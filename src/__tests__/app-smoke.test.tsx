/**
 * Smoke test of the real screens with expo-router's test renderer. Storage is replaced by
 * in-memory fakes (SQLite cannot run under Jest); everything else is the app code as shipped.
 */

import { act, fireEvent, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import { AccessibilityInfo, AppState, type AppStateStatus, Keyboard, Vibration } from 'react-native';

import { UNDO_FINISH_MS } from '../domain/finish';

import type { TopicMark } from '../domain/exam-analysis';
import type { Profile } from '../domain/profile';
import type { ActiveSession, CompletedSession } from '../domain/timer';
import { type PlannedNotification, POMODORO_CHANGES_AHEAD } from '../domain/reminders';
import type { MockExamWithScores } from '../storage/mock-exams';
import type { TimerActivityProps, TodayWidgetProps } from '../system/surface-props';

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
  /** `updated_at` of the marks, as setTopicStatus wrote it. */
  topicTimes: Record<string, number>;
  exams: MockExamWithScores[];
  /** Calls of saveMockExam (a double tap must not save twice). */
  saves: number;
  marks: Record<string, TopicMark[]>;
  examDates: Record<string, string>;
  netTargets: Record<string, number>;
  tipsSeen: boolean;
  /** Files handed to the share sheet (backup, CSV) and captured card images. */
  shared: { name: string; content: string }[];
  sharedImages: { uri: string; name: string }[];
  /** Text the fake document picker returns; `null` = the student cancels. */
  pickText: string | null;
  reminderPrefs: unknown;
  remindersConfirmed: boolean;
  liveActivityRecord: { sessionId: string; startedAt: number; dismissed?: boolean; retried?: boolean } | null;
  /**
   * Start as "Açık" and "Sor" (most tests here exercise those); the app's own defaults (off,
   * "Çalışmaya devam say") are `kv.ts`'s, tested in kv.test.ts and app-real-storage.test.tsx.
   */
  keepAwakeSetting: boolean;
  awayRule: 'ask' | 'count';
  replaceUndo: { createdAt: number; text: string } | null;
  lastBackupAt: number | null;
  backupNudgeDismissedAt: number | null;
  widgetTip: 'waiting' | 'due' | 'dismissed';
  /** Calls of `sessionsOverlapping` (how often the stored sessions are read). */
  sessionLoads: number;
  /** System surfaces (src/system adapters, replaced below). */
  permission: 'granted' | 'denied' | 'undetermined';
  grantOnRequest: boolean;
  permissionRequests: number;
  /** Older tests never await the permission check (no act() warnings): it stays pending. */
  answerPermission: boolean;
  planned: PlannedNotification[];
  liveActivities: TimerActivityProps[];
  /** `staleAt` handed to the last start/update of the Live Activity. */
  liveActivityStaleAt: number | null;
  widget: { at: number; props: TodayWidgetProps }[];
} = {
  profile: null,
  active: null,
  sessions: [],
  youngestBirthYear: null,
  dailyGoal: null,
  timerMode: 'stopwatch',
  pomodoroConfig: { workMin: 25, shortBreakMin: 5, longBreakMin: 15, longEvery: 4 },
  topicStatuses: {},
  topicTimes: {},
  exams: [],
  saves: 0,
  marks: {},
  examDates: {},
  netTargets: {},
  tipsSeen: true,
  shared: [],
  sharedImages: [],
  pickText: null,
  reminderPrefs: null,
  remindersConfirmed: false,
  liveActivityRecord: null,
  keepAwakeSetting: true,
  awayRule: 'ask',
  replaceUndo: null,
  lastBackupAt: null,
  backupNudgeDismissedAt: null,
  widgetTip: 'waiting',
  sessionLoads: 0,
  permission: 'undetermined',
  grantOnRequest: true,
  permissionRequests: 0,
  answerPermission: false,
  planned: [],
  liveActivities: [],
  liveActivityStaleAt: null,
  widget: [],
};

/** Tags currently holding the screen on (expo-keep-awake, replaced below). */
const mockKeepAwake = new Set<string>();
jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: async (tag: string) => {
    mockKeepAwake.add(tag);
  },
  deactivateKeepAwake: async (tag: string) => {
    mockKeepAwake.delete(tag);
  },
}));

/** Notification taps: one that launched the app (handed over on subscribing), and the listener. */
const mockTaps: { launchUrl: string | null; listener: ((url: string) => void) | null } = {
  launchUrl: null,
  listener: null,
};
jest.mock('../system/notifications', () => ({
  notifications: {
    supported: true,
    getPermission: () => (memory.answerPermission ? Promise.resolve(memory.permission) : new Promise(() => {})),
    requestPermission: async () => {
      memory.permissionRequests += 1;
      if (memory.permission === 'undetermined') memory.permission = memory.grantOnRequest ? 'granted' : 'denied';
      return memory.permission;
    },
    sync: async (planned: PlannedNotification[]) => {
      memory.planned = memory.permission === 'granted' ? planned : [];
    },
    cancelAll: async () => {
      memory.planned = [];
    },
    onOpen: (listener: (url: string) => void) => {
      mockTaps.listener = listener;
      if (mockTaps.launchUrl !== null) listener(mockTaps.launchUrl);
      return () => {
        mockTaps.listener = null;
      };
    },
  },
}));

jest.mock('../system/live-activity', () => ({
  liveActivity: {
    supported: true,
    count: () => memory.liveActivities.length,
    start: (props: TimerActivityProps, staleAt: number | null) => {
      memory.liveActivities = [...memory.liveActivities, props];
      memory.liveActivityStaleAt = staleAt;
      return true;
    },
    update: async (props: TimerActivityProps, staleAt: number | null) => {
      memory.liveActivities = memory.liveActivities.map(() => props);
      memory.liveActivityStaleAt = staleAt;
    },
    endAll: async () => {
      memory.liveActivities = [];
    },
  },
}));

jest.mock('../system/home-widget', () => ({
  homeWidget: {
    supported: true,
    setTimeline: (entries: { at: number; props: TodayWidgetProps }[]) => {
      memory.widget = entries;
    },
  },
}));

/** App Store rating dialog (X-7): calls of the StoreKit adapter and the stored "last asked" time. */
const mockReview = { askedAt: null as number | null, requests: 0 };
jest.mock('../system/store-review', () => ({
  storeReview: {
    isAvailable: async () => true,
    request: async () => {
      mockReview.requests += 1;
    },
  },
}));
jest.mock('../storage/review-kv', () => ({
  loadReviewAskedAt: () => mockReview.askedAt,
  storeReviewAskedAt: (ms: number) => {
    mockReview.askedAt = ms;
  },
}));

jest.mock('../storage/kv', () => ({
  loadReminderPrefs: () => jest.requireActual('../domain/reminders').normalizeReminderPrefs(memory.reminderPrefs),
  storeReminderPrefs: (p: unknown) => {
    memory.reminderPrefs = p;
  },
  loadRemindersConfirmed: () => memory.remindersConfirmed,
  storeRemindersConfirmed: () => {
    memory.remindersConfirmed = true;
  },
  loadLiveActivityRecord: () => memory.liveActivityRecord,
  storeLiveActivityRecord: (r: typeof memory.liveActivityRecord) => {
    memory.liveActivityRecord = r;
  },
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
  // No history: the goal covers every day (the history itself runs in app-real-storage.test.tsx).
  loadDailyGoalHistory: () => [],
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
  storeNetTargets: (targets: Record<string, number>) => {
    memory.netTargets = { ...targets };
  },
  loadStoredPomodoroConfig: () => memory.pomodoroConfig,
  loadStoredTimerMode: () => memory.timerMode,
  restoreTimerSettings: () => {},
  clearLastSubject: () => {},
  loadTipsSeen: () => memory.tipsSeen,
  storeTipsSeen: () => {
    memory.tipsSeen = true;
  },
  clearTipsSeen: () => {
    memory.tipsSeen = false;
  },
  loadLastBackupAt: () => memory.lastBackupAt,
  storeLastBackupAt: (ms: number) => {
    memory.lastBackupAt = ms;
  },
  loadBackupNudgeDismissedAt: () => memory.backupNudgeDismissedAt,
  storeBackupNudgeDismissedAt: (ms: number) => {
    memory.backupNudgeDismissedAt = ms;
  },
  loadWidgetTip: () => memory.widgetTip,
  storeWidgetTip: (state: typeof memory.widgetTip) => {
    memory.widgetTip = state;
  },
  loadKeepAwake: () => memory.keepAwakeSetting,
  storeKeepAwake: (on: boolean) => {
    memory.keepAwakeSetting = on;
  },
  loadAwayRule: () => memory.awayRule,
  storeAwayRule: (rule: 'ask' | 'count') => {
    memory.awayRule = rule;
  },
  loadReplaceUndo: () => memory.replaceUndo,
  storeReplaceUndo: (undo: typeof memory.replaceUndo) => {
    memory.replaceUndo = undo;
  },
  wipeKeyValueStore: () => {
    memory.replaceUndo = null;
    memory.lastBackupAt = null;
    memory.backupNudgeDismissedAt = null;
    memory.widgetTip = 'waiting';
    memory.keepAwakeSetting = true;
    memory.awayRule = 'ask';
    memory.profile = null;
    memory.active = null;
    memory.dailyGoal = null;
    memory.examDates = {};
    memory.netTargets = {};
    memory.tipsSeen = false;
    memory.reminderPrefs = null;
    memory.remindersConfirmed = false;
    memory.liveActivityRecord = null;
  },
}));

// The real SQL of storage/backup.ts runs in storage/__tests__/backup-storage.test.ts.
jest.mock('../storage/backup', () => ({
  readBackupData: () => ({
    sessions: memory.sessions,
    exams: memory.exams.map((e) => ({ ...e, marks: memory.marks[e.id] ?? [] })),
    topicProgress: Object.entries(memory.topicStatuses).map(([topicId, status]) => ({
      topicId,
      status,
      updatedAt: 1,
    })),
    settings: {
      dailyGoalMinutes: memory.dailyGoal,
      pomodoro: null,
      timerMode: null,
      examDates: memory.examDates,
      netTargets: memory.netTargets,
      lastSubject: null,
    },
  }),
  writeBackupData: (data: {
    sessions: CompletedSession[];
    exams: (MockExamWithScores & { marks: TopicMark[] })[];
    topicProgress: { topicId: string; status: 'done' | 'review' }[];
    settings: { dailyGoalMinutes: number | null; netTargets: Record<string, number> };
  }) => {
    memory.sessions = [...data.sessions];
    // Like the real write: the total net is recomputed from the scores.
    const { totalNet } = jest.requireActual('../domain/net');
    memory.exams = data.exams.map(({ marks, ...e }) => ({ ...e, totalNet: totalNet(e.scores, e.kind) }));
    memory.marks = Object.fromEntries(data.exams.map((e) => [e.id, e.marks]));
    memory.topicStatuses = Object.fromEntries(data.topicProgress.map((t) => [t.topicId, t.status]));
    memory.dailyGoal = data.settings.dailyGoalMinutes;
    memory.netTargets = data.settings.netTargets;
  },
}));

jest.mock('../storage/file-io', () => ({
  shareTextFile: async (name: string, content: string) => {
    memory.shared.push({ name, content });
    return 'shared';
  },
  shareImage: async (uri: string, name: string) => {
    memory.sharedImages.push({ uri, name });
    return 'shared';
  },
  pickTextFile: async () =>
    memory.pickText === null ? { kind: 'canceled' } : { kind: 'picked', text: memory.pickText },
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(async () => {}),
  impactAsync: jest.fn(async () => {}),
  NotificationFeedbackType: { Success: 'success' },
  ImpactFeedbackStyle: { Light: 'light' },
}));

jest.mock('react-native-view-shot', () => ({
  captureRef: async () => '/tmp/etut-card.png',
  releaseCapture: () => {},
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
  sessionsOverlapping: (from: number, to: number) => {
    memory.sessionLoads += 1;
    return memory.sessions.filter((s) => s.endedAt > from && s.startedAt < to);
  },
  allSessions: () => memory.sessions,
  recentManualSessions: () => memory.sessions.filter((s) => s.source === 'manual').reverse(),
  deleteManualSession: (id: string) => {
    memory.sessions = memory.sessions.filter((s) => !(s.id === id && s.source === 'manual'));
  },
  deleteSessionForUndo: (id: string) => {
    memory.sessions = memory.sessions.filter((s) => !(s.id === id && s.source === 'timer'));
  },
  deleteTimerSession: (id: string) => {
    memory.sessions = memory.sessions.filter((s) => !(s.id === id && s.source === 'timer'));
  },
  topicTotals: () => {
    const out: Record<string, number> = {};
    for (const s of memory.sessions) {
      if (s.topicId) out[s.topicId] = (out[s.topicId] ?? 0) + s.durationMs;
    }
    return out;
  },
  topicStudySince: (since: Record<string, number>) => {
    const out: Record<string, number> = {};
    for (const [topicId, from] of Object.entries(since)) {
      out[topicId] = memory.sessions
        .filter((s) => s.topicId === topicId && s.startedAt >= from)
        .reduce((sum, s) => sum + s.durationMs, 0);
    }
    return out;
  },
}));

jest.mock('../storage/topics', () => ({
  loadTopicStatuses: () => memory.topicStatuses,
  loadTopicMark: (id: string) => {
    const status = memory.topicStatuses[id];
    return status === undefined ? null : { status, updatedAt: memory.topicTimes[id] ?? 0 };
  },
  setTopicStatus: (id: string, status: 'done' | 'review' | null, now: number) => {
    const next = { ...memory.topicStatuses };
    if (status === null) delete next[id];
    else next[id] = status;
    memory.topicStatuses = next;
    memory.topicTimes = { ...memory.topicTimes, [id]: now };
  },
}));

jest.mock('../storage/mock-exams', () => ({
  listMockExams: () => memory.exams,
  listExamsNeedingAnalysis: () =>
    memory.exams.filter(
      (e) => e.analysisDoneAt === null && e.scores.some((s) => s.questions - s.correct > 0),
    ),
  getMockExam: (id: string) => memory.exams.find((e) => e.id === id) ?? null,
  // Same rules as the real SQL (storage/__tests__/mock-exams.test.ts): one row per id, newest first.
  saveMockExam: (exam: Omit<MockExamWithScores, 'totalNet' | 'analysisDoneAt' | 'scores'>, scores: MockExamWithScores['scores']) => {
    memory.saves += 1;
    if (memory.exams.some((e) => e.id === exam.id)) return;
    const { totalNet } = jest.requireActual('../domain/net');
    const { examNeedsAnalysis } = jest.requireActual('../domain/exam-analysis');
    memory.exams = [
      { ...exam, scores, totalNet: totalNet(scores, exam.kind), analysisDoneAt: examNeedsAnalysis(scores) ? null : exam.createdAt },
      ...memory.exams,
    ];
  },
  updateMockExam: (
    id: string,
    changes: Pick<MockExamWithScores, 'kind' | 'scope' | 'bransSectionId' | 'takenOn'>,
    scores: MockExamWithScores['scores'],
    now: number,
  ) => {
    const before = memory.exams.find((e) => e.id === id);
    if (!before) return false;
    const { totalNet } = jest.requireActual('../domain/net');
    const { analysisAfterEdit } = jest.requireActual('../domain/exam-analysis');
    const after = analysisAfterEdit({ ...before, marks: memory.marks[id] ?? [] }, changes.kind, scores, now);
    memory.marks[id] = after.marks;
    memory.exams = memory.exams.map((e) =>
      e.id === id
        ? { ...e, ...changes, scores, totalNet: totalNet(scores, changes.kind), analysisDoneAt: after.analysisDoneAt }
        : e,
    );
    return true;
  },
  deleteMockExam: (id: string) => {
    memory.exams = memory.exams.filter((e) => e.id !== id);
  },
  getExamMarks: (id: string) => memory.marks[id] ?? [],
  // With the exam's day and entry time, as the real JOIN (a mark of an exam not in memory.exams counts as 1 Oct).
  listAllMarks: () =>
    Object.entries(memory.marks).flatMap(([examId, marks]) => {
      const exam = memory.exams.find((e) => e.id === examId);
      return marks.map((m) => ({ ...m, examId, takenOn: exam?.takenOn ?? '2026-10-01', createdAt: exam?.createdAt ?? 0 }));
    }),
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
          .map((s) => ({
            examId: e.id,
            takenOn: e.takenOn,
            scope: e.scope,
            net: jest.requireActual('../domain/net').net(s.correct, s.wrong, e.kind),
          })),
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
  memory.topicTimes = {};
  memory.exams = [];
  memory.saves = 0;
  memory.marks = {};
  memory.examDates = {};
  memory.netTargets = {};
  memory.tipsSeen = true;
  memory.shared = [];
  memory.sharedImages = [];
  memory.pickText = null;
  memory.reminderPrefs = null;
  memory.remindersConfirmed = false;
  memory.liveActivityRecord = null;
  memory.keepAwakeSetting = true;
  memory.awayRule = 'ask';
  memory.replaceUndo = null;
  memory.lastBackupAt = null;
  memory.backupNudgeDismissedAt = null;
  memory.widgetTip = 'waiting';
  mockKeepAwake.clear();
  memory.sessionLoads = 0;
  memory.permission = 'undetermined';
  memory.grantOnRequest = true;
  memory.permissionRequests = 0;
  memory.answerPermission = false;
  memory.planned = [];
  memory.liveActivities = [];
  memory.liveActivityStaleAt = null;
  memory.widget = [];
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
  // The daily goal was skipped (nothing is pre-selected).
  expect(memory.dailyGoal).toBeNull();
  expect(screen.getByText('Ders seç')).toBeTruthy();
  expect(screen.queryByText('Gruplar')).toBeNull();
});

it('onboarding: a daily goal can be picked (optional) and Başla says what is missing', () => {
  const year = new Date().getUTCFullYear() - 20;
  renderRouter(APP_DIR, { initialUrl: '/' });
  expect(screen.getByTestId('onboarding-missing').props.children).toBe('Başlamak için önce doğduğun yılı seç.');
  fireEvent.press(screen.getByText(String(year)));
  expect(screen.getByTestId('onboarding-missing').props.children).toBe('Başlamak için sınavını seç.');
  fireEvent.press(screen.getByText('YKS'));
  expect(screen.getByTestId('onboarding-missing').props.children).toBe('Başlamak için alanını seç.');
  fireEvent.press(screen.getByTestId('yks-area-sayisal'));
  expect(screen.queryByTestId('onboarding-missing')).toBeNull();
  // Tapping the chosen goal again clears it.
  fireEvent.press(screen.getByTestId('onboarding-goal-120'));
  fireEvent.press(screen.getByTestId('onboarding-goal-120'));
  fireEvent.press(screen.getByTestId('onboarding-goal-240'));
  fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
  expect(memory.dailyGoal).toBe(240);
  expect(screen.getByTestId('goal-progress').props.children).toBe('Hedef 4 sa 0 dk · %0');
});

describe('the moment after Bitir', () => {
  /** Jumps the clock and lets the 1 s render interval fire once. */
  function jump(ms: number) {
    act(() => {
      jest.setSystemTime(Date.now() + ms);
      jest.advanceTimersByTime(1000);
    });
  }

  beforeEach(() => {
    memory.profile = ADULT_SAYISAL;
    jest.useFakeTimers();
    jest.setSystemTime(Date.parse('2026-10-07T09:00:00Z')); // 12:00 Istanbul
    jest.mocked(Haptics.notificationAsync).mockClear();
  });

  it('shows time, subject and the goal step, with a success haptic and a VoiceOver announcement', () => {
    memory.dailyGoal = 60;
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(screen.getByText('Fizik'));
    fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
    jump(30 * 60_000);
    fireEvent.press(screen.getByRole('button', { name: 'Bitir' }));
    expect(screen.getByTestId('timer-saved').props.children).toBe('Kaydedildi: 30 dk');
    expect(screen.getByTestId('finish-detail').props.children).toBe('Fizik çalıştın · Hedef: %0 → %50');
    expect(screen.getByTestId('today-total').props.children).toBe('30 dk');
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
    expect(announce).toHaveBeenCalledWith('Kaydedildi: 30 dk. Bugün toplam 30 dk.');
    // The core loop is right there again: the subject stays picked, one tap starts.
    expect(screen.getByTestId('timer-start')).toBeTruthy();
    announce.mockRestore();
  });

  it('a session that reaches the goal says so', () => {
    memory.dailyGoal = 30;
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
    jump(31 * 60_000);
    fireEvent.press(screen.getByRole('button', { name: 'Bitir' }));
    expect(screen.getByTestId('finish-goal-reached')).toBeTruthy();
    expect(screen.getByTestId('goal-progress').props.children).toBe('Bugünkü hedefini tutturdun.');
  });

  it('"Geri al" right after an accidental Bitir brings the session back and removes the record', () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(screen.getByText('Fizik'));
    fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
    jump(2 * 60_000);
    fireEvent.press(screen.getByRole('button', { name: 'Bitir' }));
    expect(memory.sessions).toHaveLength(1);
    fireEvent.press(screen.getByTestId('finish-undo'));
    expect(memory.sessions).toHaveLength(0);
    expect(memory.active?.subjectId).toBe('fizik');
    expect(screen.getByTestId('timer-status').props.children).toBe('Çalışıyorsun');
    expect(screen.queryByTestId('timer-saved')).toBeNull();
    // Finishing again saves it once, with the whole time.
    jump(60_000);
    fireEvent.press(screen.getByRole('button', { name: 'Bitir' }));
    expect(memory.sessions).toHaveLength(1);
    expect(memory.sessions[0].durationMs).toBeGreaterThanOrEqual(3 * 60_000);
  });

  it('after the undo window the button is gone and the record stays', () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
    jump(2 * 60_000);
    fireEvent.press(screen.getByRole('button', { name: 'Bitir' }));
    expect(screen.getByTestId('finish-undo')).toBeTruthy();
    act(() => jest.advanceTimersByTime(UNDO_FINISH_MS + 1000));
    expect(screen.queryByTestId('finish-undo')).toBeNull();
    expect(screen.getByTestId('timer-saved').props.children).toBe('Kaydedildi: 2 dk');
    expect(memory.sessions).toHaveLength(1);
    // A new session clears the summary.
    fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
    expect(screen.queryByTestId('timer-saved')).toBeNull();
  });

  it('the first Bitir that saved time brings the one-time widget card; "Gösterme" hides it for good', () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(screen.queryByTestId('widget-tip')).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
    jump(2 * 60_000);
    fireEvent.press(screen.getByRole('button', { name: 'Bitir' }));
    expect(memory.widgetTip).toBe('due');
    expect(screen.getByTestId('widget-tip')).toBeTruthy();
    expect(screen.getByText('Ana ekrana widget ekle')).toBeTruthy();
    expect(screen.getByText('1. Ana ekranda boş bir yere basılı tut.')).toBeTruthy();
    // Not while a session runs; back on the idle screen until it is closed.
    fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
    expect(screen.queryByTestId('widget-tip')).toBeNull();
    jump(60_000);
    fireEvent.press(screen.getByRole('button', { name: 'Bitir' }));
    expect(screen.getByTestId('widget-tip')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Gösterme' }));
    expect(screen.queryByTestId('widget-tip')).toBeNull();
    expect(memory.widgetTip).toBe('dismissed');
    fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
    jump(60_000);
    fireEvent.press(screen.getByRole('button', { name: 'Bitir' }));
    expect(screen.queryByTestId('widget-tip')).toBeNull();
  });

  it('no widget card where there is no widget (web, Android)', () => {
    const widget = jest.requireMock('../system/home-widget') as { homeWidget: { supported: boolean } };
    widget.homeWidget.supported = false;
    try {
      renderRouter(APP_DIR, { initialUrl: '/' });
      fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
      jump(2 * 60_000);
      fireEvent.press(screen.getByRole('button', { name: 'Bitir' }));
      expect(screen.getByTestId('timer-saved')).toBeTruthy();
      expect(screen.queryByTestId('widget-tip')).toBeNull();
      expect(memory.widgetTip).toBe('waiting');
    } finally {
      widget.homeWidget.supported = true;
    }
  });
});

it('with the group module off a 15+ profile sees no Groups tab; start, pause, finish saves a session', () => {
  memory.profile = {
    birthYear: 2000,
    examType: 'YKS',
    yksArea: 'sayisal',
    soloOnly: false,
    createdAt: 0,
  };
  renderRouter(APP_DIR, { initialUrl: '/' });
  expect(screen.queryByText('Gruplar')).toBeNull();
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

  it('the summary marks the topic "Bitti" / "Tekrar lazım"; "Geri al" puts the earlier mark back', () => {
    memory.topicStatuses = { 'tyt.fizik.basinc': 'review' };
    memory.topicTimes = { 'tyt.fizik.basinc': 7 };
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(screen.getByText('Fizik'));
    fireEvent.press(screen.getByTestId('topic-picker-toggle'));
    fireEvent.press(screen.getByTestId('topic-tyt.fizik.basinc'));
    fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
    act(() => jest.advanceTimersByTime(61_000));
    fireEvent.press(screen.getByRole('button', { name: 'Bitir' }));
    const selected = (id: string) => screen.getByTestId(id).props.accessibilityState?.selected;
    expect(screen.getByText('Konuyu işaretle (isteğe bağlı)')).toBeTruthy();
    expect(selected('finish-topic-review')).toBe(true);
    expect(screen.getByLabelText('Basınç: Bitti')).toBeTruthy();
    fireEvent.press(screen.getByTestId('finish-topic-done'));
    expect(memory.topicStatuses['tyt.fizik.basinc']).toBe('done');
    expect(selected('finish-topic-done')).toBe(true);
    expect(selected('finish-topic-review')).toBe(false);
    // Tapping the chosen one again clears it, as on Konular.
    fireEvent.press(screen.getByTestId('finish-topic-done'));
    expect(memory.topicStatuses['tyt.fizik.basinc']).toBeUndefined();
    fireEvent.press(screen.getByTestId('finish-topic-done'));
    expect(screen.getByTestId('finish-undo').props.accessibilityHint).toBe(
      'Kaydı siler ve konu işaretini eski hâline getirir; sayaç kaldığı yerden devam eder.',
    );
    fireEvent.press(screen.getByTestId('finish-undo'));
    expect(memory.sessions).toHaveLength(0);
    expect(memory.topicStatuses['tyt.fizik.basinc']).toBe('review');
    expect(memory.topicTimes['tyt.fizik.basinc']).toBe(7);
    expect(memory.active?.topicId).toBe('tyt.fizik.basinc');
  });

  it('a mark from the summary stays after the undo window; a session without a topic has no chips', () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(screen.getByText('Fizik'));
    fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
    act(() => jest.advanceTimersByTime(61_000));
    fireEvent.press(screen.getByRole('button', { name: 'Bitir' }));
    expect(screen.getByTestId('timer-saved')).toBeTruthy();
    expect(screen.queryByTestId('finish-topic-done')).toBeNull();

    fireEvent.press(screen.getByTestId('topic-picker-toggle'));
    fireEvent.press(screen.getByTestId('topic-tyt.fizik.basinc'));
    fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
    act(() => jest.advanceTimersByTime(61_000));
    fireEvent.press(screen.getByRole('button', { name: 'Bitir' }));
    fireEvent.press(screen.getByTestId('finish-topic-review'));
    act(() => jest.advanceTimersByTime(UNDO_FINISH_MS + 1_000));
    expect(screen.queryByTestId('finish-undo')).toBeNull();
    expect(memory.topicStatuses['tyt.fizik.basinc']).toBe('review');
    expect(memory.sessions[0].topicId).toBe('tyt.fizik.basinc');
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

  it('changing the area in settings drops a topic of the old subject (never saved under another subject)', () => {
    memory.profile = { ...ADULT_SAYISAL, yksArea: 'esit_agirlik' };
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(screen.getByTestId('subject-edebiyat'));
    fireEvent.press(screen.getByTestId('topic-picker-toggle'));
    fireEvent.press(screen.getByTestId('topic-ayt.edebiyat.anlam-bilgisi'));
    act(() => router.push('/ayarlar'));
    fireEvent.press(screen.getByTestId('settings-yks-area-sayisal'));
    fireEvent.press(screen.getByTestId('settings-exam-save'));
    act(() => router.push('/'));
    fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
    expect(memory.active?.subjectId).not.toBe('edebiyat');
    expect(memory.active?.topicId).toBeNull();
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

  it('topics screen: "tekrar lazım" topics come first; a mark made there does not move the rows', () => {
    memory.topicStatuses = { 'tyt.fizik.dalgalar': 'review', 'tyt.fizik.basinc': 'done' };
    renderRouter(APP_DIR, { initialUrl: '/konular' });
    fireEvent.press(screen.getByTestId('topics-subject-fizik'));
    const order = () => screen.getAllByTestId(/^topic-review-tyt\.fizik\./).map((n) => n.props.testID as string);
    const opened = order();
    expect(opened.slice(0, 3)).toEqual([
      'topic-review-tyt.fizik.dalgalar',
      'topic-review-tyt.fizik.fizik-bilimine-giris',
      'topic-review-tyt.fizik.madde-ve-ozellikleri',
    ]);
    fireEvent.press(screen.getByTestId('topic-review-tyt.fizik.hareket'));
    expect(memory.topicStatuses['tyt.fizik.hareket']).toBe('review');
    expect(order()).toEqual(opened);
    // Opening the subject again sorts with the new mark.
    fireEvent.press(screen.getByTestId('topics-subject-kimya'));
    fireEvent.press(screen.getByTestId('topics-subject-fizik'));
    expect(order().slice(0, 2)).toEqual(['topic-review-tyt.fizik.hareket', 'topic-review-tyt.fizik.dalgalar']);
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
    fireEvent.press(screen.getByTestId('manual-change-time'));
    // Today, ending 23:59 + 10 h is always after now.
    fill('23', '59', '10', '0');
    expect(screen.getByTestId('manual-error').props.children).toBe('Henüz gelmemiş bir zaman eklenemez.');
  });

  it('today the entry "just finished" by default: a duration chip and Ekle are enough', () => {
    renderRouter(APP_DIR, { initialUrl: '/elle-ekle' });
    expect(screen.queryByTestId('manual-start-hour')).toBeNull();
    expect(screen.getByTestId('manual-just-finished').props.children).toBe('Az önce bitti');
    // A chip fills the duration fields (any other length is typed there).
    fireEvent.press(screen.getByTestId('manual-duration-chip-90'));
    expect(screen.getByTestId('manual-duration-hours').props.value).toBe('1');
    expect(screen.getByTestId('manual-duration-minutes').props.value).toBe('30');
    expect(screen.getByTestId('manual-duration-chip-90').props.accessibilityState).toMatchObject({ selected: true });
    fireEvent.press(screen.getByTestId('manual-duration-chip-45'));
    expect(screen.getByTestId('manual-duration-chip-90').props.accessibilityState).toMatchObject({ selected: false });
    const span = screen.getByTestId('manual-just-finished').props.children as string;
    fireEvent.press(screen.getByTestId('manual-add'));
    expect(screen.getByTestId('manual-added').props.children).toBe('Eklendi: 45 dk (elle)');
    const [saved] = memory.sessions;
    expect(saved).toMatchObject({ source: 'manual', durationMs: 45 * 60_000 });
    // Ends at the start of the current minute.
    expect(saved.endedAt % 60_000).toBe(0);
    expect(Date.now() - saved.endedAt).toBeGreaterThanOrEqual(0);
    expect(Date.now() - saved.endedAt).toBeLessThan(60_000);
    const clock = (ms: number) => new Date(ms + 3 * 3_600_000).toISOString().slice(11, 16);
    expect(span).toBe(`Az önce bitti: ${clock(saved.startedAt)}–${clock(saved.endedAt)}`);
  });

  it('"Saati değiştir" opens the start fields, "Az önce bitti" closes them; another day always asks', () => {
    renderRouter(APP_DIR, { initialUrl: '/elle-ekle' });
    fireEvent.press(screen.getByTestId('manual-change-time'));
    expect(screen.queryByTestId('manual-just-finished')).toBeNull();
    fireEvent.press(screen.getByTestId('manual-use-just-finished'));
    expect(screen.queryByTestId('manual-start-hour')).toBeNull();
    fireEvent.press(screen.getByTestId('manual-prev-day'));
    expect(screen.getByTestId('manual-start-hour')).toBeTruthy();
    expect(screen.queryByTestId('manual-use-just-finished')).toBeNull();
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
    // Quick analysis: the topic chips are always there, one tap adds 1 of the kind on the switch.
    expect(screen.getByTestId('analysis-add-topic-matematik').props.children).toBe(
      'Bir konuya dokununca ona 1 yanlış eklenir.',
    );
    fireEvent.press(screen.getByTestId('analysis-add-tyt.matematik.mutlak-deger'));
    fireEvent.press(screen.getByTestId('analysis-add-tyt.matematik.mutlak-deger'));
    fireEvent.press(screen.getByTestId('analysis-add-tyt.matematik.mutlak-deger'));
    fireEvent.press(screen.getByTestId('analysis-kind-matematik-blank'));
    fireEvent.press(screen.getByTestId('analysis-add-tyt.matematik.mutlak-deger'));
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

  it('taps stop at the section wrong count; then blanks on the switch; "Ayrıntı" lowers a count', () => {
    renderRouter(APP_DIR, { initialUrl: '/denemeler' });
    act(() => router.push('/analiz/e1'));
    const chip = 'analysis-add-tyt.matematik.mutlak-deger';
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    for (let i = 0; i < 5; i++) fireEvent.press(screen.getByTestId(chip));
    expect(announce).toHaveBeenLastCalledWith('Mutlak Değer: 5 yanlış, 0 boş');
    // The tap on the last wrong answer says so; the chips are then off for wrong answers.
    fireEvent.press(screen.getByTestId(chip));
    expect(announce).toHaveBeenLastCalledWith(
      'Mutlak Değer: 6 yanlış, 0 boş. Bu dersteki yanlışların hepsini işaretledin.',
    );
    announce.mockRestore();
    for (let i = 0; i < 4; i++) fireEvent.press(screen.getByTestId(chip));
    expect(screen.getByTestId('analysis-tagged-matematik').props.children).toBe(
      'İşaretlenen: 6/6 yanlış · 0/4 boş',
    );
    expect(screen.getByTestId(chip).props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByTestId('analysis-add-topic-matematik').props.children).toBe(
      'Bu dersteki yanlışların hepsini işaretledin.',
    );
    fireEvent.press(screen.getByTestId('analysis-kind-matematik-blank'));
    fireEvent.press(screen.getByTestId('analysis-add-tyt.matematik.temel-kavramlar'));
    expect(screen.getByTestId('analysis-tagged-matematik').props.children).toBe(
      'İşaretlenen: 6/6 yanlış · 1/4 boş',
    );

    // The steppers are folded away; their + stops at the section count too, − lowers it.
    expect(screen.queryByTestId('analysis-wrong-tyt.matematik.mutlak-deger-plus')).toBeNull();
    fireEvent.press(screen.getByTestId('analysis-details-matematik'));
    for (let i = 0; i < 3; i++) fireEvent.press(screen.getByTestId('analysis-wrong-tyt.matematik.mutlak-deger-plus'));
    fireEvent.press(screen.getByTestId('analysis-wrong-tyt.matematik.mutlak-deger-minus'));
    expect(screen.getByTestId('analysis-tagged-matematik').props.children).toBe(
      'İşaretlenen: 5/6 yanlış · 1/4 boş',
    );
    fireEvent.press(screen.getByTestId('analysis-details-matematik'));
    expect(screen.queryByTestId('analysis-wrong-tyt.matematik.mutlak-deger-plus')).toBeNull();
    fireEvent.press(screen.getByTestId('analysis-save'));
    expect(memory.marks.e1).toEqual([
      { sectionId: 'matematik', topicId: 'tyt.matematik.mutlak-deger', wrong: 5, blank: 0 },
      { sectionId: 'matematik', topicId: 'tyt.matematik.temel-kavramlar', wrong: 0, blank: 1 },
    ]);
  });

  it('VoiceOver hears the Yanlış | Boş switch (state and count) and each topic chip with its count', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    announce.mockClear();
    renderRouter(APP_DIR, { initialUrl: '/analiz/e1' });
    const wrong = screen.getByTestId('analysis-kind-matematik-wrong');
    const blank = screen.getByTestId('analysis-kind-matematik-blank');
    expect(wrong.props).toMatchObject({
      accessibilityRole: 'button',
      accessibilityLabel: 'Yanlış: 6 sorudan 0 tanesi işaretlendi',
      accessibilityState: { selected: true },
    });
    expect(blank.props.accessibilityState).toMatchObject({ selected: false });
    const chip = screen.getByTestId('analysis-add-tyt.matematik.mutlak-deger');
    expect(chip.props).toMatchObject({ accessibilityLabel: 'Mutlak Değer', accessibilityHint: '1 yanlış ekler' });

    fireEvent.press(chip);
    expect(announce).toHaveBeenLastCalledWith('Mutlak Değer: 1 yanlış, 0 boş');
    expect(screen.getByTestId('analysis-add-tyt.matematik.mutlak-deger').props.accessibilityLabel).toBe(
      'Mutlak Değer: 1 yanlış, 0 boş',
    );
    // The badge on the chip shows the same count.
    expect(screen.getByText('1 Y')).toBeTruthy();
    expect(screen.getByTestId('analysis-kind-matematik-wrong').props.accessibilityLabel).toBe(
      'Yanlış: 6 sorudan 1 tanesi işaretlendi',
    );

    fireEvent.press(screen.getByTestId('analysis-kind-matematik-blank'));
    expect(screen.getByTestId('analysis-kind-matematik-blank').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('analysis-kind-matematik-wrong').props.accessibilityState).toMatchObject({ selected: false });
    expect(screen.getByTestId('analysis-add-tyt.matematik.mutlak-deger').props.accessibilityHint).toBe('1 boş ekler');
    fireEvent.press(screen.getByTestId('analysis-add-tyt.matematik.mutlak-deger'));
    expect(announce).toHaveBeenLastCalledWith('Mutlak Değer: 1 yanlış, 1 boş');
    expect(screen.getByText('1 Y · 1 B')).toBeTruthy();
    announce.mockRestore();
  });

  it('a section with only blanks has no switch; topics missed most in recent exams come first', () => {
    memory.exams = [
      {
        ...memory.exams[0],
        scores: [{ sectionId: 'matematik', questions: 40, correct: 36, wrong: 0 }],
      },
      {
        id: 'old',
        kind: 'TYT',
        scope: 'genel',
        bransSectionId: null,
        takenOn: '2026-09-20',
        totalNet: 30,
        createdAt: 0,
        analysisDoneAt: 1,
        scores: [{ sectionId: 'matematik', questions: 40, correct: 30, wrong: 6 }],
      },
    ];
    memory.marks = {
      old: [
        { sectionId: 'matematik', topicId: 'tyt.matematik.olasilik', wrong: 4, blank: 0 },
        { sectionId: 'matematik', topicId: 'tyt.matematik.mutlak-deger', wrong: 2, blank: 0 },
      ],
    };
    renderRouter(APP_DIR, { initialUrl: '/analiz/e1' });
    expect(screen.queryByTestId('analysis-kind-matematik-wrong')).toBeNull();
    expect(screen.getByTestId('analysis-add-topic-matematik').props.children).toBe(
      'Bir konuya dokununca ona 1 boş eklenir.',
    );
    const chips = screen.queryAllByTestId(/^analysis-add-tyt\./).map((el) => el.props.testID);
    expect(chips.slice(0, 3)).toEqual([
      'analysis-add-tyt.matematik.olasilik',
      'analysis-add-tyt.matematik.mutlak-deger',
      'analysis-add-tyt.matematik.temel-kavramlar',
    ]);
    fireEvent.press(screen.getByTestId('analysis-add-tyt.matematik.olasilik'));
    expect(screen.getByTestId('analysis-tagged-matematik').props.children).toBe(
      'İşaretlenen: 0/0 yanlış · 1/4 boş',
    );
  });

  it('per-section net trend with a target and the distance to it', () => {
    renderRouter(APP_DIR, { initialUrl: '/denemeler' });
    fireEvent.press(screen.getByTestId('trend-section-matematik'));
    // The rule is said before a target is set (TARGET_WINDOW = 3).
    expect(screen.getByTestId('trend-target-rule').props.children).toBe(
      'Hedef netin, bu dersteki son 3 denemedeki (genel ya da branş) netlerinin ortalamasıyla kıyaslanır.',
    );
    expect(screen.getByTestId('trend-target').props.children).toBe('Bu ders için hedef koymadın.');
    fireEvent.changeText(screen.getByTestId('trend-target-input'), '45');
    fireEvent.press(screen.getByTestId('trend-target-save'));
    expect(screen.getByText('0’dan büyük, en fazla 40 olan ve en çok iki ondalıklı bir net gir (ör. 30).')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('trend-target-input'), '30');
    fireEvent.press(screen.getByTestId('trend-target-save'));
    expect(memory.netTargets['TYT:matematik']).toBe(30);
    expect(screen.getByTestId('trend-target').props.children).toBe('Hedef: 30 net');
    expect(screen.getByTestId('trend-gap').props.children).toBe(
      'Hedefe 1,5 net kaldı (son denemelerin ortalaması: 28,5).',
    );
  });

  it('the target example fits the section; two decimals are allowed', () => {
    renderRouter(APP_DIR, { initialUrl: '/denemeler' });
    fireEvent.press(screen.getByTestId('trend-section-tarih'));
    expect(screen.getByTestId('trend-target-input').props.placeholder).toBe('ör. 3,75');
    fireEvent.changeText(screen.getByTestId('trend-target-input'), '6');
    fireEvent.press(screen.getByTestId('trend-target-save'));
    expect(screen.getByText('0’dan büyük, en fazla 5 olan ve en çok iki ondalıklı bir net gir (ör. 3,75).')).toBeTruthy();
    fireEvent.changeText(screen.getByTestId('trend-target-input'), '3,67');
    fireEvent.press(screen.getByTestId('trend-target-save'));
    expect(memory.netTargets['TYT:tarih']).toBe(3.67);
  });
});

describe('mock exam entry, editing and charts', () => {
  const TYT_E1: MockExamWithScores = {
    id: 'e1',
    kind: 'TYT',
    scope: 'genel',
    bransSectionId: null,
    takenOn: '2026-10-01',
    totalNet: 57.5,
    createdAt: 1,
    analysisDoneAt: 5,
    scores: [
      { sectionId: 'turkce', questions: 40, correct: 30, wrong: 4 },
      { sectionId: 'matematik', questions: 40, correct: 30, wrong: 6 },
    ],
  };

  beforeEach(() => {
    memory.profile = ADULT_SAYISAL;
  });

  it('a double tap on Kaydet saves the exam once', () => {
    renderRouter(APP_DIR, { initialUrl: '/denemeler' });
    fireEvent.press(screen.getByTestId('exams-add'));
    fireEvent.changeText(screen.getByTestId('exam-correct-turkce'), '10');
    const save = screen.getByTestId('exam-save');
    fireEvent.press(save);
    fireEvent.press(save);
    expect(memory.saves).toBe(1);
    expect(memory.exams).toHaveLength(1);
    expect(memory.exams[0]).toMatchObject({ kind: 'TYT', totalNet: 10 });
    // Back on the list (the form closed after the first tap).
    expect(screen.getByTestId('exam-item-0-net').props.children).toEqual(['10', ' ', 'net']);
  });

  it('Kaydet on a form with nothing entered is refused with the reason', () => {
    renderRouter(APP_DIR, { initialUrl: '/denemeler' });
    fireEvent.press(screen.getByTestId('exams-add'));
    fireEvent.press(screen.getByTestId('exam-save'));
    expect(memory.saves).toBe(0);
    expect(screen.getByTestId('exam-empty-error').props.children).toBe(
      'Kaydetmek için en az bir derse doğru ya da yanlış sayısı gir.',
    );
    // A typed 0 is still nothing entered.
    fireEvent.changeText(screen.getByTestId('exam-correct-turkce'), '0');
    fireEvent.press(screen.getByTestId('exam-save'));
    expect(memory.saves).toBe(0);
    fireEvent.changeText(screen.getByTestId('exam-wrong-turkce'), '2');
    expect(screen.queryByTestId('exam-empty-error')).toBeNull();
    fireEvent.press(screen.getByTestId('exam-save'));
    expect(memory.exams[0]).toMatchObject({ totalNet: -0.5 });
  });

  it('Vazgeç closes an untouched form; with something entered it asks first', () => {
    renderRouter(APP_DIR, { initialUrl: '/denemeler' });
    fireEvent.press(screen.getByTestId('exams-add'));
    fireEvent.press(screen.getByTestId('exam-cancel'));
    expect(screen.queryByTestId('exam-form')).toBeNull();

    fireEvent.press(screen.getByTestId('exams-add'));
    fireEvent.changeText(screen.getByTestId('exam-correct-turkce'), '10');
    fireEvent.press(screen.getByTestId('exam-cancel'));
    expect(screen.getByTestId('exam-discard-question').props.children).toBe('Girdiklerin kaydedilmeyecek. Çıkılsın mı?');
    fireEvent.press(screen.getByTestId('exam-discard-stay'));
    expect(screen.queryByTestId('exam-discard-question')).toBeNull();
    expect(screen.getByTestId('exam-correct-turkce').props.value).toBe('10');
    // Any other way out (pulling the sheet down lands here too) is held the same way.
    act(() => router.back());
    expect(screen.getByTestId('exam-discard-question')).toBeTruthy();
    fireEvent.press(screen.getByTestId('exam-discard-leave'));
    expect(screen.queryByTestId('exam-form')).toBeNull();
    expect(memory.saves).toBe(0);
  });

  it('edit: closing unchanged does not ask, a change does; an emptied form is not saved', () => {
    memory.exams = [TYT_E1];
    renderRouter(APP_DIR, { initialUrl: '/deneme/e1' });
    fireEvent.press(screen.getByTestId('exam-edit'));
    fireEvent.press(screen.getByTestId('exam-cancel'));
    expect(screen.queryByTestId('exam-form')).toBeNull();
    expect(screen.getByTestId('exam-detail-total')).toBeTruthy();

    fireEvent.press(screen.getByTestId('exam-edit'));
    fireEvent.press(screen.getByTestId('exam-prev-day'));
    fireEvent.press(screen.getByTestId('exam-cancel'));
    expect(screen.getByTestId('exam-discard-question').props.children).toBe(
      'Değişikliklerin kaydedilmeyecek. Çıkılsın mı?',
    );
    fireEvent.press(screen.getByTestId('exam-discard-stay'));
    for (const id of ['exam-correct-turkce', 'exam-wrong-turkce', 'exam-correct-matematik', 'exam-wrong-matematik']) {
      fireEvent.changeText(screen.getByTestId(id), '');
    }
    fireEvent.press(screen.getByTestId('exam-save'));
    expect(screen.getByTestId('exam-empty-error')).toBeTruthy();
    fireEvent.press(screen.getByTestId('exam-cancel'));
    fireEvent.press(screen.getByTestId('exam-discard-leave'));
    expect(memory.exams[0]).toMatchObject({ takenOn: '2026-10-01', totalNet: 57.5 });
  });

  it('exam detail: each section row is read as one sentence; no rounding note when the nets add up', () => {
    memory.exams = [TYT_E1];
    renderRouter(APP_DIR, { initialUrl: '/deneme/e1' });
    expect(screen.getByLabelText('Türkçe: 30 doğru, 4 yanlış, 29 net')).toBeTruthy();
    expect(screen.queryByTestId('exam-detail-rounding')).toBeNull();
  });

  it('exam detail: LGS section nets that do not add up to the total get a note', () => {
    memory.profile = { ...ADULT_SAYISAL, examType: 'LGS', yksArea: null };
    const s = (sectionId: string, questions: number, correct: number, wrong: number) => ({ sectionId, questions, correct, wrong });
    memory.exams = [
      {
        ...TYT_E1,
        kind: 'LGS',
        totalNet: 46 + 1 / 3,
        // 9,67 + 4,33 + 6,67 + 5,67 + 9,67 + 10,33 = 46,34, total 46,33.
        scores: [s('turkce', 20, 10, 1), s('inkilap', 10, 5, 2), s('din', 10, 7, 1), s('yabanci_dil', 10, 6, 1), s('matematik', 20, 10, 1), s('fen', 20, 11, 2)],
      },
    ];
    renderRouter(APP_DIR, { initialUrl: '/deneme/e1' });
    expect(screen.getByTestId('exam-detail-total').props.children).toBe('46,33');
    expect(screen.getByTestId('exam-detail-rounding')).toBeTruthy();
  });

  it('after Kaydet the list confirms the net and offers the analysis once', () => {
    jest.mocked(Haptics.notificationAsync).mockClear();
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    renderRouter(APP_DIR, { initialUrl: '/denemeler' });
    fireEvent.press(screen.getByTestId('exams-add'));
    // Türkçe 10 doğru 6 yanlış = 8,5 net; the other sections stay blank, so there is something to analyse.
    fireEvent.changeText(screen.getByTestId('exam-correct-turkce'), '10');
    fireEvent.changeText(screen.getByTestId('exam-wrong-turkce'), '6');
    fireEvent.press(screen.getByTestId('exam-save'));

    expect(screen.getByTestId('exams-saved-title').props.children).toBe('8,5 net kaydedildi');
    expect(Haptics.notificationAsync).toHaveBeenCalledWith('success');
    expect(announce).toHaveBeenCalledWith('8,5 net kaydedildi');
    // The reminder card would repeat the same offer for the same exam.
    expect(screen.queryByTestId('analysis-reminder')).toBeNull();
    fireEvent.press(screen.getByTestId('exams-saved-analysis'));
    expect(screen.getByTestId('analysis-tagged-turkce')).toBeTruthy();

    // Back on the list: the confirmation was a moment; the usual reminder takes over.
    act(() => router.back());
    expect(screen.queryByTestId('exams-saved')).toBeNull();
    expect(screen.getByTestId('analysis-reminder').props.children).toBe('Analizi bekleyen 1 deneme var');
    announce.mockRestore();
  });

  it('an exam with nothing to analyse is only confirmed; "Kapat" removes the card', () => {
    renderRouter(APP_DIR, { initialUrl: '/denemeler' });
    fireEvent.press(screen.getByTestId('exams-add'));
    fireEvent.press(screen.getByTestId('exam-scope-brans'));
    fireEvent.changeText(screen.getByTestId('exam-correct-turkce'), '40');
    fireEvent.press(screen.getByTestId('exam-save'));
    expect(screen.getByTestId('exams-saved-title').props.children).toBe('40 net kaydedildi');
    expect(screen.queryByTestId('exams-saved-analysis')).toBeNull();
    fireEvent.press(screen.getByLabelText('Kaydedildi bilgisini kapat'));
    expect(screen.queryByTestId('exams-saved')).toBeNull();
  });

  it('the confirmation is gone once the student leaves the list and comes back', () => {
    renderRouter(APP_DIR, { initialUrl: '/denemeler' });
    fireEvent.press(screen.getByTestId('exams-add'));
    fireEvent.changeText(screen.getByTestId('exam-correct-turkce'), '5');
    fireEvent.press(screen.getByTestId('exam-save'));
    expect(screen.getByTestId('exams-saved')).toBeTruthy();
    fireEvent.press(screen.getByTestId('exam-item-0'));
    expect(screen.getByTestId('exam-detail-total')).toBeTruthy();
    act(() => router.back());
    expect(screen.getByTestId('exam-item-0')).toBeTruthy();
    expect(screen.queryByTestId('exams-saved')).toBeNull();
  });

  it('the list draws 20 exams at a time; "Daha fazla göster" adds the next 20', () => {
    memory.exams = Array.from({ length: 45 }, (_, i) => ({ ...TYT_E1, id: `e${i}`, totalNet: i }));
    renderRouter(APP_DIR, { initialUrl: '/denemeler' });
    expect(screen.getByTestId('exam-item-19-net').props.children).toEqual(['19', ' ', 'net']);
    expect(screen.queryByTestId('exam-item-20')).toBeNull();
    fireEvent.press(screen.getByTestId('exams-more'));
    expect(screen.getByTestId('exam-item-39')).toBeTruthy();
    expect(screen.queryByTestId('exam-item-40')).toBeNull();
    fireEvent.press(screen.getByTestId('exams-more'));
    expect(screen.getByTestId('exam-item-44-net').props.children).toEqual(['44', ' ', 'net']);
    expect(screen.queryByTestId('exams-more')).toBeNull();
  });

  it('20 exams or fewer: no "Daha fazla göster"', () => {
    memory.exams = Array.from({ length: 20 }, (_, i) => ({ ...TYT_E1, id: `e${i}` }));
    renderRouter(APP_DIR, { initialUrl: '/denemeler' });
    expect(screen.getByTestId('exam-item-19')).toBeTruthy();
    expect(screen.queryByTestId('exams-more')).toBeNull();
  });

  it('"Dün" picks yesterday in one tap; the boxes move on with the return key / keyboard bar', () => {
    const keyboardListeners: { show?: (e: object) => void; hide?: (e: object) => void } = {};
    const keyboardSpy = jest.spyOn(Keyboard, 'addListener').mockImplementation(((event: string, cb: (e: object) => void) => {
      if (event === 'keyboardWillShow' || event === 'keyboardDidShow') keyboardListeners.show = cb;
      if (event === 'keyboardWillHide' || event === 'keyboardDidHide') keyboardListeners.hide = cb;
      return { remove: () => {} };
    }) as unknown as typeof Keyboard.addListener);
    renderRouter(APP_DIR, { initialUrl: '/denemeler' });
    fireEvent.press(screen.getByTestId('exams-add'));
    fireEvent.press(screen.getByTestId('exam-day-yesterday'));
    expect(screen.getByTestId('exam-day-yesterday').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('exam-correct-turkce').props.returnKeyType).toBe('next');
    expect(screen.getByTestId('exam-wrong-biyoloji').props.returnKeyType).toBe('done');
    // The number pad has no return key, so a "‹ Önceki / Sonraki › / Bitti" bar is drawn right above
    // it while it is open (not an InputAccessoryView: that is not drawn inside the sheet).
    expect(screen.queryByTestId('exam-keyboard-bar')).toBeNull();
    act(() => keyboardListeners.show?.({ endCoordinates: { height: 300 } }));
    expect(screen.getByTestId('exam-keyboard-bar').props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ bottom: 300 })]),
    );
    expect(screen.getByLabelText('Sonraki kutu')).toBeTruthy();
    fireEvent.press(screen.getByTestId('exam-keyboard-done'));
    act(() => keyboardListeners.hide?.({}));
    expect(screen.queryByTestId('exam-keyboard-bar')).toBeNull();
    fireEvent(screen.getByTestId('exam-correct-turkce'), 'submitEditing');
    fireEvent.changeText(screen.getByTestId('exam-correct-turkce'), '8');
    fireEvent.press(screen.getByTestId('exam-save'));
    const { addDays, istanbulDayKey } = jest.requireActual('../domain/istanbul-day');
    expect(memory.exams[0].takenOn).toBe(addDays(istanbulDayKey(Date.now()), -1));
    keyboardSpy.mockRestore();
  });

  it('chips name the choice they belong to', () => {
    renderRouter(APP_DIR, { initialUrl: '/deneme/yeni' });
    expect(screen.getByLabelText('Deneme türü: Branş')).toBeTruthy();
    expect(screen.getByLabelText('Sınav: AYT Sayısal')).toBeTruthy();
    expect(screen.getByLabelText('Deneme tarihi: Bugün')).toBeTruthy();
  });

  it('edit: the saved values are filled in; date, type and counts change, the analysis stays', () => {
    memory.exams = [TYT_E1];
    memory.marks = { e1: [{ sectionId: 'matematik', topicId: 'tyt.matematik.mutlak-deger', wrong: 3, blank: 0 }] };
    renderRouter(APP_DIR, { initialUrl: '/denemeler' });
    fireEvent.press(screen.getByTestId('exam-item-0'));
    fireEvent.press(screen.getByTestId('exam-edit'));
    expect(screen.getByTestId('exam-correct-turkce').props.value).toBe('30');
    expect(screen.getByTestId('exam-wrong-matematik').props.value).toBe('6');
    expect(screen.getByTestId('exam-total-net').props.children).toBe('57,5');
    fireEvent.changeText(screen.getByTestId('exam-wrong-turkce'), '0');
    fireEvent.press(screen.getByTestId('exam-prev-day'));
    fireEvent.press(screen.getByTestId('exam-save'));

    expect(memory.exams).toHaveLength(1);
    expect(memory.exams[0]).toMatchObject({ id: 'e1', takenOn: '2026-09-30', totalNet: 30 + 28.5, analysisDoneAt: 5 });
    expect(memory.marks.e1).toHaveLength(1);
    // Back on the detail screen with the new total.
    expect(screen.getByTestId('exam-detail-total').props.children).toBe('58,5');
  });

  it('edit: lowering the wrong count below the tagged topics drops them and asks for the analysis again', () => {
    memory.exams = [TYT_E1];
    memory.marks = { e1: [{ sectionId: 'matematik', topicId: 'tyt.matematik.mutlak-deger', wrong: 3, blank: 0 }] };
    renderRouter(APP_DIR, { initialUrl: '/deneme/e1' });
    fireEvent.press(screen.getByTestId('exam-edit'));
    fireEvent.changeText(screen.getByTestId('exam-wrong-matematik'), '1');
    fireEvent.press(screen.getByTestId('exam-save'));
    expect(memory.marks.e1).toEqual([]);
    expect(memory.exams[0].analysisDoneAt).toBeNull();
  });

  it('"o denemeden beri": time on the topic from the day of the last exam that missed it', () => {
    const studiedOn = (id: string, iso: string, minutes: number, topicId: string): CompletedSession => ({
      id,
      subjectId: 'matematik',
      topicId,
      startedAt: Date.parse(iso),
      endedAt: Date.parse(iso) + minutes * 60_000,
      pauses: [],
      durationMs: minutes * 60_000,
      source: 'timer',
    });
    memory.exams = [{ ...TYT_E1, id: 'e2', takenOn: '2026-10-04', createdAt: 2 }, TYT_E1];
    memory.marks = {
      e1: [{ sectionId: 'matematik', topicId: 'tyt.matematik.mutlak-deger', wrong: 3, blank: 0 }],
      e2: [{ sectionId: 'matematik', topicId: 'tyt.matematik.mutlak-deger', wrong: 1, blank: 0 }],
    };
    memory.sessions = [
      // 3 Oct: before the last exam that missed it (4 Oct), so not counted.
      studiedOn('s1', '2026-10-03T15:00:00Z', 50, 'tyt.matematik.mutlak-deger'),
      // 4 Oct 01:00 Istanbul (3 Oct 22:00 UTC): the exam day, counted.
      studiedOn('s2', '2026-10-03T22:00:00Z', 20, 'tyt.matematik.mutlak-deger'),
      studiedOn('s3', '2026-10-05T15:00:00Z', 65, 'tyt.matematik.mutlak-deger'),
      studiedOn('s4', '2026-10-05T17:00:00Z', 30, 'tyt.matematik.olasilik'),
    ];
    renderRouter(APP_DIR, { initialUrl: '/denemeler' });
    expect(screen.getByText('4 Y')).toBeTruthy();
    expect(screen.getByTestId('missed-since-tyt.matematik.mutlak-deger').props.children).toBe(
      '4 Ekim 2026 denemesinden beri 1 sa 25 dk çalıştın.',
    );
  });

  it('a single exam is one point with a hint', () => {
    memory.exams = [TYT_E1];
    renderRouter(APP_DIR, { initialUrl: '/denemeler' });
    expect(screen.getByTestId('exams-chart-caption').props.children).toBe(
      'Son deneme: 57,5 net. Bir deneme daha ekleyince eğilim görünür.',
    );
  });

  it('two exams show the change from the previous one', () => {
    memory.exams = [{ ...TYT_E1, id: 'e2', takenOn: '2026-10-04', totalNet: 62 }, TYT_E1];
    renderRouter(APP_DIR, { initialUrl: '/denemeler' });
    expect(screen.getByTestId('exams-chart-caption').props.children).toBe('Son deneme: 62 net · öncekinden +4,5');
    expect(screen.getByLabelText(/^Grafik\. 01\.10: 57,5, 04\.10: 62/)).toBeTruthy();
  });

  it('most-missed topic: one tap marks it for review, "Çalış" starts the timer on it', () => {
    memory.exams = [TYT_E1];
    memory.marks = { e1: [{ sectionId: 'matematik', topicId: 'tyt.matematik.mutlak-deger', wrong: 3, blank: 0 }] };
    renderRouter(APP_DIR, { initialUrl: '/denemeler' });
    expect(screen.getByTestId('missed-window').props.children).toBe('Konu işaretlediğin son 5 denemeye göre.');
    expect(screen.getByTestId('missed-since-tyt.matematik.mutlak-deger').props.children).toBe(
      '1 Ekim 2026 denemesinden beri bu konuda süre yok.',
    );
    fireEvent.press(screen.getByLabelText('Mutlak Değer: tekrar lazım'));
    expect(memory.topicStatuses['tyt.matematik.mutlak-deger']).toBe('review');
    expect(screen.getByTestId('missed-review-tyt.matematik.mutlak-deger').props.accessibilityState).toMatchObject({
      selected: true,
    });
    fireEvent.press(screen.getByLabelText('Mutlak Değer konusunda sayacı başlat'));
    expect(memory.active).toMatchObject({ subjectId: 'matematik', topicId: 'tyt.matematik.mutlak-deger' });
    expect(screen.getByTestId('timer-subject')).toBeTruthy();
  });

  it('analysis steppers say which topic they change', () => {
    memory.exams = [{ ...TYT_E1, analysisDoneAt: null }];
    renderRouter(APP_DIR, { initialUrl: '/analiz/e1' });
    fireEvent.press(screen.getByLabelText('Mutlak Değer'));
    fireEvent.press(screen.getByLabelText('Matematik: ayrıntıyı göster'));
    expect(screen.getByLabelText('Matematik: ayrıntıyı gizle')).toBeTruthy();
    expect(screen.getByLabelText('Mutlak Değer, Yanlış, artır')).toBeTruthy();
    expect(screen.getByLabelText('Mutlak Değer, Boş, azalt')).toBeTruthy();
  });

  it('LGS: own paper and wrong / 3, no YKS sections', () => {
    memory.profile = { ...ADULT_SAYISAL, examType: 'LGS', yksArea: null };
    renderRouter(APP_DIR, { initialUrl: '/deneme/yeni' });
    expect(screen.queryAllByTestId(/^exam-kind-/).map((el) => el.props.testID)).toEqual(['exam-kind-LGS']);
    expect(screen.getByTestId('exam-net-rule').props.children).toBe('Net = Doğru − Yanlış ÷ 3');
    fireEvent.changeText(screen.getByTestId('exam-correct-turkce'), '15');
    fireEvent.changeText(screen.getByTestId('exam-wrong-turkce'), '3');
    expect(screen.getByTestId('exam-net-turkce').props.children).toBe('14');
    expect(screen.queryByTestId('exam-correct-tarih')).toBeNull();
  });

  it('"Diğer" exam type: no form, no add button', () => {
    memory.profile = { ...ADULT_SAYISAL, examType: 'DIGER', yksArea: null };
    renderRouter(APP_DIR, { initialUrl: '/denemeler' });
    expect(screen.getByTestId('exams-no-form')).toBeTruthy();
    expect(screen.queryByTestId('exams-add')).toBeNull();
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
    jest.useFakeTimers();
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
    expect(screen.getByTestId('compare-line')).toHaveTextContent(
      'Dün bu saate kadar 1 sa 0 dk · Geçen hafta bu zamana kadar 30 dk',
    );
    expect(screen.getByText('1 sa 0 dk elle eklendi')).toBeTruthy();
  });

  it('the first days show no comparison; later only the past that holds study time', () => {
    memory.sessions = [];
    const first = renderRouter(APP_DIR, { initialUrl: '/' });
    expect(screen.getByTestId('today-total').props.children).toBe('0 dk');
    expect(screen.queryByTestId('compare-line')).toBeNull();
    expect(screen.queryByText('Kendinle kıyas')).toBeNull();
    first.unmount();

    memory.sessions = [session('lw', '2026-09-30T07:00:00Z', '2026-09-30T07:30:00Z')]; // last Wednesday only
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(screen.getByTestId('compare-line')).toHaveTextContent('Geçen hafta bu zamana kadar 30 dk');
    expect(screen.queryByTestId('compare-yesterday')).toBeNull();
  });

  it('without a goal, the home card sets one in place (presets, 15 min steps, off)', () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(screen.queryByTestId('streak')).toBeNull();
    fireEvent.press(screen.getByTestId('goal-set'));
    fireEvent.press(screen.getByTestId('goal-preset-180'));
    expect(memory.dailyGoal).toBe(180);
    fireEvent.press(screen.getByTestId('goal-sheet-plus'));
    expect(memory.dailyGoal).toBe(195);
    fireEvent.press(screen.getByTestId('goal-sheet-done'));
    expect(screen.queryByTestId('goal-sheet')).toBeNull();
    // Still on the timer screen, now with progress and streak.
    expect(screen.getByTestId('timer-start')).toBeTruthy();
    expect(screen.getByTestId('goal-progress').props.children).toBe('Hedef 3 sa 15 dk · %30');
    expect(screen.getByTestId('streak')).toBeTruthy();
    fireEvent.press(screen.getByTestId('goal-edit'));
    fireEvent.press(screen.getByTestId('goal-sheet-off'));
    expect(memory.dailyGoal).toBeNull();
    fireEvent.press(screen.getByTestId('goal-sheet-done'));
    expect(screen.getByTestId('goal-set')).toBeTruthy();
  });

  it('settings still turn the goal on, change and off', () => {
    renderRouter(APP_DIR, { initialUrl: '/ayarlar' });
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

  it('the pause button says "Duraklat" ("Mola" is the phase); the clock is read as the time left', () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(screen.getByTestId('mode-pomodoro'));
    fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
    jump(47_000);
    expect(screen.getByTestId('timer-clock').props.children).toBe('24:12');
    expect(screen.getByTestId('timer-clock').props.accessibilityLabel).toBe('24 dakika 12 saniye kaldı');
    expect(screen.queryByRole('button', { name: 'Mola' })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Duraklat' }));
    expect(screen.getByTestId('timer-status').props.children).toBe('Duraklatıldı');
    fireEvent.press(screen.getByRole('button', { name: 'Devam' }));
    fireEvent.press(screen.getByRole('button', { name: 'Bitir' }));
    // The stopwatch keeps "Mola" and its digits (E2E reads them).
    fireEvent.press(screen.getByTestId('mode-stopwatch'));
    fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
    expect(screen.getByRole('button', { name: 'Mola' })).toBeTruthy();
    expect(screen.getByTestId('timer-clock').props.accessibilityLabel).toBeUndefined();
  });

  it('settings change the pomodoro lengths within limits', () => {
    renderRouter(APP_DIR, { initialUrl: '/ayarlar' });
    fireEvent.press(screen.getByTestId('settings-pomodoro-workMin-plus'));
    expect(memory.pomodoroConfig.workMin).toBe(30);
    fireEvent.press(screen.getByTestId('settings-pomodoro-longEvery-minus'));
    expect(memory.pomodoroConfig.longEvery).toBe(3);
  });

  it('a pomodoro preset sets all four lengths; changing one leaves no preset selected', () => {
    renderRouter(APP_DIR, { initialUrl: '/ayarlar' });
    const selected = (id: string) => screen.getByTestId(`settings-pomodoro-preset-${id}`).props.accessibilityState?.selected;
    expect(selected('25-5')).toBe(true);
    expect(screen.getByTestId('settings-pomodoro-preset-50-10').props.accessibilityLabel).toBe('50 dakika çalışma, 10 dakika mola');
    fireEvent.press(screen.getByTestId('settings-pomodoro-preset-50-10'));
    expect(memory.pomodoroConfig).toEqual({ workMin: 50, shortBreakMin: 10, longBreakMin: 30, longEvery: 4 });
    expect([selected('25-5'), selected('50-10'), selected('90-15')]).toEqual([false, true, false]);
    fireEvent.press(screen.getByTestId('settings-pomodoro-preset-90-15'));
    expect(memory.pomodoroConfig).toEqual({ workMin: 90, shortBreakMin: 15, longBreakMin: 30, longEvery: 2 });
    fireEvent.press(screen.getByTestId('settings-pomodoro-workMin-minus'));
    expect(memory.pomodoroConfig.workMin).toBe(85);
    expect([selected('25-5'), selected('50-10'), selected('90-15')]).toEqual([false, false, false]);
    fireEvent.press(screen.getByTestId('settings-pomodoro-preset-25-5'));
    expect(memory.pomodoroConfig).toEqual({ workMin: 25, shortBreakMin: 5, longBreakMin: 15, longEvery: 4 });
  });
});

describe('exam countdown', () => {
  beforeEach(() => {
    memory.profile = ADULT_SAYISAL;
    jest.useFakeTimers();
    jest.setSystemTime(Date.parse('2026-10-04T09:00:00Z'));
  });

  it('home shows the days left to the estimated YKS date', () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(screen.getByTestId('countdown').props.children).toBe('YKS’ye 258 gün');
    expect(screen.getByText('tahmini')).toBeTruthy();
  });

  it('the student can set the exact date and go back to the estimate', () => {
    renderRouter(APP_DIR, { initialUrl: '/ayarlar' });
    const invalid = 'Bugün ya da sonrası için GG.AA.YYYY biçiminde bir tarih gir.';
    const input = () => screen.getByTestId('settings-exam-date-input');
    expect(screen.getByTestId('settings-exam-date').props.children).toBe('19 Haziran 2027');
    // Saved as it is typed, no Kaydet button; an error only once the entry is finished.
    expect(screen.queryByTestId('settings-exam-date-save')).toBeNull();
    fireEvent.changeText(input(), '01.01.2020');
    expect(screen.getByText(invalid)).toBeTruthy();
    expect(memory.examDates.YKS).toBeUndefined();
    fireEvent.changeText(input(), '26.06');
    expect(screen.queryByText(invalid)).toBeNull();
    fireEvent(input(), 'blur');
    expect(screen.getByText(invalid)).toBeTruthy();
    fireEvent.changeText(input(), '26.06.202');
    expect(screen.queryByText(invalid)).toBeNull();
    expect(memory.examDates.YKS).toBeUndefined();
    fireEvent.changeText(input(), '26.06.2027');
    expect(memory.examDates.YKS).toBe('2027-06-26');
    expect(input().props.value).toBe('');
    expect(screen.getByTestId('settings-exam-date').props.children).toBe('26 Haziran 2027');
    expect(screen.getByText('senin girdiğin tarih')).toBeTruthy();
    // The tag says it is the student's date; the "tahmin" line is gone.
    expect(screen.queryByTestId('settings-exam-date-info')).toBeNull();
    expect(screen.getByTestId('settings-exam-date-reset')).toHaveTextContent('Tahmini tarihe dön');
    fireEvent.press(screen.getByTestId('settings-exam-date-reset'));
    expect(memory.examDates.YKS).toBeUndefined();
    expect(screen.getByTestId('settings-exam-date-info').props.children).toBe(
      'Bu tarih önceki yılların düzenine göre bir tahmindir; kesin tarih açıklanınca buradan düzeltebilirsin.',
    );
  });

  it('KPSS: the date line names the session the default date is for', () => {
    memory.profile = { ...ADULT_SAYISAL, examType: 'KPSS', yksArea: null };
    renderRouter(APP_DIR, { initialUrl: '/ayarlar' });
    expect(screen.getByTestId('settings-exam-date-info').props.children).toMatch(/^Bu tarih, bir sonraki KPSS Lisans \(B grubu\)/);
  });

  it('"Diğer" without a date says what one gives; its own date is removed, not reset to an estimate', () => {
    memory.profile = { ...ADULT_SAYISAL, examType: 'DIGER', yksArea: null };
    renderRouter(APP_DIR, { initialUrl: '/ayarlar' });
    expect(screen.getByTestId('settings-exam-date').props.children).toBe('Tarih yok');
    expect(screen.getByTestId('settings-exam-date-info').props.children).toBe(
      'Sınav tarihini girersen Sayaç ekranında geri sayım görünür.',
    );
    fireEvent.changeText(screen.getByTestId('settings-exam-date-input'), '01.07.2027');
    expect(memory.examDates.DIGER).toBe('2027-07-01');
    // There is no estimate to go back to.
    expect(screen.getByTestId('settings-exam-date-reset')).toHaveTextContent('Tarihi kaldır');
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

  it('birth years are part of the page; older ones one tap away; nothing pre-selected (K-15)', () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    const year = new Date().getUTCFullYear();
    expect(screen.getByTestId(`birth-year-${year - 8}`)).toBeTruthy();
    expect(screen.getByTestId(`birth-year-${year - 30}`)).toBeTruthy();
    expect(screen.queryByTestId(`birth-year-${year - 31}`)).toBeNull();
    for (const age of [8, 14, 15, 18, 30]) {
      expect(screen.getByTestId(`birth-year-${year - age}`).props.accessibilityState).toMatchObject({ selected: false });
    }
    fireEvent.press(screen.getByTestId('birth-year-more'));
    expect(screen.queryByTestId('birth-year-more')).toBeNull();
    fireEvent.press(screen.getByTestId(`birth-year-${year - 45}`));
    fireEvent.press(screen.getByText('KPSS'));
    fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
    expect(memory.profile).toMatchObject({ birthYear: year - 45, examType: 'KPSS' });
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
    // Each box names its section for screen readers (18 boxes on a TYT paper).
    fireEvent.changeText(screen.getByLabelText('Türkçe, Doğru'), '30');
    fireEvent.changeText(screen.getByLabelText('Türkçe, Yanlış'), '5');
    expect(screen.getAllByText('28,75').length).toBeGreaterThan(0);
  });

  it('settings: delete all data returns to onboarding', () => {
    renderRouter(APP_DIR, { initialUrl: '/ayarlar' });
  fireEvent.press(screen.getByRole('button', { name: 'Tüm verileri sil' }));
  fireEvent.press(screen.getByRole('button', { name: 'Evet, hepsini sil' }));
    expect(memory.profile).toBeNull();
    expect(screen.getByText('Doğum yılın')).toBeTruthy();
  });

  it('"Önce yedek al" in the delete dialog shares the backup and deletes nothing; deleting stays a choice of its own', async () => {
    memory.sessions = [
      {
        id: 'a',
        subjectId: 'fizik',
        topicId: null,
        startedAt: Date.parse('2026-10-01T07:00:00Z'),
        endedAt: Date.parse('2026-10-01T08:00:00Z'),
        pauses: [],
        durationMs: 3_600_000,
        source: 'timer',
      },
    ];
    renderRouter(APP_DIR, { initialUrl: '/ayarlar' });
    fireEvent.press(screen.getByRole('button', { name: 'Tüm verileri sil' }));
    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Önce yedek al' }));
    });
    expect(memory.shared).toHaveLength(1);
    expect(memory.shared[0].name).toMatch(/^etut-yedek-\d{4}-\d{2}-\d{2}\.json$/);
    expect(JSON.parse(memory.shared[0].content)).toMatchObject({ format: 'etut-yedek', sessions: [{ id: 'a' }] });
    expect(memory.lastBackupAt).not.toBeNull();
    // The share sheet does not tell whether the file was saved: the note says so.
    expect(screen.getByTestId('settings-delete-all-backup-note').props.children).toBe(
      'Yedek dosyası hazırlandı. Silmeden önce dosyayı bir yere kaydettiğinden emin ol; Etüt bunu kontrol edemez.',
    );
    // Nothing deleted, the dialog still open.
    expect(memory.profile).not.toBeNull();
    expect(memory.sessions).toHaveLength(1);
    expect(screen.getByTestId('settings-delete-all-dialog')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Evet, hepsini sil' }));
    expect(memory.profile).toBeNull();
  });
});

describe('subjects and papers follow the exam and YKS area', () => {
  const ids = (prefix: string) =>
    screen
      .queryAllByTestId(new RegExp(`^${prefix}`))
      .map((el) => String(el.props.testID).slice(prefix.length));

  it('Sayısal: no literature or foreign language on the timer, only TYT and AYT Sayısal papers', () => {
    memory.profile = ADULT_SAYISAL;
    renderRouter(APP_DIR, { initialUrl: '/' });
    const subjects = ids('subject-');
    expect(subjects).toEqual(expect.arrayContaining(['matematik', 'fizik', 'turkce', 'tarih']));
    expect(subjects).not.toContain('edebiyat');
    expect(subjects).not.toContain('yabanci_dil');
    act(() => router.push('/deneme/yeni'));
    expect(ids('exam-kind-')).toEqual(['TYT', 'AYT_SAY']);
  });

  it('settings change the area (not the birth year); the lists follow', () => {
    memory.profile = ADULT_SAYISAL;
    renderRouter(APP_DIR, { initialUrl: '/ayarlar' });
    fireEvent.press(screen.getByTestId('settings-yks-area-esit_agirlik'));
    fireEvent.press(screen.getByTestId('settings-exam-save'));
    expect(memory.profile).toEqual({ ...ADULT_SAYISAL, yksArea: 'esit_agirlik' });
    expect(screen.getByTestId('settings-exam-saved')).toBeTruthy();
    act(() => router.push('/'));
    // EA: the AYT subjects of the area first, TYT Fizik stays, no foreign language.
    expect(ids('subject-').slice(0, 5)).toEqual(['matematik', 'geometri', 'edebiyat', 'tarih', 'cografya']);
    expect(ids('subject-')).toContain('fizik');
    expect(ids('subject-')).not.toContain('yabanci_dil');
    act(() => router.push('/deneme/yeni'));
    expect(ids('exam-kind-')).toEqual(['TYT', 'AYT_EA']);
  });

  it('switching to a non-YKS exam drops the area', () => {
    memory.profile = ADULT_SAYISAL;
    renderRouter(APP_DIR, { initialUrl: '/ayarlar' });
    fireEvent.press(screen.getByTestId('settings-exam-type-KPSS'));
    fireEvent.press(screen.getByTestId('settings-exam-save'));
    expect(memory.profile).toMatchObject({ examType: 'KPSS', yksArea: null, birthYear: 2000, soloOnly: false });
  });

  it('charts keep a paper that already has exams after the area changed', () => {
    memory.profile = { ...ADULT_SAYISAL, yksArea: 'sozel' };
    memory.exams = [
      {
        id: 'old',
        kind: 'AYT_SAY',
        scope: 'genel',
        bransSectionId: null,
        takenOn: '2026-09-01',
        totalNet: 40,
        createdAt: 1,
        analysisDoneAt: 1,
        scores: [{ sectionId: 'matematik', questions: 40, correct: 40, wrong: 0 }],
      },
    ];
    renderRouter(APP_DIR, { initialUrl: '/denemeler' });
    expect(ids('exams-chart-kind-')).toEqual(['TYT', 'AYT_SOZ', 'AYT_SAY']);
  });
});

describe('first-use tips', () => {
  it('shown once after onboarding, three steps, then remembered', () => {
    memory.tipsSeen = false;
    memory.profile = ADULT_SAYISAL;
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(screen.getByTestId('tips-card')).toBeTruthy();
    fireEvent.press(screen.getByTestId('tips-next'));
    fireEvent.press(screen.getByTestId('tips-next'));
    expect(screen.queryByTestId('tips-skip')).toBeNull();
    fireEvent.press(screen.getByTestId('tips-done'));
    expect(memory.tipsSeen).toBe(true);
    expect(screen.queryByTestId('tips-card')).toBeNull();
  });

  it('not shown again', () => {
    memory.profile = ADULT_SAYISAL;
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(screen.queryByTestId('tips-card')).toBeNull();
  });
});

describe('accessibility text sizes (iOS Larger Text)', () => {
  // The same module instance the app uses; the jest preset reports fontScale 2 by default.
  const RN = jest.requireActual<typeof import('react-native')>('react-native');
  let dimensions: jest.SpyInstance | null = null;
  /** 1 = the default text size; iOS AX1…AX5 are about 1.8, 2.1, 2.6, 3.1 and 3.6. */
  function textSize(fontScale: number) {
    dimensions = jest.spyOn(RN.Dimensions, 'get').mockReturnValue({ width: 393, height: 852, scale: 3, fontScale });
  }
  afterEach(() => {
    dimensions?.mockRestore();
    dimensions = null;
  });

  type Node = ReturnType<typeof screen.getByTestId>;
  /** `flexDirection` of the laid-out views around a control, nearest first. */
  function directions(node: Node): string[] {
    const found: string[] = [];
    for (let n = node.parent; n !== null; n = n.parent) {
      const direction = typeof n.type === 'string' ? RN.StyleSheet.flatten(n.props.style)?.flexDirection : undefined;
      if (direction !== undefined) found.push(direction);
    }
    return found;
  }
  const contains = (node: Node, testID: string) => node.findAll((n) => n.props.testID === testID).length > 0;

  it('first-use tips: only the text scrolls, Geç and İleri stay on the card below it, stacked', () => {
    textSize(3);
    memory.tipsSeen = false;
    memory.profile = ADULT_SAYISAL;
    renderRouter(APP_DIR, { initialUrl: '/' });
    const card = screen.getByTestId('tips-card');
    const scroll = screen.getByTestId('tips-scroll');
    expect(contains(card, 'tips-scroll')).toBe(true);
    expect(contains(scroll, 'tips-step-title')).toBe(true);
    for (const id of ['tips-skip', 'tips-next']) {
      expect(contains(card, id)).toBe(true);
      expect(contains(scroll, id)).toBe(false);
    }
    expect(directions(screen.getByTestId('tips-skip'))[0]).toBe('column');
    // A tap outside the card is one more way out (not for VoiceOver, which stays on the card).
    fireEvent.press(screen.getByTestId('tips-backdrop', { includeHiddenElements: true }));
    expect(screen.queryByTestId('tips-card')).toBeNull();
    expect(memory.tipsSeen).toBe(true);
  });

  it('"Tüm verileri sil": only the text and "Önce yedek al" scroll; Vazgeç, then the delete button, stay below it', () => {
    textSize(3);
    memory.profile = ADULT_SAYISAL;
    renderRouter(APP_DIR, { initialUrl: '/ayarlar' });
    fireEvent.press(screen.getByTestId('settings-delete-all'));
    const dialog = screen.getByTestId('settings-delete-all-dialog');
    const scroll = screen.getByTestId('settings-delete-all-scroll');
    expect(contains(scroll, 'settings-delete-all-backup')).toBe(true);
    for (const id of ['settings-delete-all-cancel', 'settings-delete-all-confirm']) {
      expect(contains(dialog, id)).toBe(true);
      expect(contains(scroll, id)).toBe(false);
    }
    const order = dialog
      .findAll((n) => typeof n.type === 'string' && typeof n.props.testID === 'string')
      .map((n) => n.props.testID);
    expect(order.indexOf('settings-delete-all-cancel')).toBeLessThan(order.indexOf('settings-delete-all-confirm'));
    // A tap outside the dialog cancels (not for VoiceOver, which stays on the dialog).
    fireEvent.press(screen.getByTestId('settings-delete-all-backdrop', { includeHiddenElements: true }));
    expect(screen.queryByTestId('settings-delete-all-dialog')).toBeNull();
    expect(memory.profile).not.toBeNull();
  });

  it.each([1, 3])('text size %d: the ‹ › week buttons stay on either side of the week, which wraps between them', (fontScale) => {
    textSize(fontScale);
    memory.profile = ADULT_SAYISAL;
    renderRouter(APP_DIR, { initialUrl: '/haftalik' });
    const prev = screen.getByTestId('weekly-prev');
    const next = screen.getByTestId('weekly-next');
    // Icon buttons do not clip at any size, so the row never stacks; the week's name takes the rest.
    expect(directions(prev)[0]).toBe('row');
    expect(directions(next)[0]).toBe('row');
    let row = next.parent;
    while (row !== null && typeof row.type !== 'string') row = row.parent;
    expect(row !== null && contains(row, 'weekly-prev')).toBe(true);
    const label = row?.findAll((n) => typeof n.type === 'string' && RN.StyleSheet.flatten(n.props.style)?.flex === 1) ?? [];
    expect(label).toHaveLength(1);
    // Named for screen readers by what they do (the arrows are only drawn).
    expect(prev.props.accessibilityLabel).toBe('Önceki hafta');
    expect(next.props.accessibilityLabel).toBe('Sonraki hafta');
  });

  it.each([
    [1, 'row'],
    [2, 'column'],
  ])('text size %d: a stepper keeps − value + in one row, with its label in a %s around it', (fontScale, direction) => {
    textSize(fontScale);
    memory.profile = ADULT_SAYISAL;
    memory.dailyGoal = 120;
    renderRouter(APP_DIR, { initialUrl: '/ayarlar' });
    // At large text the label gets its own line above − value +.
    expect(directions(screen.getByTestId('settings-goal-minus')).slice(0, 2)).toEqual(['row', direction]);
  });
});

describe('empty states', () => {
  beforeEach(() => {
    memory.profile = ADULT_SAYISAL;
  });

  it.each([
    ['/gecmis', 'history-empty'],
    ['/denemeler', 'exams-empty'],
    ['/haftalik', 'weekly-empty'],
    ['/konular', 'topics-empty'],
  ])('%s explains what will appear', (url, id) => {
    renderRouter(APP_DIR, { initialUrl: url });
    expect(screen.getByTestId(id)).toBeTruthy();
  });

  it('the empty exam list has its own add button (the top one is out of sight down there)', () => {
    renderRouter(APP_DIR, { initialUrl: '/denemeler' });
    expect(screen.getByRole('button', { name: 'İlk denemeni ekle' })).toBeTruthy();
    fireEvent.press(screen.getByTestId('exams-empty-action'));
    expect(screen.getByTestId('exam-kind-TYT')).toBeTruthy();
  });

  it('no exam form ("Diğer"): the empty card offers no add button', () => {
    memory.profile = { ...ADULT_SAYISAL, examType: 'DIGER', yksArea: null };
    renderRouter(APP_DIR, { initialUrl: '/denemeler' });
    expect(screen.getByTestId('exams-empty')).toBeTruthy();
    expect(screen.queryByTestId('exams-empty-action')).toBeNull();
  });

  it('an empty week leads to the timer; a past week does not', () => {
    renderRouter(APP_DIR, { initialUrl: '/haftalik' });
    fireEvent.press(screen.getByTestId('weekly-prev'));
    expect(screen.getByTestId('weekly-empty')).toBeTruthy();
    expect(screen.queryByTestId('weekly-empty-action')).toBeNull();
    fireEvent.press(screen.getByTestId('weekly-next'));
    fireEvent.press(screen.getByTestId('weekly-empty-action'));
    expect(screen.getByTestId('timer-start')).toBeTruthy();
  });
});

describe('share card', () => {
  it('daily and weekly card with study numbers only, shared as an image', async () => {
    memory.profile = ADULT_SAYISAL;
    const now = Date.now();
    memory.sessions = [
      {
        id: 's1',
        subjectId: 'fizik',
        topicId: null,
        startedAt: now - 2 * 3_600_000,
        endedAt: now - 3_600_000,
        pauses: [],
        durationMs: 3_600_000,
        source: 'timer',
      },
    ];
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(screen.getByTestId('open-share'));
    expect(screen.getByText('Bugünkü çalışmam')).toBeTruthy();
    // No birth year, exam type or area on the card.
    expect(screen.queryByText(/2000|Sayısal|YKS/)).toBeNull();
    fireEvent.press(screen.getByTestId('share-period-week'));
    expect(screen.getByText('Bu haftaki çalışmam')).toBeTruthy();
    fireEvent.press(screen.getByTestId('share-theme-dark'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('share-card-share'));
    });
    expect(memory.sharedImages).toEqual([{ uri: '/tmp/etut-card.png', name: expect.stringMatching(/^etut-calisma-\d{4}-\d{2}-\d{2}\.png$/) }]);
  });

  it('0 dk: Paylaş is off and says why; the card holds no call to action; the file is named by the Istanbul day', async () => {
    memory.profile = ADULT_SAYISAL;
    jest.useFakeTimers();
    jest.setSystemTime(Date.parse('2026-10-07T21:30:00Z')); // 8 Oct 00:30 Istanbul
    // Studied on Wednesday 7 October (Istanbul), nothing yet on Thursday.
    memory.sessions = [
      {
        id: 's1',
        subjectId: 'fizik',
        topicId: null,
        startedAt: Date.parse('2026-10-07T18:00:00Z'),
        endedAt: Date.parse('2026-10-07T18:30:00Z'),
        pauses: [],
        durationMs: 30 * 60_000,
        source: 'timer',
      },
    ];
    renderRouter(APP_DIR, { initialUrl: '/paylas' });
    const button = () => screen.getByTestId('share-card-share');
    expect(button().props.accessibilityState).toMatchObject({ disabled: true });
    expect(screen.getByTestId('share-nothing').props.children).toBe(
      'Paylaşmak için bu dönemde en az 1 dakika çalışmış olmalısın.',
    );
    expect(button().props.accessibilityHint).toBe('Paylaşmak için bu dönemde en az 1 dakika çalışmış olmalısın.');
    expect(screen.getByText('Bu dönemde kayıtlı çalışma yok.')).toBeTruthy();
    expect(screen.queryByText(/başlat/i)).toBeNull();
    await act(async () => {
      fireEvent.press(button());
    });
    expect(memory.sharedImages).toEqual([]);

    // This week has the 30 minutes: the button is on and the image is named by today (Istanbul).
    fireEvent.press(screen.getByTestId('share-period-week'));
    expect(screen.queryByTestId('share-nothing')).toBeNull();
    expect(button().props.accessibilityState).toMatchObject({ disabled: false });
    await act(async () => {
      fireEvent.press(button());
    });
    expect(memory.sharedImages).toEqual([{ uri: '/tmp/etut-card.png', name: 'etut-calisma-2026-10-08.png' }]);
  });

  it('"Kartı paylaş" on Haftalık özet opens the weekly card, not an empty "Bugün"', () => {
    memory.profile = ADULT_SAYISAL;
    jest.setSystemTime(Date.parse('2026-10-07T21:30:00Z')); // Thursday 8 Oct 00:30 Istanbul
    // Studied on Wednesday, nothing yet today.
    memory.sessions = [
      {
        id: 's1',
        subjectId: 'fizik',
        topicId: null,
        startedAt: Date.parse('2026-10-07T18:00:00Z'),
        endedAt: Date.parse('2026-10-07T18:30:00Z'),
        pauses: [],
        durationMs: 30 * 60_000,
        source: 'timer',
      },
    ];
    renderRouter(APP_DIR, { initialUrl: '/haftalik' });
    fireEvent.press(screen.getByTestId('weekly-share'));
    expect(screen.getByText('Bu haftaki çalışmam')).toBeTruthy();
    expect(screen.getByTestId('share-period-week').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByTestId('share-card-share').props.accessibilityState).toMatchObject({ disabled: false });
    expect(screen.queryByTestId('share-nothing')).toBeNull();
  });

  it('under 15 (solo) the card is not offered and its screen does not open (ADR-001)', () => {
    memory.profile = { birthYear: new Date().getUTCFullYear() - 12, examType: 'LGS', yksArea: null, soloOnly: true, createdAt: 0 };
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(screen.queryByTestId('open-share')).toBeNull();
    renderRouter(APP_DIR, { initialUrl: '/paylas' });
    expect(screen.queryByTestId('share-screen')).toBeNull();
    expect(screen.getByTestId('timer-screen')).toBeTruthy();
  });
});

describe('backup and restore', () => {
  const session = (id: string): CompletedSession => ({
    id,
    subjectId: 'kimya',
    topicId: null,
    startedAt: Date.parse('2026-10-01T07:00:00Z'),
    endedAt: Date.parse('2026-10-01T08:00:00Z'),
    pauses: [],
    durationMs: 3_600_000,
    source: 'timer',
  });

  it('exports every record to a versioned JSON file', async () => {
    memory.profile = ADULT_SAYISAL;
    memory.sessions = [session('a')];
    renderRouter(APP_DIR, { initialUrl: '/yedek' });
    await act(async () => {
      fireEvent.press(screen.getByTestId('backup-export'));
    });
    expect(memory.shared).toHaveLength(1);
    expect(memory.shared[0].name).toMatch(/^etut-yedek-\d{4}-\d{2}-\d{2}\.json$/);
    const file = JSON.parse(memory.shared[0].content);
    expect(file).toMatchObject({ format: 'etut-yedek', schemaVersion: 2, sessions: [{ id: 'a' }] });
    expect(screen.getByTestId('backup-message')).toBeTruthy();
  });

  it('merge import twice adds the missing records once (idempotent)', async () => {
    memory.profile = ADULT_SAYISAL;
    memory.sessions = [session('a')];
    renderRouter(APP_DIR, { initialUrl: '/yedek' });
    await act(async () => {
      fireEvent.press(screen.getByTestId('backup-export'));
    });
    const exported = JSON.parse(memory.shared[0].content);
    memory.pickText = JSON.stringify({ ...exported, sessions: [...exported.sessions, session('b')] });
    for (let i = 0; i < 2; i++) {
      await act(async () => {
        fireEvent.press(screen.getByTestId('backup-import'));
      });
      expect(screen.getByTestId('backup-preview-counts').props.children).toBe(
        'Yedekte 2 çalışma kaydı, 0 deneme ve 0 konu işareti var.',
      );
      fireEvent.press(screen.getByTestId('backup-confirm'));
    }
    expect(memory.sessions.map((s) => s.id).sort()).toEqual(['a', 'b']);
    expect(screen.getByTestId('backup-message').props.children).toBe(
      'Yüklendi. Şu an 2 çalışma kaydı, 0 deneme ve 0 konu işareti var.',
    );
  });

  it('a session recorded with the clock reset to 2001 does not cost the backup: left out and told', async () => {
    const old = { ...session('old'), startedAt: Date.UTC(2001, 0, 1), endedAt: Date.UTC(2001, 0, 1, 1) };
    memory.profile = ADULT_SAYISAL;
    memory.sessions = [session('a'), old];
    renderRouter(APP_DIR, { initialUrl: '/yedek' });
    await act(async () => {
      fireEvent.press(screen.getByTestId('backup-export'));
    });
    expect(screen.getByTestId('backup-message').props.children).toContain('1 çalışma kaydı geri yüklemede alınmayacak');
    memory.pickText = memory.shared[0].content;
    await act(async () => {
      fireEvent.press(screen.getByTestId('backup-import'));
    });
    expect(screen.getByTestId('backup-preview-counts').props.children).toBe(
      'Yedekte 1 çalışma kaydı, 0 deneme ve 0 konu işareti var.',
    );
    expect(screen.getByTestId('backup-preview-skipped')).toBeTruthy();
    fireEvent.press(screen.getByTestId('backup-mode-replace'));
    fireEvent.press(screen.getByTestId('backup-confirm'));
    fireEvent.press(screen.getByTestId('backup-replace-yes'));
    expect(memory.sessions.map((s) => s.id)).toEqual(['a']);
  });

  it('K-17: an older age in the backup is ignored, a younger one wins and turns groups off', async () => {
    const year = new Date().getUTCFullYear();
    const file = (birthYear: number) =>
      JSON.stringify({
        format: 'etut-yedek',
        schemaVersion: 1,
        exportedAt: Date.parse('2026-10-02T00:00:00Z'),
        appVersion: '0.2.0',
        profile: { birthYear, examType: 'YKS', yksArea: 'sozel' },
        sessions: [],
        exams: [],
        topicProgress: [],
        settings: {},
      });
    memory.profile = { ...ADULT_SAYISAL, birthYear: year - 20 };
    renderRouter(APP_DIR, { initialUrl: '/yedek' });

    memory.pickText = file(year - 40);
    await act(async () => {
      fireEvent.press(screen.getByTestId('backup-import'));
    });
    fireEvent.press(screen.getByTestId('backup-mode-replace'));
    fireEvent.press(screen.getByTestId('backup-confirm'));
    fireEvent.press(screen.getByTestId('backup-replace-yes'));
    expect(memory.profile).toMatchObject({ birthYear: year - 20, soloOnly: false, yksArea: 'sozel' });

    memory.pickText = file(year - 12);
    await act(async () => {
      fireEvent.press(screen.getByTestId('backup-import'));
    });
    fireEvent.press(screen.getByTestId('backup-confirm'));
    expect(memory.profile).toMatchObject({ birthYear: year - 12, soloOnly: true });
    expect(memory.youngestBirthYear).toBe(year - 12);
  });

  it('replace takes the exam and area; settings then show them with nothing unsaved', async () => {
    memory.profile = ADULT_SAYISAL;
    memory.pickText = JSON.stringify({
      format: 'etut-yedek',
      schemaVersion: 1,
      exportedAt: Date.parse('2026-10-02T00:00:00Z'),
      profile: { birthYear: 2000, examType: 'YKS', yksArea: 'sozel' },
      sessions: [session('x')],
      exams: [],
      topicProgress: [],
    });
    renderRouter(APP_DIR, { initialUrl: '/ayarlar' });
    fireEvent.press(screen.getByTestId('settings-open-backup'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('backup-import'));
    });
    fireEvent.press(screen.getByTestId('backup-mode-replace'));
    fireEvent.press(screen.getByTestId('backup-confirm'));
    fireEvent.press(screen.getByTestId('backup-replace-yes'));
    expect(memory.sessions.map((s) => s.id)).toEqual(['x']);
    act(() => router.back());
    expect(screen.getByTestId('settings-exam-current').props.children).toEqual(['YKS', ' · Sözel']);
    const save = screen.getByTestId('settings-exam-save');
    expect(save.props.accessibilityState?.disabled ?? save.props['aria-disabled']).toBeTruthy();
  });

  it('a file that is not an Etüt backup is refused and nothing changes', async () => {
    memory.profile = ADULT_SAYISAL;
    memory.sessions = [session('a')];
    memory.pickText = '{"hello": "world"}';
    renderRouter(APP_DIR, { initialUrl: '/yedek' });
    await act(async () => {
      fireEvent.press(screen.getByTestId('backup-import'));
    });
    expect(screen.getByTestId('backup-error').props.children).toBe('Bu dosya bir Etüt yedeği değil.');
    expect(screen.queryByTestId('backup-preview')).toBeNull();
    expect(memory.sessions).toHaveLength(1);
  });

  it('CSV export of sessions', async () => {
    memory.profile = ADULT_SAYISAL;
    memory.sessions = [session('a')];
    renderRouter(APP_DIR, { initialUrl: '/yedek' });
    await act(async () => {
      fireEvent.press(screen.getByTestId('csv-sessions'));
    });
    expect(memory.shared[0].name).toMatch(/^etut-calisma-.*\.csv$/);
    expect(memory.shared[0].content).toContain(
      '2026-10-01;2026-10-01 10:00;2026-10-01 11:00;Kimya;;sayaç;60;3600',
    );
  });
});

describe('about and legal texts', () => {
  it('settings → about shows the version, the placeholder controller and the legal texts', () => {
    memory.profile = ADULT_SAYISAL;
    renderRouter(APP_DIR, { initialUrl: '/ayarlar' });
    fireEvent.press(screen.getByTestId('settings-open-about'));
    expect(screen.getByTestId('about-controller').props.children).toBe('[DOLDURULACAK]');
    expect(screen.getByText('Aydınlatma metni')).toBeTruthy();
    expect(screen.queryByText(/Kısaca bilgilerin/)).toBeNull();
    fireEvent.press(screen.getByTestId('about-doc-gizlilik'));
    expect(screen.getByTestId('legal-gizlilik')).toBeTruthy();
  });

  it('the short notice is reachable from onboarding before anything is saved', () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    // It sits right above Başla.
    const buttons = screen.getAllByRole('button').map((b) => b.props.testID);
    expect(buttons.indexOf('onboarding-privacy')).toBe(buttons.indexOf('onboarding-start') - 1);
    fireEvent.press(screen.getByTestId('onboarding-privacy'));
    expect(screen.getByTestId('legal-aydinlatma')).toBeTruthy();
    expect(screen.getAllByText('Aydınlatma metni').length).toBeGreaterThan(0);
    expect(screen.getByText('Son güncelleme: 16 Ekim 2026')).toBeTruthy();
    expect(memory.profile).toBeNull();
  });

  it('licenses list npm packages and native libraries; a row shows its license text', () => {
    memory.profile = ADULT_SAYISAL;
    renderRouter(APP_DIR, { initialUrl: '/lisanslar' });
    expect(screen.getByTestId('license-react-native')).toBeTruthy();
    expect(screen.getByTestId('license-folly (RCT-Folly)')).toBeTruthy();
    expect(screen.queryByTestId('license-text-react-native')).toBeNull();
    fireEvent.press(screen.getByTestId('license-react-native'));
    expect(screen.getByTestId('license-text-react-native')).toHaveTextContent(/Permission is hereby granted/);
    fireEvent.press(screen.getByTestId('license-SQLite'));
    expect(screen.getByTestId('license-text-SQLite')).toHaveTextContent(/disclaims copyright/);
    expect(screen.queryByTestId('license-text-react-native')).toBeNull();
  });
});

describe('system surfaces: Live Activity, widget, reminders', () => {
  beforeEach(() => {
    memory.profile = ADULT_SAYISAL;
    memory.answerPermission = true;
  });

  /** Lets the async sync jobs (promise chains) finish. */
  async function settle() {
    await act(async () => {
      for (let i = 0; i < 5; i++) await Promise.resolve();
    });
  }

  it('the Live Activity starts with the timer, follows pause/resume and ends with "Bitir"', async () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(screen.getByText('Fizik'));
    fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
    await settle();
    expect(memory.liveActivities).toHaveLength(1);
    expect(memory.liveActivities[0]).toMatchObject({
      title: 'Fizik',
      status: 'Çalışıyorsun',
      countsDown: false,
      pausedAt: null,
      from: memory.active?.startedAt,
    });
    expect(memory.liveActivityRecord?.sessionId).toBe(memory.active?.id);

    fireEvent.press(screen.getByRole('button', { name: 'Mola' }));
    await settle();
    expect(memory.liveActivities).toHaveLength(1);
    expect(memory.liveActivities[0]).toMatchObject({ status: 'Moladasın', icon: 'pause.fill' });
    expect(memory.liveActivities[0].pausedAt).not.toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'Devam' }));
    await settle();
    expect(memory.liveActivities[0]).toMatchObject({ status: 'Çalışıyorsun', pausedAt: null });

    fireEvent.press(screen.getByRole('button', { name: 'Bitir' }));
    await settle();
    expect(memory.liveActivities).toHaveLength(0);
    expect(memory.liveActivityRecord).toBeNull();
  });

  it('pomodoro: the Live Activity counts down and knows the next phase', async () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(screen.getByTestId('mode-pomodoro'));
    fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
    await settle();
    const props = memory.liveActivities[0];
    expect(props).toMatchObject({ status: 'Çalışma 1/4', countsDown: true, showProgress: true });
    expect(props.nextStatus).toMatch(/^Kısa mola · bitiş \d\d:\d\d$/);
    expect(props.to - props.from).toBe(25 * 60_000);
    expect(props.nextFrom).toBe(props.to);
    // The system switches to the next phase when the work block ends.
    expect(memory.liveActivityStaleAt).toBe(props.to);
  });

  /** Moves the clock on and lets the app's timers run for a minute (the phase-end check included). */
  function jumpAndRun(ms: number) {
    act(() => {
      jest.setSystemTime(Date.now() + ms);
      jest.advanceTimersByTime(60_000);
    });
  }

  const futurePomodoroReminders = () =>
    memory.planned.filter((n) => n.kind === 'pomodoro' && n.at > Date.now());

  it('pomodoro, app left open: each phase change updates the Live Activity and moves the reminders on', async () => {
    memory.permission = 'granted';
    memory.remindersConfirmed = true;
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(screen.getByTestId('mode-pomodoro'));
    fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
    await settle();
    const startedAt = memory.active!.startedAt;

    // 31 min: second work block. Nothing in the stored session changed, the phase end did.
    jumpAndRun(31 * 60_000);
    await settle();
    expect(memory.liveActivities).toHaveLength(1);
    const props = memory.liveActivities[0];
    expect(props.status).toBe('Çalışma 2/4');
    expect(props.to).toBe(startedAt + 55 * 60_000);
    expect(memory.liveActivityStaleAt).toBe(props.to);
    expect(screen.getByTestId('pomodoro-phase').props.children).toBe('Çalışma 2/4');

    // Long after the first plan (140 min): the phase-end reminders still lie ahead.
    jumpAndRun(108 * 60_000);
    await settle();
    expect(futurePomodoroReminders()).toHaveLength(POMODORO_CHANGES_AHEAD);
    expect(memory.widget[0].at).toBeGreaterThanOrEqual(startedAt + 140 * 60_000);
  });

  /** Sends an AppState change to the listeners registered since `from` (the mock never calls them). */
  function emitAppState(status: AppStateStatus, from: number) {
    Object.defineProperty(AppState, 'currentState', { value: status, configurable: true, writable: true });
    const calls = (AppState.addEventListener as jest.Mock).mock.calls.slice(from);
    act(() => {
      for (const [type, listener] of calls) if (type === 'change') listener(status);
    });
  }

  describe('going to the background', () => {
    const original = AppState.currentState;
    afterEach(() => {
      Object.defineProperty(AppState, 'currentState', { value: original, configurable: true, writable: true });
    });

    it('syncs once more: the Live Activity is updated, the reminders start from now', async () => {
      memory.permission = 'granted';
      memory.remindersConfirmed = true;
      const from = (AppState.addEventListener as jest.Mock).mock.calls.length;
      renderRouter(APP_DIR, { initialUrl: '/' });
      fireEvent.press(screen.getByTestId('mode-pomodoro'));
      fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
      await settle();
      const startedAt = memory.active!.startedAt;

      // The break began a moment ago; no app timer has run since (e.g. the phone was just locked).
      act(() => jest.setSystemTime(startedAt + 26 * 60_000));
      expect(memory.liveActivities[0].status).toBe('Çalışma 1/4');
      emitAppState('background', from);
      await settle();
      expect(memory.active?.backgroundedAt).not.toBeNull();
      expect(memory.liveActivities[0].status).toBe('Kısa mola');
      expect(memory.liveActivityStaleAt).toBe(startedAt + 30 * 60_000 + 10_000);
      // Away during a break costs nothing until it ends; then the next block is shown frozen.
      expect(memory.liveActivities[0]).toMatchObject({
        awayAt: startedAt + 30 * 60_000,
        awayStatus: 'Uygulamadan çıktın · mola sayılıyor',
        awayFrom: startedAt + 30 * 60_000,
        awayTo: startedAt + 55 * 60_000,
      });
      const reminders = futurePomodoroReminders();
      expect(reminders).toHaveLength(POMODORO_CHANGES_AHEAD);
      expect(reminders[0]).toMatchObject({ at: startedAt + 30 * 60_000, ended: 'short_break' });
    });

    it('rule "Sor": the last update says where the clock freezes; back late, it follows the break', async () => {
      const from = (AppState.addEventListener as jest.Mock).mock.calls.length;
      renderRouter(APP_DIR, { initialUrl: '/' });
      fireEvent.press(screen.getByText('Fizik'));
      fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
      await settle();
      const startedAt = memory.active!.startedAt;
      expect(memory.liveActivities[0].awayAt).toBeNull();

      act(() => jest.setSystemTime(startedAt + 60_000));
      emitAppState('background', from);
      await settle();
      const leftAt = memory.active!.backgroundedAt!;
      // The clock still runs (the tolerance) but the status is honest at once; the system may
      // switch to the frozen away presentation at the stale date.
      expect(memory.liveActivities[0]).toMatchObject({
        status: 'Uygulamadan çıktın · 10 sn sonra mola sayılır',
        pausedAt: null,
        from: startedAt,
        awayAt: leftAt,
        awayStatus: 'Uygulamadan çıktın · mola sayılıyor',
        awayHint: 'Dönünce “Çalışıyordum” dersen süre eklenir.',
        awayFrom: startedAt,
      });
      expect(memory.liveActivityStaleAt).toBe(leftAt + 10_000);
      // The widget stops counting at once.
      expect(memory.widget[0].props).toMatchObject({ countingFrom: null, runningNote: null, total: '1 dk' });

      // Back after 30 s: the time away is a break, the clock starts 30 s later.
      act(() => jest.setSystemTime(leftAt + 30_000));
      emitAppState('active', from);
      await settle();
      expect(memory.liveActivities[0]).toMatchObject({ status: 'Çalışıyorsun', awayAt: null, from: startedAt + 30_000 });
      expect(memory.liveActivityStaleAt).toBeNull();
      expect(memory.widget[0].props.runningNote).toBe('Sayaç açık');
      fireEvent.press(screen.getByTestId('away-credit'));
      await settle();
      expect(memory.liveActivities[0]).toMatchObject({ awayAt: null, from: startedAt });
    });

    it('"Çalışmaya devam say": frozen only after its 3 hours, the widget goes on; a manual break: nothing freezes', async () => {
      memory.awayRule = 'count';
      const counted = 3 * 3_600_000; // AWAY_COUNT_MAX_MS
      const from = (AppState.addEventListener as jest.Mock).mock.calls.length;
      renderRouter(APP_DIR, { initialUrl: '/' });
      fireEvent.press(screen.getByText('Fizik'));
      fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
      await settle();
      act(() => jest.setSystemTime(Date.now() + 60_000));
      emitAppState('background', from);
      await settle();
      const leftAt = memory.active!.backgroundedAt!;
      expect(memory.liveActivities[0]).toMatchObject({
        status: 'Çalışıyorsun',
        pausedAt: null,
        awayAt: leftAt + counted,
        awayStatus: 'Uygulamadan çıktın · mola sayılıyor',
      });
      expect(memory.liveActivityStaleAt).toBe(leftAt + counted + 10_000);
      expect(memory.widget[0].props.runningNote).toBe('Sayaç açık');
      expect(memory.widget[0].props.countingFrom).not.toBeNull();

      // "Sor", but paused by hand before leaving: the pause already stops the clock.
      memory.awayRule = 'ask';
      emitAppState('active', from);
      await settle();
      fireEvent.press(screen.getByRole('button', { name: 'Mola' }));
      await settle();
      emitAppState('background', from);
      await settle();
      expect(memory.liveActivities[0]).toMatchObject({ status: 'Moladasın', awayAt: null });
      expect(memory.liveActivityStaleAt).toBeNull();
    });

    it('a Live Activity 6 hours old still gets the away update there; its refresh waits for the foreground', async () => {
      const from = (AppState.addEventListener as jest.Mock).mock.calls.length;
      renderRouter(APP_DIR, { initialUrl: '/' });
      fireEvent.press(screen.getByText('Fizik'));
      fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
      await settle();
      const record = memory.liveActivityRecord!;
      act(() => jest.setSystemTime(record.startedAt + 6.5 * 3_600_000));
      emitAppState('background', from);
      await settle();
      const leftAt = memory.active!.backgroundedAt!;
      // Not ended (a start is refused in the background): the running one says the app was left.
      expect(memory.liveActivities).toHaveLength(1);
      expect(memory.liveActivities[0]).toMatchObject({
        status: 'Uygulamadan çıktın · 10 sn sonra mola sayılır',
        awayAt: leftAt,
      });
      expect(memory.liveActivityStaleAt).toBe(leftAt + 10_000);
      expect(memory.liveActivityRecord).toEqual(record);
      // Back in the app: now it is replaced (a new 8-hour window).
      emitAppState('active', from);
      await settle();
      expect(memory.liveActivities).toHaveLength(1);
      expect(memory.liveActivityRecord!.startedAt).toBeGreaterThan(record.startedAt);
    });

    it('never starts a Live Activity there; it starts once the app is back', async () => {
      const from = (AppState.addEventListener as jest.Mock).mock.calls.length;
      renderRouter(APP_DIR, { initialUrl: '/' });
      fireEvent.press(screen.getByText('Fizik'));
      fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
      await settle();
      // The system had refused it (e.g. Live Activities off): none and no record.
      memory.liveActivities = [];
      memory.liveActivityRecord = null;
      emitAppState('background', from);
      await settle();
      expect(memory.liveActivities).toHaveLength(0);
      emitAppState('active', from);
      await settle();
      expect(memory.liveActivities).toHaveLength(1);
      expect(memory.liveActivityRecord).toMatchObject({ sessionId: memory.active?.id });
    });
  });

  it('a tapped notification opens its screen, also the tap that launched the app', async () => {
    mockTaps.launchUrl = '/denemeler';
    try {
      renderRouter(APP_DIR, { initialUrl: '/' });
      await settle();
      expect(screen.getByTestId('exams-screen')).toBeTruthy();
    } finally {
      mockTaps.launchUrl = null;
    }
    act(() => router.navigate('/'));
    expect(screen.getByTestId('timer-screen')).toBeTruthy();
    act(() => mockTaps.listener!('/denemeler'));
    await settle();
    expect(screen.getByTestId('exams-screen')).toBeTruthy();
  });

  it('the widget shows today, the goal and the streak; "delete all" leaves nothing personal', async () => {
    memory.dailyGoal = 60;
    const now = Date.now();
    memory.sessions = [
      {
        id: 'w',
        subjectId: 'fizik',
        topicId: null,
        startedAt: now - 2 * 3_600_000,
        endedAt: now - 2 * 3_600_000 + 30 * 60_000,
        pauses: [],
        durationMs: 30 * 60_000,
        source: 'timer',
      },
    ];
    renderRouter(APP_DIR, { initialUrl: '/ayarlar' });
    await settle();
    expect(memory.widget[0].props).toMatchObject({ title: 'Bugün', countingFrom: null, goalLine: 'Hedef 1 sa 0 dk' });
    expect(memory.widget[0].props.streakLine).toMatch(/^Seri: \d+ gün$/);
    fireEvent.press(screen.getByRole('button', { name: 'Tüm verileri sil' }));
    fireEvent.press(screen.getByRole('button', { name: 'Evet, hepsini sil' }));
    await settle();
    expect(memory.widget).toHaveLength(1);
    expect(memory.widget[0].props).toMatchObject({ total: '0 dk', goalLine: null, streakLine: null });
  });

  it('turning a reminder on asks through the explanation screen, whose only button opens the prompt', async () => {
    renderRouter(APP_DIR, { initialUrl: '/ayarlar' });
    await settle();
    expect(screen.getByTestId('settings-reminders-summary').props.children).toBe(
      'Bildirim izni verilmedi; hatırlatıcılar gelmez.',
    );
    fireEvent.press(screen.getByTestId('settings-reminders'));
    await settle();
    expect(screen.getByTestId('reminders-permission-missing')).toBeTruthy();
    // Neutral wording: asking is not granting.
    expect(screen.getByRole('button', { name: 'Bildirim izni iste' })).toBeTruthy();
    expect(screen.getByTestId('reminder-daily-toggle').props.accessibilityState.checked).toBe(false);
    fireEvent.press(screen.getByTestId('reminder-daily-toggle'));
    await settle();
    // The explanation lists what will be on: only the requested daily reminder, the others stay off.
    expect(screen.getByTestId('notification-permission-item-daily').props.children).toBe(
      '• Günlük çalışma hatırlatıcısı (20:00)',
    );
    expect(screen.queryByTestId('notification-permission-item-longSession')).toBeNull();
    expect(screen.queryByTestId('notification-permission-item-pomodoro')).toBeNull();
    expect(screen.getByTestId('notification-permission-others-off')).toBeTruthy();
    expect(memory.permissionRequests).toBe(0);
    // Apple HIG: one "Continue"-like button, no second way out of the explanation.
    expect(screen.queryByTestId('notification-permission-later')).toBeNull();
    expect(screen.queryByText('Şimdi değil')).toBeNull();

    // "Devam et" shows the system prompt (granted here) and turns the reminder on.
    fireEvent.press(screen.getByTestId('notification-permission-allow'));
    await settle();
    expect(memory.permissionRequests).toBe(1);
    expect(screen.getByTestId('reminder-daily-toggle').props.accessibilityState.checked).toBe(true);
    expect(screen.getByTestId('reminder-daily-time').props.children).toBe('20:00');
    fireEvent.press(screen.getByTestId('reminder-daily-hour-plus'));
    fireEvent.press(screen.getByTestId('reminder-daily-minute-minus'));
    expect(screen.getByTestId('reminder-daily-time').props.children).toBe('20:45');
    await settle();
    expect(memory.planned.some((n) => n.kind === 'daily')).toBe(true);
    expect(screen.getByTestId('reminder-long-toggle').props.accessibilityState.checked).toBe(false);
    expect(screen.getByTestId('reminder-pomodoro-toggle').props.accessibilityState.checked).toBe(false);
  });

  it('a refused permission keeps the app working and the reminders silent', async () => {
    memory.grantOnRequest = false;
    renderRouter(APP_DIR, { initialUrl: '/hatirlaticilar' });
    await settle();
    fireEvent.press(screen.getByTestId('reminders-permission'));
    await settle();
    // Asking for the permission alone turns no reminder on.
    expect(screen.queryByTestId('notification-permission-item-longSession')).toBeNull();
    expect(screen.getByTestId('notification-permission-none-on')).toBeTruthy();
    fireEvent.press(screen.getByTestId('notification-permission-allow'));
    await settle();
    expect(screen.getByTestId('notification-permission-denied')).toBeTruthy();
    fireEvent.press(screen.getByTestId('notification-permission-close'));
    await settle();
    expect(screen.getByTestId('reminders-permission-denied')).toBeTruthy();
    expect(memory.planned).toEqual([]);
  });

  it('with permission: a running pomodoro schedules its phase ends, a pause cancels them', async () => {
    memory.permission = 'granted';
    memory.remindersConfirmed = true;
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(screen.getByTestId('mode-pomodoro'));
    fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
    await settle();
    const kinds = memory.planned.map((n) => n.kind);
    expect(kinds).toContain('pomodoro');
    expect(kinds).toContain('long_session');
    fireEvent.press(screen.getByRole('button', { name: 'Duraklat' }));
    await settle();
    expect(memory.planned.filter((n) => n.kind === 'pomodoro' || n.kind === 'long_session')).toEqual([]);
  });

  it('permission granted without asking (Android 12 and older, or after "delete all"): nothing until the student confirms', async () => {
    memory.permission = 'granted';
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(screen.getByTestId('mode-pomodoro'));
    fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
    await settle();
    // Running pomodoro, permission granted, defaults on paper: still nothing scheduled.
    expect(memory.planned).toEqual([]);

    act(() => router.push('/hatirlaticilar'));
    await settle();
    // Shown as they are: off. Turning one on explains first, even with the permission granted.
    expect(screen.getByTestId('reminder-long-toggle').props.accessibilityState.checked).toBe(false);
    fireEvent.press(screen.getByTestId('reminder-long-toggle'));
    await settle();
    expect(screen.getByTestId('notification-permission-item-longSession')).toBeTruthy();
    fireEvent.press(screen.getByTestId('notification-permission-allow'));
    await settle();
    expect(memory.remindersConfirmed).toBe(true);
    expect(screen.getByTestId('reminder-long-toggle').props.accessibilityState.checked).toBe(true);
    // Only that one: the pomodoro reminder stays off until it is turned on by itself.
    expect(screen.getByTestId('reminder-pomodoro-toggle').props.accessibilityState.checked).toBe(false);
    const kinds = memory.planned.map((n) => n.kind);
    expect(kinds).toContain('long_session');
    expect(kinds).not.toContain('pomodoro');
  });

  it('"delete all" forgets the confirmation: the permission stays, the reminders do not', async () => {
    memory.permission = 'granted';
    memory.remindersConfirmed = true;
    memory.reminderPrefs = { daily: { enabled: true, hour: 20, minute: 0 } };
    renderRouter(APP_DIR, { initialUrl: '/ayarlar' });
    await settle();
    expect(memory.planned.some((n) => n.kind === 'daily')).toBe(true);
    fireEvent.press(screen.getByRole('button', { name: 'Tüm verileri sil' }));
    fireEvent.press(screen.getByRole('button', { name: 'Evet, hepsini sil' }));
    await settle();
    expect(memory.remindersConfirmed).toBe(false);
    expect(memory.planned).toEqual([]);
  });

  it('a Live Activity the student removed stays away for the rest of the session', async () => {
    const from = (AppState.addEventListener as jest.Mock).mock.calls.length;
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(screen.getByText('Fizik'));
    fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
    await settle();
    expect(memory.liveActivities).toHaveLength(1);
    // Removed from the Lock Screen an hour in; the app comes back.
    memory.liveActivities = [];
    act(() => jest.setSystemTime(Date.now() + 3_600_000));
    emitAppState('active', from);
    await settle();
    expect(memory.liveActivities).toHaveLength(0);
    expect(memory.liveActivityRecord).toMatchObject({ sessionId: memory.active?.id, dismissed: true });
    // Past the 8-hour limit it would look like the system's end: still not brought back.
    act(() => jest.setSystemTime(Date.now() + 9 * 3_600_000));
    emitAppState('active', from);
    await settle();
    expect(memory.liveActivities).toHaveLength(0);
  });
});

describe('timer and data safety', () => {
  const MIN = 60_000;
  const HOUR = 3_600_000;
  const original = AppState.currentState;
  beforeEach(() => {
    memory.profile = ADULT_SAYISAL;
  });
  afterEach(() => {
    Object.defineProperty(AppState, 'currentState', { value: original, configurable: true, writable: true });
  });

  const listenersFrom = () => (AppState.addEventListener as jest.Mock).mock.calls.length;
  function emitAppState(status: AppStateStatus, from: number) {
    Object.defineProperty(AppState, 'currentState', { value: status, configurable: true, writable: true });
    const calls = (AppState.addEventListener as jest.Mock).mock.calls.slice(from);
    act(() => {
      for (const [type, listener] of calls) if (type === 'change') listener(status);
    });
  }
  /** Leaves the app at `leaveAt` and comes back at `backAt`. */
  function away(from: number, leaveAt: number, backAt: number) {
    act(() => jest.setSystemTime(leaveAt));
    emitAppState('background', from);
    act(() => jest.setSystemTime(backAt));
    emitAppState('active', from);
  }
  async function settle() {
    await act(async () => {
      for (let i = 0; i < 5; i++) await Promise.resolve();
    });
  }
  const start = () => fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
  const finish = () => fireEvent.press(screen.getByTestId('timer-finish'));

  it('keeps the screen on while the timer runs on the timer screen, unless turned off', () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(mockKeepAwake.size).toBe(0);
    start();
    expect(mockKeepAwake.size).toBe(1);
    fireEvent.press(screen.getByRole('button', { name: 'Mola' }));
    expect(mockKeepAwake.size).toBe(0);
    fireEvent.press(screen.getByRole('button', { name: 'Devam' }));
    expect(mockKeepAwake.size).toBe(1);
    // On another tab the phone may lock as usual.
    act(() => router.push('/ayarlar'));
    expect(mockKeepAwake.size).toBe(0);
    fireEvent.press(screen.getByTestId('settings-keep-awake-off'));
    expect(memory.keepAwakeSetting).toBe(false);
    act(() => router.push('/'));
    expect(mockKeepAwake.size).toBe(0);
    finish();
    expect(mockKeepAwake.size).toBe(0);
  });

  it('"Çalışmaya devam say": time away counts as study and nothing is asked', () => {
    const from = listenersFrom();
    renderRouter(APP_DIR, { initialUrl: '/ayarlar' });
    expect(screen.getByTestId('settings-away-ask').props.accessibilityState.selected).toBe(true);
    fireEvent.press(screen.getByTestId('settings-away-count'));
    expect(memory.awayRule).toBe('count');
    expect(screen.getByTestId('settings-away-info').props.children).toContain('çalışma sayılır');
    act(() => router.push('/'));
    start();
    const startedAt = memory.active!.startedAt;
    away(from, startedAt + MIN, startedAt + 31 * MIN);
    expect(screen.queryByTestId('away-title')).toBeNull();
    expect(memory.active?.pauses).toEqual([]);
    finish();
    expect(memory.sessions[0].durationMs).toBeGreaterThanOrEqual(31 * MIN);
  });

  it('"Bitir" with an unanswered absence asks first; "Çalışıyordum" saves it as study', () => {
    const from = listenersFrom();
    renderRouter(APP_DIR, { initialUrl: '/' });
    start();
    const startedAt = memory.active!.startedAt;
    away(from, startedAt + MIN, startedAt + 61 * MIN);
    expect(screen.getByTestId('away-title')).toBeTruthy();
    finish();
    // Nothing saved yet: the question is on screen.
    expect(memory.active).not.toBeNull();
    expect(screen.getByTestId('finish-check-title').props.children).toBe(
      'Bitirmeden önce: 1 sa 0 dk uygulamanın dışındaydın.',
    );
    fireEvent.press(screen.getByTestId('finish-away-credit'));
    expect(memory.active).toBeNull();
    expect(memory.sessions[0].durationMs).toBe(61 * MIN);
    expect(screen.getByTestId('timer-saved').props.children).toBe('Kaydedildi: 1 sa 1 dk');
  });

  it('… "Molaydı" saves it without the time away; "Vazgeç" keeps the timer running', () => {
    const from = listenersFrom();
    renderRouter(APP_DIR, { initialUrl: '/' });
    start();
    const startedAt = memory.active!.startedAt;
    away(from, startedAt + 5 * MIN, startedAt + 65 * MIN);
    finish();
    fireEvent.press(screen.getByTestId('finish-check-cancel'));
    expect(screen.queryByTestId('finish-check')).toBeNull();
    expect(memory.active).not.toBeNull();
    finish();
    fireEvent.press(screen.getByTestId('finish-away-break'));
    expect(memory.active).toBeNull();
    expect(memory.sessions[0].durationMs).toBe(5 * MIN);
  });

  it('while "Bitir" asks about the absence the card above is hidden; answered on the card, it is not asked again', () => {
    const from = listenersFrom();
    renderRouter(APP_DIR, { initialUrl: '/' });
    start();
    const startedAt = memory.active!.startedAt;
    away(from, startedAt + MIN, startedAt + 31 * MIN);
    finish();
    expect(screen.getByTestId('finish-check')).toBeTruthy();
    // One question on screen, not the same one twice.
    expect(screen.queryByTestId('away-title')).toBeNull();
    fireEvent.press(screen.getByTestId('finish-check-cancel'));
    expect(screen.getByTestId('away-title')).toBeTruthy();
    fireEvent.press(screen.getByTestId('away-dismiss'));
    expect(screen.queryByTestId('finish-check')).toBeNull();
    away(from, startedAt + 32 * MIN, startedAt + 62 * MIN);
    expect(screen.getByTestId('away-title')).toBeTruthy();
    expect(screen.queryByTestId('finish-check')).toBeNull();
    expect(memory.active).not.toBeNull();
  });

  it('an absence that starts while the 10-hour question is open is asked about first', () => {
    const from = listenersFrom();
    renderRouter(APP_DIR, { initialUrl: '/' });
    start();
    const startedAt = memory.active!.startedAt;
    act(() => jest.setSystemTime(startedAt + 11 * HOUR));
    finish();
    expect(screen.getByTestId('finish-check-title').props.children).toBe('Bu oturum 11 sa 0 dk sürmüş görünüyor.');
    away(from, startedAt + 11 * HOUR, startedAt + 11 * HOUR + 30 * MIN);
    expect(screen.getByTestId('finish-check-title').props.children).toBe(
      'Bitirmeden önce: 30 dk uygulamanın dışındaydın.',
    );
    fireEvent.press(screen.getByTestId('finish-away-break'));
    // Then the 10-hour question again, for what is left.
    expect(screen.getByTestId('finish-check-title').props.children).toBe('Bu oturum 11 sa 0 dk sürmüş görünüyor.');
    fireEvent.press(screen.getByTestId('finish-long-all'));
    expect(memory.sessions[0].durationMs).toBe(11 * HOUR);
  });

  it('a second absence before answering joins the first: one card, one answer for both', () => {
    const from = listenersFrom();
    renderRouter(APP_DIR, { initialUrl: '/' });
    start();
    const startedAt = memory.active!.startedAt;
    away(from, startedAt + MIN, startedAt + 31 * MIN);
    away(from, startedAt + 32 * MIN, startedAt + 62 * MIN);
    expect(screen.getByTestId('away-title').props.children).toBe('1 sa 0 dk uygulamanın dışındaydın.');
    fireEvent.press(screen.getByTestId('away-credit'));
    finish();
    expect(memory.sessions[0].durationMs).toBe(62 * MIN);
  });

  it('pomodoro: back seconds after a break nothing is asked; a card names the study time it would add', () => {
    const from = listenersFrom();
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(screen.getByTestId('mode-pomodoro'));
    start();
    const startedAt = memory.active!.startedAt;
    // Left in the short break (25:00–30:00), back 4 s after it ended (the "Mola bitti" tap).
    away(from, startedAt + 26 * MIN, startedAt + 30 * MIN + 4_000);
    expect(screen.queryByTestId('away-title')).toBeNull();
    // Two hours away from a work block: 30 min of it were pomodoro breaks anyway.
    away(from, startedAt + 40 * MIN, startedAt + 160 * MIN);
    expect(screen.getByTestId('away-title').props.children).toBe('2 sa 0 dk uygulamanın dışındaydın.');
    expect(screen.getByText('Çalışma bloklarına denk gelen 1 sa 30 dk mola sayıldı.')).toBeTruthy();
    finish();
    expect(screen.getByText('Çalışma bloklarına denk gelen 1 sa 30 dk çalışma mıydı?')).toBeTruthy();
    const before = jest.requireActual('../domain/timer').elapsedMs(memory.active!, startedAt + 160 * MIN);
    fireEvent.press(screen.getByTestId('finish-away-credit'));
    expect(memory.sessions[0].durationMs - before).toBe(90 * MIN);
  });

  it('a timer session can be deleted in Geçmiş after a second confirmation', () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    start();
    const startedAt = memory.active!.startedAt;
    act(() => jest.setSystemTime(startedAt + 11 * HOUR));
    finish();
    fireEvent.press(screen.getByTestId('finish-long-all'));
    const id = memory.sessions[0].id;
    const day = jest.requireActual('../domain/istanbul-day').istanbulDayKey(startedAt);
    act(() => router.push('/gecmis'));
    // Folded away until asked for.
    expect(screen.queryByTestId(`history-delete-${id}`)).toBeNull();
    fireEvent.press(screen.getByTestId(`history-sessions-${day}`));
    fireEvent.press(screen.getByTestId(`history-delete-${id}`));
    expect(screen.getByText(/Bu sayaç kaydı silinsin mi\?/)).toBeTruthy();
    fireEvent.press(screen.getByTestId(`history-delete-no-${id}`));
    expect(memory.sessions).toHaveLength(1);
    fireEvent.press(screen.getByTestId(`history-delete-${id}`));
    fireEvent.press(screen.getByTestId(`history-delete-yes-${id}`));
    expect(memory.sessions).toHaveLength(0);
    expect(screen.getByTestId('history-empty')).toBeTruthy();
  });

  it('a session over 10 hours asks; "İlk 10 saati kaydet" keeps 10 hours', () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    start();
    const startedAt = memory.active!.startedAt;
    act(() => jest.setSystemTime(startedAt + 11 * HOUR));
    finish();
    expect(screen.getByTestId('finish-check-title').props.children).toBe('Bu oturum 11 sa 0 dk sürmüş görünüyor.');
    expect(memory.active).not.toBeNull();
    fireEvent.press(screen.getByTestId('finish-long-cap'));
    expect(memory.sessions[0]).toMatchObject({ durationMs: 10 * HOUR, endedAt: startedAt + 10 * HOUR });
  });

  it('… or all of it when the student says so', () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    start();
    const startedAt = memory.active!.startedAt;
    act(() => jest.setSystemTime(startedAt + 11 * HOUR));
    finish();
    fireEvent.press(screen.getByTestId('finish-long-all'));
    expect(memory.sessions[0].durationMs).toBe(11 * HOUR);
  });

  it('a clock set back before the start does not lose the session', () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    start();
    const startedAt = memory.active!.startedAt;
    // 20 minutes of study (heartbeats run), then the network sets the clock 2 hours back.
    act(() => {
      jest.setSystemTime(startedAt + 20 * MIN);
      jest.advanceTimersByTime(5_000);
    });
    act(() => {
      jest.setSystemTime(startedAt - 2 * HOUR);
      jest.advanceTimersByTime(5_000);
    });
    finish();
    expect(memory.sessions).toHaveLength(1);
    expect(memory.sessions[0].durationMs).toBeGreaterThanOrEqual(20 * MIN);
    expect(memory.sessions[0].durationMs).toBeLessThan(21 * MIN);
  });

  const sessionAt = (id: string): CompletedSession => ({
    id,
    subjectId: 'kimya',
    topicId: null,
    startedAt: Date.parse('2026-10-01T07:00:00Z'),
    endedAt: Date.parse('2026-10-01T08:00:00Z'),
    pauses: [],
    durationMs: HOUR,
    source: 'timer',
  });
  const backupText = (extra: Record<string, unknown>) =>
    JSON.stringify({
      format: 'etut-yedek',
      schemaVersion: 1,
      exportedAt: Date.parse('2026-10-02T00:00:00Z'),
      profile: { birthYear: 2000, examType: 'YKS', yksArea: 'sozel' },
      sessions: [sessionAt('x')],
      exams: [],
      topicProgress: [],
      ...extra,
    });

  it('"Değiştir" asks a second time, keeps a copy, and "Geri al" brings the old data back', async () => {
    memory.sessions = [sessionAt('a')];
    memory.topicStatuses = { 'tyt.fizik.basinc': 'done' };
    memory.pickText = backupText({});
    renderRouter(APP_DIR, { initialUrl: '/yedek' });
    await act(async () => {
      fireEvent.press(screen.getByTestId('backup-import'));
    });
    fireEvent.press(screen.getByTestId('backup-mode-replace'));
    fireEvent.press(screen.getByTestId('backup-confirm'));
    // Second question, with what will go; nothing has changed yet.
    expect(screen.getByTestId('backup-replace-sure').props.children).toContain(
      'Bu telefondaki 1 çalışma kaydı, 0 deneme ve 1 konu işareti silinip',
    );
    expect(memory.sessions.map((s) => s.id)).toEqual(['a']);
    fireEvent.press(screen.getByTestId('backup-replace-no'));
    expect(screen.queryByTestId('backup-replace-sure')).toBeNull();
    fireEvent.press(screen.getByTestId('backup-confirm'));
    fireEvent.press(screen.getByTestId('backup-replace-yes'));
    expect(memory.sessions.map((s) => s.id)).toEqual(['x']);
    expect(memory.topicStatuses).toEqual({});
    expect(memory.profile?.yksArea).toBe('sozel');
    expect(memory.replaceUndo).not.toBeNull();

    // "Geri al" replaces too: it asks first, and nothing changes until "Evet".
    fireEvent.press(screen.getByTestId('backup-undo'));
    expect(screen.getByTestId('backup-undo-sure').props.children).toContain(
      'Şu an bu telefondaki 1 çalışma kaydı, 0 deneme ve 0 konu işareti silinip',
    );
    expect(memory.sessions.map((s) => s.id)).toEqual(['x']);
    fireEvent.press(screen.getByTestId('backup-undo-yes'));
    expect(memory.sessions.map((s) => s.id)).toEqual(['a']);
    expect(memory.topicStatuses).toEqual({ 'tyt.fizik.basinc': 'done' });
    expect(memory.profile?.yksArea).toBe('sayisal');
    expect(screen.getByTestId('backup-message').props.children).toBe(
      'Geri alındı. Şu an 1 çalışma kaydı, 0 deneme ve 1 konu işareti var.',
    );
    expect(memory.replaceUndo).toBeNull();
    expect(screen.queryByTestId('backup-undo-card')).toBeNull();
  });

  it('the copy can be deleted, after a second question; one older than a day is neither offered nor kept', async () => {
    const copy = { createdAt: Date.now() - HOUR, text: backupText({}) };
    memory.replaceUndo = copy;
    renderRouter(APP_DIR, { initialUrl: '/yedek' });
    expect(screen.getByTestId('backup-undo-card')).toBeTruthy();
    // Deleting can not be taken back: it asks first, and "Geri al" is not offered meanwhile.
    fireEvent.press(screen.getByTestId('backup-undo-discard'));
    expect(screen.getByTestId('backup-undo-discard-sure').props.children).toBe(
      'Emin misin? Kopya silinirse “Değiştir”den önceki veriler bir daha geri getirilemez.',
    );
    expect(screen.queryByTestId('backup-undo')).toBeNull();
    expect(memory.replaceUndo).toEqual(copy);
    fireEvent.press(screen.getByTestId('backup-undo-discard-no'));
    expect(screen.getByTestId('backup-undo')).toBeTruthy();
    expect(memory.replaceUndo).toEqual(copy);
    fireEvent.press(screen.getByTestId('backup-undo-discard'));
    fireEvent.press(screen.getByTestId('backup-undo-discard-yes'));
    expect(memory.replaceUndo).toBeNull();
    expect(screen.queryByTestId('backup-undo-card')).toBeNull();
  });

  it('an expired copy is removed', () => {
    memory.replaceUndo = { createdAt: Date.now() - 25 * HOUR, text: backupText({}) };
    renderRouter(APP_DIR, { initialUrl: '/yedek' });
    expect(screen.queryByTestId('backup-undo-card')).toBeNull();
    expect(memory.replaceUndo).toBeNull();
  });

  it('an expired copy is removed at app start too, without opening the backup screen', () => {
    memory.replaceUndo = { createdAt: Date.now() - 25 * HOUR, text: backupText({}) };
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(memory.replaceUndo).toBeNull();
  });

  it('a copy that can not be read is kept and the data is left alone', () => {
    memory.sessions = [sessionAt('a')];
    const broken = { createdAt: Date.now() - HOUR, text: '{"format":"etut-yedek"' };
    memory.replaceUndo = broken;
    renderRouter(APP_DIR, { initialUrl: '/yedek' });
    fireEvent.press(screen.getByTestId('backup-undo'));
    fireEvent.press(screen.getByTestId('backup-undo-yes'));
    expect(screen.getByTestId('backup-error').props.children).toBe('Kopya okunamadı, geri alınamadı.');
    expect(memory.replaceUndo).toEqual(broken);
    expect(memory.sessions.map((s) => s.id)).toEqual(['a']);
  });

  const staleExam = {
    id: 'old',
    kind: 'AYT_XYZ',
    scope: 'genel',
    bransSectionId: null,
    takenOn: '2026-09-01',
    createdAt: 1,
    analysisDoneAt: null,
    scores: [{ sectionId: 'matematik', questions: 40, correct: 10, wrong: 0 }],
    marks: [],
  };

  it('"Değiştir" is refused when its copy could not bring everything back; nothing changes', async () => {
    // E.g. after an update changed the exam tables: this exam and target no longer fit them.
    memory.sessions = [sessionAt('a')];
    memory.exams = [{ ...staleExam, totalNet: 10 } as unknown as MockExamWithScores];
    memory.netTargets = { 'TYT:fizik': 8 };
    memory.pickText = backupText({});
    renderRouter(APP_DIR, { initialUrl: '/yedek' });
    await act(async () => {
      fireEvent.press(screen.getByTestId('backup-import'));
    });
    fireEvent.press(screen.getByTestId('backup-mode-replace'));
    fireEvent.press(screen.getByTestId('backup-confirm'));
    fireEvent.press(screen.getByTestId('backup-replace-yes'));
    expect(screen.getByTestId('backup-error').props.children).toBe(
      'Bu telefondaki 1 deneme ve 1 net hedefi uygulamanın şimdiki sınav biçimine (soru sayıları, dersler) uymuyor; “Geri al” bunları geri getiremeyeceği için hiçbir şey değiştirilmedi. İstersen “Birleştir” ile yükleyebilirsin.',
    );
    expect(memory.sessions.map((s) => s.id)).toEqual(['a']);
    expect(memory.exams.map((e) => e.id)).toEqual(['old']);
    expect(memory.netTargets).toEqual({ 'TYT:fizik': 8 });
    expect(memory.replaceUndo).toBeNull();
    // The file is still there to merge instead.
    expect(screen.getByTestId('backup-preview')).toBeTruthy();
  });

  it('"Geri al" with a copy that no longer fits: puts back the rest, says what it could not, keeps the copy', () => {
    memory.sessions = [sessionAt('x')];
    const copy = {
      createdAt: Date.now() - HOUR,
      text: backupText({ sessions: [sessionAt('a')], exams: [staleExam], settings: { netTargets: { 'TYT:fizik': 8 } } }),
    };
    memory.replaceUndo = copy;
    renderRouter(APP_DIR, { initialUrl: '/yedek' });
    fireEvent.press(screen.getByTestId('backup-undo'));
    fireEvent.press(screen.getByTestId('backup-undo-yes'));
    expect(memory.sessions.map((s) => s.id)).toEqual(['a']);
    expect(screen.getByTestId('backup-message').props.children).toBe(
      'Geri alındı. Şu an 1 çalışma kaydı, 0 deneme ve 0 konu işareti var. Kopyadaki 1 deneme ve 1 net hedefi uygulamanın şimdiki sınav biçimine uymadığı için geri getirilemedi; kopya bu telefonda duruyor.',
    );
    expect(memory.replaceUndo).toEqual(copy);
  });

  it('an export says which exams would not load back', async () => {
    memory.profile = ADULT_SAYISAL;
    memory.exams = [{ ...staleExam, totalNet: 10 } as unknown as MockExamWithScores];
    renderRouter(APP_DIR, { initialUrl: '/yedek' });
    await act(async () => {
      fireEvent.press(screen.getByTestId('backup-export'));
    });
    expect(screen.getByTestId('backup-message').props.children).toBe(
      'Yedek dosyası hazırlandı. Uygulamanın şimdiki sınav biçimine (soru sayıları, dersler) uymayan 1 deneme geri yüklemede alınmayacak.',
    );
  });

  it('an old backup with an exam that no longer fits loads the rest and says what was left out', async () => {
    memory.pickText = backupText({
      exams: [
        {
          id: 'old',
          kind: 'AYT_XYZ',
          scope: 'genel',
          bransSectionId: null,
          takenOn: '2026-09-01',
          createdAt: 1,
          analysisDoneAt: null,
          scores: [{ sectionId: 'matematik', questions: 40, correct: 10, wrong: 0 }],
          marks: [],
        },
      ],
      settings: { netTargets: { 'TYT:fizik': 8, 'TYT:matematik': 30 } },
    });
    renderRouter(APP_DIR, { initialUrl: '/yedek' });
    await act(async () => {
      fireEvent.press(screen.getByTestId('backup-import'));
    });
    expect(screen.getByTestId('backup-preview-counts').props.children).toBe(
      'Yedekte 1 çalışma kaydı, 0 deneme ve 0 konu işareti var.',
    );
    expect(screen.getByTestId('backup-preview-skipped-exams').props.children).toBe(
      'Uygulamanın şimdiki sınav biçimine (soru sayıları, dersler) uymayan 1 deneme ve 1 net hedefi yüklenmeyecek; geri kalan her şey yüklenecek.',
    );
    fireEvent.press(screen.getByTestId('backup-confirm'));
    expect(memory.sessions.map((s) => s.id)).toEqual(['x']);
    expect(memory.netTargets).toEqual({ 'TYT:matematik': 30 });
  });

  it('an exam date that has passed is not hidden: the home screen says to enter the new one', () => {
    jest.useFakeTimers();
    jest.setSystemTime(Date.parse('2026-10-07T09:00:00Z'));
    memory.examDates = { YKS: '2026-06-20' };
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(screen.queryByTestId('countdown')).toBeNull();
    expect(screen.getByTestId('countdown-passed').props.children).toBe(
      'Sınav tarihi geçti. Yeni tarihi Ayarlar’dan gir.',
    );
  });

  it('Live Activity: after a phone restart it comes back once; removed again, it stays away', async () => {
    const from = listenersFrom();
    const { startSession } = jest.requireActual('../domain/timer');
    const now = Date.now();
    memory.active = { ...startSession('after-restart', 'fizik', now - 2 * HOUR), lastSeenAt: now - 1_000 };
    memory.liveActivityRecord = { sessionId: 'after-restart', startedAt: now - 2 * HOUR };
    memory.liveActivities = [];
    renderRouter(APP_DIR, { initialUrl: '/' });
    await settle();
    expect(memory.liveActivities).toHaveLength(1);
    expect(memory.liveActivities[0].awayAt).toBeNull();
    expect(memory.liveActivityRecord).toMatchObject({ sessionId: 'after-restart', retried: true });
    // Now the student removes it with the app alive: respected.
    memory.liveActivities = [];
    act(() => jest.setSystemTime(Date.now() + 1_000));
    emitAppState('active', from);
    await settle();
    expect(memory.liveActivities).toHaveLength(0);
    expect(memory.liveActivityRecord).toMatchObject({ dismissed: true });
  });

  it('marking a topic does not reload the stored sessions for the timer and the system surfaces', () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    act(() => router.push('/konular'));
    fireEvent.press(screen.getByTestId('topics-subject-fizik'));
    const before = memory.sessionLoads;
    fireEvent.press(screen.getByTestId('topic-done-tyt.fizik.basinc'));
    expect(memory.topicStatuses['tyt.fizik.basinc']).toBe('done');
    expect(memory.sessionLoads).toBe(before);
  });

  it('a mock exam, its analysis and a net target read no sessions; the exam reminder still follows them', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(Date.parse('2026-10-07T09:00:00Z')); // 12:00 Istanbul
    memory.permission = 'granted';
    memory.remindersConfirmed = true;
    renderRouter(APP_DIR, { initialUrl: '/' });
    await settle();
    act(() => router.push('/denemeler'));
    const before = memory.sessionLoads;

    fireEvent.press(screen.getByTestId('exams-add'));
    fireEvent.changeText(screen.getByTestId('exam-correct-turkce'), '30');
    fireEvent.changeText(screen.getByTestId('exam-wrong-turkce'), '4');
    fireEvent.press(screen.getByTestId('exam-save'));
    await settle();
    // Saved with its analysis pending: tomorrow evening's reminder is planned.
    expect(memory.planned.filter((n) => n.kind === 'exam_analysis')).toHaveLength(1);

    fireEvent.press(screen.getByTestId('trend-section-turkce'));
    fireEvent.changeText(screen.getByTestId('trend-target-input'), '35');
    fireEvent.press(screen.getByTestId('trend-target-save'));
    expect(screen.getByTestId('trend-target').props.children).toBe('Hedef: 35 net');

    // The card for the exam just saved offers its analysis.
    fireEvent.press(screen.getByTestId('exams-saved-analysis'));
    fireEvent.press(screen.getByTestId('analysis-save'));
    await settle();
    expect(screen.queryByTestId('analysis-reminder')).toBeNull();
    expect(memory.planned.filter((n) => n.kind === 'exam_analysis')).toEqual([]);
    expect(memory.sessionLoads).toBe(before);
  });

  it('a setting reads no sessions; the timer screen and the widget still show the new goal', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(Date.parse('2026-10-07T09:00:00Z'));
    renderRouter(APP_DIR, { initialUrl: '/' });
    await settle();
    const before = memory.sessionLoads;
    fireEvent.press(screen.getByTestId('goal-set'));
    fireEvent.press(screen.getByTestId('goal-preset-180'));
    fireEvent.press(screen.getByTestId('goal-sheet-done'));
    await settle();
    expect(screen.getByTestId('goal-progress').props.children).toBe('Hedef 3 sa 0 dk · %0');
    expect(memory.widget[0].props.goalLine).toBe('Hedef 3 sa 0 dk');
    act(() => router.push('/ayarlar'));
    fireEvent.press(screen.getByTestId('settings-keep-awake-off'));
    expect(memory.keepAwakeSetting).toBe(false);
    expect(memory.sessionLoads).toBe(before);
  });

  it('a restore reloads every open screen (each kind of data) and the widget', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(Date.parse('2026-10-07T09:00:00Z')); // 12:00 Istanbul
    const studied = { ...sessionAt('today'), startedAt: Date.parse('2026-10-07T07:00:00Z'), endedAt: Date.parse('2026-10-07T08:00:00Z') };
    memory.pickText = backupText({
      exportedAt: Date.parse('2026-10-07T08:30:00Z'),
      profile: { birthYear: 2000, examType: 'YKS', yksArea: 'sayisal' },
      sessions: [studied],
      exams: [
        {
          id: 'restored',
          kind: 'TYT',
          scope: 'brans',
          bransSectionId: 'turkce',
          takenOn: '2026-10-06',
          createdAt: Date.parse('2026-10-06T12:00:00Z'),
          analysisDoneAt: Date.parse('2026-10-06T12:00:00Z'),
          scores: [{ sectionId: 'turkce', questions: 40, correct: 30, wrong: 4 }],
          marks: [],
        },
      ],
      topicProgress: [{ topicId: 'tyt.fizik.basinc', status: 'done', updatedAt: Date.parse('2026-10-07T08:30:00Z') }],
      settings: { dailyGoalMinutes: 120 },
    });
    renderRouter(APP_DIR, { initialUrl: '/' });
    await settle();
    // Open before the restore, each one reading one kind: sessions and the goal (settings) on the
    // timer, the exam detail (exams), the topic marks (topics).
    expect(screen.getByTestId('today-total').props.children).toBe('0 dk');
    expect(screen.queryByTestId('goal-progress')).toBeNull();
    act(() => router.push('/deneme/restored'));
    expect(screen.getByText('Deneme bulunamadı.')).toBeTruthy();
    act(() => router.push('/konular'));
    fireEvent.press(screen.getByTestId('topics-subject-fizik'));
    expect(screen.getByTestId('topic-done-tyt.fizik.basinc').props.accessibilityState).toMatchObject({ selected: false });

    act(() => router.push('/yedek'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('backup-import'));
    });
    fireEvent.press(screen.getByTestId('backup-mode-replace'));
    fireEvent.press(screen.getByTestId('backup-confirm'));
    fireEvent.press(screen.getByTestId('backup-replace-yes'));
    await settle();
    expect(memory.widget[0].props).toMatchObject({ total: '1 sa 0 dk', goalLine: 'Hedef 2 sa 0 dk' });

    act(() => router.back());
    expect(screen.getByTestId('topic-done-tyt.fizik.basinc').props.accessibilityState).toMatchObject({ selected: true });
    act(() => router.back());
    expect(screen.getByTestId('exam-detail-total').props.children).toBe('29');
    act(() => router.back());
    expect(screen.getByTestId('today-total').props.children).toBe('1 sa 0 dk');
    expect(screen.getByTestId('goal-progress').props.children).toBe('Hedef 2 sa 0 dk · %50');
  });
});

// Package E: report card, question counts, weekly subject targets, monthly calendar.
const mockSubjectTargets: { value: Record<string, number> } = { value: {} };

jest.mock('../storage/subject-targets', () => ({
  loadSubjectTargets: () => ({ ...mockSubjectTargets.value }),
  storeSubjectTarget: (id: string, minutes: number | null) => {
    const next = { ...mockSubjectTargets.value };
    if (minutes === null) delete next[id];
    else next[id] = minutes;
    mockSubjectTargets.value = next;
  },
  storeSubjectTargets: (t: Record<string, number>) => {
    mockSubjectTargets.value = { ...t };
  },
}));

jest.mock('../storage/report', () => ({
  setSessionQuestions: (id: string, questions: number | null) => {
    memory.sessions = memory.sessions.map((s) => {
      if (s.id !== id) return s;
      const { questions: _old, ...rest } = s;
      return questions === null ? rest : { ...rest, questions };
    });
  },
  subjectAllTime: (subjectId: string) => {
    const own = memory.sessions.filter((s) => s.subjectId === subjectId);
    return {
      ms: own.reduce((sum, s) => sum + s.durationMs, 0),
      questions: own.reduce((sum, s) => sum + (s.questions ?? 0), 0),
    };
  },
}));

describe('ders karnesi, soru sayısı, ders hedefi, aylık görünüm', () => {
  const at = (iso: string) => Date.parse(iso);
  const studied = (
    id: string,
    subjectId: string,
    startIso: string,
    minutes: number,
    extra: Partial<CompletedSession> = {},
  ): CompletedSession => ({
    id,
    subjectId,
    topicId: null,
    startedAt: at(startIso),
    endedAt: at(startIso) + minutes * 60_000,
    pauses: [],
    durationMs: minutes * 60_000,
    source: 'timer',
    ...extra,
  });

  beforeEach(() => {
    memory.profile = ADULT_SAYISAL;
    mockSubjectTargets.value = {};
    // Fake timers also when this block runs on its own (renderRouter installs them otherwise).
    jest.useFakeTimers();
    jest.setSystemTime(at('2026-10-07T09:00:00Z')); // Wednesday 12:00 Istanbul
  });

  it('after Bitir the question count is optional: skipped, it saves nothing; given, it is stored', () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(screen.getByText('Fizik'));
    fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
    act(() => {
      jest.setSystemTime(Date.now() + 30 * 60_000);
      jest.advanceTimersByTime(1000);
    });
    fireEvent.press(screen.getByRole('button', { name: 'Bitir' }));
    // Saved without waiting for the count; "Geri al" is still there.
    expect(screen.getByTestId('timer-saved').props.children).toBe('Kaydedildi: 30 dk');
    expect(screen.getByTestId('finish-undo')).toBeTruthy();
    expect(memory.sessions[0].questions).toBeUndefined();

    fireEvent.changeText(screen.getByTestId('finish-questions-input'), '5000');
    fireEvent.press(screen.getByTestId('finish-questions-save'));
    expect(screen.getByTestId('finish-questions-message').props.children).toBe('0 ile 2000 arasında bir tam sayı gir.');
    expect(memory.sessions[0].questions).toBeUndefined();

    expect(screen.queryByTestId('today-questions')).toBeNull();
    fireEvent.changeText(screen.getByTestId('finish-questions-input'), '35');
    fireEvent.press(screen.getByTestId('finish-questions-save'));
    expect(memory.sessions[0].questions).toBe(35);
    expect(screen.getByTestId('finish-questions-message').props.children).toBe('35 soru kaydedildi.');
    expect(screen.getByLabelText('Kaç soru çözdün? (isteğe bağlı)')).toBeTruthy();
    // Today's line counts it next to the time (never as a rate).
    expect(screen.getByTestId('today-total').props.children).toBe('30 dk');
    expect(screen.getByTestId('today-questions').props.children).toBe('· 35 soru');
  });

  it('"Elle ekle" takes an optional count; a wrong one stops the entry with a message', () => {
    renderRouter(APP_DIR, { initialUrl: '/elle-ekle' });
    fireEvent.press(screen.getByTestId('manual-subject-kimya'));
    fireEvent.press(screen.getByTestId('manual-prev-day'));
    fireEvent.changeText(screen.getByTestId('manual-start-hour'), '10');
    fireEvent.changeText(screen.getByTestId('manual-duration-minutes'), '45');
    fireEvent.changeText(screen.getByTestId('manual-questions'), '9999');
    fireEvent.press(screen.getByTestId('manual-add'));
    expect(screen.getByTestId('manual-questions-error')).toBeTruthy();
    expect(memory.sessions).toHaveLength(0);
    fireEvent.changeText(screen.getByTestId('manual-questions'), '20');
    fireEvent.press(screen.getByTestId('manual-add'));
    expect(memory.sessions[0]).toMatchObject({ subjectId: 'kimya', source: 'manual', questions: 20 });
    expect(screen.getByText('20 soru')).toBeTruthy();
  });

  it('weekly: questions per day and subject; a subject row opens its report card', () => {
    memory.sessions = [
      studied('a', 'matematik', '2026-10-05T07:00:00Z', 90, { questions: 40 }),
      studied('b', 'matematik', '2026-10-06T07:00:00Z', 60, { questions: 25 }),
      studied('c', 'fizik', '2026-10-06T10:00:00Z', 30),
    ];
    renderRouter(APP_DIR, { initialUrl: '/haftalik' });
    expect(screen.getByTestId('weekly-total').props.children).toBe('3 sa 0 dk');
    expect(screen.getByTestId('weekly-questions').props.children).toBe('Çözülen soru: 65');
    expect(screen.getByLabelText('Günlere göre çözülen soru. Pzt 40, Sal 25, Çar 0, Per 0, Cum 0, Cmt 0, Paz 0')).toBeTruthy();
    expect(screen.getByText('65 soru')).toBeTruthy();
    // No target yet: the card says where to set one.
    expect(screen.getByText('Bir dersin karnesinden ona haftalık hedef koyabilirsin.')).toBeTruthy();

    fireEvent.press(screen.getByTestId('weekly-subject-matematik'));
    expect(screen.getByTestId('report-screen')).toBeTruthy();
    expect(screen.getByTestId('report-week').props.children).toBe('2 sa 30 dk');
    expect(screen.getByTestId('report-total').props.children).toBe('2 sa 30 dk');
    expect(screen.getByTestId('report-questions').props.children).toBe(
      'Çözülen soru: bugün 0 · bu hafta 65 · toplam 65',
    );
  });

  it('report card: weekly target with − / +, shown again in Haftalık; no ranking anywhere', () => {
    memory.sessions = [studied('a', 'matematik', '2026-10-05T07:00:00Z', 90)];
    renderRouter(APP_DIR, { initialUrl: '/karne/matematik' });
    expect(screen.getByLabelText('Matematik haftalık hedefi, azalt').props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(screen.getByTestId('report-target-plus'));
    fireEvent.press(screen.getByTestId('report-target-plus'));
    fireEvent.press(screen.getByTestId('report-target-plus'));
    fireEvent.press(screen.getByTestId('report-target-plus'));
    expect(mockSubjectTargets.value).toEqual({ matematik: 120 });
    expect(screen.getByTestId('report-target-progress').props.children).toBe('1 sa 30 dk / 2 sa 0 dk · %75');
    expect(screen.getByText('Hedefe 30 dk kaldı.')).toBeTruthy();
    expect(screen.queryByText(/sıra|sıralama/i)).toBeNull();

    act(() => router.push('/haftalik'));
    expect(screen.getByTestId('weekly-target-matematik').props.children).toBe('1 sa 30 dk / 2 sa 0 dk · %75');
    expect(screen.getByLabelText('Matematik haftalık hedefi')).toBeTruthy();
  });

  it('report card brings time, topics and nets of one subject together', () => {
    memory.sessions = [studied('a', 'matematik', '2026-10-07T07:00:00Z', 45, { topicId: 'tyt.matematik.mutlak-deger' })];
    memory.topicStatuses = { 'tyt.matematik.temel-kavramlar': 'done', 'tyt.matematik.sayi-basamaklari': 'review' };
    memory.exams = [
      {
        id: 'e1',
        kind: 'TYT',
        scope: 'genel',
        bransSectionId: null,
        takenOn: '2026-10-01',
        totalNet: 25.5,
        createdAt: 1,
        analysisDoneAt: 2,
        scores: [{ sectionId: 'matematik', questions: 40, correct: 27, wrong: 6 }],
      },
    ];
    memory.marks = { e1: [{ sectionId: 'matematik', topicId: 'tyt.matematik.mutlak-deger', wrong: 4, blank: 1 }] };
    renderRouter(APP_DIR, { initialUrl: '/karne/matematik' });
    expect(screen.getByTestId('report-today').props.children).toBe('45 dk');
    expect(screen.getByTestId('report-topics-done').props.children).toBe('Bitti: 1');
    expect(screen.getByTestId('report-topics-review').props.children).toBe('Tekrar lazım: 1');
    expect(screen.getByTestId('report-net-TYT-matematik')).toBeTruthy();
    expect(screen.getByText('4 yanlış · 1 boş · çalıştığın: 45 dk')).toBeTruthy();
    expect(screen.getByTestId('report-missed-window').props.children).toBe(
      'Bu dersten konu işaretlediğin son 5 denemeye göre.',
    );
    fireEvent.press(screen.getByTestId('report-untouched-toggle'));
    expect(screen.getByText('Dokunulmamış konuları gizle')).toBeTruthy();

    // Another subject from the chips; its card has no nets yet.
    fireEvent.press(screen.getByTestId('report-subject-kimya'));
    expect(screen.getByTestId('report-today').props.children).toBe('0 dk');
    expect(screen.getByText('Bu ders için henüz deneme neti yok. Deneme ekleyince netlerin burada görünür.')).toBeTruthy();

    fireEvent.press(screen.getByTestId('report-open-topics'));
    expect(screen.getByTestId('topics-screen')).toBeTruthy();
    expect(screen.getByTestId('topics-subject-kimya').props.accessibilityState?.selected).toBe(true);
  });

  it('report card: a subject with no test of its own is not told to add an exam; the target line is explained', () => {
    memory.exams = [
      {
        id: 'e1',
        kind: 'TYT',
        scope: 'genel',
        bransSectionId: null,
        takenOn: '2026-10-01',
        totalNet: 25.5,
        createdAt: 1,
        analysisDoneAt: 2,
        scores: [{ sectionId: 'matematik', questions: 40, correct: 27, wrong: 6 }],
      },
    ];
    memory.netTargets = { 'TYT:matematik': 30 };
    renderRouter(APP_DIR, { initialUrl: '/karne/matematik' });
    expect(screen.getByText('Kesik çizgi: hedef net.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('report-subject-diger'));
    expect(screen.getByTestId('report-exams-empty').props.children).toBe('Bu dersin deneme formunda ayrı bir testi yok.');
  });

  it('report card for "Diğer": no exam form at all', () => {
    memory.profile = { ...ADULT_SAYISAL, examType: 'DIGER', yksArea: null };
    renderRouter(APP_DIR, { initialUrl: '/karne/genel' });
    expect(screen.getByTestId('report-exams-empty').props.children).toBe(
      'Bu sınav için deneme formu yok; deneme netleri burada görünmez.',
    );
  });

  it('entry points: the Karne shortcut on the timer and the button in Konular', () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    // Existing shortcuts are still there, Karne is added after them.
    expect(screen.getByTestId('open-topics')).toBeTruthy();
    expect(screen.getByTestId('open-weekly')).toBeTruthy();
    fireEvent.press(screen.getByTestId('open-report'));
    expect(screen.getByTestId('report-screen')).toBeTruthy();

    act(() => router.push('/konular'));
    fireEvent.press(screen.getByTestId('topics-subject-fizik'));
    fireEvent.press(screen.getByTestId('topics-open-report'));
    expect(screen.getByTestId('report-subject-fizik').props.accessibilityState?.selected).toBe(true);
  });

  it('monthly calendar: totals, best day, every day labelled; arrows move by month', () => {
    memory.sessions = [
      studied('a', 'matematik', '2026-10-01T07:00:00Z', 120),
      studied('b', 'fizik', '2026-10-03T07:00:00Z', 400),
      studied('c', 'kimya', '2026-09-15T07:00:00Z', 30),
    ];
    renderRouter(APP_DIR, { initialUrl: '/haftalik' });
    expect(screen.getByTestId('monthly-month').props.children).toBe('Ekim 2026');
    expect(screen.getByTestId('monthly-total').props.children).toBe('Toplam: 8 sa 40 dk');
    expect(screen.getByTestId('monthly-best').props.children).toBe('En çok: 3 Ekim 2026 · 6 sa 40 dk');
    expect(screen.getByText('Çalıştığın gün: 2/7')).toBeTruthy();
    expect(screen.getByText('Ara verdiğin gün: 5')).toBeTruthy();
    expect(screen.getByLabelText('3 Ekim 2026: 6 sa 40 dk')).toBeTruthy();
    expect(screen.getByLabelText('2 Ekim 2026: çalışma yok')).toBeTruthy();
    expect(screen.getByLabelText('20 Ekim 2026: henüz gelmedi')).toBeTruthy();
    const next = screen.getByTestId('monthly-next');
    expect(next.props.accessibilityState?.disabled ?? next.props['aria-disabled']).toBeTruthy();

    fireEvent.press(screen.getByTestId('monthly-prev'));
    expect(screen.getByTestId('monthly-month').props.children).toBe('Eylül 2026');
    expect(screen.getByTestId('monthly-total').props.children).toBe('Toplam: 30 dk');
    expect(screen.getByText('Çalıştığın gün: 1/30')).toBeTruthy();
    fireEvent.press(screen.getByTestId('monthly-prev'));
    expect(screen.getByTestId('monthly-empty')).toBeTruthy();
  });

  it('history shows the questions of a day', () => {
    memory.sessions = [studied('a', 'matematik', '2026-10-06T07:00:00Z', 60, { questions: 30 })];
    renderRouter(APP_DIR, { initialUrl: '/gecmis' });
    expect(screen.getByTestId('history-questions-2026-10-06').props.children).toBe('30 soru');
  });

  it('widget: the exam countdown line follows the exam date', async () => {
    // A date of the student's own (the widget skips a timeline that looks like the last one sent).
    memory.examDates = { YKS: '2027-06-26' };
    renderRouter(APP_DIR, { initialUrl: '/' });
    await act(async () => {});
    expect(memory.widget[0].props.countdownLine).toBe('YKS’ye 262 gün');
    // The next day's entry says one day less.
    const tomorrow = memory.widget.find((e) => e.at === at('2026-10-07T21:00:00Z'));
    expect(tomorrow?.props.countdownLine).toBe('YKS’ye 261 gün');
  });
});

describe('accessibility names on key screens', () => {
  /** Roles a screen reader user acts on; each one needs a name of its own. */
  const ACTIONABLE = new Set(['button', 'switch', 'link', 'checkbox', 'radio', 'tab', 'togglebutton', 'adjustable', 'menuitem']);
  type Node = ReturnType<typeof screen.getByTestId>;

  const isInput = (node: Node): boolean => String(node.type) === 'TextInput';

  function textOf(node: Node | string): string {
    return typeof node === 'string' ? node : node.children.map(textOf).join('');
  }

  /** What VoiceOver reads as the element's name: its label, or else its text. */
  function nameOf(node: Node): string {
    const label = node.props.accessibilityLabel ?? node.props['aria-label'];
    if (typeof label === 'string') return label.trim();
    return isInput(node) ? '' : textOf(node).replace(/\s+/g, ' ').trim();
  }

  const roleOf = (node: Node): unknown => node.props.accessibilityRole ?? node.props.role;
  const idOf = (node: Node): string => node.props.testID ?? `${String(node.type)} "${textOf(node)}"`;

  /** Buttons, switches, links and text fields of the rendered screen (host elements). */
  function controls(): Node[] {
    return screen.root.findAll(
      (node) => typeof node.type === 'string' && (isInput(node) || ACTIONABLE.has(roleOf(node) as string)),
    );
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(Date.parse('2026-10-07T09:00:00Z')); // Wednesday 12:00 Istanbul
    const now = Date.now();
    memory.profile = ADULT_SAYISAL;
    memory.dailyGoal = 120;
    memory.remindersConfirmed = true;
    memory.reminderPrefs = { daily: { enabled: true, hour: 20, minute: 0 }, longSession: { enabled: true, hours: 3 } };
    memory.topicStatuses = { 'tyt.fizik.basinc': 'done', 'ayt.matematik.turev': 'review' };
    memory.sessions = [
      { id: 's1', subjectId: 'fizik', topicId: null, startedAt: now - 3 * 3_600_000, endedAt: now - 2 * 3_600_000, pauses: [], durationMs: 3_600_000, source: 'timer' },
      { id: 's2', subjectId: 'matematik', topicId: null, startedAt: now - 26 * 3_600_000, endedAt: now - 25 * 3_600_000, pauses: [], durationMs: 3_600_000, source: 'manual' },
    ];
    const scores = (matematikWrong: number) => [
      { sectionId: 'turkce', questions: 40, correct: 30, wrong: 0 },
      { sectionId: 'matematik', questions: 40, correct: 30, wrong: matematikWrong },
    ];
    memory.exams = [
      { id: 'e1', kind: 'TYT', scope: 'genel', bransSectionId: null, takenOn: '2026-10-01', totalNet: 58.5, createdAt: 2, analysisDoneAt: null, scores: scores(6) },
      { id: 'e2', kind: 'TYT', scope: 'genel', bransSectionId: null, takenOn: '2026-09-24', totalNet: 60, createdAt: 1, analysisDoneAt: 1, scores: scores(0) },
    ];
    memory.marks = { e1: [{ sectionId: 'matematik', topicId: 'tyt.matematik.mutlak-deger', wrong: 2, blank: 1 }] };
  });

  it.each([
    '/',
    '/konular',
    '/hatirlaticilar',
    '/denemeler',
    '/ayarlar',
    '/paylas',
    '/yedek',
    '/karne/fizik',
    '/elle-ekle',
    '/deneme/yeni',
    '/deneme/e1',
    '/analiz/e1',
    '/haftalik',
    '/gecmis',
    '/hakkinda',
  ])('%s: every control has a role and a name of its own', (url) => {
    renderRouter(APP_DIR, { initialUrl: url });
    const found = controls();
    expect(found.length).toBeGreaterThan(0);
    // Anything pressable is announced as something (button, switch, link…), not as plain text.
    const pressable = screen.root.findAll(
      (node) => typeof node.type === 'string' && node.props.onClick !== undefined && !ACTIONABLE.has(roleOf(node) as string),
    );
    expect(pressable.map(idOf)).toEqual([]);
    expect(found.filter((node) => nameOf(node) === '').map(idOf)).toEqual([]);
    // The same name twice on one screen ("Bitti", "Saat") leaves a VoiceOver user guessing.
    const names = found.map(nameOf);
    expect(names.filter((name, i) => names.indexOf(name) !== i)).toEqual([]);
  });

  // States the resting screens above do not show: several entries with their own "Sil" (one being
  // confirmed), and the open topic picker, where TYT and AYT share topic names.
  it.each<[string, () => void]>([
    [
      '/elle-ekle with several entries, one asking "Bu kayıt silinsin mi?"',
      () => {
        const start = Date.now() - 50 * 3_600_000;
        memory.sessions.push({ id: 's3', subjectId: 'fizik', topicId: null, startedAt: start, endedAt: start + 1_800_000, pauses: [], durationMs: 1_800_000, source: 'manual' });
        renderRouter(APP_DIR, { initialUrl: '/elle-ekle' });
        fireEvent.press(screen.getByTestId('manual-delete-s2'));
      },
    ],
    [
      '/ with the topic picker open on Matematik',
      () => {
        renderRouter(APP_DIR, { initialUrl: '/' });
        fireEvent.press(screen.getByTestId('subject-matematik'));
        fireEvent.press(screen.getByTestId('topic-picker-toggle'));
        expect(screen.getByTestId('topic-tyt.matematik.fonksiyonlar').props.accessibilityLabel).toBe('TYT Fonksiyonlar');
      },
    ],
  ])('%s: every control has a name of its own', (_, open) => {
    open();
    const names = controls().map(nameOf);
    expect(names.length).toBeGreaterThan(0);
    expect(names.filter((name) => name === '')).toEqual([]);
    expect(names.filter((name, i) => names.indexOf(name) !== i)).toEqual([]);
  });

  it('the "Sil" of an entry says which entry it deletes', () => {
    renderRouter(APP_DIR, { initialUrl: '/elle-ekle' });
    expect(screen.getByTestId('manual-delete-s2').props.accessibilityLabel).toBe('Sil: Matematik, 6 Ekim 2026 · 10:00, 1 sa 0 dk');
    fireEvent.press(screen.getByTestId('manual-delete-s2'));
    expect(screen.getByTestId('manual-delete-yes-s2').props.accessibilityLabel).toBe('Sil: Matematik, 6 Ekim 2026 · 10:00, 1 sa 0 dk');
  });

  it('more messages that appear after an action are read out, a repeated mistake again', async () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    announce.mockClear();
    const said = (message: string) => announce.mock.calls.filter(([m]) => m === message).length;
    // Net target ("Hedefi kaydet") on Denemeler.
    renderRouter(APP_DIR, { initialUrl: '/denemeler' });
    fireEvent.press(screen.getByTestId('trend-section-matematik'));
    fireEvent.changeText(screen.getByTestId('trend-target-input'), '45');
    fireEvent.press(screen.getByTestId('trend-target-save'));
    fireEvent.press(screen.getByTestId('trend-target-save'));
    expect(said('0’dan büyük, en fazla 40 olan ve en çok iki ondalıklı bir net gir (ör. 30).')).toBe(2);
    // The note under "Önce yedek al" in the delete dialog.
    act(() => router.push('/ayarlar'));
    fireEvent.press(screen.getByTestId('settings-delete-all'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('settings-delete-all-backup'));
    });
    // The fixture's two-section TYT exams do not fit the TYT tables, so the note also says they would
    // be skipped on restore; what is checked here is that the note is read out.
    expect(announce).toHaveBeenLastCalledWith(
      expect.stringMatching(/^Yedek dosyası hazırlandı\..*Silmeden önce dosyayı bir yere kaydettiğinden emin ol; Etüt bunu kontrol edemez\.$/),
    );
    announce.mockRestore();
  });

  it('a wrong question count after Bitir is read out on each Kaydet', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    announce.mockClear();
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(screen.getByTestId('subject-fizik'));
    fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
    act(() => {
      jest.setSystemTime(Date.now() + 30 * 60_000);
      jest.advanceTimersByTime(1000);
    });
    fireEvent.press(screen.getByRole('button', { name: 'Bitir' }));
    fireEvent.changeText(screen.getByTestId('finish-questions-input'), '5000');
    fireEvent.press(screen.getByTestId('finish-questions-save'));
    fireEvent.press(screen.getByTestId('finish-questions-save'));
    expect(announce.mock.calls.filter(([m]) => m === '0 ile 2000 arasında bir tam sayı gir.')).toHaveLength(2);
    announce.mockRestore();
  });

  it('a Başla refused for the declared age is read out on each tap', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    announce.mockClear();
    const year = new Date().getUTCFullYear();
    memory.profile = null;
    memory.youngestBirthYear = year - 12;
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(screen.getByText(String(year - 20)));
    fireEvent.press(screen.getByText('KPSS'));
    fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
    fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
    const blocked = screen.getByTestId('onboarding-age-blocked').props.children;
    expect(announce.mock.calls.filter(([m]) => m === blocked)).toHaveLength(2);
    announce.mockRestore();
  });

  it('reminder toggles are switches named by their reminder', () => {
    memory.reminderPrefs = { daily: { enabled: true, hour: 20, minute: 0 }, longSession: { enabled: false, hours: 3 } };
    renderRouter(APP_DIR, { initialUrl: '/hatirlaticilar' });
    const daily = screen.getByRole('switch', { name: 'Günlük çalışma hatırlatıcısı' });
    expect(daily.props.testID).toBe('reminder-daily-toggle');
    expect(daily.props.accessibilityState).toEqual({ checked: true });
    expect(screen.getByRole('switch', { name: 'Uzun oturum uyarısı' }).props.accessibilityState).toEqual({ checked: false });
    // The visible text stays "Açık" / "Kapalı".
    expect(textOf(daily)).toBe('Açık');
  });

  it('topic marks name their topic, with the paper where TYT and AYT share a name', () => {
    renderRouter(APP_DIR, { initialUrl: '/konular' });
    fireEvent.press(screen.getByTestId('topics-subject-matematik'));
    expect(screen.getByTestId('topic-done-tyt.matematik.fonksiyonlar').props.accessibilityLabel).toBe('TYT Fonksiyonlar: Bitti');
    expect(screen.getByTestId('topic-done-ayt.matematik.fonksiyonlar').props.accessibilityLabel).toBe('AYT Fonksiyonlar: Bitti');
    expect(screen.getByTestId('topic-review-ayt.matematik.turev').props).toMatchObject({
      accessibilityLabel: 'AYT Türev: Tekrar lazım',
      accessibilityState: { selected: true },
    });
  });

  it('a study-time chart reads its values as durations, not as clock times', () => {
    renderRouter(APP_DIR, { initialUrl: '/gecmis' });
    // The bar shows "1:00"; VoiceOver hears "1 sa 0 dk".
    expect(screen.getByLabelText(/^Grafik\. .*Bugün: 1 sa 0 dk$/)).toBeTruthy();
  });

  it('a topic name both papers share carries its paper in the timer picker and the most-missed list', () => {
    memory.marks = {
      e1: [
        { sectionId: 'matematik', topicId: 'tyt.matematik.fonksiyonlar', wrong: 3, blank: 0 },
        { sectionId: 'matematik', topicId: 'ayt.matematik.fonksiyonlar', wrong: 2, blank: 0 },
      ],
    };
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(screen.getByTestId('subject-matematik'));
    fireEvent.press(screen.getByTestId('topic-picker-toggle'));
    expect(screen.getByTestId('topic-tyt.matematik.fonksiyonlar').props.accessibilityLabel).toBe('TYT Fonksiyonlar');
    expect(screen.getByTestId('topic-ayt.matematik.fonksiyonlar').props.accessibilityLabel).toBe('AYT Fonksiyonlar');
    // A name of one paper only stays as it is.
    expect(screen.getByTestId('topic-ayt.matematik.turev').props.accessibilityLabel).toBe('Türev');
    fireEvent.press(screen.getByTestId('topic-ayt.matematik.fonksiyonlar'));
    expect(screen.getByText('AYT Fonksiyonlar')).toBeTruthy();

    act(() => router.push('/denemeler'));
    expect(screen.getByLabelText('TYT Fonksiyonlar: tekrar lazım')).toBeTruthy();
    expect(screen.getByLabelText('AYT Fonksiyonlar: tekrar lazım')).toBeTruthy();
  });

  it('an exam in the list is one button with a full sentence and a hint', () => {
    renderRouter(APP_DIR, { initialUrl: '/denemeler' });
    expect(screen.getByTestId('exam-item-0').props).toMatchObject({
      accessibilityRole: 'button',
      accessibilityLabel: 'TYT, 58,5 net, 1 Ekim 2026, Genel, analiz bekliyor',
      accessibilityHint: 'Denemenin ayrıntısını açar',
    });
    expect(screen.getByTestId('exam-item-1').props.accessibilityLabel).toBe('TYT, 60 net, 24 Eylül 2026, Genel');
  });

  it('a message that appears after an action is read out (manual entry error and success)', () => {
    const announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
    // React Native's jest setup already mocks it: spyOn returns that mock, with earlier tests' calls.
    announce.mockClear();
    renderRouter(APP_DIR, { initialUrl: '/elle-ekle' });
    fireEvent.press(screen.getByTestId('manual-change-time'));
    fireEvent.press(screen.getByTestId('manual-add'));
    expect(announce).toHaveBeenLastCalledWith('Başlangıç saatini ve süreyi kontrol et.');
    // The same mistake again is read out again (else the tap would seem to do nothing).
    fireEvent.press(screen.getByTestId('manual-add'));
    expect(announce.mock.calls.filter(([m]) => m === 'Başlangıç saatini ve süreyi kontrol et.')).toHaveLength(2);
    fireEvent.changeText(screen.getByTestId('manual-start-hour'), '7');
    fireEvent.changeText(screen.getByTestId('manual-duration-minutes'), '30');
    fireEvent.press(screen.getByTestId('manual-add'));
    expect(announce).toHaveBeenLastCalledWith('Eklendi: 30 dk (elle)');
    announce.mockRestore();
  });
});

describe('App Store rating dialog (X-7)', () => {
  const exam = (id: string, takenOn: string): MockExamWithScores => ({
    id,
    kind: 'TYT',
    scope: 'genel',
    bransSectionId: null,
    takenOn,
    totalNet: 10,
    createdAt: 1,
    analysisDoneAt: 1,
    scores: [{ sectionId: 'turkce', questions: 40, correct: 10, wrong: 0 }],
  });
  const UNDER_15: Profile = { birthYear: 2013, examType: 'LGS', yksArea: null, soloOnly: true, createdAt: 0 };
  /** 30 min on each of the `days` days before today (12:00 Istanbul on 7 Oct 2026). */
  const pastDays = (days: number): CompletedSession[] =>
    Array.from({ length: days }, (_, i) => {
      const startedAt = Date.parse('2026-10-06T07:00:00Z') - i * 86_400_000;
      return {
        id: `p${i}`,
        subjectId: 'fizik',
        topicId: null,
        startedAt,
        endedAt: startedAt + 30 * 60_000,
        pauses: [],
        durationMs: 30 * 60_000,
        source: 'timer' as const,
      };
    });
  const flush = () => act(async () => {});
  async function saveExam() {
    fireEvent.press(screen.getByTestId('exams-add'));
    fireEvent.changeText(screen.getByTestId('exam-correct-turkce'), '10');
    fireEvent.press(screen.getByTestId('exam-save'));
    await flush();
  }
  /** Starts, studies 31 min and finishes on the timer tab. */
  function studyAndFinish() {
    fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
    act(() => {
      jest.setSystemTime(Date.now() + 31 * 60_000);
      jest.advanceTimersByTime(1000);
    });
    fireEvent.press(screen.getByRole('button', { name: 'Bitir' }));
  }

  const originalAppState = AppState.currentState;
  const setAppState = (status: AppStateStatus) =>
    Object.defineProperty(AppState, 'currentState', { value: status, configurable: true, writable: true });

  beforeEach(() => {
    memory.profile = ADULT_SAYISAL;
    mockReview.askedAt = null;
    mockReview.requests = 0;
    setAppState('active');
    jest.useFakeTimers();
    jest.setSystemTime(Date.parse('2026-10-07T09:00:00Z'));
  });

  afterEach(() => {
    Object.defineProperty(AppState, 'currentState', { value: originalAppState, configurable: true, writable: true });
  });

  it('asks as the 3rd saved exam closes the form, then not again within 120 days', async () => {
    memory.exams = [exam('a', '2026-09-24')];
    renderRouter(APP_DIR, { initialUrl: '/denemeler' });
    await saveExam();
    expect(memory.exams).toHaveLength(2);
    expect(mockReview.requests).toBe(0);

    memory.exams = [exam('a', '2026-09-24'), exam('b', '2026-10-01')];
    await saveExam();
    expect(memory.exams).toHaveLength(3);
    expect(mockReview).toMatchObject({ requests: 1, askedAt: Date.now() });

    memory.exams = memory.exams.slice(1);
    jest.setSystemTime(Date.now() + 119 * 86_400_000);
    await saveExam();
    expect(mockReview.requests).toBe(1);
  });

  it('never for an under-15 profile, and never while a session runs', async () => {
    memory.profile = UNDER_15;
    memory.exams = [exam('a', '2026-09-24'), exam('b', '2026-10-01')];
    renderRouter(APP_DIR, { initialUrl: '/denemeler' });
    fireEvent.press(screen.getByTestId('exams-add'));
    fireEvent.changeText(screen.getByTestId('exam-correct-turkce'), '10');
    fireEvent.press(screen.getByTestId('exam-save'));
    await flush();
    expect(memory.exams).toHaveLength(3);
    expect(mockReview.requests).toBe(0);
    screen.unmount();

    memory.profile = ADULT_SAYISAL;
    memory.exams = [exam('a', '2026-09-24'), exam('b', '2026-10-01')];
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
    act(() => router.push('/deneme/yeni'));
    fireEvent.changeText(screen.getByTestId('exam-correct-turkce'), '10');
    fireEvent.press(screen.getByTestId('exam-save'));
    await flush();
    expect(memory.exams).toHaveLength(3);
    expect(memory.active).not.toBeNull();
    expect(mockReview.requests).toBe(0);
  });

  it('after a session that makes a 7-day goal streak, once "Geri al" is gone', async () => {
    memory.dailyGoal = 30;
    memory.sessions = pastDays(6);
    renderRouter(APP_DIR, { initialUrl: '/' });
    studyAndFinish();
    expect(screen.getByTestId('finish-goal-reached')).toBeTruthy();
    await flush();
    // The dialog never covers "Geri al".
    expect(screen.getByTestId('finish-undo')).toBeTruthy();
    expect(mockReview.requests).toBe(0);
    act(() => jest.advanceTimersByTime(UNDO_FINISH_MS + 1000));
    await flush();
    expect(screen.queryByTestId('finish-undo')).toBeNull();
    expect(mockReview.requests).toBe(1);
  });

  it('not when "Geri al" ends in the background or hours later (the phone was locked after Bitir)', async () => {
    memory.dailyGoal = 30;
    memory.sessions = pastDays(6);
    renderRouter(APP_DIR, { initialUrl: '/' });
    studyAndFinish();
    // Locked right after Bitir: the timer fires in the background.
    setAppState('background');
    act(() => jest.advanceTimersByTime(UNDO_FINISH_MS + 1000));
    await flush();
    expect(screen.queryByTestId('finish-undo')).toBeNull();
    expect(mockReview.requests).toBe(0);
    screen.unmount();

    setAppState('active');
    memory.sessions = pastDays(6);
    renderRouter(APP_DIR, { initialUrl: '/' });
    studyAndFinish();
    // The undo timer was paused while locked and fires when the app is opened 3 hours later.
    act(() => {
      jest.setSystemTime(Date.now() + 3 * 60 * 60_000);
      jest.advanceTimersByTime(UNDO_FINISH_MS + 1000);
    });
    await flush();
    expect(screen.queryByTestId('finish-undo')).toBeNull();
    expect(mockReview.requests).toBe(0);
  });

  it('not for a shorter streak, and not when a new session started within the undo window', async () => {
    memory.dailyGoal = 30;
    memory.sessions = pastDays(5);
    renderRouter(APP_DIR, { initialUrl: '/' });
    studyAndFinish();
    act(() => jest.advanceTimersByTime(UNDO_FINISH_MS + 1000));
    await flush();
    expect(mockReview.requests).toBe(0);
    screen.unmount();

    memory.sessions = pastDays(6);
    renderRouter(APP_DIR, { initialUrl: '/' });
    studyAndFinish();
    fireEvent.press(screen.getByRole('button', { name: 'Başla' }));
    act(() => jest.advanceTimersByTime(UNDO_FINISH_MS + 1000));
    await flush();
    expect(memory.active).not.toBeNull();
    expect(mockReview.requests).toBe(0);
  });
});
