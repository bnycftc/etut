/**
 * Group screens with the flag ON, against the in-memory fake server (src/sync/testing). Storage
 * is replaced by in-memory fakes like in app-smoke.test.tsx. A second block checks that with the
 * flag OFF the tab stays "Yakında" and nothing reaches the network.
 */

import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import type { Profile } from '../domain/profile';
import type { ActiveSession } from '../domain/timer';
import { setGroupApiForTests } from '../sync/api';
import { createFakeServer, type FakeServer, ME_ID } from '../sync/testing/fake-api';

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
  usage: { day: string; ms: number } | null;
} = { profile: null, active: null, groupsAccount: false, parentAccount: false, usage: null };

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
  storeDailyGoal: () => {},
  loadPomodoroConfig: () => ({ workMin: 25, shortBreakMin: 5, longBreakMin: 15, longEvery: 4 }),
  storePomodoroConfig: () => {},
  loadTimerMode: () => 'stopwatch',
  storeTimerMode: () => {},
  loadCustomExamDate: () => null,
  storeCustomExamDate: () => {},
  loadNetTargets: () => ({}),
  storeNetTarget: () => {},
  wipeKeyValueStore: () => {
    memory.profile = null;
    memory.active = null;
    memory.groupsAccount = false;
    memory.parentAccount = false;
  },
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
  loadGroupsUsage: (day: string) => (memory.usage?.day === day ? memory.usage.ms : 0),
  storeGroupsUsage: (day: string, ms: number) => {
    memory.usage = { day, ms };
  },
}));
jest.mock('../storage/outbox', () => ({
  enqueueSession: () => {},
  dueItems: () => [],
  removeItem: () => {},
  scheduleRetry: () => {},
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

const APP_DIR = './app';
let server: FakeServer;

function profile(birthYear: number): Profile {
  return { birthYear, examType: 'YKS', yksArea: 'sayisal', soloOnly: false, createdAt: 0 };
}

const adultYear = new Date().getUTCFullYear() - 30;
const teenYear = new Date().getUTCFullYear() - 17; // minimum age 16 → 15–17

beforeEach(() => {
  flags.enabled = true;
  memory.profile = profile(adultYear);
  memory.active = null;
  memory.groupsAccount = false;
  memory.parentAccount = false;
  memory.usage = null;
  server = createFakeServer();
  setGroupApiForTests(server.api);
});

afterEach(() => setGroupApiForTests(null));

/** Lets the fake server's promises settle (renderRouter uses fake timers; promises are real). */
async function flush() {
  for (let i = 0; i < 10; i++) {
    await act(async () => {
      await Promise.resolve();
    });
  }
}

async function signUp(nickname = 'Gece Kuşu') {
  renderRouter(APP_DIR, { initialUrl: '/gruplar' });
  await flush();
  fireEvent.changeText(screen.getByTestId('groups-nickname'), nickname);
  fireEvent.press(screen.getByTestId('groups-enable'));
  await flush();
}

describe('group module ON', () => {
  it('opening groups signs in anonymously and sends only the age band', async () => {
    await signUp();
    expect(server.calls.slice(0, 2)).toEqual(['ensureSignedIn', 'saveProfile']);
    expect(server.me).toMatchObject({ nickname: 'Gece Kuşu', ageBand: '18_plus', examType: 'YKS' });
    expect(JSON.stringify(server.me)).not.toContain(String(adultYear));
    expect(memory.groupsAccount).toBe(true);
    expect(screen.getByTestId('groups-home')).toBeTruthy();
  });

  it('a bad nickname is caught before anything is sent', async () => {
    renderRouter(APP_DIR, { initialUrl: '/gruplar' });
    await flush();
    fireEvent.changeText(screen.getByTestId('groups-nickname'), 'A😀');
    fireEvent.press(screen.getByTestId('groups-enable'));
    await flush();
    expect(screen.getByTestId('groups-error')).toBeTruthy();
    expect(server.calls).not.toContain('saveProfile');
  });

  it('create a group, see the code, approve a request, react with the daily limit', async () => {
    await signUp();
    fireEvent.changeText(screen.getByTestId('groups-create-name'), 'Sayısal Ekip');
    fireEvent.press(screen.getByTestId('groups-create'));
    await flush();
    await waitFor(() => expect(screen.getByTestId('group-screen')).toBeTruthy());
    expect(screen.getByTestId('group-invite-code').props.children).toContain('ABCD-EFGH');

    // Someone asked to join; the founder approves (K-03).
    server.groups[0].requests.push({ requestId: 'r-1', nickname: 'Arkadaş', createdAt: new Date().toISOString() });
    fireEvent.press(screen.getByTestId('group-period-week'));
    await flush();
    fireEvent.press(screen.getByTestId('group-request-approve-0'));
    await flush();
    expect(server.groups[0].members.map((m) => m.nickname)).toEqual(['Gece Kuşu', 'Arkadaş']);
    expect(screen.getByText('Gruba eklendi.')).toBeTruthy();

    // The new member is studying; send ready-made reactions (K-07, K-08).
    server.studying['user-Arkadaş'] = { subjectId: 'fizik', startedAt: new Date(Date.now() - 25 * 60_000).toISOString() };
    fireEvent.press(screen.getByTestId('group-period-day'));
    await flush();
    expect(screen.getByText(/çalışıyor · Fizik · 25 dk/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('group-member-1'));
    for (let i = 0; i < 3; i++) {
      fireEvent.press(screen.getByTestId('group-react-tebrik'));
      await flush();
    }
    expect(screen.getByText('Gönderildi.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('group-react-hadi'));
    await flush();
    expect(screen.getByText('Bugün bu kişiye en fazla 3 tepki gönderebilirsin.')).toBeTruthy();

    // Report and block (K-28).
    fireEvent.press(screen.getByTestId('group-report'));
    fireEvent.press(screen.getByTestId('group-report-harassment'));
    await flush();
    expect(screen.getByText('Bildirimin alındı. 24 saat içinde incelenir.')).toBeTruthy();
    fireEvent.press(screen.getByTestId('group-block'));
    await flush();
    expect(server.calls).toContain('blockUser');
  });

  it('join with a code: the founder has to approve first', async () => {
    server.groups.push({
      id: 'g-x',
      name: 'Eşit Ağırlık',
      code: 'KLMNPQRS',
      members: [{ userId: 'other', nickname: 'Kurucu', role: 'owner' }],
      requests: [],
    });
    await signUp();
    fireEvent.changeText(screen.getByTestId('groups-join-code'), 'klmn-pqrs');
    fireEvent.press(screen.getByTestId('groups-join'));
    await flush();
    expect(screen.getByText('İsteğin kurucuya iletildi. Onaylanınca grup burada görünür.')).toBeTruthy();
    expect(server.groups[0].members.some((m) => m.userId === ME_ID)).toBe(false);
    expect(screen.getByText('Onay bekliyor')).toBeTruthy();
  });

  it('görünmez çalış can be turned on, unless the parent forces it', async () => {
    await signUp();
    fireEvent.press(screen.getByTestId('groups-invisible'));
    await flush();
    expect(server.me?.invisible).toBe(true);
  });

  it('a parent lock turns the whole module off for the student', async () => {
    memory.groupsAccount = true;
    server.signedIn = true;
    server.me = {
      nickname: 'Öğrenci',
      examType: 'YKS',
      yksArea: 'sayisal',
      ageBand: '15_17',
      invisible: true,
      reactionsEnabled: true,
      groupsDisabled: true,
      forceInvisible: true,
      dailyLimitMinutes: null,
      parentCount: 1,
    };
    memory.profile = profile(teenYear);
    renderRouter(APP_DIR, { initialUrl: '/gruplar' });
    await flush();
    expect(screen.getByTestId('groups-locked')).toBeTruthy();
    expect(server.calls).not.toContain('myGroups');
  });

  it('the parent daily limit closes the group screens for the day', async () => {
    memory.groupsAccount = true;
    server.signedIn = true;
    server.me = {
      nickname: 'Öğrenci',
      examType: 'YKS',
      yksArea: 'sayisal',
      ageBand: '15_17',
      invisible: false,
      reactionsEnabled: true,
      groupsDisabled: false,
      forceInvisible: false,
      dailyLimitMinutes: 30,
      parentCount: 1,
    };
    memory.profile = profile(teenYear);
    const { istanbulDayKey } = jest.requireActual('../domain/istanbul-day');
    memory.usage = { day: istanbulDayKey(Date.now()), ms: 31 * 60_000 };
    renderRouter(APP_DIR, { initialUrl: '/gruplar' });
    await flush();
    expect(screen.getByTestId('groups-limit')).toBeTruthy();
  });

  it('a 15-17 student shows a parent code; the parent links on their own device', async () => {
    memory.profile = profile(teenYear);
    await signUp('Genç Öğrenci');
    expect(server.me?.ageBand).toBe('15_17');
    fireEvent.press(screen.getByTestId('groups-parent-create'));
    await flush();
    expect(screen.getByTestId('groups-parent-code').props.children).toContain('PARE-NT23');

    // Parent device: adult profile, Settings → Veli modu.
    server.parentCodes.PARENT23 = { childId: 'child-1', nickname: 'Genç Öğrenci' };
    memory.profile = profile(adultYear);
    renderRouter(APP_DIR, { initialUrl: '/veli' });
    await flush();
    fireEvent.changeText(screen.getByTestId('parent-code'), 'pare-nt23');
    fireEvent.press(screen.getByTestId('parent-link'));
    await flush();
    expect(screen.getByText('Bağlandı.')).toBeTruthy();
    expect(memory.parentAccount).toBe(true);
    expect(screen.getByTestId('parent-child-0').props.children).toBe('Genç Öğrenci');
    fireEvent.press(screen.getByTestId('parent-groups-off-0'));
    await flush();
    expect(server.controls['child-1']).toEqual({ groupsDisabled: true, forceInvisible: false, dailyLimitMinutes: null });
    fireEvent.press(screen.getByTestId('parent-limit-0-plus'));
    await flush();
    expect(server.controls['child-1'].dailyLimitMinutes).toBe(15);
  });

  it('deleting the group account removes it on the server and locally', async () => {
    await signUp();
    fireEvent.press(screen.getByTestId('groups-delete'));
    fireEvent.press(screen.getByTestId('groups-delete-confirm'));
    await flush();
    expect(server.calls).toContain('deleteMyAccount');
    expect(server.me).toBeNull();
    expect(memory.groupsAccount).toBe(false);
    expect(screen.getByTestId('groups-intro')).toBeTruthy();
  });

  it('"delete all data" refuses to wipe the device if the server account cannot be deleted', async () => {
    memory.groupsAccount = true;
    server.signedIn = true;
    renderRouter(APP_DIR, { initialUrl: '/ayarlar' });
    await flush();
    const { ApiError } = jest.requireActual('../sync/api');
    server.failNext = new ApiError('network');
    fireEvent.press(screen.getByTestId('settings-delete-all'));
    fireEvent.press(screen.getByTestId('settings-delete-all-confirm'));
    await flush();
    expect(memory.profile).not.toBeNull();
    expect(screen.getByText(/silinemedi/)).toBeTruthy();
    fireEvent.press(screen.getByTestId('settings-delete-all-confirm'));
    await flush();
    expect(server.calls.filter((c) => c === 'deleteMyAccount')).toHaveLength(2);
    expect(memory.profile).toBeNull();
  });
});

describe('group module OFF', () => {
  it('shows "Yakında", makes no network request and never touches the server API', async () => {
    flags.enabled = false;
    memory.groupsAccount = true; // even with a stale account flag
    const fetchSpy = jest.fn();
    const originalFetch = global.fetch;
    global.fetch = fetchSpy as unknown as typeof fetch;
    try {
      renderRouter(APP_DIR, { initialUrl: '/gruplar' });
      await flush();
      expect(screen.getByText('Yakında')).toBeTruthy();
      expect(screen.queryByTestId('groups-intro')).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(server.calls).toEqual([]);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('settings show no parent mode and "delete all" stays local', async () => {
    flags.enabled = false;
    memory.groupsAccount = true;
    renderRouter(APP_DIR, { initialUrl: '/ayarlar' });
    await flush();
    expect(screen.queryByTestId('settings-parent-mode')).toBeNull();
    fireEvent.press(screen.getByTestId('settings-delete-all'));
    fireEvent.press(screen.getByTestId('settings-delete-all-confirm'));
    await flush();
    expect(server.calls).toEqual([]);
    expect(memory.profile).toBeNull();
  });
});
