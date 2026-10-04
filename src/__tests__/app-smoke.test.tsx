/**
 * Smoke test of the real screens with expo-router's test renderer. Storage is replaced by
 * in-memory fakes (SQLite cannot run under Jest); everything else is the app code as shipped.
 */

import { act, fireEvent, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';

import type { Profile } from '../domain/profile';
import type { ActiveSession, CompletedSession } from '../domain/timer';

const memory: {
  profile: Profile | null;
  active: ActiveSession | null;
  sessions: CompletedSession[];
} = { profile: null, active: null, sessions: [] };

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
  wipeKeyValueStore: () => {
    memory.profile = null;
    memory.active = null;
  },
}));

jest.mock('../storage/sessions', () => ({
  saveSession: (s: CompletedSession) => {
    memory.sessions.push(s);
  },
  sessionsOverlapping: () => memory.sessions,
}));

jest.mock('../storage/mock-exams', () => ({
  listMockExams: () => [],
  getMockExam: () => null,
  saveMockExam: () => {},
  deleteMockExam: () => {},
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
