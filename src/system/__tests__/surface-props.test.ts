import { liveTimerView } from '../../domain/live-timer';
import { DEFAULT_POMODORO } from '../../domain/pomodoro';
import { pauseSession, startSession } from '../../domain/timer';
import type { WidgetEntry } from '../../domain/widget-summary';
import { emptyWidgetProps, notificationText, timerActivityProps, todayWidgetProps } from '../surface-props';

const T0 = Date.parse('2026-10-04T07:00:00Z');
const MIN = 60_000;

describe('Live Activity props', () => {
  it('stopwatch with a topic', () => {
    const s = startSession('s', 'fizik', T0, { topicId: 'tyt.fizik.basinc' });
    expect(timerActivityProps(s, liveTimerView(s, T0 + MIN))).toMatchObject({
      title: 'Fizik · Basınç',
      status: 'Çalışıyorsun',
      icon: 'book.fill',
      from: T0,
      countsDown: false,
      pausedAt: null,
      showProgress: false,
      nextStatus: null,
    });
  });

  it('paused pomodoro shows the phase, the pause and a static progress', () => {
    const s = pauseSession(startSession('p', 'kimya', T0, { pomodoro: DEFAULT_POMODORO }), T0 + 10 * MIN);
    const props = timerActivityProps(s, liveTimerView(s, T0 + 12 * MIN));
    expect(props).toMatchObject({ status: 'Çalışma 1/4 · Duraklatıldı', icon: 'pause.fill', showProgress: true });
    expect(props.progress).toBeCloseTo(10 / 25);
    expect(props.nextStatus).toBeNull();
  });

  it('a break says what comes next and when that ends (still true once its clock is at 0:00)', () => {
    const s = startSession('p', 'kimya', T0, { pomodoro: DEFAULT_POMODORO });
    const props = timerActivityProps(s, liveTimerView(s, T0 + 26 * MIN));
    // T0 = 10:00 Istanbul; the second work block runs 10:30–10:55.
    expect(props).toMatchObject({
      status: 'Kısa mola',
      icon: 'cup.and.saucer.fill',
      nextStatus: 'Çalışma 2/4 · bitiş 10:55',
      nextFrom: T0 + 30 * MIN,
      nextTo: T0 + 55 * MIN,
    });
  });
});

describe('widget props', () => {
  const base: WidgetEntry = {
    at: T0,
    day: '2026-10-04',
    todayMs: 50 * MIN,
    counting: false,
    goalMinutes: 60,
    goalMet: false,
    goalRatio: 50 / 60,
    goalReachedAt: null,
    streakDays: 3,
  };

  it('static day with a goal', () => {
    expect(todayWidgetProps(base)).toEqual({
      title: 'Bugün',
      total: '50 dk',
      countingFrom: null,
      runningNote: null,
      goalLine: 'Hedef 1 sa 0 dk',
      goalRatio: 50 / 60,
      goalFrom: null,
      goalTo: null,
      streakLine: 'Seri: 3 gün',
    });
  });

  it('counting: the widget draws the clock and the goal bar from ranges', () => {
    const props = todayWidgetProps({ ...base, counting: true, goalReachedAt: T0 + 10 * MIN });
    expect(props).toMatchObject({
      countingFrom: T0 - 50 * MIN,
      runningNote: 'Sayaç açık',
      goalFrom: T0 - 50 * MIN,
      goalTo: T0 + 10 * MIN,
    });
  });

  it('goal met, no goal, and the empty widget', () => {
    expect(todayWidgetProps({ ...base, goalMet: true }).goalLine).toBe('Hedef tamam');
    expect(todayWidgetProps({ ...base, goalMinutes: null, streakDays: null })).toMatchObject({
      goalLine: null,
      streakLine: null,
    });
    expect(emptyWidgetProps()).toMatchObject({ total: '0 dk', goalLine: null, streakLine: null, countingFrom: null });
  });
});

describe('notification texts (neutral for every age)', () => {
  it('maps each planned reminder to a title, body and route', () => {
    expect(notificationText({ id: 'a', at: 0, kind: 'long_session', hours: 3 })).toEqual({
      title: 'Hâlâ çalışıyor musun?',
      // Pomodoro breaks do not pause the timer, so the text does not claim "without a break".
      body: 'Sayaç 3 saattir duraklatılmadan açık. Ara verdiysen sayacı durdurabilirsin.',
      url: '/',
    });
    expect(notificationText({ id: 'b', at: 0, kind: 'pomodoro', ended: 'work', next: 'long_break' }).body).toBe(
      'Uzun mola başladı.',
    );
    expect(notificationText({ id: 'c', at: 0, kind: 'pomodoro', ended: 'short_break', next: 'work' }).title).toBe(
      'Mola bitti',
    );
    expect(notificationText({ id: 'd', at: 0, kind: 'daily' }).title).toBe('Çalışma zamanı');
    expect(notificationText({ id: 'e', at: 0, kind: 'exam_analysis', count: 2 })).toEqual({
      title: 'Deneme analizi',
      body: 'Analizi bekleyen 2 deneme var.',
      url: '/denemeler',
    });
  });
});
