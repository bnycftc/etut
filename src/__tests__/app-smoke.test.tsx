/**
 * Smoke test of the real screens with expo-router's test renderer. Storage is replaced by
 * in-memory fakes (SQLite cannot run under Jest); everything else is the app code as shipped.
 */

import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import { Vibration } from 'react-native';

import type { TopicMark } from '../domain/exam-analysis';
import type { Profile } from '../domain/profile';
import type { ActiveSession, CompletedSession } from '../domain/timer';
import type { MockExamWithScores } from '../storage/mock-exams';

const memory: {
  profile: Profile | null;
  active: ActiveSession | null;
  sessions: CompletedSession[];
  /** K-17 record; survives "delete all data" like the real separate store. */
  youngestBirthYear: number | null;
  dailyGoal: number | null;
  timerMode: 'stopwatch' | 'pomodoro';
  pomodoroConfig: { workMin: number; shortBreakMin: number; longBreakMin: number; longEvery: number };
  topicStatuses: Record<string, 'done' | 'review'>;
  exams: MockExamWithScores[];
  marks: Record<string, TopicMark[]>;
  examDates: Record<string, string>;
  netTargets: Record<string, number>;
} = {
  profile: null,
  active: null,
  sessions: [],
  youngestBirthYear: null,
  dailyGoal: null,
  timerMode: 'stopwatch',
  pomodoroConfig: { workMin: 25, shortBreakMin: 5, longBreakMin: 15, longEvery: 4 },
  topicStatuses: {},
  exams: [],
  marks: {},
  examDates: {},
  netTargets: {},
};

jest.mock('../storage/kv', () => ({
  loadProfile: () => memory.profile,
  storeProfile: (p: Profile) => {
    memory.profile = p;
  },
  loadActiveSession: () => memory.active,
  storeActiveSession: (s: ActiveSession | null) => {
    memory.active = s;
  },
  loadLastSubject: () => null,
  storeLastSubject: () => {},
  loadDailyGoal: () => memory.dailyGoal,
  storeDailyGoal: (m: number | null) => {
    memory.dailyGoal = m;
  },
  loadPomodoroConfig: () => memory.pomodoroConfig,
  storePomodoroConfig: (c: typeof memory.pomodoroConfig) => {
    memory.pomodoroConfig = c;
  },
  loadTimerMode: () => memory.timerMode,
  storeTimerMode: (m: 'stopwatch' | 'pomodoro') => {
    memory.timerMode = m;
  },
  loadCustomExamDate: (t: string) => memory.examDates[t] ?? null,
  storeCustomExamDate: (t: string, day: string | null) => {
    if (day === null) delete memory.examDates[t];
    else memory.examDates[t] = day;
  },
  loadNetTargets: () => memory.netTargets,
  storeNetTarget: (key: string, value: number | null) => {
    if (value === null) delete memory.netTargets[key];
    else memory.netTargets[key] = value;
  },
  wipeKeyValueStore: () => {
    memory.profile = null;
    memory.active = null;
    memory.dailyGoal = null;
    memory.examDates = {};
    memory.netTargets = {};
  },
}));

jest.mock('../storage/age-guard', () => ({
  loadYoungestDeclaredBirthYear: () => memory.youngestBirthYear,
  storeYoungestDeclaredBirthYear: (y: number | null) => {
    memory.youngestBirthYear = y;
  },
}));

jest.mock('../storage/sessions', () => ({
  saveSession: (s: CompletedSession) => {
    memory.sessions = [...memory.sessions.filter((x) => x.id !== s.id), s];
  },
  sessionsOverlapping: (from: number, to: number) =>
    memory.sessions.filter((s) => s.endedAt > from && s.startedAt < to),
  recentManualSessions: () => memory.sessions.filter((s) => s.source === 'manual').reverse(),
  deleteManualSession: (id: string) => {
    memory.sessions = memory.sessions.filter((s) => !(s.id === id && s.source === 'manual'));
  },
  topicTotals: () => {
    const out: Record<string, number> = {};
    for (const s of memory.sessions) {
      if (s.topicId) out[s.topicId] = (out[s.topicId] ?? 0) + s.durationMs;
    }
    return out;
  },
}));

jest.mock('../storage/topics', () => ({
  loadTopicStatuses: () => memory.topicStatuses,
  setTopicStatus: (id: string, status: 'done' | 'review' | null) => {
    const next = { ...memory.topicStatuses };
    if (status === null) delete next[id];
    else next[id] = status;
    memory.topicStatuses = next;
  },
}));

jest.mock('../storage/mock-exams', () => ({
  listMockExams: () => memory.exams,
  listExamsNeedingAnalysis: () =>
    memory.exams.filter(
      (e) => e.analysisDoneAt === null && e.scores.some((s) => s.questions - s.correct > 0),
    ),
  getMockExam: (id: string) => memory.exams.find((e) => e.id === id) ?? null,
  saveMockExam: () => {},
  deleteMockExam: () => {},
  getExamMarks: (id: string) => memory.marks[id] ?? [],
  listAllMarks: () => Object.values(memory.marks).flat(),
  saveExamAnalysis: (id: string, marks: TopicMark[], now: number) => {
    memory.marks[id] = marks.filter((m) => m.wrong + m.blank > 0);
    memory.exams = memory.exams.map((e) => (e.id === id ? { ...e, analysisDoneAt: now } : e));
  },
  sectionNetHistory: (kind: string, sectionId: string) =>
    memory.exams
      .filter((e) => e.kind === kind)
      .flatMap((e) =>
        e.scores
          .filter((s) => s.sectionId === sectionId)
          .map((s) => ({ examId: e.id, takenOn: e.takenOn, scope: e.scope, net: s.correct - s.wrong / 4 })),
      ),
}));

jest.mock('../storage/db', () => ({
  newId: () => 'test-id',
  getDb: () => {
    throw new Error('no SQLite in tests');
  },
  wipeDatabase: () => {
    memory.sessions = [];
  },
}));

const APP_DIR = './app';

beforeEach(() => {
  memory.profile = null;
  memory.active = null;
  memory.sessions = [];
  memory.youngestBirthYear = null;
  memory.dailyGoal = null;
  memory.timerMode = 'stopwatch';
  memory.pomodoroConfig = { workMin: 25, shortBreakMin: 5, longBreakMin: 15, longEvery: 4 };
  memory.topicStatuses = {};
  memory.exams = [];
  memory.marks = {};
  memory.examDates = {};
  memory.netTargets = {};
});

it('first launch shows onboarding with no birth year pre-selected', () => {
  renderRouter(APP_DIR, { initialUrl: '/' });
  expect(screen.getByText('Doğum yılın')).toBeTruthy();
  const start = screen.getByRole('button', { name: 'Başla' });
  expect(start.props.accessibilityState?.disabled ?? start.props['aria-disabled']).toBeTruthy();
});

it('completing onboarding opens the timer; an under-15 profile has no groups tab', () => {
  const year = new Date().getUTCFullYear() - 12;
  renderRouter(APP_DIR, { initialUrl: '/' });
  fireEvent.press(screen.getByText(String(year)));
  fireEvent.press(screen.getByText('LGS'));
  fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
  expect(memory.profile?.soloOnly).toBe(true);
  expect(screen.getByText('Ders seç')).toBeTruthy();
  expect(screen.queryByText('Gruplar')).toBeNull();
});

it('a 15+ profile sees the groups tab; start, pause, finish saves a session', () => {
  memory.profile = {
    birthYear: 2000,
    examType: 'YKS',
    yksArea: 'sayisal',
    soloOnly: false,
    createdAt: 0,
  };
  renderRouter(APP_DIR, { initialUrl: '/' });
  expect(screen.getByText('Gruplar')).toBeTruthy();
  fireEvent.press(screen.getByText('Fizik'));
  fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
  expect(memory.active?.subjectId).toBe('fizik');
  fireEvent.press(screen.getByRole('button', { name: 'Mola' }));
  expect(screen.getByText('Moladasın')).toBeTruthy();
  fireEvent.press(screen.getByRole('button', { name: 'Devam' }));
  act(() => jest.advanceTimersByTime(65_000));
  fireEvent.press(screen.getByRole('button', { name: 'Bitir' }));
  expect(memory.active).toBeNull();
  expect(memory.sessions).toHaveLength(1);
  expect(memory.sessions[0].subjectId).toBe('fizik');
  expect(memory.sessions[0].durationMs).toBeGreaterThanOrEqual(65_000);
  expect(screen.getByText('Ders seç')).toBeTruthy();
});

const ADULT_SAYISAL: Profile = {
  birthYear: 2000,
  examType: 'YKS',
  yksArea: 'sayisal',
  soloOnly: false,
  createdAt: 0,
};

describe('topic tracking', () => {
  beforeEach(() => {
    memory.profile = ADULT_SAYISAL;
  });

  it('the optional topic picked on the timer is saved with the session', () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(screen.getByText('Fizik'));
    fireEvent.press(screen.getByTestId('topic-picker-toggle'));
    fireEvent.press(screen.getByTestId('topic-tyt.fizik.basinc'));
    expect(screen.getByText('Basınç')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
    expect(memory.active?.topicId).toBe('tyt.fizik.basinc');
    act(() => jest.advanceTimersByTime(61_000));
    fireEvent.press(screen.getByRole('button', { name: 'Bitir' }));
    expect(memory.sessions[0]).toMatchObject({ topicId: 'tyt.fizik.basinc', source: 'timer' });
  });

  it('changing the subject clears the topic', () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(screen.getByText('Fizik'));
    fireEvent.press(screen.getByTestId('topic-picker-toggle'));
    fireEvent.press(screen.getByTestId('topic-tyt.fizik.basinc'));
    fireEvent.press(screen.getByText('Kimya'));
    fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
    expect(memory.active).toMatchObject({ subjectId: 'kimya', topicId: null });
  });

  it('topics screen: "bitti" raises the progress, tapping again clears it', () => {
    memory.sessions = [
      {
        id: 's',
        subjectId: 'fizik',
        topicId: 'tyt.fizik.basinc',
        startedAt: 0,
        endedAt: 45 * 60_000,
        pauses: [],
        durationMs: 45 * 60_000,
        source: 'timer',
      },
    ];
    renderRouter(APP_DIR, { initialUrl: '/konular' });
    fireEvent.press(screen.getByTestId('topics-subject-fizik'));
    expect(screen.getByText('45 dk')).toBeTruthy();
    const before = screen.getByTestId('topics-progress').props.children as string;
    expect(before.startsWith('%0 · 0/')).toBe(true);
    fireEvent.press(screen.getByTestId('topic-done-tyt.fizik.basinc'));
    expect(memory.topicStatuses['tyt.fizik.basinc']).toBe('done');
    expect(screen.getByTestId('topics-progress').props.children).toMatch(/^%\d+ · 1\//);
    fireEvent.press(screen.getByTestId('topic-done-tyt.fizik.basinc'));
    expect(memory.topicStatuses['tyt.fizik.basinc']).toBeUndefined();
    fireEvent.press(screen.getByTestId('topic-review-tyt.fizik.basinc'));
    expect(screen.getByText('1 konu tekrar bekliyor')).toBeTruthy();
  });
});

describe('manual entry ("elle")', () => {
  beforeEach(() => {
    memory.profile = ADULT_SAYISAL;
  });

  function fill(hour: string, minute: string, hours: string, minutes: string) {
    fireEvent.changeText(screen.getByTestId('manual-start-hour'), hour);
    fireEvent.changeText(screen.getByTestId('manual-start-minute'), minute);
    fireEvent.changeText(screen.getByTestId('manual-duration-hours'), hours);
    fireEvent.changeText(screen.getByTestId('manual-duration-minutes'), minutes);
    fireEvent.press(screen.getByTestId('manual-add'));
  }

  it('adds a past session labelled "elle", refuses overlaps and over-long entries', () => {
    renderRouter(APP_DIR, { initialUrl: '/elle-ekle' });
    fireEvent.press(screen.getByTestId('manual-subject-kimya'));
    fireEvent.press(screen.getByTestId('manual-prev-day'));
    fill('10', '00', '0', '45');
    expect(memory.sessions).toHaveLength(1);
    expect(memory.sessions[0]).toMatchObject({ subjectId: 'kimya', source: 'manual', durationMs: 45 * 60_000 });
    expect(screen.getByTestId('manual-added').props.children).toBe('Eklendi: 45 dk (elle)');
    expect(screen.getAllByText('elle').length).toBeGreaterThan(0);

    fill('10', '30', '1', '0');
    expect(screen.getByTestId('manual-error').props.children).toBe('Bu saatlerde başka bir çalışma kaydın var.');
    expect(memory.sessions).toHaveLength(1);

    fill('11', '00', '10', '1');
    expect(screen.getByTestId('manual-error').props.children).toBe('Tek kayıt en fazla 10 saat olabilir.');

    fill('25', '00', '1', '0');
    expect(screen.getByTestId('manual-error').props.children).toBe('Başlangıç saatini ve süreyi kontrol et.');

    const id = memory.sessions[0].id;
    fireEvent.press(screen.getByTestId(`manual-delete-${id}`));
    fireEvent.press(screen.getByTestId(`manual-delete-yes-${id}`));
    expect(memory.sessions).toHaveLength(0);
  });

  it('only the last 7 days can be chosen', () => {
    renderRouter(APP_DIR, { initialUrl: '/elle-ekle' });
    const prev = screen.getByTestId('manual-prev-day');
    for (let i = 0; i < 6; i++) fireEvent.press(screen.getByTestId('manual-prev-day'));
    const disabled = (el: typeof prev) => el.props.accessibilityState?.disabled ?? el.props['aria-disabled'];
    expect(disabled(screen.getByTestId('manual-prev-day'))).toBeTruthy();
  });

  it('a future time is refused', () => {
    renderRouter(APP_DIR, { initialUrl: '/elle-ekle' });
    // Today, ending 23:59 + 10 h is always after now.
    fill('23', '59', '10', '0');
    expect(screen.getByTestId('manual-error').props.children).toBe('Henüz gelmemiş bir zaman eklenemez.');
  });

  it('history shows the manual part of a day', () => {
    const now = Date.now();
    memory.sessions = [
      {
        id: 'm',
        subjectId: 'fizik',
        topicId: null,
        startedAt: now - 3 * 3_600_000,
        endedAt: now - 3 * 3_600_000 + 30 * 60_000,
        pauses: [],
        durationMs: 30 * 60_000,
        source: 'manual',
      },
    ];
    renderRouter(APP_DIR, { initialUrl: '/gecmis' });
    expect(screen.getByText('Elle eklenen: 30 dk')).toBeTruthy();
  });
});

describe('mock exam analysis', () => {
  beforeEach(() => {
    memory.profile = ADULT_SAYISAL;
    memory.exams = [
      {
        id: 'e1',
        kind: 'TYT',
        scope: 'genel',
        bransSectionId: null,
        takenOn: '2026-10-01',
        totalNet: 68.5,
        createdAt: 1,
        analysisDoneAt: null,
        scores: [
          { sectionId: 'turkce', questions: 40, correct: 40, wrong: 0 },
          { sectionId: 'matematik', questions: 40, correct: 30, wrong: 6 },
        ],
      },
    ];
  });

  it('reminds about the pending analysis, tags topics and then drops the reminder', () => {
    renderRouter(APP_DIR, { initialUrl: '/denemeler' });
    expect(screen.getByTestId('analysis-reminder').props.children).toBe('Analizi bekleyen 1 deneme var');
    expect(screen.getByText('analiz bekliyor')).toBeTruthy();
    fireEvent.press(screen.getByTestId('analysis-reminder-start'));

    // Only the section with wrong/blank answers is offered.
    expect(screen.queryByTestId('analysis-tagged-turkce')).toBeNull();
    expect(screen.getByTestId('analysis-tagged-matematik').props.children).toBe(
      'İşaretlenen: 0/6 yanlış · 0/4 boş',
    );
    fireEvent.press(screen.getByTestId('analysis-add-topic-matematik'));
    fireEvent.press(screen.getByTestId('analysis-add-tyt.matematik.mutlak-deger'));
    fireEvent.press(screen.getByTestId('analysis-wrong-tyt.matematik.mutlak-deger-plus'));
    fireEvent.press(screen.getByTestId('analysis-wrong-tyt.matematik.mutlak-deger-plus'));
    fireEvent.press(screen.getByTestId('analysis-blank-tyt.matematik.mutlak-deger-plus'));
    expect(screen.getByTestId('analysis-tagged-matematik').props.children).toBe(
      'İşaretlenen: 3/6 yanlış · 1/4 boş',
    );
    fireEvent.press(screen.getByTestId('analysis-save'));

    expect(memory.marks.e1).toEqual([
      { sectionId: 'matematik', topicId: 'tyt.matematik.mutlak-deger', wrong: 3, blank: 1 },
    ]);
    expect(memory.exams[0].analysisDoneAt).not.toBeNull();
    expect(screen.queryByTestId('analysis-reminder')).toBeNull();
    expect(screen.getByText('1. Mutlak Değer')).toBeTruthy();
    expect(screen.getByText('3 Y · 1 B')).toBeTruthy();
  });

  it('the plus button stops at the section wrong count', () => {
    renderRouter(APP_DIR, { initialUrl: '/analiz/e1' });
    fireEvent.press(screen.getByTestId('analysis-add-topic-matematik'));
    fireEvent.press(screen.getByTestId('analysis-add-tyt.matematik.mutlak-deger'));
    for (let i = 0; i < 10; i++) {
      fireEvent.press(screen.getByTestId('analysis-wrong-tyt.matematik.mutlak-deger-plus'));
    }
    expect(screen.getByTestId('analysis-tagged-matematik').props.children).toBe(
      'İşaretlenen: 6/6 yanlış · 0/4 boş',
    );
  });

  it('per-section net trend with a target and the distance to it', () => {
    renderRouter(APP_DIR, { initialUrl: '/denemeler' });
    fireEvent.press(screen.getByTestId('trend-section-matematik'));
    expect(screen.getByTestId('trend-target').props.children).toBe('Bu ders için hedef koymadın.');
    fireEvent.changeText(screen.getByTestId('trend-target-input'), '45');
    fireEvent.press(screen.getByTestId('trend-target-save'));
    expect(screen.getByText('0’dan büyük, en fazla 40 olan ve 0,25’in katı bir net gir (ör. 32,5).')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('trend-target-input'), '30');
    fireEvent.press(screen.getByTestId('trend-target-save'));
    expect(memory.netTargets['TYT:matematik']).toBe(30);
    expect(screen.getByTestId('trend-target').props.children).toBe('Hedef: 30 net');
    expect(screen.getByTestId('trend-gap').props.children).toBe(
      'Hedefe 1,5 net kaldı (son denemelerin ortalaması: 28,5).',
    );
  });
});

describe('goal, streak and "dünkü sen"', () => {
  const at = (iso: string) => Date.parse(iso);
  const session = (id: string, startIso: string, endIso: string, source: 'timer' | 'manual' = 'timer') => ({
    id,
    subjectId: 'fizik',
    topicId: null,
    startedAt: at(startIso),
    endedAt: at(endIso),
    pauses: [],
    durationMs: at(endIso) - at(startIso),
    source,
  });

  beforeEach(() => {
    memory.profile = ADULT_SAYISAL;
    jest.setSystemTime(at('2026-10-07T09:00:00Z')); // Wednesday 12:00 Istanbul
    memory.sessions = [
      session('lw', '2026-09-30T07:00:00Z', '2026-09-30T07:30:00Z'), // last Wednesday
      session('mon', '2026-10-05T07:00:00Z', '2026-10-05T08:00:00Z'),
      session('tue', '2026-10-06T07:00:00Z', '2026-10-06T08:00:00Z'),
      session('tue-late', '2026-10-06T12:00:00Z', '2026-10-06T13:00:00Z'), // after "same time"
      session('wed', '2026-10-07T07:00:00Z', '2026-10-07T08:00:00Z', 'manual'),
    ];
  });

  it('home shows goal progress, streak and comparisons with own past', () => {
    memory.dailyGoal = 60;
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(screen.getByTestId('goal-progress').props.children).toBe('Bugünkü hedefini tutturdun.');
    expect(screen.getByTestId('streak').props.children).toBe('Seri: 3 gün');
    expect(screen.getByTestId('compare-yesterday').props.children).toBe('1 sa 0 dk');
    expect(screen.getByTestId('compare-last-week').props.children).toBe('30 dk');
    expect(screen.getByText('1 sa 0 dk elle eklendi')).toBeTruthy();
  });

  it('without a goal, the home screen offers to set one in settings', () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(screen.queryByTestId('streak')).toBeNull();
    fireEvent.press(screen.getByTestId('goal-set'));
    fireEvent.press(screen.getByTestId('settings-goal-on'));
    expect(memory.dailyGoal).toBe(120);
    fireEvent.press(screen.getByTestId('settings-goal-plus'));
    expect(memory.dailyGoal).toBe(135);
    fireEvent.press(screen.getByTestId('settings-goal-off'));
    expect(memory.dailyGoal).toBeNull();
  });

  it('weekly summary: total, longest session, previous week', () => {
    memory.dailyGoal = 60;
    renderRouter(APP_DIR, { initialUrl: '/haftalik' });
    expect(screen.getByTestId('weekly-total').props.children).toBe('4 sa 0 dk');
    expect(screen.getByText('Önceki hafta: 30 dk')).toBeTruthy();
    expect(screen.getByText('Hedefi tutturduğun gün: 3/7')).toBeTruthy();
    expect(screen.getByText('Elle eklenen: 1 sa 0 dk')).toBeTruthy();
    fireEvent.press(screen.getByTestId('weekly-prev'));
    expect(screen.getByTestId('weekly-total').props.children).toBe('30 dk');
  });
});

describe('pomodoro mode', () => {
  beforeEach(() => {
    memory.profile = ADULT_SAYISAL;
  });

  /** Jumps the clock and lets the 1 s render interval fire once. */
  function jump(ms: number) {
    act(() => {
      jest.setSystemTime(Date.now() + ms);
      jest.advanceTimersByTime(1000);
    });
  }

  it('counts down the work block, switches to a break, and the break is not study time', () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(screen.getByTestId('mode-pomodoro'));
    expect(memory.timerMode).toBe('pomodoro');
    expect(screen.getByText(/25 dk çalışma · 5 dk mola/)).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
    expect(memory.active?.pomodoro?.config.workMin).toBe(25);
    expect(screen.getByTestId('pomodoro-phase').props.children).toBe('Çalışma 1/4');
    const vibrate = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => {});

    // Work block ends while the screen is open (tick by tick): one vibration.
    jump(25 * 60_000 - 2000);
    expect(screen.getByTestId('pomodoro-phase').props.children).toBe('Çalışma 1/4');
    act(() => jest.advanceTimersByTime(1000));
    expect(screen.getByTestId('pomodoro-phase').props.children).toBe('Kısa mola');
    expect(vibrate).toHaveBeenCalledTimes(1);

    // "Molayı geç" changes the phase without vibrating.
    jump(2 * 60_000);
    fireEvent.press(screen.getByTestId('pomodoro-skip'));
    expect(screen.getByTestId('pomodoro-phase').props.children).toBe('Çalışma 2/4');
    act(() => jest.advanceTimersByTime(1000));
    expect(vibrate).toHaveBeenCalledTimes(1);

    jump(60_000);
    fireEvent.press(screen.getByRole('button', { name: 'Bitir' }));

    const saved = memory.sessions[0];
    // ~25 + ~1 min of work; the ~2 min break is a stored pause of kind "break".
    expect(saved.durationMs).toBeGreaterThanOrEqual(26 * 60_000);
    expect(saved.durationMs).toBeLessThan(27 * 60_000);
    expect(saved.pauses.some((p) => p.kind === 'break')).toBe(true);
    vibrate.mockRestore();
  });

  it('no vibration for a phase change that happened while away (time jump)', () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(screen.getByTestId('mode-pomodoro'));
    fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
    const vibrate = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => {});
    jump(27 * 60_000);
    expect(screen.getByTestId('pomodoro-phase').props.children).toBe('Kısa mola');
    expect(vibrate).not.toHaveBeenCalled();
    vibrate.mockRestore();
  });

  it('settings change the pomodoro lengths within limits', () => {
    renderRouter(APP_DIR, { initialUrl: '/ayarlar' });
    fireEvent.press(screen.getByTestId('settings-pomodoro-workMin-plus'));
    expect(memory.pomodoroConfig.workMin).toBe(30);
    fireEvent.press(screen.getByTestId('settings-pomodoro-longEvery-minus'));
    expect(memory.pomodoroConfig.longEvery).toBe(3);
  });
});

describe('exam countdown', () => {
  beforeEach(() => {
    memory.profile = ADULT_SAYISAL;
    jest.setSystemTime(Date.parse('2026-10-04T09:00:00Z'));
  });

  it('home shows the days left to the estimated YKS date', () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(screen.getByTestId('countdown').props.children).toBe('YKS’ye 258 gün');
    expect(screen.getByText('tahmini')).toBeTruthy();
  });

  it('the student can set the exact date and go back to the estimate', () => {
    renderRouter(APP_DIR, { initialUrl: '/ayarlar' });
    expect(screen.getByTestId('settings-exam-date').props.children).toBe('19 Haziran 2027');
    fireEvent.changeText(screen.getByTestId('settings-exam-date-input'), '01.01.2020');
    fireEvent.press(screen.getByTestId('settings-exam-date-save'));
    expect(screen.getByText('Bugün ya da sonrası için GG.AA.YYYY biçiminde bir tarih gir.')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('settings-exam-date-input'), '26.06.2027');
    fireEvent.press(screen.getByTestId('settings-exam-date-save'));
    expect(memory.examDates.YKS).toBe('2027-06-26');
    expect(screen.getByTestId('settings-exam-date').props.children).toBe('26 Haziran 2027');
    expect(screen.getByText('senin girdiğin tarih')).toBeTruthy();
    fireEvent.press(screen.getByTestId('settings-exam-date-reset'));
    expect(memory.examDates.YKS).toBeUndefined();
  });

  it('a custom date is shown on the home screen without "tahmini"', () => {
    memory.examDates.YKS = '2027-06-26';
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(screen.getByTestId('countdown').props.children).toBe('YKS’ye 265 gün');
    expect(screen.queryByText('tahmini')).toBeNull();
  });
});

describe('K-17: age declaration after deleting all data', () => {
  it('the under-15 record survives "delete all" and blocks a 15+ declaration', () => {
    const year = new Date().getUTCFullYear();
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(screen.getByText(String(year - 12)));
    fireEvent.press(screen.getByText('LGS'));
    fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
    expect(memory.youngestBirthYear).toBe(year - 12);
    act(() => router.push('/ayarlar'));
    fireEvent.press(screen.getByRole('button', { name: 'Tüm verileri sil' }));
    fireEvent.press(screen.getByRole('button', { name: 'Evet, hepsini sil' }));
    expect(memory.profile).toBeNull();
    expect(memory.youngestBirthYear).toBe(year - 12);

    fireEvent.press(screen.getByText(String(year - 20)));
    fireEvent.press(screen.getByText('LGS'));
    fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
    expect(memory.profile).toBeNull();
    expect(screen.getByTestId('onboarding-age-blocked')).toBeTruthy();

    // Same side of the threshold (still under 15) is accepted.
    fireEvent.press(screen.getByText(String(year - 13)));
    expect(screen.queryByTestId('onboarding-age-blocked')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
    expect(memory.profile?.soloOnly).toBe(true);
  });

  it('2000 → nothing kept; delete; 2012 → kept; delete; 2000 → refused', () => {
    const year = new Date().getUTCFullYear();
    const deleteAll = () => {
      act(() => router.push('/ayarlar'));
      fireEvent.press(screen.getByRole('button', { name: 'Tüm verileri sil' }));
      fireEvent.press(screen.getByRole('button', { name: 'Evet, hepsini sil' }));
    };
    const declare = (birthYear: number) => {
      fireEvent.press(screen.getByText(String(birthYear)));
      fireEvent.press(screen.getByText('KPSS'));
      fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
    };
    renderRouter(APP_DIR, { initialUrl: '/' });
    declare(year - 26);
    expect(memory.profile?.soloOnly).toBe(false);
    expect(memory.youngestBirthYear).toBeNull();
    deleteAll();
    declare(year - 14);
    expect(memory.profile?.soloOnly).toBe(true);
    expect(memory.youngestBirthYear).toBe(year - 14);
    deleteAll();
    declare(year - 26);
    expect(memory.profile).toBeNull();
    expect(screen.getByTestId('onboarding-age-blocked').props.children).toBe(
      'Bu doğum yılı bu cihazda kaydedilemiyor. Seçimini kontrol edip yeniden dene.',
    );
  });

  it('an expired record is dropped at start', () => {
    memory.youngestBirthYear = new Date().getUTCFullYear() - 30; // certainly 15+ by now
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(memory.youngestBirthYear).toBeNull();
  });

  it('an adult profile keeps no record; settings show neither birth year nor age group', () => {
    memory.profile = ADULT_SAYISAL;
    renderRouter(APP_DIR, { initialUrl: '/ayarlar' });
    expect(memory.youngestBirthYear).toBeNull();
    expect(screen.queryByText('2000')).toBeNull();
    expect(screen.queryByText('Doğum yılı')).toBeNull();
    expect(screen.queryByText(/15 ve üstü|15 altı/)).toBeNull();
  });
});

describe('other screens render', () => {
  beforeEach(() => {
    memory.profile = {
      birthYear: 2008,
      examType: 'YKS',
      yksArea: 'esit_agirlik',
      soloOnly: false,
      createdAt: 0,
    };
  });

  it('exams', () => {
    renderRouter(APP_DIR, { initialUrl: '/denemeler' });
    expect(screen.getByRole('button', { name: 'Deneme ekle' })).toBeTruthy();
    expect(screen.getByText('TYT genel deneme netleri')).toBeTruthy();
  });

  it('history', () => {
    renderRouter(APP_DIR, { initialUrl: '/gecmis' });
    expect(screen.getByText('Son 7 gün')).toBeTruthy();
  });

  it('new exam form computes the net live', () => {
    renderRouter(APP_DIR, { initialUrl: '/deneme/yeni' });
    fireEvent.changeText(screen.getAllByLabelText('Doğru')[0], '30');
    fireEvent.changeText(screen.getAllByLabelText('Yanlış')[0], '5');
    expect(screen.getAllByText('28,75').length).toBeGreaterThan(0);
  });

  it('settings: delete all data returns to onboarding', () => {
    renderRouter(APP_DIR, { initialUrl: '/ayarlar' });
  fireEvent.press(screen.getByRole('button', { name: 'Tüm verileri sil' }));
  fireEvent.press(screen.getByRole('button', { name: 'Evet, hepsini sil' }));
    expect(memory.profile).toBeNull();
    expect(screen.getByText('Doğum yılın')).toBeTruthy();
  });
});
