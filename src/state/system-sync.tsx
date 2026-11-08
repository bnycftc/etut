/**
 * Keeps the system surfaces in step with the app: the iOS Live Activity (Lock Screen / Dynamic
 * Island timer), the Home Screen widget and the local reminders. Glue only: what to show comes
 * from the domain (`live-timer.ts`, `widget-summary.ts`, `reminders.ts`), how to show it from
 * `src/system/`. Runs after every change of the running session or the stored data, whenever the
 * app comes to the foreground and when a pomodoro phase ends while the app stays open (a phase
 * change changes nothing in the stored session). Going to the background is a session change
 * too, so the surfaces get a last sync then; only starting a Live Activity needs the foreground.
 * That last sync also says from when the time away will cost study time (`provisionalAwayAt`: at
 * once with "Sor", after 3 hours with "Çalışmaya devam say"): the Live Activity freezes there by
 * itself once stale, the widget's timeline stops counting there.
 * Never ticks.
 *
 * Demo mode (example data): nothing is written to the widget or the Live Activity and the reminder
 * plan is left as the student's own data made it, so the real Lock Screen and Home Screen stay
 * the student's. A Live Activity still showing is ended (no real timer can run then: entering demo
 * mode is refused while one does). Leaving demo mode reloads everything, so all three follow the
 * student's own data and reminder settings again.
 */

import { router, useNavigationContainerRef } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { resolveExamDate } from '../domain/exam-dates';
import { addDays, type DayKey, dayStartMs, istanbulDayKey, lastDays } from '../domain/istanbul-day';
import {
  blockProgress,
  liveActivityAction,
  type LiveActivityRecord,
  liveTimerView,
  planBlockIndex,
} from '../domain/live-timer';
import {
  effectiveReminderPrefs,
  type PendingExam,
  planNotifications,
  type ReminderPrefs,
} from '../domain/reminders';
import { type GoalHistory, STREAK_LOOKBACK_DAYS } from '../domain/streak';
import { type ActiveSession, provisionalAwayAt } from '../domain/timer';
import type { ExamType, Profile } from '../domain/profile';
import {
  countdownTimeline,
  nextPlanBlock,
  savedTotalsLookup,
  type WidgetExam,
  widgetTimeline,
} from '../domain/widget-summary';
import {
  loadAwayRule,
  loadCustomExamDate,
  loadDailyGoal,
  loadDailyGoalHistory,
  loadLiveActivityRecord,
  loadReminderPrefs,
  loadRemindersConfirmed,
  storeLiveActivityRecord,
} from '../storage/kv';
import { listExamsNeedingAnalysis } from '../storage/mock-exams';
import { sessionsOverlapping } from '../storage/sessions';
import { type StudiedThisWeek, studiedThisWeek, type TodayPlanBlock, todaysPlan } from '../storage/study-plan';
import { homeWidget } from '../system/home-widget';
import { liveActivity } from '../system/live-activity';
import { notifications } from '../system/notifications';
import {
  countdownWidgetProps,
  emptyCountdownProps,
  emptyWidgetProps,
  notificationText,
  timerActivityProps,
  todayWidgetProps,
} from '../system/surface-props';
import { useAppState, useNow, useStored } from './app-state';

interface SurfaceData {
  savedTotal: (day: DayKey) => number;
  goalMinutes: number | null;
  goalHistory: GoalHistory;
  prefs: ReminderPrefs;
  pendingExams: PendingExam[];
  /** The widget's countdown line (the same date the timer screen counts down to). */
  exam: WidgetExam | null;
}

/** Saved study time per day: the streak window up to today, and the next two days (the timeline). */
function loadSavedTotals(today: DayKey): (day: DayKey) => number {
  const days = [...lastDays(dayStartMs(today), STREAK_LOOKBACK_DAYS + 1), addDays(today, 1), addDays(today, 2)];
  const sessions = sessionsOverlapping(dayStartMs(days[0]), dayStartMs(addDays(today, 3)));
  return savedTotalsLookup(sessions, days);
}

function loadSurfaceData(savedTotal: (day: DayKey) => number, examType: ExamType, today: DayKey): SurfaceData {
  return {
    savedTotal,
    goalMinutes: loadDailyGoal(),
    goalHistory: loadDailyGoalHistory(),
    prefs: effectiveReminderPrefs(loadReminderPrefs(), loadRemindersConfirmed()),
    pendingExams: listExamsNeedingAnalysis().map((e) => ({ id: e.id, createdAt: e.createdAt })),
    exam: examFor(examType, today),
  };
}

function examFor(examType: ExamType, today: DayKey): WidgetExam | null {
  const date = resolveExamDate(examType, loadCustomExamDate(examType), today);
  return date === null ? null : { examType, day: date.day, days: date.days, estimated: date.estimated };
}

/** Runs async jobs one at a time; a job queued while another runs replaces the older queued one. */
function serial() {
  let queued: (() => Promise<void>) | null = null;
  let running = false;
  return (job: () => Promise<void>) => {
    queued = job;
    if (running) return;
    running = true;
    void (async () => {
      while (queued !== null) {
        const next = queued;
        queued = null;
        try {
          await next();
        } catch {
          // Best effort; the next change syncs again.
        }
      }
      running = false;
    })();
  };
}

const inBackground = () => AppState.currentState === 'background';

const runLiveActivity = serial();
let lastLiveKey: string | null = null;
/** The recorded Live Activity this app process has seen alive or started (see `liveActivityAction`). */
let seenLive: string | null = null;
const recordKey = (record: LiveActivityRecord) => `${record.sessionId}|${record.startedAt}`;

/**
 * Starts, updates, refreshes or ends the Live Activity. ActivityKit starts one only while the app
 * is in the foreground; updating and ending also work while it goes to the background.
 */
async function syncLiveActivity(
  active: ActiveSession | null,
  data: SurfaceData | null,
  plan: readonly TodayPlanBlock[] = [],
): Promise<void> {
  if (!liveActivity.supported) return;
  const now = Date.now();
  const record = loadLiveActivityRecord();
  const instances = liveActivity.count();
  if (record !== null && instances > 0 && record.sessionId === active?.id) seenLive = recordKey(record);
  const decided = liveActivityAction({
    sessionId: active?.id ?? null,
    instances,
    record,
    now,
    seenThisLaunch: record !== null && seenLive === recordKey(record),
  });
  if (decided === 'dismissed') {
    if (record !== null) storeLiveActivityRecord({ ...record, dismissed: true });
    return;
  }
  // A start would be refused here: it waits for the foreground. A restart would end the old one
  // and leave none, so the old one gets this update (the away status) and the restart waits too.
  const action = decided === 'restart' && inBackground() ? 'update' : decided;
  if (inBackground() && (action === 'start' || action === 'retry')) return;
  if (action === 'end' || action === 'restart') {
    await liveActivity.endAll();
    lastLiveKey = null;
    if (action === 'end') storeLiveActivityRecord(null);
  }
  if (active === null || action === 'none' || action === 'end') return;
  const view = liveTimerView(active, now, provisionalAwayAt(active, loadAwayRule()));
  // The goal ring: the widget timeline's entry for now (same numbers as the widget).
  const today = data === null ? null : timeline(active, data, now)[0];
  const props = timerActivityProps(active, view, today, planBlock(active, plan, now));
  const key = JSON.stringify([active.id, props, view.staleAt]);
  if (action === 'update') {
    if (key === lastLiveKey) return;
    await liveActivity.update(props, view.staleAt);
    lastLiveKey = key;
    return;
  }
  if (liveActivity.start(props, view.staleAt)) {
    const started: LiveActivityRecord =
      action === 'retry' ? { sessionId: active.id, startedAt: now, retried: true } : { sessionId: active.id, startedAt: now };
    storeLiveActivityRecord(started);
    seenLive = recordKey(started);
    lastLiveKey = key;
  }
}

let lastWidgetKey: string | null = null;

function timeline(active: ActiveSession | null, data: SurfaceData, now: number, plan: readonly TodayPlanBlock[] = []) {
  return widgetTimeline({
    now,
    savedTotal: data.savedTotal,
    active,
    goalMinutes: data.goalMinutes,
    goalHistory: data.goalHistory,
    exam: data.exam,
    awayAt: active === null ? null : provisionalAwayAt(active, loadAwayRule()),
    nextBlock: nextPlanBlock(plan, active),
  });
}

function syncWidget(active: ActiveSession | null, data: SurfaceData | null, plan: readonly TodayPlanBlock[] = []): void {
  if (!homeWidget.supported) return;
  const now = Date.now();
  const entries =
    data === null
      ? [{ at: now, props: emptyWidgetProps() }]
      : timeline(active, data, now, plan).map((e) => ({ at: e.at, props: todayWidgetProps(e) }));
  // The first entry always starts "now"; only a different picture needs a reload.
  const key = JSON.stringify(entries.map((e, i) => [i === 0 ? 0 : e.at, e.props]));
  if (key === lastWidgetKey) return;
  homeWidget.setTimeline(entries);
  lastWidgetKey = key;
}

// --- Study plan on the surfaces (0.5.0): the widget's next block, the Live Activity's block bar,
// and the countdown widget.

/**
 * Today's plan blocks, read like the timer screen's plan card does (`useTodaysPlan`): the week's
 * study per subject is read only when sessions change, so a topic mark or a setting reads no
 * sessions. `[]` without a profile.
 */
function loadPlanBlocks(
  profile: Pick<Profile, 'examType' | 'yksArea'> | null,
  now: number,
  studied: StudiedThisWeek | null,
): TodayPlanBlock[] {
  if (profile === null || studied === null) return [];
  try {
    return todaysPlan(profile, now, studied).blocks;
  } catch {
    return [];
  }
}

function loadStudied(today: DayKey): StudiedThisWeek | null {
  try {
    return studiedThisWeek(today);
  } catch {
    return null;
  }
}

/** The plan block the running session was started from, as the Live Activity's bar. */
function planBlock(active: ActiveSession, plan: readonly TodayPlanBlock[], now: number) {
  const index = planBlockIndex(plan, active);
  return blockProgress(active, now, index < 0 ? null : plan[index].minutes);
}

let lastCountdownKey: string | null = null;

/** The countdown widget "EtutCountdown": one entry per Istanbul midnight ahead. */
function syncCountdownWidget(data: SurfaceData | null): void {
  if (!homeWidget.supported || homeWidget.setCountdownTimeline === undefined) return;
  const now = Date.now();
  const entries =
    data === null
      ? [{ at: now, props: emptyCountdownProps() }]
      : countdownTimeline(now, data.exam).map((e) => ({ at: e.at, props: countdownWidgetProps(e) }));
  const key = JSON.stringify(entries.map((e, i) => [i === 0 ? 0 : e.at, e.props]));
  if (key === lastCountdownKey) return;
  homeWidget.setCountdownTimeline(entries);
  lastCountdownKey = key;
}

/** `notifications.sync` queues by itself (latest plan wins). */
function syncReminders(active: ActiveSession | null, data: SurfaceData | null): Promise<void> {
  if (data === null) return notifications.cancelAll();
  const now = Date.now();
  const planned = planNotifications({
    now,
    prefs: data.prefs,
    active,
    studiedToday: active !== null || data.savedTotal(istanbulDayKey(now)) > 0,
    pendingExams: data.pendingExams,
  });
  return notifications.sync(planned, notificationText);
}

/** Longest wait between two looks at the clock (a timer can fire late; the clock can be changed). */
const PHASE_CHECK_MS = 60_000;

/**
 * Counts the ends of the pomodoro phase shown on the system surfaces (`staleAt`) while the app
 * stays open, so that each phase change syncs the Live Activity, the reminder plan and the widget.
 */
function usePhaseEnds(session: ActiveSession | null, foreground: number): number {
  const [ends, setEnds] = useState(0);
  useEffect(() => {
    const end = session === null ? null : liveTimerView(session, Date.now()).staleAt;
    if (end === null) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = () => {
      const left = end - Date.now();
      if (left <= 0) setEnds((n) => n + 1);
      else timer = setTimeout(check, Math.min(left, PHASE_CHECK_MS));
    };
    check();
    return () => clearTimeout(timer);
  }, [session, foreground, ends]);
  return ends;
}

export function SystemSync(): null {
  const { active, profile, dataVersions, demo } = useAppState();
  // Minute ticks only matter for the day key (a new day reloads the data).
  const today = istanbulDayKey(useNow(false));
  const [foreground, setForeground] = useState(0);
  const examType = profile === null ? null : profile.examType;
  // The 400 days of sessions are read again only when sessions change (or a new day starts). The
  // goal and reminder settings, the countdown and the exams awaiting analysis are small reads of
  // their own; topic marks are not read here.
  const savedTotal = useStored(`${today}|${dataVersions.sessions}|${examType === null}`, () =>
    examType === null ? null : loadSavedTotals(today),
  );
  const data = useStored(
    `${today}|${dataVersions.sessions}|${dataVersions.settings}|${dataVersions.exams}|${examType ?? 'none'}`,
    () => (examType === null || savedTotal === null ? null : loadSurfaceData(savedTotal, examType, today)),
  );
  const session = profile === null ? null : active;
  const studied = useStored(`planStudied|${today}|${dataVersions.sessions}|${examType === null}`, () =>
    examType === null ? null : loadStudied(today),
  );
  const plan = useStored(
    `plan|${today}|${dataVersions.sessions}|${dataVersions.exams}|${dataVersions.topics}|${dataVersions.settings}|${examType ?? 'none'}|${profile?.yksArea ?? 'none'}`,
    () => loadPlanBlocks(profile, Date.now(), studied),
  );
  const phaseEnds = usePhaseEnds(session, foreground);
  const navigation = useNavigationContainerRef();
  // Route of a tapped notification, opened once the navigator can (a tap that launched the app
  // comes before it is ready).
  const [openUrl, setOpenUrl] = useState<string | null>(null);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') setForeground((n) => n + 1);
    });
    const unsubscribe = notifications.onOpen(setOpenUrl);
    return () => {
      subscription.remove();
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (openUrl === null) return;
    const open = () => {
      setOpenUrl(null);
      // Without a profile only onboarding exists: stay there.
      if (profile === null) return;
      try {
        router.navigate(openUrl);
      } catch {
        // Not possible from here: stay where the app opens.
      }
    };
    if (navigation.isReady()) {
      open();
      return;
    }
    return navigation.addListener('ready', open);
  }, [openUrl, profile, navigation]);

  // Demo mode: the Live Activity and both widgets show the example data (what the reviewer is
  // pointed to); leaving it reloads the real data (`switchedData`) and these write it again (no
  // session there: the Live Activity ends). Reminders stay off in demo mode.
  useEffect(() => {
    runLiveActivity(() => syncLiveActivity(session, data, plan));
  }, [session, data, plan, foreground, phaseEnds]);

  useEffect(() => {
    syncWidget(session, data, plan);
  }, [session, data, plan, foreground, phaseEnds]);

  useEffect(() => {
    syncCountdownWidget(data);
  }, [data, foreground]);

  useEffect(() => {
    if (!notifications.supported || demo) return;
    void syncReminders(session, data);
  }, [session, data, foreground, phaseEnds, demo]);

  return null;
}
