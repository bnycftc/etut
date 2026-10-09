/**
 * In-app guidance: the tips again from Ayarlar, "Nasıl çalışır" and its "Nedir?" links, the
 * "Son yedek" line with the quiet backup card, and the contact row. Real screens through
 * expo-router's test renderer; storage is an in-memory fake as in app-smoke.test.tsx.
 */

import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import { StyleSheet } from 'react-native';

import { DAY_MS, dayStartMs, istanbulDayKey } from '../domain/istanbul-day';
import type { Profile } from '../domain/profile';
import type { ActiveSession, CompletedSession } from '../domain/timer';

jest.setTimeout(30_000);

const memory: {
  profile: Profile | null;
  active: ActiveSession | null;
  sessions: CompletedSession[];
  dailyGoal: number | null;
  examDates: Record<string, string>;
  tipsSeen: boolean;
  lastBackupAt: number | null;
  backupNudgeDismissedAt: number | null;
  shared: { name: string; content: string }[];
} = {
  profile: null,
  active: null,
  sessions: [],
  dailyGoal: null,
  examDates: {},
  tipsSeen: true,
  lastBackupAt: null,
  backupNudgeDismissedAt: null,
  shared: [],
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
  shareTextFile: async (name: string, content: string) => {
    memory.shared.push({ name, content });
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
  recentManualSessions: () => memory.sessions.filter((s) => s.source === 'manual'),
  deleteManualSession: () => {},
  deleteSessionForUndo: () => {},
  topicTotals: () => ({}),
}));
jest.mock('../storage/topics', () => ({
  loadTopicStatuses: () => ({}),
  setTopicStatus: () => {},
}));
jest.mock('../storage/mock-exams', () => ({
  listMockExams: () => [],
  listExamsNeedingAnalysis: () => [],
  getMockExam: () => null,
  saveMockExam: () => {},
  updateMockExam: () => false,
  deleteMockExam: () => {},
  getExamMarks: () => [],
  listAllMarks: () => [],
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

/** 30 minutes at 10:00 (Istanbul) on each of the `days` days before today. */
function studiedOnPastDays(days: number, source: 'timer' | 'manual' = 'timer'): CompletedSession[] {
  const todayStart = dayStartMs(istanbulDayKey(Date.now()));
  return Array.from({ length: days }, (_, i) => {
    const startedAt = todayStart - (i + 1) * DAY_MS + 10 * 3_600_000;
    return {
      id: `s${i}`,
      subjectId: 'fizik',
      topicId: null,
      startedAt,
      endedAt: startedAt + 30 * 60_000,
      pauses: [],
      durationMs: 30 * 60_000,
      source,
    };
  });
}

const disabled = (testID: string) => {
  const el = screen.getByTestId(testID);
  return el.props.accessibilityState?.disabled ?? el.props['aria-disabled'];
};
const outlined = (testID: string) => StyleSheet.flatten(screen.getByTestId(testID).props.style).borderWidth === 2;

beforeEach(() => {
  memory.profile = ADULT;
  memory.active = null;
  memory.sessions = [];
  memory.dailyGoal = null;
  memory.examDates = {};
  memory.tipsSeen = true;
  memory.lastBackupAt = null;
  memory.backupNudgeDismissedAt = null;
  memory.shared = [];
});

describe('the tour again', () => {
  it('Ayarlar → "Turu yeniden göster" opens the three tips on the timer tab, from the first step', () => {
    renderRouter(APP_DIR, { initialUrl: '/ayarlar' });
    expect(screen.queryByTestId('tips-card')).toBeNull();
    fireEvent.press(screen.getByTestId('settings-show-tips'));
    expect(memory.tipsSeen).toBe(false);
    expect(screen.getByTestId('tips-card')).toBeTruthy();
    expect(screen.getByTestId('tips-step-title').props.children).toBe('Ders seç, Başla’ya dokun');
    fireEvent.press(screen.getByTestId('tips-next'));
    // Wave-1 rules: the away setting, by its name in Ayarlar.
    expect(screen.getByTestId('tips-step-title').props.children).toBe('Uygulamadan çıkarsan');
    expect(screen.getByText(/“Çalışmaya devam say”/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('tips-skip'));
    expect(screen.queryByTestId('tips-card')).toBeNull();
    expect(memory.tipsSeen).toBe(true);
    expect(screen.getByTestId('timer-start')).toBeTruthy();
  });

  it('the first tip mentions the screen kept on, the lock screen timer and "Geri al"', () => {
    memory.tipsSeen = false;
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(screen.getByText(/ekran kendiliğinden kapanmaz/)).toBeTruthy();
    expect(screen.getByText(/kilit ekranında/)).toBeTruthy();
    expect(screen.getByText(/“Geri al”/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('tips-next'));
    fireEvent.press(screen.getByTestId('tips-next'));
    fireEvent.press(screen.getByTestId('tips-done'));
    expect(memory.tipsSeen).toBe(true);
  });
});

describe('"Nasıl çalışır"', () => {
  it('opens from Ayarlar and from Hakkında', () => {
    renderRouter(APP_DIR, { initialUrl: '/ayarlar' });
    fireEvent.press(screen.getByTestId('settings-open-guide'));
    expect(screen.getByTestId('guide-screen')).toBeTruthy();
    fireEvent.press(screen.getByTestId('guide-close'));
    expect(screen.getByTestId('settings-screen')).toBeTruthy();
    act(() => router.push('/hakkinda'));
    fireEvent.press(screen.getByTestId('about-open-guide'));
    expect(screen.getByTestId('guide-screen')).toBeTruthy();
  });

  it('has every section, and the net rules come from the net module', () => {
    renderRouter(APP_DIR, { initialUrl: '/nasil-calisir' });
    for (const id of ['sayac', 'pomodoro', 'elle', 'net', 'analiz', 'hedef', 'seri', 'tarih', 'kilit', 'yedek']) {
      expect(screen.getByTestId(`guide-section-${id}`)).toBeTruthy();
    }
    expect(screen.getByTestId('guide-net-TYT').props.children).toBe('YKS (TYT, AYT, YDT): Net = Doğru − Yanlış ÷ 4');
    expect(screen.getByTestId('guide-net-KPSS_GYGK').props.children).toBe(
      'KPSS Genel Yetenek–Genel Kültür: Net = Doğru − Yanlış ÷ 4',
    );
    expect(screen.getByTestId('guide-net-LGS').props.children).toBe('LGS: Net = Doğru − Yanlış ÷ 3');
    expect(screen.getByText('Örnek: 30 doğru, 8 yanlış → 30 − 8 ÷ 4 = 28 net.')).toBeTruthy();
    expect(screen.getByText('Örnek: 15 doğru, 3 yanlış → 15 − 3 ÷ 3 = 14 net.')).toBeTruthy();
    // The streak rule as streak.ts applies it.
    expect(screen.getByText(/Her hafta \(Pazartesi–Pazar\) 1 gün hedefin altında kalabilirsin/)).toBeTruthy();
    expect(screen.getByText(/ikinci bir gün hedefin altında kalırsan seri biter/)).toBeTruthy();
    // Timer numbers from timer.ts / finish.ts, the away setting by its name.
    expect(screen.getByText(/10 saniyeden uzun çıkarsan/)).toBeTruthy();
    expect(screen.getByText(/8 saniye içinde “Geri al”/)).toBeTruthy();
    expect(screen.getByText(/Uygulamadan çıkınca bölümünde “Çalışmaya devam say”/)).toBeTruthy();
    // Nothing is outlined without a section.
    expect(outlined('guide-section-seri')).toBe(false);
  });

  it('a section link outlines its section', () => {
    renderRouter(APP_DIR, { initialUrl: '/nasil-calisir?bolum=seri' });
    expect(outlined('guide-section-seri')).toBe(true);
    expect(outlined('guide-section-sayac')).toBe(false);
  });

  it('an unknown section just shows the guide', () => {
    renderRouter(APP_DIR, { initialUrl: '/nasil-calisir?bolum=yok' });
    expect(screen.getByTestId('guide-screen')).toBeTruthy();
  });
});

describe('"Nedir?" next to a term', () => {
  it('"tahmini" on the countdown opens the exam date section; a date of your own has neither', () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(screen.getByTestId('countdown-info'));
    expect(screen.getByTestId('guide-screen')).toBeTruthy();
    expect(outlined('guide-section-tarih')).toBe(true);
  });

  it('no link without the "tahmini" tag', () => {
    memory.examDates = { YKS: '2027-06-20' };
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(screen.getByTestId('countdown')).toBeTruthy();
    expect(screen.queryByTestId('countdown-info')).toBeNull();
  });

  it('the streak on the home card opens the streak and rest day rule', () => {
    memory.dailyGoal = 60;
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(screen.getByTestId('streak')).toBeTruthy();
    fireEvent.press(screen.getByTestId('streak-info'));
    expect(outlined('guide-section-seri')).toBe(true);
  });

  it('"elle" in history: one link, on the newest day with manual time', () => {
    memory.sessions = studiedOnPastDays(2, 'manual');
    renderRouter(APP_DIR, { initialUrl: '/gecmis' });
    expect(screen.getAllByText('Elle eklenen: 30 dk')).toHaveLength(2);
    expect(screen.getAllByTestId('history-manual-info')).toHaveLength(1);
    fireEvent.press(screen.getByTestId('history-manual-info'));
    expect(outlined('guide-section-elle')).toBe(true);
  });

  it('the net formula on the exam form opens the net section', () => {
    renderRouter(APP_DIR, { initialUrl: '/deneme/yeni' });
    expect(screen.getByTestId('exam-net-rule').props.children).toBe('Net = Doğru − Yanlış ÷ 4');
    fireEvent.press(screen.getByTestId('exam-net-info'));
    expect(outlined('guide-section-net')).toBe(true);
  });

  it('is announced as a link that names the term', () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    const link = screen.getByTestId('countdown-info');
    expect(link.props.accessibilityRole).toBe('link');
    expect(link.props.accessibilityLabel).toBe('“Tahmini” tarih nedir?');
  });
});

describe('last backup and the quiet reminder', () => {
  it('Yedek and Ayarlar say when the last backup was made; a new one updates both', async () => {
    renderRouter(APP_DIR, { initialUrl: '/ayarlar' });
    expect(screen.getByTestId('settings-last-backup').props.children).toBe('Hiç yedek alınmadı');
    fireEvent.press(screen.getByTestId('settings-open-backup'));
    expect(screen.getByTestId('backup-last').props.children).toBe('Hiç yedek alınmadı');
    await act(async () => {
      fireEvent.press(screen.getByTestId('backup-export'));
    });
    expect(memory.shared).toHaveLength(1);
    expect(memory.lastBackupAt).not.toBeNull();
    expect(screen.getByTestId('backup-last').props.children).toBe('Son yedek: bugün');
    act(() => router.back());
    expect(screen.getByTestId('settings-last-backup').props.children).toBe('Son yedek: bugün');
  });

  it('an older backup shows its age and date', () => {
    memory.lastBackupAt = Date.now() - 3 * DAY_MS;
    renderRouter(APP_DIR, { initialUrl: '/yedek' });
    expect(screen.getByTestId('backup-last').props.children).toMatch(/^Son yedek: 3 gün önce \(\d{1,2} \S+ \d{4}\)$/);
  });

  it('a CSV export is not a backup', async () => {
    memory.sessions = studiedOnPastDays(1);
    renderRouter(APP_DIR, { initialUrl: '/yedek' });
    await act(async () => {
      fireEvent.press(screen.getByTestId('csv-sessions'));
    });
    expect(memory.shared).toHaveLength(1);
    expect(memory.lastBackupAt).toBeNull();
  });

  it('7 study days and no backup: a card on the timer tab, never a notification', () => {
    memory.sessions = studiedOnPastDays(7);
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(screen.getByTestId('backup-nudge')).toBeTruthy();
    expect(screen.getByText('Henüz yedek almadın')).toBeTruthy();
    fireEvent.press(screen.getByTestId('backup-nudge-open'));
    expect(screen.getByTestId('backup-screen')).toBeTruthy();
  });

  it('6 study days: nothing yet', () => {
    memory.sessions = studiedOnPastDays(6);
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(screen.queryByTestId('backup-nudge')).toBeNull();
  });

  it('"Şimdi değil" hides it and remembers when', () => {
    memory.sessions = studiedOnPastDays(8);
    renderRouter(APP_DIR, { initialUrl: '/' });
    const before = Date.now();
    fireEvent.press(screen.getByTestId('backup-nudge-dismiss'));
    expect(screen.queryByTestId('backup-nudge')).toBeNull();
    expect(memory.backupNudgeDismissedAt).toBeGreaterThanOrEqual(before);
  });

  it('a dismissal or a backup within 30 days keeps it away; an older backup brings it back', () => {
    memory.sessions = studiedOnPastDays(10);
    memory.backupNudgeDismissedAt = Date.now() - 10 * DAY_MS;
    const first = renderRouter(APP_DIR, { initialUrl: '/' });
    expect(screen.queryByTestId('backup-nudge')).toBeNull();
    first.unmount();

    memory.backupNudgeDismissedAt = null;
    memory.lastBackupAt = Date.now() - 10 * DAY_MS;
    const second = renderRouter(APP_DIR, { initialUrl: '/' });
    expect(screen.queryByTestId('backup-nudge')).toBeNull();
    second.unmount();

    memory.lastBackupAt = Date.now() - 31 * DAY_MS;
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(screen.getByText('Son yedeğin 31 gün önce')).toBeTruthy();
  });

  it('not while the timer runs, and gone after a backup', async () => {
    memory.sessions = studiedOnPastDays(7);
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(screen.getByTestId('timer-start'));
    expect(screen.queryByTestId('backup-nudge')).toBeNull();
    fireEvent.press(screen.getByTestId('timer-finish'));
    expect(screen.getByTestId('backup-nudge')).toBeTruthy();
    fireEvent.press(screen.getByTestId('backup-nudge-open'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('backup-export'));
    });
    act(() => router.back());
    expect(screen.queryByTestId('backup-nudge')).toBeNull();
  });
});

describe('contact', () => {
  it('while the address is still [DOLDURULACAK] the row is shown but disabled ("Yakında")', () => {
    renderRouter(APP_DIR, { initialUrl: '/hakkinda' });
    expect(screen.getByTestId('about-contact')).toBeTruthy();
    expect(screen.getByText('E-posta · Yakında')).toBeTruthy();
    expect(disabled('about-contact')).toBeTruthy();
  });
});
