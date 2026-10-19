/**
 * KVKK application screens (app/basvuru.tsx, app/basvurularim.tsx) and the entry card with the
 * flag ON, against the in-memory fake (src/sync/testing/requests-fake.ts); storage is replaced
 * by in-memory fakes as in groups-screens.test.tsx. With the flag OFF the screens cannot be
 * reached and nothing is called.
 */

import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { Text } from 'react-native';

import type { Profile } from '../domain/profile';
import type { ActiveSession } from '../domain/timer';
import { ApiError } from '../sync/api';
import { setRequestsApiForTests } from '../sync/requests-api';
import { createFakeRequestsServer, type FakeRequestsServer } from '../sync/testing/requests-fake';
import { RequestsEntry } from '../ui/requests-entry';

// The first renderRouter of a cold run loads and transforms every route (over 30 s on a cold
// local run, so more room than groups-screens.test.tsx).
jest.setTimeout(90_000);

const flags = { enabled: true };
jest.mock('../config/features', () => ({
  get GROUPS_ENABLED() {
    return flags.enabled;
  },
}));

const memory: {
  profile: Profile | null;
  active: ActiveSession | null;
  groupsAccount: boolean;
  parentAccount: boolean;
  member: boolean;
  parentLinked: boolean;
  usage: { day: string; ms: number } | null;
  outboxCleared: boolean;
} = {
  profile: null,
  active: null,
  groupsAccount: false,
  parentAccount: false,
  member: true,
  parentLinked: false,
  usage: null,
  outboxCleared: false,
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
  loadDailyGoal: () => null,
  loadDailyGoalHistory: () => [],
  storeDailyGoal: () => {},
  loadPomodoroConfig: () => ({ workMin: 25, shortBreakMin: 5, longBreakMin: 15, longEvery: 4 }),
  storePomodoroConfig: () => {},
  loadTimerMode: () => 'stopwatch',
  storeTimerMode: () => {},
  loadCustomExamDate: () => null,
  storeCustomExamDate: () => {},
  loadNetTargets: () => ({}),
  storeNetTarget: () => {},
  loadTipsSeen: () => true,
  storeTipsSeen: () => {},
  loadReminderPrefs: () => jest.requireActual('../domain/reminders').normalizeReminderPrefs(null),
  storeReminderPrefs: () => {},
  loadRemindersConfirmed: () => false,
  storeRemindersConfirmed: () => {},
  loadLiveActivityRecord: () => null,
  storeLiveActivityRecord: () => {},
  loadKeepAwake: () => false,
  storeKeepAwake: () => {},
  loadAwayRule: () => 'ask',
  storeAwayRule: () => {},
  loadReplaceUndo: () => null,
  storeReplaceUndo: () => {},
  loadLastBackupAt: () => null,
  storeLastBackupAt: () => {},
  loadBackupNudgeDismissedAt: () => null,
  storeBackupNudgeDismissedAt: () => {},
  wipeKeyValueStore: () => {
    memory.profile = null;
    memory.active = null;
    memory.groupsAccount = false;
    memory.parentAccount = false;
  },
}));
// System surfaces (Live Activity, widget, reminders) are covered in app-smoke.test.tsx; here they
// are off so the native modules are never loaded. The permission check never answers (no act()
// warnings), as in the older app-smoke tests.
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
jest.mock('../storage/groups-kv', () => ({
  loadGroupsAccount: () => memory.groupsAccount,
  storeGroupsAccount: (on: boolean) => {
    memory.groupsAccount = on;
  },
  loadParentAccount: () => memory.parentAccount,
  storeParentAccount: (on: boolean) => {
    memory.parentAccount = on;
  },
  loadGroupsMember: () => memory.member,
  storeGroupsMember: (on: boolean) => {
    memory.member = on;
  },
  loadParentLinked: () => memory.parentLinked,
  storeParentLinked: (on: boolean) => {
    memory.parentLinked = on;
  },
  loadGroupsUsage: (day: string) => (memory.usage?.day === day ? memory.usage.ms : 0),
  storeGroupsUsage: (day: string, ms: number) => {
    memory.usage = { day, ms };
  },
}));
jest.mock('../storage/outbox', () => ({
  enqueueSession: () => {},
  dueItems: () => [],
  removeItem: () => null,
  scheduleRetry: () => {},
  nextAttemptAt: () => null,
  clearOutbox: () => {
    memory.outboxCleared = true;
  },
}));
jest.mock('../storage/age-guard', () => ({
  loadYoungestDeclaredBirthYear: () => null,
  storeYoungestDeclaredBirthYear: () => {},
}));
jest.mock('../storage/sessions', () => ({
  saveSession: () => {},
  sessionsOverlapping: () => [],
  recentManualSessions: () => [],
  deleteManualSession: () => {},
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
jest.mock('../storage/file-io', () => ({
  shareTextFile: jest.fn(async () => 'shared'),
  shareImage: jest.fn(async () => 'shared'),
  pickTextFile: jest.fn(async () => ({ kind: 'canceled' })),
}));
const fileIo = jest.requireMock('../storage/file-io') as { shareTextFile: jest.Mock };

const APP_DIR = './app';
let server: FakeRequestsServer;

function profile(birthYear: number): Profile {
  return { birthYear, examType: 'YKS', yksArea: 'sayisal', soloOnly: false, createdAt: 0 };
}

const adultYear = new Date().getUTCFullYear() - 30;

beforeEach(() => {
  flags.enabled = true;
  memory.profile = profile(adultYear);
  memory.active = null;
  memory.groupsAccount = true;
  memory.parentAccount = false;
  server = createFakeRequestsServer();
  setRequestsApiForTests(server.api);
  fileIo.shareTextFile.mockClear();
});

afterEach(() => setRequestsApiForTests(null));

/** Lets the fake server's promises settle (renderRouter uses fake timers; promises are real). */
async function flush() {
  for (let i = 0; i < 10; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function openForm() {
  renderRouter(APP_DIR, { initialUrl: '/basvuru' });
  await waitFor(() => expect(screen.getByTestId('request-form-screen')).toBeTruthy());
}

describe('KVKK application form (flag ON)', () => {
  it('a complaint needs a text before anything is sent, then gets a number and a deadline', async () => {
    await openForm();
    expect(screen.getByTestId('request-submit').props.accessibilityState).toMatchObject({ disabled: true });
    fireEvent.press(screen.getByTestId('request-kind-complaint'));
    expect(screen.getByText('Açıklama (bu talep türünde gerekli)')).toBeTruthy();
    fireEvent.press(screen.getByTestId('request-submit'));
    await flush();
    expect(screen.getByText('Bu talep türünde birkaç cümleyle ne olduğunu yazman gerekiyor.')).toBeTruthy();
    expect(server.calls).toEqual([]);

    fireEvent.changeText(screen.getByTestId('request-body'), '  Bir grup adında küfür var.  ');
    expect(screen.getByTestId('request-body-count').props.children).toBe('26/2000');
    fireEvent.press(screen.getByTestId('request-submit'));
    await flush();
    expect(server.calls).toEqual(['submitRequest']);
    expect(server.requests[0]).toMatchObject({ kind: 'complaint', applicant: 'self', body: 'Bir grup adında küfür var.' });
    const r = server.requests[0];
    expect(Date.parse(r.dueAt) - Date.parse(r.createdAt)).toBe(30 * 86_400_000);
    expect(screen.getByTestId('request-received').props.children).toMatch(
      /^Başvurun alındı\. Başvuru numaran: ABCD-EFGJ · Tarih: \d+ \S+ \d{4}\. En geç \d+ \S+ \d{4} tarihine kadar cevap vereceğiz\.$/,
    );
    fireEvent.press(screen.getByTestId('request-open-list'));
    await flush();
    expect(screen.getByTestId('my-requests-screen')).toBeTruthy();
    expect(screen.getByText('Şikâyet / bildirim')).toBeTruthy();
  });

  it('a right of KVKK m.11 needs no text; a parent can apply for the child', async () => {
    await openForm();
    fireEvent.press(screen.getByTestId('request-kind-deletion'));
    fireEvent.press(screen.getByTestId('request-applicant-parent'));
    expect(screen.getByText(/Çocuğun adına başvuruyorsan/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('request-submit'));
    await flush();
    expect(server.requests[0]).toMatchObject({ kind: 'deletion', applicant: 'parent', body: null });
    expect(screen.getByTestId('request-received')).toBeTruthy();
  });

  it('more than 2000 characters are refused on the device', async () => {
    await openForm();
    fireEvent.press(screen.getByTestId('request-kind-other'));
    fireEvent.changeText(screen.getByTestId('request-body'), 'a'.repeat(2001));
    fireEvent.press(screen.getByTestId('request-submit'));
    await flush();
    expect(screen.getByText('Açıklama en fazla 2.000 karakter olabilir.')).toBeTruthy();
    expect(server.calls).toEqual([]);
  });

  it('says so when the daily limit is reached', async () => {
    await openForm();
    server.failNext = new ApiError('rate_limited');
    fireEvent.press(screen.getByTestId('request-kind-info'));
    fireEvent.press(screen.getByTestId('request-submit'));
    await flush();
    expect(screen.getByTestId('request-error').props.children).toMatch(/en fazla 5 başvuru/);
  });

  it('without a server account nothing is sent and e-mail is the way', async () => {
    memory.groupsAccount = false;
    await openForm();
    expect(screen.getByTestId('request-no-account')).toBeTruthy();
    expect(screen.queryByTestId('request-submit')).toBeNull();
    expect(server.calls).toEqual([]);
  });

  it('an account that is gone on the server turns into the no-account note', async () => {
    await openForm();
    server.failNext = new ApiError('not_authenticated');
    fireEvent.press(screen.getByTestId('request-kind-info'));
    fireEvent.press(screen.getByTestId('request-submit'));
    await flush();
    expect(screen.getByTestId('request-no-account')).toBeTruthy();
  });

  it('a parent account (no group profile) can apply', async () => {
    memory.groupsAccount = false;
    memory.parentAccount = true;
    await openForm();
    expect(screen.getByTestId('request-submit')).toBeTruthy();
  });
});

describe('Başvurularım (flag ON)', () => {
  async function openList() {
    renderRouter(APP_DIR, { initialUrl: '/basvurularim' });
    await waitFor(() => expect(screen.getByTestId('my-requests-screen')).toBeTruthy());
    await flush();
  }

  it('shows the waiting request with its deadline', async () => {
    await server.api.submitRequest({ kind: 'info', applicant: 'self', body: '' });
    server.calls.length = 0;
    await openList();
    expect(server.calls).toEqual(['myRequests']);
    expect(screen.getByTestId('my-request-state-0').props.children).toMatch(/^Cevap bekleniyor · son gün /);
    expect(screen.queryByTestId('my-request-read-0')).toBeNull();
  });

  it('opening the answer the first time is kept as the proof; the answer is shown as written', async () => {
    await server.api.submitRequest({ kind: 'info', applicant: 'self', body: '' });
    server.answer('ABCDEFGJ', 'partial', 'Verilerinin dökümü ektedir. Silme talebin 30 gün içinde yerine getirilecek.');
    server.calls.length = 0;
    await openList();
    expect(screen.getByText('Yeni cevap')).toBeTruthy();
    expect(screen.getByTestId('my-request-state-0').props.children).toMatch(/^Cevaplandı · /);
    fireEvent.press(screen.getByTestId('my-request-read-0'));
    await flush();
    expect(server.calls).toEqual(['myRequests', 'markRequestSeen']);
    expect(server.requests[0].seenAt).not.toBeNull();
    expect(screen.getByTestId('my-request-answer-0').props.children).toBe(
      'Verilerinin dökümü ektedir. Silme talebin 30 gün içinde yerine getirilecek.',
    );
    expect(screen.getByText('Sonuç: Kısmen kabul edildi')).toBeTruthy();
    expect(screen.getByText(/Kişisel Verileri Koruma Kurulu’na şikâyette/)).toBeTruthy();
    expect(screen.getByTestId('my-request-seen-0').props.children).toMatch(/^Cevabı ilk açtığın zaman: .+ \d{2}:\d{2}$/);
    expect(screen.queryByText('Yeni cevap')).toBeNull();

    // Closing and opening again does not touch the first time.
    const first = server.requests[0].seenAt;
    fireEvent.press(screen.getByTestId('my-request-read-0'));
    fireEvent.press(screen.getByTestId('my-request-read-0'));
    await flush();
    expect(server.calls.filter((c) => c === 'markRequestSeen')).toHaveLength(1);
    expect(server.requests[0].seenAt).toBe(first);
  });

  it('an empty list says so', async () => {
    await openList();
    expect(screen.getByTestId('my-requests-empty')).toBeTruthy();
  });

  it('"Verilerimi indir" shares the server data as a JSON file', async () => {
    server.exportData = { format: 'etut-sunucu-verileri', version: 1, profile: { nickname: 'Gece Kuşu' } };
    await openList();
    fireEvent.press(screen.getByTestId('my-data-export'));
    await flush();
    expect(server.calls).toContain('exportMyData');
    expect(fileIo.shareTextFile).toHaveBeenCalledTimes(1);
    const [name, content, options] = fileIo.shareTextFile.mock.calls[0];
    expect(name).toMatch(/^etut-sunucu-verilerim-\d{4}-\d{2}-\d{2}\.json$/);
    expect(JSON.parse(content)).toEqual(server.exportData);
    expect(options).toMatchObject({ mimeType: 'application/json', uti: 'public.json' });
    expect(screen.getByTestId('my-data-export-note').props.children).toBe('Dosya hazır.');
  });

  it('without a server account there is nothing to list or export', async () => {
    memory.groupsAccount = false;
    await openList();
    expect(screen.getByTestId('my-requests-no-account')).toBeTruthy();
    expect(screen.queryByTestId('my-data-export')).toBeNull();
    expect(server.calls).toEqual([]);
  });
});

describe('entry card', () => {
  it('opens the form and the list', async () => {
    const routes = {
      index: () => <RequestsEntry />,
      basvuru: () => <Text>form</Text>,
      basvurularim: () => <Text>liste</Text>,
    };
    const first = renderRouter(routes, { initialUrl: '/' });
    fireEvent.press(screen.getByTestId('requests-entry-apply'));
    await flush();
    expect(first.getPathname()).toBe('/basvuru');
    first.unmount();
    const second = renderRouter(routes, { initialUrl: '/' });
    fireEvent.press(screen.getByTestId('requests-entry-list'));
    await flush();
    expect(second.getPathname()).toBe('/basvurularim');
  });

  it('renders nothing with the flag off', () => {
    flags.enabled = false;
    renderRouter({ index: () => <RequestsEntry /> }, { initialUrl: '/' });
    expect(screen.queryByTestId('requests-entry')).toBeNull();
  });
});

describe('flag OFF', () => {
  it.each(['/basvuru', '/basvurularim'])('%s cannot be reached and calls nothing', async (url) => {
    flags.enabled = false;
    const fetchSpy = jest.fn();
    const originalFetch = global.fetch;
    global.fetch = fetchSpy as unknown as typeof fetch;
    try {
      renderRouter(APP_DIR, { initialUrl: url });
      await flush();
      expect(screen.queryByTestId('request-form-screen')).toBeNull();
      expect(screen.queryByTestId('my-requests-screen')).toBeNull();
      expect(screen.getByTestId('timer-screen')).toBeTruthy();
      expect(server.calls).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('an under-15 profile cannot reach them with the flag on either (K-16)', async () => {
    memory.profile = { ...profile(new Date().getUTCFullYear() - 12), examType: 'LGS', yksArea: null, soloOnly: true };
    renderRouter(APP_DIR, { initialUrl: '/basvuru' });
    await flush();
    expect(screen.queryByTestId('request-form-screen')).toBeNull();
    expect(server.calls).toEqual([]);
  });
});
