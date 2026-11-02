/**
 * YKS content screens: the net calculator ("Net hesapla") and its hand-over to the new-exam form,
 * the topic detail screen and the richer Konular screen (per-paper progress, "Tekrar lazım"
 * filter, row → detail). Real screens through expo-router's test renderer; storage is an
 * in-memory fake as in education.test.tsx.
 */

import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';

import type { ExamTopicMark } from '../domain/exam-analysis';
import type { Profile } from '../domain/profile';
import type { ActiveSession, CompletedSession } from '../domain/timer';
import type { TopicStatus } from '../domain/topics';

jest.setTimeout(30_000);

type SavedScore = { sectionId: string; correct: number; wrong: number };

const memory: {
  profile: Profile | null;
  active: ActiveSession | null;
  sessions: CompletedSession[];
  dailyGoal: number | null;
  examDates: Record<string, string>;
  tipsSeen: boolean;
  lastBackupAt: number | null;
  backupNudgeDismissedAt: number | null;
  statuses: Record<string, TopicStatus>;
  marks: ExamTopicMark[];
  savedExams: { exam: { kind: string; scope: string }; scores: SavedScore[] }[];
} = {
  profile: null,
  active: null,
  sessions: [],
  dailyGoal: null,
  examDates: {},
  tipsSeen: true,
  lastBackupAt: null,
  backupNudgeDismissedAt: null,
  statuses: {},
  marks: [],
  savedExams: [],
};

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: async () => {},
  deactivateKeepAwake: async () => {},
}));
jest.mock('expo-haptics', () => ({
  notificationAsync: async () => {},
  impactAsync: async () => {},
  NotificationFeedbackType: { Success: 'success' },
  ImpactFeedbackStyle: { Light: 'light' },
}));
// System surfaces are covered in app-smoke.test.tsx; off here (no native modules).
jest.mock('../system/notifications', () => ({
  notifications: {
    supported: false,
    getPermission: () => new Promise(() => {}),
    requestPermission: async () => 'unsupported',
    sync: async () => {},
    cancelAll: async () => {},
    onOpen: () => () => {},
  },
}));
jest.mock('../system/live-activity', () => ({
  liveActivity: { supported: false, count: () => 0, start: () => false, update: async () => {}, endAll: async () => {} },
}));
jest.mock('../system/home-widget', () => ({
  homeWidget: { supported: false, setTimeline: () => {} },
}));

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
  clearLastSubject: () => {},
  loadDailyGoal: () => memory.dailyGoal,
  loadDailyGoalHistory: () => [],
  storeDailyGoal: (m: number | null) => {
    memory.dailyGoal = m;
  },
  loadPomodoroConfig: () => ({ workMin: 25, shortBreakMin: 5, longBreakMin: 15, longEvery: 4 }),
  storePomodoroConfig: () => {},
  loadStoredPomodoroConfig: () => null,
  loadTimerMode: () => 'stopwatch',
  loadStoredTimerMode: () => null,
  storeTimerMode: () => {},
  restoreTimerSettings: () => {},
  loadCustomExamDate: (t: string) => memory.examDates[t] ?? null,
  storeCustomExamDate: () => {},
  loadNetTargets: () => ({}),
  storeNetTarget: () => {},
  storeNetTargets: () => {},
  loadTipsSeen: () => memory.tipsSeen,
  storeTipsSeen: () => {
    memory.tipsSeen = true;
  },
  clearTipsSeen: () => {
    memory.tipsSeen = false;
  },
  loadReminderPrefs: () => jest.requireActual('../domain/reminders').normalizeReminderPrefs(null),
  storeReminderPrefs: () => {},
  loadRemindersConfirmed: () => false,
  storeRemindersConfirmed: () => {},
  loadLiveActivityRecord: () => null,
  storeLiveActivityRecord: () => {},
  loadKeepAwake: () => true,
  storeKeepAwake: () => {},
  loadAwayRule: () => 'ask',
  storeAwayRule: () => {},
  loadReplaceUndo: () => null,
  storeReplaceUndo: () => {},
  loadLastBackupAt: () => memory.lastBackupAt,
  storeLastBackupAt: (ms: number) => {
    memory.lastBackupAt = ms;
  },
  loadBackupNudgeDismissedAt: () => memory.backupNudgeDismissedAt,
  storeBackupNudgeDismissedAt: (ms: number) => {
    memory.backupNudgeDismissedAt = ms;
  },
  wipeKeyValueStore: () => {},
}));
jest.mock('../storage/backup', () => ({
  readBackupData: () => ({
    sessions: memory.sessions,
    exams: [],
    topicProgress: [],
    settings: {
      dailyGoalMinutes: memory.dailyGoal,
      pomodoro: null,
      timerMode: null,
      examDates: memory.examDates,
      netTargets: {},
      lastSubject: null,
    },
  }),
  writeBackupData: () => {},
}));
jest.mock('../storage/file-io', () => ({
  shareTextFile: async () => {
    return 'shared';
  },
  shareImage: async () => 'shared',
  pickTextFile: async () => ({ kind: 'canceled' }),
}));
jest.mock('../storage/age-guard', () => ({
  loadYoungestDeclaredBirthYear: () => null,
  storeYoungestDeclaredBirthYear: () => {},
}));
jest.mock('../storage/sessions', () => ({
  saveSession: (s: CompletedSession) => {
    memory.sessions = [...memory.sessions.filter((x) => x.id !== s.id), s];
  },
  sessionsOverlapping: (from: number, to: number) =>
    memory.sessions.filter((s) => s.endedAt > from && s.startedAt < to),
  allSessions: () => memory.sessions,
  firstSessionStartedAt: () =>
    memory.sessions.length === 0 ? null : Math.min(...memory.sessions.map((s) => s.startedAt)),
  recentManualSessions: () => memory.sessions.filter((s) => s.source === 'manual'),
  deleteManualSession: () => {},
  deleteSessionForUndo: () => {},
  topicTotals: () => {
    const out: Record<string, number> = {};
    for (const s of memory.sessions) if (s.topicId !== null) out[s.topicId] = (out[s.topicId] ?? 0) + s.durationMs;
    return out;
  },
  topicStudySince: () => ({}),
}));
jest.mock('../storage/topics', () => ({
  loadTopicStatuses: () => ({ ...memory.statuses }),
  loadTopicMark: () => null,
  setTopicStatus: (id: string, status: TopicStatus | null) => {
    if (status === null) delete memory.statuses[id];
    else memory.statuses[id] = status;
  },
}));
jest.mock('../storage/mock-exams', () => ({
  listMockExams: () => [],
  listExamsNeedingAnalysis: () => [],
  getMockExam: () => null,
  saveMockExam: (exam: { kind: string; scope: string }, scores: SavedScore[]) => {
    memory.savedExams.push({ exam, scores });
  },
  updateMockExam: () => false,
  deleteMockExam: () => {},
  getExamMarks: () => [],
  listAllMarks: () => memory.marks,
  saveExamAnalysis: () => {},
  sectionNetHistory: () => [],
}));
jest.mock('../storage/db', () => ({
  newId: () => 'test-id',
  getDb: () => {
    throw new Error('no SQLite in tests');
  },
  wipeDatabase: () => {},
}));

const APP_DIR = './app';
const ADULT: Profile = { birthYear: 2000, examType: 'YKS', yksArea: 'sayisal', soloOnly: false, createdAt: 0 };
const TOPIC = 'tyt.matematik.temel-kavramlar';
const OTHER = 'tyt.matematik.sayi-basamaklari';

function session(id: string, topicId: string | null, startedAt: number, minutes: number): CompletedSession {
  return {
    id,
    subjectId: 'matematik',
    topicId,
    startedAt,
    endedAt: startedAt + minutes * 60_000,
    pauses: [],
    durationMs: minutes * 60_000,
    source: 'timer',
  };
}

const text = (testID: string) => screen.getByTestId(testID).props.children;

beforeEach(() => {
  memory.profile = ADULT;
  memory.active = null;
  memory.sessions = [];
  memory.dailyGoal = null;
  memory.examDates = {};
  memory.tipsSeen = true;
  memory.lastBackupAt = null;
  memory.backupNudgeDismissedAt = null;
  memory.statuses = {};
  memory.marks = [];
  memory.savedExams = [];
});

describe('Net hesapla', () => {
  it('opens from the exams tab, also with no exams yet, and from "Nasıl çalışır"', () => {
    renderRouter(APP_DIR, { initialUrl: '/denemeler' });
    expect(screen.getByTestId('exams-empty')).toBeTruthy();
    fireEvent.press(screen.getByTestId('exams-net-calc'));
    expect(screen.getByTestId('net-calc')).toBeTruthy();
    act(() => router.push('/nasil-calisir'));
    fireEvent.press(screen.getByTestId('guide-net-calc'));
    expect(screen.getByTestId('net-calc')).toBeTruthy();
  });

  it('offers the papers of the student and nets 30 correct, 8 wrong as 28', () => {
    renderRouter(APP_DIR, { initialUrl: '/net-hesapla' });
    expect(screen.getByTestId('net-calc-kind-TYT')).toBeTruthy();
    expect(screen.getByTestId('net-calc-kind-AYT_SAY')).toBeTruthy();
    expect(screen.queryByTestId('net-calc-kind-AYT_EA')).toBeNull();
    expect(text('net-calc-total')).toBe('0');
    fireEvent.changeText(screen.getByTestId('net-calc-correct-matematik'), '30');
    fireEvent.changeText(screen.getByTestId('net-calc-wrong-matematik'), '8');
    expect(text('net-calc-net-matematik')).toBe('28');
    expect(text('net-calc-total')).toBe('28');
    fireEvent.changeText(screen.getByTestId('net-calc-correct-turkce'), '20');
    fireEvent.changeText(screen.getByTestId('net-calc-wrong-turkce'), '2');
    expect(text('net-calc-total')).toBe('47,5');
    expect(memory.savedExams).toEqual([]);
  });

  it('shows a dash and refuses to hand over counts that do not fit the section', () => {
    renderRouter(APP_DIR, { initialUrl: '/net-hesapla' });
    fireEvent.changeText(screen.getByTestId('net-calc-correct-fizik'), '6');
    fireEvent.changeText(screen.getByTestId('net-calc-wrong-fizik'), '3');
    expect(text('net-calc-total')).toBe('–');
    expect(screen.getByTestId('net-calc-save').props.accessibilityState.disabled).toBe(true);
  });

  it('LGS divides by 3', () => {
    memory.profile = { ...ADULT, examType: 'LGS', yksArea: null };
    renderRouter(APP_DIR, { initialUrl: '/net-hesapla' });
    fireEvent.changeText(screen.getByTestId('net-calc-correct-turkce'), '15');
    fireEvent.changeText(screen.getByTestId('net-calc-wrong-turkce'), '3');
    expect(text('net-calc-total')).toBe('14');
  });

  it('"Deneme olarak kaydet" opens the new-exam form filled in, and saving it saves those counts', () => {
    renderRouter(APP_DIR, { initialUrl: '/net-hesapla' });
    fireEvent.press(screen.getByTestId('net-calc-kind-AYT_SAY'));
    fireEvent.changeText(screen.getByTestId('net-calc-correct-matematik'), '30');
    fireEvent.changeText(screen.getByTestId('net-calc-wrong-matematik'), '8');
    fireEvent.press(screen.getByTestId('net-calc-save'));
    expect(screen.getByTestId('exam-form')).toBeTruthy();
    expect(screen.getByTestId('exam-kind-AYT_SAY').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('exam-correct-matematik').props.value).toBe('30');
    expect(screen.getByTestId('exam-wrong-matematik').props.value).toBe('8');
    expect(text('exam-total-net')).toBe('28');
    fireEvent.press(screen.getByTestId('exam-save'));
    expect(memory.savedExams).toHaveLength(1);
    expect(memory.savedExams[0].exam).toMatchObject({ kind: 'AYT_SAY', scope: 'genel' });
    expect(memory.savedExams[0].scores.find((s) => s.sectionId === 'matematik')).toMatchObject({
      correct: 30,
      wrong: 8,
    });
  });

  it('a malformed prefill opens an empty form', () => {
    renderRouter(APP_DIR, { initialUrl: '/deneme/yeni?prefill=%7Bbozuk' });
    expect(screen.getByTestId('exam-correct-matematik').props.value).toBe('');
  });
});

describe('Konular and the topic detail', () => {
  it('a row opens the topic with its time, exam misses and sessions', () => {
    const now = Date.now();
    memory.sessions = [
      session('a', TOPIC, now - 3 * 86_400_000, 30),
      session('b', TOPIC, now - 86_400_000, 45),
      session('c', OTHER, now - 3_600_000, 20),
    ];
    memory.marks = [
      { examId: 'e1', topicId: TOPIC, sectionId: 'matematik', wrong: 2, blank: 1, takenOn: '2026-10-01', createdAt: 0 },
      { examId: 'e2', topicId: TOPIC, sectionId: 'matematik', wrong: 1, blank: 0, takenOn: '2026-10-08', createdAt: 0 },
    ];
    renderRouter(APP_DIR, { initialUrl: '/konular?subject=matematik' });
    expect(screen.getByTestId('topics-paper-progress-TYT')).toBeTruthy();
    expect(screen.getByTestId('topics-paper-progress-AYT')).toBeTruthy();
    fireEvent.press(screen.getByTestId(`topic-row-${TOPIC}`));
    expect(screen.getByTestId('topic-detail')).toBeTruthy();
    expect(text('topic-detail-name')).toBe('Temel Kavramlar');
    expect(text('topic-detail-source')).toBe('Matematik · TYT');
    expect(text('topic-detail-time')).toBe('1 sa 15 dk');
    expect(text('topic-detail-session-count')).toBe('2 oturum');
    expect(text('topic-detail-misses')).toBe('3 yanlış · 1 boş');
    expect(screen.getByTestId('topic-detail-session-0')).toBeTruthy();
    expect(screen.getByTestId('topic-detail-session-1')).toBeTruthy();
    expect(screen.queryByTestId('topic-detail-session-2')).toBeNull();
  });

  it('a topic never studied says so', () => {
    renderRouter(APP_DIR, { initialUrl: `/konu/${OTHER}` });
    expect(text('topic-detail-last')).toBe('Henüz çalışılmadı');
    expect(text('topic-detail-misses')).toBe('0 yanlış · 0 boş');
  });

  it('the mark can be changed on the detail screen', () => {
    renderRouter(APP_DIR, { initialUrl: `/konu/${TOPIC}` });
    expect(screen.getByTestId('topic-detail-mark')).toBeTruthy();
    fireEvent.press(screen.getByTestId('topic-detail-review'));
    expect(memory.statuses[TOPIC]).toBe('review');
    expect(screen.getByTestId('topic-detail-review').props.accessibilityState.selected).toBe(true);
    fireEvent.press(screen.getByTestId('topic-detail-done'));
    expect(memory.statuses[TOPIC]).toBe('done');
    fireEvent.press(screen.getByTestId('topic-detail-done'));
    expect(memory.statuses[TOPIC]).toBeUndefined();
  });

  it('"Bu konuyu çalış" starts the timer on the subject and topic', () => {
    renderRouter(APP_DIR, { initialUrl: `/konu/${TOPIC}` });
    fireEvent.press(screen.getByTestId('topic-detail-start'));
    expect(memory.active).toMatchObject({ subjectId: 'matematik', topicId: TOPIC });
  });

  it('an unknown topic id shows a note', () => {
    renderRouter(APP_DIR, { initialUrl: '/konu/yok.yok.yok' });
    expect(screen.getByTestId('topic-detail-missing')).toBeTruthy();
  });

  it('the "Tekrar lazım" filter shows only the topics marked for review', () => {
    memory.statuses = { [OTHER]: 'review', [TOPIC]: 'done' };
    renderRouter(APP_DIR, { initialUrl: '/konular?subject=matematik' });
    expect(screen.getByTestId(`topic-row-${TOPIC}`)).toBeTruthy();
    fireEvent.press(screen.getByTestId('topics-filter-review'));
    expect(screen.getByTestId(`topic-row-${OTHER}`)).toBeTruthy();
    expect(screen.queryByTestId(`topic-row-${TOPIC}`)).toBeNull();
    // The existing mark chips stay on the filtered rows.
    expect(screen.getByTestId(`topic-review-${OTHER}`)).toBeTruthy();
    fireEvent.press(screen.getByTestId('topics-filter-review'));
    expect(screen.getByTestId(`topic-row-${TOPIC}`)).toBeTruthy();
  });

  it('the filter says so when nothing is marked for review', () => {
    renderRouter(APP_DIR, { initialUrl: '/konular?subject=matematik' });
    fireEvent.press(screen.getByTestId('topics-filter-review'));
    expect(screen.getByTestId('topics-filter-empty')).toBeTruthy();
    expect(screen.queryByTestId(`topic-row-${TOPIC}`)).toBeNull();
  });
});
