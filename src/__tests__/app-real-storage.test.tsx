/// <reference types="node" />
/**
 * The real screens on the real storage layer: `db.ts`, `kv.ts`, `sessions.ts`, `mock-exams.ts`,
 * `backup.ts` and `wipe.ts` run unchanged. Only the native modules underneath are replaced:
 * expo-sqlite by Node's built-in SQLite behind the same method names, expo-sqlite/kv-store by an
 * in-memory map per database name. System surfaces (Live Activity, widget, notifications), the
 * file picker and the screen lock are stand-ins that record what the app asked for.
 *
 * app-smoke.test.tsx covers the screens with in-memory fakes for storage; this file checks the
 * paths where the storage itself matters (what really ends up in the database and kv-store).
 * Clock: 2026-10-07 09:00 Istanbul (06:00 UTC), fake timers.
 */

import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';
import { AppState, type AppStateStatus } from 'react-native';

import { UNDO_FINISH_MS } from '../domain/finish';
import type { Profile } from '../domain/profile';
import type { CompletedSession } from '../domain/timer';
import { getDb } from '../storage/db';
import * as kv from '../storage/kv';
import { getExamMarks, getMockExam, listMockExams, saveExamAnalysis, saveMockExam } from '../storage/mock-exams';
import { allSessions, saveSession } from '../storage/sessions';
import type { TimerActivityProps, TodayWidgetProps } from '../system/surface-props';

jest.mock('expo-sqlite', () => {
  const { DatabaseSync } = require('node:sqlite');
  const files = new Map();
  const opened: { name: string; options: unknown; exec: string[]; closed: boolean }[] = [];
  const args = (p: unknown[]) => p.map((v) => (v === undefined ? null : v));
  return {
    mockOpened: opened,
    openDatabaseSync: (name: string, options?: unknown) => {
      if (!files.has(name)) files.set(name, new DatabaseSync(':memory:'));
      const db = files.get(name);
      const record = { name, options, exec: [] as string[], closed: false };
      opened.push(record);
      return {
        getAllSync: (sql: string, ...p: unknown[]) => db.prepare(sql).all(...args(p)),
        getFirstSync: (sql: string, ...p: unknown[]) => db.prepare(sql).get(...args(p)) ?? null,
        runSync: (sql: string, ...p: unknown[]) => db.prepare(sql).run(...args(p)),
        execSync: (sql: string) => {
          record.exec.push(sql);
          db.exec(sql);
        },
        withTransactionSync: (fn: () => void) => {
          db.exec('BEGIN');
          try {
            fn();
            db.exec('COMMIT');
          } catch (error) {
            db.exec('ROLLBACK');
            throw error;
          }
        },
        prepareSync: (sql: string) => {
          const statement = db.prepare(sql);
          return { executeSync: (...p: unknown[]) => statement.run(...args(p)), finalizeSync: () => {} };
        },
        closeSync: () => {
          record.closed = true;
        },
      };
    },
  };
});

jest.mock('expo-sqlite/kv-store', () => {
  const files = new Map<string, Map<string, string>>();
  class SQLiteStorage {
    private readonly rows: Map<string, string>;
    constructor(name = 'ExpoSQLiteStorage') {
      if (!files.has(name)) files.set(name, new Map());
      this.rows = files.get(name)!;
    }
    getItemSync(key: string) {
      return this.rows.get(key) ?? null;
    }
    setItemSync(key: string, value: string) {
      this.rows.set(key, value);
    }
    removeItemSync(key: string) {
      this.rows.delete(key);
    }
    clearSync() {
      this.rows.clear();
    }
  }
  return { __esModule: true, default: new SQLiteStorage(), SQLiteStorage, mockKvFiles: files };
});

/** What the app asked of the system surfaces and the device. */
const mockSurfaces: {
  liveActivities: TimerActivityProps[];
  liveStarts: number;
  liveUpdates: number;
  liveEndAll: number;
  widget: { at: number; props: TodayWidgetProps }[];
  widgetWrites: number;
  keepAwake: Set<string>;
  shared: { name: string; content: string }[];
  pickText: string | null;
} = {
  liveActivities: [],
  liveStarts: 0,
  liveUpdates: 0,
  liveEndAll: 0,
  widget: [],
  widgetWrites: 0,
  keepAwake: new Set(),
  shared: [],
  pickText: null,
};

jest.mock('../system/live-activity', () => ({
  liveActivity: {
    supported: true,
    count: () => mockSurfaces.liveActivities.length,
    start: (props: TimerActivityProps) => {
      mockSurfaces.liveStarts += 1;
      mockSurfaces.liveActivities = [...mockSurfaces.liveActivities, props];
      return true;
    },
    update: async (props: TimerActivityProps) => {
      mockSurfaces.liveUpdates += 1;
      mockSurfaces.liveActivities = mockSurfaces.liveActivities.map(() => props);
    },
    endAll: async () => {
      mockSurfaces.liveEndAll += 1;
      mockSurfaces.liveActivities = [];
    },
  },
}));

jest.mock('../system/home-widget', () => ({
  homeWidget: {
    supported: true,
    setTimeline: (entries: { at: number; props: TodayWidgetProps }[]) => {
      mockSurfaces.widgetWrites += 1;
      mockSurfaces.widget = entries;
    },
  },
}));

jest.mock('../system/notifications', () => ({
  notifications: {
    supported: true,
    getPermission: async () => 'denied',
    requestPermission: async () => 'denied',
    sync: async () => {},
    cancelAll: async () => {},
    onOpen: () => () => {},
  },
}));

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: async (tag: string) => {
    mockSurfaces.keepAwake.add(tag);
  },
  deactivateKeepAwake: async (tag: string) => {
    mockSurfaces.keepAwake.delete(tag);
  },
}));

jest.mock('../storage/file-io', () => ({
  shareTextFile: async (name: string, content: string) => {
    mockSurfaces.shared.push({ name, content });
    return 'shared';
  },
  shareImage: async () => 'shared',
  pickTextFile: async () => (mockSurfaces.pickText === null ? { kind: 'canceled' } : { kind: 'picked', text: mockSurfaces.pickText }),
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

const { mockKvFiles } = jest.requireMock('expo-sqlite/kv-store') as { mockKvFiles: Map<string, Map<string, string>> };
const { mockOpened } = jest.requireMock('expo-sqlite') as {
  mockOpened: { name: string; options: unknown; exec: string[]; closed: boolean }[];
};
const mainKv = () => mockKvFiles.get('ExpoSQLiteStorage')!;

const APP_DIR = './app';
// The first render loads every route of the app.
jest.setTimeout(60_000);
const MIN = 60_000;
const HOUR = 3_600_000;
const T0 = Date.parse('2026-10-07T06:00:00Z'); // 09:00 Istanbul
const ADULT: Profile = { birthYear: 2000, examType: 'YKS', yksArea: 'sayisal', soloOnly: false, createdAt: 0 };

const count = (table: string) => (getDb().getFirstSync(`SELECT COUNT(*) AS n FROM ${table}`) as { n: number }).n;
const storedActive = () => kv.loadActiveSession();

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(T0);
  getDb().execSync(
    'DELETE FROM mock_exam_marks; DELETE FROM mock_exam_scores; DELETE FROM mock_exams; ' +
      'DELETE FROM sessions; DELETE FROM topic_progress; DELETE FROM sync_outbox;',
  );
  for (const rows of mockKvFiles.values()) rows.clear();
  mockOpened.length = 0;
  kv.storeProfile(ADULT);
  kv.storeTipsSeen();
  mockSurfaces.liveActivities = [];
  mockSurfaces.liveStarts = 0;
  mockSurfaces.liveUpdates = 0;
  mockSurfaces.liveEndAll = 0;
  mockSurfaces.widget = [];
  mockSurfaces.widgetWrites = 0;
  mockSurfaces.keepAwake.clear();
  mockSurfaces.shared = [];
  mockSurfaces.pickText = null;
});

const original = AppState.currentState;
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
/**
 * Sets the clock to `ms` while the 1 s render interval fires once (fake timers move the clock
 * along with the timers, so the jump lands one second early).
 */
function at(ms: number) {
  act(() => {
    jest.setSystemTime(ms - 1000);
    jest.advanceTimersByTime(1000);
  });
}
async function settle() {
  await act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });
}
const start = () => fireEvent.press(screen.getByTestId('timer-start'));
const finish = () => fireEvent.press(screen.getByTestId('timer-finish'));

describe('"Tüm verileri sil" on the real storage', () => {
  it('with the timer running: kv-store and database emptied and compacted, the Live Activity ended', async () => {
    saveSession(
      {
        id: 'old',
        subjectId: 'kimya',
        topicId: null,
        startedAt: T0 - 2 * HOUR,
        endedAt: T0 - HOUR,
        pauses: [],
        durationMs: HOUR,
        source: 'timer',
      },
      T0,
    );
    kv.storeDailyGoal(60);
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(screen.getByTestId('subject-fizik'));
    start();
    await settle();
    expect(mockSurfaces.liveActivities).toHaveLength(1);
    expect(kv.loadLiveActivityRecord()?.sessionId).toBe(storedActive()?.id);
    mockOpened.length = 0;

    act(() => router.push('/ayarlar'));
    fireEvent.press(screen.getByTestId('settings-delete-all'));
    fireEvent.press(screen.getByTestId('settings-delete-all-confirm'));
    await settle();

    expect(screen.getByTestId('onboarding-start')).toBeTruthy();
    // kv-store: every key gone (Storage.clearSync), file compacted on its own connection.
    expect([...mainKv().keys()]).toEqual([]);
    const kvConnection = mockOpened.find((o) => o.name === 'ExpoSQLiteStorage');
    expect(kvConnection).toMatchObject({ options: { useNewConnection: true }, closed: true });
    expect(kvConnection?.exec).toEqual(['PRAGMA wal_checkpoint(TRUNCATE); VACUUM;']);
    // Database: no rows, compacted.
    expect(count('sessions')).toBe(0);
    // The running session is gone with the data, and so is its Lock Screen clock.
    expect(storedActive()).toBeNull();
    expect(mockSurfaces.liveEndAll).toBeGreaterThanOrEqual(1);
    expect(mockSurfaces.liveActivities).toEqual([]);
    expect(mockSurfaces.widget).toHaveLength(1);
    expect(mockSurfaces.widget[0].props).toMatchObject({ total: '0 dk', goalLine: null, streakLine: null, countingFrom: null });
  });
});

describe('mock exams on the real database', () => {
  const TYT = [
    { sectionId: 'turkce', questions: 40, correct: 30, wrong: 4 },
    { sectionId: 'matematik', questions: 40, correct: 20, wrong: 8 },
  ];
  const saveTyt = (id: string) =>
    saveMockExam({ id, kind: 'TYT', scope: 'genel', bransSectionId: null, takenOn: '2026-10-05', createdAt: 10 }, TYT);

  it('"Sil" asks first; "Vazgeç" keeps it, "Sil" removes the exam with its scores and topic marks', () => {
    saveTyt('e1');
    saveTyt('e2');
    saveExamAnalysis('e1', [{ sectionId: 'turkce', topicId: 'tyt.turkce.paragraf', wrong: 3, blank: 1 }], 50);
    renderRouter(APP_DIR, { initialUrl: '/denemeler' });
    act(() => router.push('/deneme/e1'));
    expect(screen.getByTestId('exam-detail-total').props.children).toBe('47');

    fireEvent.press(screen.getByRole('button', { name: 'Sil' }));
    expect(screen.getByText('Bu deneme silinsin mi?')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Vazgeç' }));
    expect(screen.queryByText('Bu deneme silinsin mi?')).toBeNull();
    expect(getMockExam('e1')).not.toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'Sil' }));
    fireEvent.press(screen.getByRole('button', { name: 'Sil' }));
    expect(getMockExam('e1')).toBeNull();
    expect(getExamMarks('e1')).toEqual([]);
    expect(listMockExams().map((e) => e.id)).toEqual(['e2']);
    expect(count('mock_exam_scores')).toBe(2);
    // Back on the list, which no longer shows it.
    expect(screen.getByTestId('exam-item-0')).toBeTruthy();
    expect(screen.queryByTestId('exam-item-1')).toBeNull();
  });

  it('editing writes the new counts and date into the same row', () => {
    saveTyt('e1');
    renderRouter(APP_DIR, { initialUrl: '/deneme/e1' });
    fireEvent.press(screen.getByTestId('exam-edit'));
    fireEvent.changeText(screen.getByTestId('exam-wrong-turkce'), '0');
    fireEvent.press(screen.getByTestId('exam-prev-day'));
    fireEvent.press(screen.getByTestId('exam-save'));
    expect(listMockExams()).toHaveLength(1);
    expect(getMockExam('e1')).toMatchObject({ takenOn: '2026-10-04', totalNet: 30 + 18, createdAt: 10 });
    expect(getMockExam('e1')?.scores[0]).toEqual({ sectionId: 'turkce', questions: 40, correct: 30, wrong: 0 });
  });

  it('branch exam (branş): one section, its net, saved as a branch exam of that section', () => {
    renderRouter(APP_DIR, { initialUrl: '/denemeler' });
    fireEvent.press(screen.getByTestId('exams-add'));
    fireEvent.press(screen.getByTestId('exam-scope-brans'));
    fireEvent.press(screen.getByTestId('exam-brans-matematik'));
    // Only the chosen section is on the form.
    expect(screen.queryByTestId('exam-correct-turkce')).toBeNull();
    fireEvent.changeText(screen.getByTestId('exam-correct-matematik'), '30');
    fireEvent.changeText(screen.getByTestId('exam-wrong-matematik'), '9');
    expect(screen.getByTestId('exam-net-matematik').props.children).toBe('27,75');
    expect(screen.getByTestId('exam-total-net').props.children).toBe('27,75');
    // More answers than questions: no net, no save.
    fireEvent.changeText(screen.getByTestId('exam-wrong-matematik'), '11');
    expect(screen.getByTestId('exam-net-matematik').props.children).toBe('–');
    fireEvent.press(screen.getByTestId('exam-save'));
    expect(listMockExams()).toEqual([]);
    fireEvent.changeText(screen.getByTestId('exam-wrong-matematik'), '9');
    fireEvent.press(screen.getByTestId('exam-save'));

    const [saved] = listMockExams();
    expect(saved).toMatchObject({ kind: 'TYT', scope: 'brans', bransSectionId: 'matematik', totalNet: 27.75 });
    expect(getMockExam(saved.id)?.scores).toEqual([{ sectionId: 'matematik', questions: 40, correct: 30, wrong: 9 }]);
  });

  it('a branch exam shows its section on the detail screen', () => {
    saveMockExam(
      { id: 'b1', kind: 'TYT', scope: 'brans', bransSectionId: 'matematik', takenOn: '2026-10-05', createdAt: 1 },
      [{ sectionId: 'matematik', questions: 40, correct: 30, wrong: 9 }],
    );
    renderRouter(APP_DIR, { initialUrl: '/deneme/b1' });
    expect(screen.getByText(/Branş: Matematik/)).toBeTruthy();
    expect(screen.getByTestId('exam-detail-total').props.children).toBe('27,75');
  });

  it('an exam that does not exist shows "Deneme bulunamadı."', () => {
    renderRouter(APP_DIR, { initialUrl: '/deneme/gone' });
    expect(screen.getByText('Deneme bulunamadı.')).toBeTruthy();
  });
});

describe('exam countdown from the stored date', () => {
  it('on the exam day: "Sınav günü bugün"', () => {
    kv.storeCustomExamDate('YKS', '2026-10-07');
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(screen.getByTestId('countdown').props.children).toBe('Sınav günü bugün. Başarılar!');
    expect(screen.queryByTestId('countdown-passed')).toBeNull();
  });

  it('the day before: one day left; the day after: the date has passed', () => {
    kv.storeCustomExamDate('YKS', '2026-10-08');
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(screen.getByTestId('countdown').props.children).toBe('YKS’ye 1 gün');
    // After midnight Istanbul (21:00 UTC) the exam is today, a day later it has passed.
    at(Date.parse('2026-10-07T21:00:30Z'));
    act(() => jest.advanceTimersByTime(60_000));
    expect(screen.getByTestId('countdown').props.children).toBe('Sınav günü bugün. Başarılar!');
    at(Date.parse('2026-10-08T21:00:30Z'));
    act(() => jest.advanceTimersByTime(60_000));
    expect(screen.queryByTestId('countdown')).toBeNull();
    expect(screen.getByTestId('countdown-passed').props.children).toBe('Sınav tarihi geçti. Yeni tarihi Ayarlar’dan gir.');
  });
});

describe('backup screen on the real storage', () => {
  const session = (id: string): CompletedSession => ({
    id,
    subjectId: 'kimya',
    topicId: null,
    startedAt: Date.parse('2026-10-01T07:00:00Z'),
    endedAt: Date.parse('2026-10-01T08:00:00Z'),
    pauses: [],
    durationMs: HOUR,
    source: 'timer',
  });
  const backup = (extra: Record<string, unknown> = {}) =>
    JSON.stringify({
      format: 'etut-yedek',
      schemaVersion: 1,
      exportedAt: Date.parse('2026-10-02T00:00:00Z'),
      profile: { birthYear: 2000, examType: 'YKS', yksArea: 'sozel' },
      sessions: [session('x')],
      exams: [],
      topicProgress: [],
      ...extra,
    });

  it('a file from a newer app version is refused with "update first", nothing changes', async () => {
    saveSession(session('a'), T0);
    mockSurfaces.pickText = backup({ schemaVersion: 99 });
    renderRouter(APP_DIR, { initialUrl: '/yedek' });
    await act(async () => {
      fireEvent.press(screen.getByTestId('backup-import'));
    });
    expect(screen.getByTestId('backup-error').props.children).toBe(
      'Bu yedek uygulamanın daha yeni bir sürümüyle alınmış. Önce uygulamayı güncelle.',
    );
    expect(screen.queryByTestId('backup-preview')).toBeNull();
    expect(allSessions().map((s) => s.id)).toEqual(['a']);
  });

  it('"Değiştir" then "Geri al": the database and the profile are back as before; the copy is gone', async () => {
    saveSession(session('a'), T0);
    mockSurfaces.pickText = backup();
    renderRouter(APP_DIR, { initialUrl: '/yedek' });
    await act(async () => {
      fireEvent.press(screen.getByTestId('backup-import'));
    });
    fireEvent.press(screen.getByTestId('backup-mode-replace'));
    fireEvent.press(screen.getByTestId('backup-confirm'));
    fireEvent.press(screen.getByTestId('backup-replace-yes'));
    expect(allSessions().map((s) => s.id)).toEqual(['x']);
    expect(kv.loadProfile()?.yksArea).toBe('sozel');
    expect(kv.loadReplaceUndo()).not.toBeNull();

    fireEvent.press(screen.getByTestId('backup-undo'));
    fireEvent.press(screen.getByTestId('backup-undo-yes'));
    expect(allSessions().map((s) => s.id)).toEqual(['a']);
    expect(kv.loadProfile()?.yksArea).toBe('sayisal');
    expect(kv.loadReplaceUndo()).toBeNull();
    expect(screen.getByTestId('backup-message').props.children).toBe(
      'Geri alındı. Şu an 1 çalışma kaydı, 0 deneme ve 0 konu işareti var.',
    );
  });
});

describe('timer on the real storage', () => {
  it('heartbeat: every 5 s while running the stored session records the time; not while paused', () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    start();
    // (Fake timers move the clock with the timers.)
    expect(storedActive()?.lastSeenAt).toBe(T0);
    act(() => jest.advanceTimersByTime(4_999));
    expect(storedActive()?.lastSeenAt).toBe(T0);
    act(() => jest.advanceTimersByTime(1));
    expect(storedActive()?.lastSeenAt).toBe(T0 + 5_000);
    act(() => jest.advanceTimersByTime(5_000));
    expect(storedActive()?.lastSeenAt).toBe(T0 + 10_000);

    fireEvent.press(screen.getByTestId('timer-pause'));
    act(() => jest.advanceTimersByTime(50_000));
    expect(storedActive()?.lastSeenAt).toBe(T0 + 10_000);
    fireEvent.press(screen.getByTestId('timer-resume'));
    // Resuming records the moment, then the heartbeat goes on.
    expect(storedActive()?.lastSeenAt).toBe(T0 + 60_000);
    act(() => jest.advanceTimersByTime(5_000));
    expect(storedActive()?.lastSeenAt).toBe(T0 + 65_000);
  });

  it('app killed in the foreground: on the next start the time after the last heartbeat is away', () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    start();
    act(() => jest.advanceTimersByTime(5 * MIN));
    expect(storedActive()?.lastSeenAt).toBe(T0 + 5 * MIN);
    screen.unmount();

    // Cold start 30 minutes later: no background event was recorded.
    jest.setSystemTime(T0 + 35 * MIN);
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(screen.getByTestId('away-title').props.children).toBe('30 dk uygulamanın dışındaydın.');
    fireEvent.press(screen.getByTestId('away-credit'));
    finish();
    expect(allSessions()[0].durationMs).toBe(35 * MIN);
  });

  it('"Çalışıyordum" after the clock was set back before the start keeps the whole session', () => {
    const from = listenersFrom();
    renderRouter(APP_DIR, { initialUrl: '/' });
    start();
    // One minute of study, an hour away, back in the app: the absence is asked about.
    at(T0 + MIN);
    emitAppState('background', from);
    act(() => jest.setSystemTime(T0 + 61 * MIN));
    emitAppState('active', from);
    expect(screen.getByTestId('away-title').props.children).toBe('1 sa 0 dk uygulamanın dışındaydın.');
    // Now the network sets the clock two hours back, before the start.
    at(T0 - 2 * HOUR);
    act(() => jest.advanceTimersByTime(5_000));
    fireEvent.press(screen.getByTestId('away-credit'));
    expect(screen.queryByTestId('away-title')).toBeNull();
    finish();
    expect(allSessions()).toHaveLength(1);
    expect(allSessions()[0]).toMatchObject({ startedAt: T0, endedAt: T0 + 61 * MIN, durationMs: 61 * MIN, pauses: [] });
  });

  it('a clock set back while away does not count as an absence', () => {
    const from = listenersFrom();
    renderRouter(APP_DIR, { initialUrl: '/' });
    start();
    at(T0 + 10 * MIN);
    emitAppState('background', from);
    act(() => jest.setSystemTime(T0 + 3 * MIN));
    emitAppState('active', from);
    expect(screen.queryByTestId('away-title')).toBeNull();
    expect(screen.getByTestId('timer-status').props.children).toBe('Çalışıyorsun');
    expect(storedActive()?.pendingAway).toBeNull();
  });

  it('a session over 24 hours: asked, saved whole, split at midnight and kept in the backup', async () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    start();
    at(T0 + 25 * HOUR);
    finish();
    expect(screen.getByTestId('finish-check-title').props.children).toBe('Bu oturum 25 sa 0 dk sürmüş görünüyor.');
    expect(allSessions()).toEqual([]);
    fireEvent.press(screen.getByTestId('finish-long-all'));
    expect(allSessions()).toHaveLength(1);
    expect(allSessions()[0]).toMatchObject({ startedAt: T0, endedAt: T0 + 25 * HOUR, durationMs: 25 * HOUR });
    // Today (8 Oct, Istanbul) holds only the part after midnight: 00:00 → 10:00.
    expect(screen.getByTestId('today-total').props.children).toBe('10 sa 0 dk');

    act(() => router.push('/yedek'));
    await act(async () => {
      fireEvent.press(screen.getByTestId('backup-export'));
    });
    expect(screen.getByTestId('backup-message')).toBeTruthy();
    const file = JSON.parse(mockSurfaces.shared[0].content) as { sessions: CompletedSession[] };
    expect(file.sessions.map((s) => s.durationMs)).toEqual([25 * HOUR]);
  });

  it('… or only its first 10 hours', () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    start();
    at(T0 + 25 * HOUR);
    finish();
    fireEvent.press(screen.getByTestId('finish-long-cap'));
    expect(allSessions()[0]).toMatchObject({ startedAt: T0, endedAt: T0 + 10 * HOUR, durationMs: 10 * HOUR });
    // All of it was yesterday.
    expect(screen.getByTestId('today-total').props.children).toBe('0 dk');
  });

  it('"Geri al": inside the window the stored row goes and the session runs on; after it, it stays', () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    fireEvent.press(screen.getByTestId('subject-fizik'));
    start();
    const id = storedActive()!.id;
    at(T0 + 2 * MIN);
    finish();
    expect(allSessions().map((s) => s.id)).toEqual([id]);
    expect(storedActive()).toBeNull();
    act(() => jest.advanceTimersByTime(UNDO_FINISH_MS - 2_000));
    fireEvent.press(screen.getByTestId('finish-undo'));
    expect(allSessions()).toEqual([]);
    expect(storedActive()).toMatchObject({ id, subjectId: 'fizik' });
    expect(mockSurfaces.keepAwake.size).toBe(1);

    at(Date.now() + MIN);
    finish();
    act(() => jest.advanceTimersByTime(UNDO_FINISH_MS + 1_000));
    expect(screen.queryByTestId('finish-undo')).toBeNull();
    expect(allSessions().map((s) => s.id)).toEqual([id]);
    expect(allSessions()[0].durationMs).toBeGreaterThanOrEqual(3 * MIN);
  });

  it('screen kept on only while running on the timer screen; the setting survives a restart', () => {
    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(mockSurfaces.keepAwake.size).toBe(0);
    start();
    expect(mockSurfaces.keepAwake.size).toBe(1);
    act(() => router.push('/ayarlar'));
    expect(mockSurfaces.keepAwake.size).toBe(0);
    fireEvent.press(screen.getByTestId('settings-keep-awake-off'));
    expect(kv.loadKeepAwake()).toBe(false);
    act(() => router.push('/'));
    expect(mockSurfaces.keepAwake.size).toBe(0);
    screen.unmount();

    renderRouter(APP_DIR, { initialUrl: '/' });
    expect(screen.getByTestId('timer-status')).toBeTruthy();
    expect(mockSurfaces.keepAwake.size).toBe(0);
    act(() => router.push('/ayarlar'));
    expect(screen.getByTestId('settings-keep-awake-off').props.accessibilityState.selected).toBe(true);
    fireEvent.press(screen.getByTestId('settings-keep-awake-on'));
    act(() => router.push('/'));
    expect(mockSurfaces.keepAwake.size).toBe(1);
    fireEvent.press(screen.getByTestId('timer-pause'));
    expect(mockSurfaces.keepAwake.size).toBe(0);
  });
});

describe('settings: "Sayaç çalışırken" after another change on the same screen', () => {
  // Passes here because Jest does not run the React Compiler; the shipped bundles do, and there
  // these chips do freeze (use-stored-compiler.test.tsx, scripts/test-web.mjs step 5b-2).
  it('saving the exam area first does not freeze the keep-awake and away-rule chips', () => {
    renderRouter(APP_DIR, { initialUrl: '/ayarlar' });
    fireEvent.press(screen.getByTestId('settings-yks-area-esit_agirlik'));
    fireEvent.press(screen.getByTestId('settings-exam-save'));
    expect(kv.loadProfile()?.yksArea).toBe('esit_agirlik');
    fireEvent.press(screen.getByTestId('settings-keep-awake-off'));
    expect(kv.loadKeepAwake()).toBe(false);
    expect(screen.getByTestId('settings-keep-awake-off').props.accessibilityState.selected).toBe(true);
    fireEvent.press(screen.getByTestId('settings-away-count'));
    expect(screen.getByTestId('settings-away-info').props.children).toContain('çalışma sayılır');
  });
});

describe('system surfaces are not rewritten with the same content', () => {
  it('coming back to the foreground with nothing changed sends no Live Activity update and no widget timeline', async () => {
    const from = listenersFrom();
    renderRouter(APP_DIR, { initialUrl: '/' });
    start();
    await settle();
    expect(mockSurfaces.liveActivities).toHaveLength(1);
    const before = { starts: mockSurfaces.liveStarts, updates: mockSurfaces.liveUpdates, widget: mockSurfaces.widgetWrites };

    // Two short trips out of the app (within the 10 s tolerance) and a few clock ticks.
    for (let i = 1; i <= 2; i++) {
      emitAppState('background', from);
      act(() => jest.setSystemTime(T0 + i * 3_000));
      emitAppState('active', from);
      await settle();
    }
    at(T0 + 20_000);
    await settle();
    expect({ starts: mockSurfaces.liveStarts, updates: mockSurfaces.liveUpdates, widget: mockSurfaces.widgetWrites }).toEqual(before);

    // A real change (pause) is sent once to each.
    fireEvent.press(screen.getByTestId('timer-pause'));
    await settle();
    expect(mockSurfaces.liveUpdates).toBe(before.updates + 1);
    expect(mockSurfaces.widgetWrites).toBe(before.widget + 1);
    expect(mockSurfaces.liveActivities[0].pausedAt).not.toBeNull();
    emitAppState('active', from);
    await settle();
    expect(mockSurfaces.liveUpdates).toBe(before.updates + 1);
    expect(mockSurfaces.widgetWrites).toBe(before.widget + 1);
  });
});
