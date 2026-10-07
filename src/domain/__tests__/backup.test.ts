import {
  BACKUP_FORMAT,
  BACKUP_MAX_BYTES,
  BACKUP_SCHEMA_VERSION,
  type BackupData,
  type BackupExam,
  backupFileName,
  buildBackupFile,
  canUndoReplace,
  EMPTY_SETTINGS,
  importedProfile,
  mergeBackup,
  parseBackup,
  REPLACE_UNDO_MS,
  serializeBackup,
} from '../backup';
import type { Profile } from '../profile';
import {
  type CompletedSession,
  creditAway,
  finishSession,
  onAppBackground,
  onAppForeground,
  onAppLaunch,
  pauseSession,
  resumeSession,
  skipBreak,
  startSession,
} from '../timer';

const T0 = Date.parse('2026-10-01T07:00:00Z');
const DAY_MS = 24 * 3_600_000;
const EXPORTED = T0 + DAY_MS;

function session(id: string, overrides: Partial<CompletedSession> = {}): CompletedSession {
  return {
    id,
    subjectId: 'fizik',
    topicId: 'tyt.fizik.basinc',
    startedAt: T0,
    endedAt: T0 + 3_600_000,
    pauses: [{ start: T0 + 600_000, end: T0 + 900_000, kind: 'manual' }],
    durationMs: 3_300_000,
    source: 'timer',
    ...overrides,
  };
}

function exam(id: string, overrides: Partial<BackupExam> = {}): BackupExam {
  return {
    id,
    kind: 'AYT_EA',
    scope: 'genel',
    bransSectionId: null,
    takenOn: '2026-10-02',
    createdAt: T0,
    analysisDoneAt: null,
    scores: [
      { sectionId: 'matematik', questions: 40, correct: 30, wrong: 6 },
      { sectionId: 'edebiyat', questions: 24, correct: 20, wrong: 2 },
      { sectionId: 'tarih1', questions: 10, correct: 8, wrong: 1 },
      { sectionId: 'cografya1', questions: 6, correct: 6, wrong: 0 },
    ],
    marks: [{ sectionId: 'matematik', topicId: 'ayt.matematik.fonksiyonlar', wrong: 3, blank: 1 }],
    ...overrides,
  };
}

const DATA: BackupData = {
  sessions: [session('s1'), session('s2', { source: 'manual', pauses: [], durationMs: 3_600_000, topicId: null })],
  exams: [exam('e1')],
  topicProgress: [{ topicId: 'tyt.fizik.basinc', status: 'done', updatedAt: 10 }],
  settings: {
    dailyGoalMinutes: 120,
    pomodoro: { workMin: 30, shortBreakMin: 5, longBreakMin: 15, longEvery: 4 },
    timerMode: 'pomodoro',
    examDates: { YKS: '2027-06-19' },
    netTargets: { 'TYT:matematik': 30 },
    lastSubject: 'fizik',
  },
};

const PROFILE: Profile = { birthYear: 2008, examType: 'YKS', yksArea: 'esit_agirlik', soloOnly: false, createdAt: 1 };

function fileText(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({ ...buildBackupFile(DATA, PROFILE, EXPORTED, '0.2.0'), ...overrides });
}

function parsed(text: string) {
  const result = parseBackup(text);
  if (!result.ok) throw new Error(`expected a valid backup, got ${result.error}`);
  return result.file;
}

describe('backup file format', () => {
  it('round-trips every record and setting', () => {
    const file = buildBackupFile(DATA, PROFILE, EXPORTED, '0.2.0');
    expect(file).toMatchObject({ format: BACKUP_FORMAT, schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: EXPORTED });
    expect(file.profile).toEqual({ birthYear: 2008, examType: 'YKS', yksArea: 'esit_agirlik' });
    const back = parsed(serializeBackup(file));
    expect(back).toEqual(file);
  });

  it('reads back what the timer itself records, even a session left paused for a week', () => {
    const DAY = 24 * 3_600_000;
    // Paused after an hour, finished 8 days later.
    const paused = finishSession(pauseSession(startSession('long1', 'fizik', T0), T0 + 3_600_000), T0 + 8 * DAY);
    // Sent to the background after an hour, back 8 days later.
    const away = finishSession(
      onAppForeground(onAppBackground(startSession('long2', 'kimya', T0), T0 + 3_600_000), T0 + 8 * DAY),
      T0 + 8 * DAY + 60_000,
    );
    for (const s of [paused, away]) expect(s.endedAt - s.startedAt).toBeGreaterThan(7 * DAY);
    const file = buildBackupFile({ ...DATA, sessions: [paused, away] }, PROFILE, T0 + 8 * DAY, '0.2.0');
    expect(parsed(serializeBackup(file)).sessions).toEqual([paused, away]);
  });

  it('reads back any session the timer can finish (random pause, away and pomodoro runs)', () => {
    // Small deterministic PRNG (mulberry32) so a failure is reproducible.
    let seed = 0x5eed;
    const rand = () => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const step = () => Math.floor(rand() * (rand() < 0.1 ? 9 * DAY_MS : 2 * 3_600_000));
    const sessions: CompletedSession[] = [];
    let latest = T0;
    for (let i = 0; i < 200; i++) {
      const pomodoro = rand() < 0.5 ? { workMin: 25, shortBreakMin: 5, longBreakMin: 15, longEvery: 4 } : null;
      let now = T0 + Math.floor(rand() * 30 * DAY_MS);
      let s = startSession(`r${i}`, 'fizik', now, { pomodoro });
      for (let k = Math.floor(rand() * 12); k > 0; k--) {
        now += step();
        const r = rand();
        if (r < 0.2) s = pauseSession(s, now);
        else if (r < 0.4) s = resumeSession(s, now);
        else if (r < 0.55) s = onAppBackground(s, now);
        else if (r < 0.7) s = onAppForeground(s, now);
        else if (r < 0.8) s = creditAway(s);
        else if (r < 0.9) s = skipBreak(s, now);
        else s = onAppLaunch(s, now);
      }
      now += step();
      sessions.push(finishSession(s, now));
      latest = Math.max(latest, now);
    }
    const file = buildBackupFile({ ...DATA, sessions }, PROFILE, latest, '0.2.0');
    expect(parsed(serializeBackup(file)).sessions).toEqual(sessions);
    // The clock may be right when recording and behind when backing up (or the other way round).
    const early = buildBackupFile({ ...DATA, sessions }, PROFILE, T0 - 30 * DAY_MS, '0.2.0');
    expect(parsed(serializeBackup(early)).sessions).toEqual(sessions);
  });

  it('reads back a session recorded while the clock was days ahead, backed up after it was fixed', () => {
    const ahead = finishSession(startSession('ahead', 'fizik', EXPORTED + 2 * DAY_MS), EXPORTED + 2 * DAY_MS + 1_000);
    const file = buildBackupFile({ ...DATA, sessions: [ahead] }, PROFILE, EXPORTED, '0.2.0');
    const result = parseBackup(serializeBackup(file));
    expect(result).toMatchObject({ ok: true, skippedSessions: 0 });
    expect(result.ok && result.file.sessions).toEqual([ahead]);
  });

  it('a wrong-clock session is left out and counted, the rest of the file still loads', () => {
    const skip = (bad: CompletedSession) => {
      const result = parseBackup(fileText({ sessions: [session('ok'), bad] }));
      if (!result.ok) throw new Error(result.error);
      return { kept: result.file.sessions.map((s) => s.id), skipped: result.skippedSessions };
    };
    const want = { kept: ['ok'], skipped: 1 };
    // Clock reset to 2001 / 2015.
    expect(skip(finishSession(startSession('old', 'fizik', Date.UTC(2001, 0, 1)), Date.UTC(2001, 0, 1, 1)))).toEqual(want);
    expect(skip(session('old', { startedAt: Date.UTC(2015, 5, 1), endedAt: Date.UTC(2015, 5, 1, 1), pauses: [] }))).toEqual(want);
    // Year 11476: would make a day-by-day walk run ~3.5 million days.
    expect(skip(session('far', { endedAt: 3e14 }))).toEqual(want);
    // Clock jumped decades ahead mid-session (2016 → 2099): longer than a year.
    expect(skip(session('long', { startedAt: Date.UTC(2016, 0, 2), endedAt: Date.UTC(2099, 10, 30), pauses: [] }))).toEqual(want);
    // A malformed session still rejects the whole file.
    expect(parseBackup(fileText({ sessions: [session('ok'), session('bad', { endedAt: T0 - 1 })] }))).toEqual({
      ok: false,
      error: 'invalid',
    });
  });

  it('the file date is only shown, any date a clock can show is accepted', () => {
    const error = (overrides: Record<string, unknown>) => {
      const result = parseBackup(fileText(overrides));
      return result.ok ? null : result.error;
    };
    expect(error({ exportedAt: 0 })).toBeNull();
    expect(error({ exportedAt: Date.UTC(2100, 0, 2) })).toBeNull();
    expect(error({ exportedAt: 9e15 })).toBe('invalid');
    expect(error({ exportedAt: -1 })).toBe('invalid');
  });

  it('file name carries the day', () => {
    expect(backupFileName('2026-10-04')).toBe('etut-yedek-2026-10-04.json');
  });

  it('accepts a UTF-8 BOM and missing optional parts', () => {
    const minimal = JSON.stringify({
      format: BACKUP_FORMAT,
      schemaVersion: 1,
      exportedAt: T0,
      sessions: [],
      exams: [],
      topicProgress: [],
    });
    const file = parsed('﻿' + minimal);
    expect(file.profile).toBeNull();
    expect(file.settings).toEqual(EMPTY_SETTINGS);
  });
});

describe('backup validation', () => {
  const error = (text: string) => {
    const result = parseBackup(text);
    return result.ok ? null : result.error;
  };

  it('tells apart non-JSON, other JSON, newer versions and too large files', () => {
    expect(error('not json')).toBe('not_json');
    expect(error('{"a":1}')).toBe('not_backup');
    expect(error('[]')).toBe('not_backup');
    expect(error(fileText({ schemaVersion: BACKUP_SCHEMA_VERSION + 1 }))).toBe('too_new');
    expect(error(fileText({ schemaVersion: 0 }))).toBe('invalid');
    expect(error(fileText({ schemaVersion: '1' }))).toBe('invalid');
    expect(error(' '.repeat(BACKUP_MAX_BYTES + 1))).toBe('too_large');
  });

  it.each([
    ['duplicate session id', { sessions: [session('x'), session('x')] }],
    ['session ending before it starts', { sessions: [session('x', { endedAt: T0 - 1 })] }],
    ['duration longer than the session', { sessions: [session('x', { durationMs: 3_600_001 })] }],
    ['unknown source', { sessions: [{ ...session('x'), source: 'server' }] }],
    ['id with odd characters', { sessions: [session('x"; DROP TABLE')] }],
    ['paper that is not text', { exams: [{ ...exam('e'), kind: 42 }] }],
    ['question count that is not a number', { exams: [exam('e', { scores: [{ sectionId: 'matematik', questions: '40', correct: 1, wrong: 0 } as never] })] }],
    ['duplicate section in an exam', { exams: [exam('e', { scores: [exam('e').scores[0], exam('e').scores[0]] })] }],
    ['correct + wrong above the questions', { exams: [exam('e', { scores: [...exam('e').scores.slice(1), { sectionId: 'matematik', questions: 40, correct: 35, wrong: 6 }] })] }],
    ['more tagged wrong answers than wrong answers', { exams: [exam('e', { marks: [{ sectionId: 'matematik', topicId: 't', wrong: 7, blank: 0 }] })] }],
    ['mark on a section the exam does not have', { exams: [exam('e', { marks: [{ sectionId: 'fizik', topicId: 't', wrong: 1, blank: 0 }] })] }],
    ['branch exam without its section', { exams: [exam('e', { scope: 'brans', bransSectionId: null })] }],
    ['unknown topic status', { topicProgress: [{ topicId: 't', status: 'maybe', updatedAt: 1 }] }],
    ['net target that is not a number', { settings: { netTargets: { 'TYT:fizik': '5' } } }],
    ['net target key without a section', { settings: { netTargets: { TYT: 5 } } }],
    ['net target not a multiple of 0.25', { settings: { netTargets: { 'TYT:matematik': 10.1 } } }],
    ['bad exam date', { settings: { examDates: { YKS: '19.06.2027' } } }],
    ['exam date not on the calendar', { settings: { examDates: { YKS: '2026-00-00' } } }],
    ['exam taken on a day that does not exist', { exams: [exam('e', { takenOn: '2026-99-99' })] }],
    ['exam taken on 30 February', { exams: [exam('e', { takenOn: '2026-02-30' })] }],
    ['bad birth year', { profile: { birthYear: 'iki bin', examType: 'YKS', yksArea: 'sayisal' } }],
    ['YKS profile without an area', { profile: { birthYear: 2008, examType: 'YKS', yksArea: null } }],
  ])('rejects the whole file: %s', (_name, overrides) => {
    expect(error(fileText(overrides))).toBe('invalid');
  });

  it('an old file whose exams no longer fit the exam tables still loads; only those exams are left out', () => {
    // E.g. ÖSYM changed a question count after the file was made, or a paper/section was dropped.
    const result = parseBackup(
      fileText({
        exams: [
          exam('ok'),
          exam('count', { scores: [{ sectionId: 'matematik', questions: 41, correct: 1, wrong: 0 }, ...exam('e').scores.slice(1)] }),
          exam('missing', { scores: exam('e').scores.slice(1), marks: [] }),
          { ...exam('paper'), kind: 'AYT_XYZ' },
          exam('gone', { scope: 'brans', bransSectionId: 'astronomi', scores: [{ sectionId: 'astronomi', questions: 10, correct: 5, wrong: 0 }], marks: [] }),
        ],
        settings: { ...DATA.settings, netTargets: { 'TYT:matematik': 30, 'TYT:fizik': 8, 'XYZ:matematik': 5, 'TYT:astronomi': 2 } },
      }),
    );
    if (!result.ok) throw new Error(result.error);
    expect(result.file.exams.map((e) => e.id)).toEqual(['ok']);
    expect(result.skippedExams).toBe(4);
    expect(result.file.settings.netTargets).toEqual({ 'TYT:matematik': 30 });
    expect(result.skippedTargets).toBe(3);
    // Sessions, topics and the other settings are all there.
    expect(result.file.sessions).toHaveLength(DATA.sessions.length);
    expect(result.file.topicProgress).toEqual(DATA.topicProgress);
    expect(result.file.settings.dailyGoalMinutes).toBe(120);
    expect(result.skippedSessions).toBe(0);
  });

  it('a current file skips nothing', () => {
    expect(parseBackup(fileText())).toMatchObject({ ok: true, skippedSessions: 0, skippedExams: 0, skippedTargets: 0 });
  });

  it('"Geri al" copy: wrong-clock sessions are kept when asked', () => {
    const old = session('old', { startedAt: Date.UTC(2001, 0, 1), endedAt: Date.UTC(2001, 0, 1, 1), pauses: [], durationMs: 3_600_000 });
    const text = fileText({ sessions: [session('ok'), old] });
    expect(parseBackup(text)).toMatchObject({ ok: true, skippedSessions: 1 });
    const kept = parseBackup(text, { keepWrongClockSessions: true });
    expect(kept.ok && kept.file.sessions.map((s) => s.id)).toEqual(['ok', 'old']);
  });

  it('"Geri al" is offered for a day after the replace', () => {
    expect(canUndoReplace(T0, T0)).toBe(true);
    expect(canUndoReplace(T0, T0 + REPLACE_UNDO_MS - 1)).toBe(true);
    expect(canUndoReplace(T0, T0 + REPLACE_UNDO_MS)).toBe(false);
    // A clock set back before the copy: not offered (it may be from another day).
    expect(canUndoReplace(T0, T0 - 1)).toBe(false);
  });

  it('a branch exam has exactly its section', () => {
    const brans = exam('b', {
      scope: 'brans',
      bransSectionId: 'tarih1',
      scores: [{ sectionId: 'tarih1', questions: 10, correct: 5, wrong: 2 }],
      marks: [],
    });
    expect(parsed(fileText({ exams: [brans] })).exams[0].bransSectionId).toBe('tarih1');
  });

  it('pauses outside the session are clipped, old pauses without a kind become manual', () => {
    const odd = { ...session('x'), pauses: [{ start: T0 - 5000, end: T0 + 1000 }] };
    expect(parsed(fileText({ sessions: [odd] })).sessions[0].pauses).toEqual([
      { start: T0, end: T0 + 1000, kind: 'manual' },
    ]);
  });

  it('settings are normalised (goal and pomodoro clamped into range)', () => {
    const file = parsed(
      fileText({
        settings: { dailyGoalMinutes: 5, pomodoro: { workMin: 500, shortBreakMin: 5, longBreakMin: 15, longEvery: 4 } },
      }),
    );
    expect(file.settings.dailyGoalMinutes).toBe(15);
    expect(file.settings.pomodoro?.workMin).toBe(120);
  });
});

describe('merging a backup', () => {
  const device: BackupData = {
    sessions: [session('s1', { subjectId: 'kimya' }), session('d1')],
    exams: [exam('e1', { takenOn: '2026-09-30' })],
    topicProgress: [
      { topicId: 'tyt.fizik.basinc', status: 'review', updatedAt: 20 },
      { topicId: 'only.here', status: 'done', updatedAt: 1 },
    ],
    settings: { ...EMPTY_SETTINGS, dailyGoalMinutes: 60, examDates: { LGS: '2027-06-13' } },
  };

  it('merge: this device wins on the same id, missing records are added', () => {
    const merged = mergeBackup(device, DATA, 'merge');
    expect(merged.sessions.map((s) => s.id)).toEqual(['s1', 'd1', 's2']);
    expect(merged.sessions[0].subjectId).toBe('kimya');
    expect(merged.exams).toHaveLength(1);
    expect(merged.exams[0].takenOn).toBe('2026-09-30');
  });

  it('merge: the newer topic mark wins', () => {
    const merged = mergeBackup(device, DATA, 'merge');
    expect(merged.topicProgress).toEqual(
      expect.arrayContaining([
        { topicId: 'tyt.fizik.basinc', status: 'review', updatedAt: 20 },
        { topicId: 'only.here', status: 'done', updatedAt: 1 },
      ]),
    );
    const newer = mergeBackup(device, { ...DATA, topicProgress: [{ topicId: 'tyt.fizik.basinc', status: 'done', updatedAt: 30 }] }, 'merge');
    expect(newer.topicProgress.find((t) => t.topicId === 'tyt.fizik.basinc')?.status).toBe('done');
  });

  it('merge: settings set here stay, missing ones come from the file', () => {
    const { settings } = mergeBackup(device, DATA, 'merge');
    expect(settings.dailyGoalMinutes).toBe(60);
    expect(settings.pomodoro).toEqual(DATA.settings.pomodoro);
    expect(settings.examDates).toEqual({ YKS: '2027-06-19', LGS: '2027-06-13' });
    expect(settings.netTargets).toEqual({ 'TYT:matematik': 30 });
  });

  it('is idempotent: importing the same file again changes nothing', () => {
    for (const mode of ['merge', 'replace'] as const) {
      const once = mergeBackup(device, DATA, mode);
      expect(mergeBackup(once, DATA, mode)).toEqual(once);
    }
  });

  it('replace: exactly the file data', () => {
    expect(mergeBackup(device, DATA, 'replace')).toEqual(DATA);
  });
});

describe('K-17: the age on import', () => {
  const year = 2026;
  const adult: Profile = { birthYear: 2000, examType: 'YKS', yksArea: 'sayisal', soloOnly: false, createdAt: 7 };

  it('an older age in the file is ignored', () => {
    expect(importedProfile(adult, { birthYear: 1980, examType: 'KPSS', yksArea: null }, 'merge', year)).toEqual(adult);
  });

  it('a younger age in the file wins (the lower age), and can only turn groups off', () => {
    const next = importedProfile(adult, { birthYear: 2014, examType: 'YKS', yksArea: 'sayisal' }, 'merge', year);
    expect(next).toMatchObject({ birthYear: 2014, soloOnly: true, createdAt: 7 });
  });

  it('an under-15 device stays under 15 whatever the file says', () => {
    const child: Profile = { birthYear: 2013, examType: 'LGS', yksArea: null, soloOnly: true, createdAt: 1 };
    const next = importedProfile(child, { birthYear: 1990, examType: 'YKS', yksArea: 'sozel' }, 'replace', year);
    expect(next).toMatchObject({ birthYear: 2013, soloOnly: true });
    // Replace takes the exam and area (settings, not age data).
    expect(next).toMatchObject({ examType: 'YKS', yksArea: 'sozel' });
  });

  it('a birth year the picker can not offer (edited file) is ignored, it does not lock the age', () => {
    for (const birthYear of [2200, 2025, year - 7]) {
      const next = importedProfile(adult, { birthYear, examType: 'YKS', yksArea: 'sayisal' }, 'merge', year);
      expect(next).toEqual(adult);
    }
    // The youngest year the picker offers still counts (lower age wins).
    expect(importedProfile(adult, { birthYear: year - 8, examType: 'YKS', yksArea: 'sayisal' }, 'merge', year)).toMatchObject({
      birthYear: year - 8,
      soloOnly: true,
    });
  });

  it('merge keeps the exam of this device; a file without a profile changes nothing', () => {
    expect(importedProfile(adult, { birthYear: 2000, examType: 'KPSS', yksArea: null }, 'merge', year).examType).toBe('YKS');
    expect(importedProfile(adult, null, 'replace', year)).toEqual(adult);
  });
});
