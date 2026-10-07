/**
 * Smoke test of the real screens with expo-router's test renderer. Storage is replaced by
 * in-memory fakes (SQLite cannot run under Jest); everything else is the app code as shipped.
 */

import { act, fireEvent, screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import { AccessibilityInfo, AppState, type AppStateStatus, Vibration } from 'react-native';

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
  exams: MockExamWithScores[];
  marks: Record<string, TopicMark[]>;
  examDates: Record<string, string>;
  netTargets: Record<string, number>;
  tipsSeen: boolean;
  /** Files handed to the share sheet (backup, CSV) and captured card images. */
  shared: { name: string; content: string }[];
  sharedImages: string[];
  /** Text the fake document picker returns; `null` = the student cancels. */
  pickText: string | null;
  reminderPrefs: unknown;
  remindersConfirmed: boolean;
  liveActivityRecord: { sessionId: string; startedAt: number; dismissed?: boolean } | null;
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
  exams: [],
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
  permission: 'undetermined',
  grantOnRequest: true,
  permissionRequests: 0,
  answerPermission: false,
  planned: [],
  liveActivities: [],
  liveActivityStaleAt: null,
  widget: [],
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
    onOpen: () => () => {},
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
  wipeKeyValueStore: () => {
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
    memory.exams = data.exams.map(({ marks, ...e }) => e);
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
  shareImage: async (uri: string) => {
    memory.sharedImages.push(uri);
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
  sessionsOverlapping: (from: number, to: number) =>
    memory.sessions.filter((s) => s.endedAt > from && s.startedAt < to),
  allSessions: () => memory.sessions,
  recentManualSessions: () => memory.sessions.filter((s) => s.source === 'manual').reverse(),
  deleteManualSession: (id: string) => {
    memory.sessions = memory.sessions.filter((s) => !(s.id === id && s.source === 'manual'));
  },
  deleteSessionForUndo: (id: string) => {
    memory.sessions = memory.sessions.filter((s) => !(s.id === id && s.source === 'timer'));
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
  memory.tipsSeen = true;
  memory.shared = [];
  memory.sharedImages = [];
  memory.pickText = null;
  memory.reminderPrefs = null;
  memory.remindersConfirmed = false;
  memory.liveActivityRecord = null;
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
    expect(memory.sharedImages).toEqual(['/tmp/etut-card.png']);
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
    expect(file).toMatchObject({ format: 'etut-yedek', schemaVersion: 1, sessions: [{ id: 'a' }] });
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
    fireEvent.press(screen.getByTestId('about-doc-gizlilik'));
    expect(screen.getByTestId('legal-gizlilik')).toBeTruthy();
  });

  it('the short notice is reachable from onboarding before anything is saved', () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(screen.getByTestId('onboarding-privacy'));
    expect(screen.getByTestId('legal-aydinlatma')).toBeTruthy();
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
      expect(memory.liveActivityStaleAt).toBe(startedAt + 30 * 60_000);
      const reminders = futurePomodoroReminders();
      expect(reminders).toHaveLength(POMODORO_CHANGES_AHEAD);
      expect(reminders[0]).toMatchObject({ at: startedAt + 30 * 60_000, ended: 'short_break' });
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
    expect(screen.getByTestId('reminder-daily-toggle').props.accessibilityState.selected).toBe(false);
    fireEvent.press(screen.getByTestId('reminder-daily-toggle'));
    await settle();
    // The explanation lists what will be on, the requested daily reminder included.
    expect(screen.getByTestId('notification-permission-item-daily')).toBeTruthy();
    expect(screen.getByTestId('notification-permission-item-longSession').props.children).toBe(
      '• Uzun oturum uyarısı (3 saat)',
    );
    expect(memory.permissionRequests).toBe(0);
    // Apple HIG: one "Continue"-like button, no second way out of the explanation.
    expect(screen.queryByTestId('notification-permission-later')).toBeNull();
    expect(screen.queryByText('Şimdi değil')).toBeNull();

    // "Devam et" shows the system prompt (granted here) and turns the reminder on.
    fireEvent.press(screen.getByTestId('notification-permission-allow'));
    await settle();
    expect(memory.permissionRequests).toBe(1);
    expect(screen.getByTestId('reminder-daily-toggle').props.accessibilityState.selected).toBe(true);
    expect(screen.getByTestId('reminder-daily-time').props.children).toBe('20:00');
    fireEvent.press(screen.getByTestId('reminder-daily-hour-plus'));
    fireEvent.press(screen.getByTestId('reminder-daily-minute-minus'));
    expect(screen.getByTestId('reminder-daily-time').props.children).toBe('20:45');
    await settle();
    expect(memory.planned.some((n) => n.kind === 'daily')).toBe(true);
  });

  it('a refused permission keeps the app working and the reminders silent', async () => {
    memory.grantOnRequest = false;
    renderRouter(APP_DIR, { initialUrl: '/hatirlaticilar' });
    await settle();
    fireEvent.press(screen.getByTestId('reminders-permission'));
    await settle();
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
    fireEvent.press(screen.getByRole('button', { name: 'Mola' }));
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
    expect(screen.getByTestId('reminder-long-toggle').props.accessibilityState.selected).toBe(false);
    fireEvent.press(screen.getByTestId('reminder-long-toggle'));
    await settle();
    expect(screen.getByTestId('notification-permission-item-longSession')).toBeTruthy();
    fireEvent.press(screen.getByTestId('notification-permission-allow'));
    await settle();
    expect(memory.remindersConfirmed).toBe(true);
    expect(screen.getByTestId('reminder-long-toggle').props.accessibilityState.selected).toBe(true);
    const kinds = memory.planned.map((n) => n.kind);
    expect(kinds).toContain('long_session');
    expect(kinds).toContain('pomodoro');
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
