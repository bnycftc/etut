/**
 * Props of the iOS Live Activity and Home Screen widget, built from the pure domain views
 * (`live-timer.ts`, `widget-summary.ts`) plus the texts of `strings.ts`.
 *
 * Widget code runs in an isolated runtime that sees nothing of the app (no strings, no
 * formatting helpers), so every text arrives here already formatted. Values must be plain JSON:
 * times are epoch milliseconds.
 */

import { topicName } from '../domain/curriculum';
import { istanbulTimeOfDay } from '../domain/istanbul-day';
import type { LiveTimerView } from '../domain/live-timer';
import type { PomodoroPhase } from '../domain/pomodoro';
import type { PlannedNotification } from '../domain/reminders';
import type { ActiveSession } from '../domain/timer';
import type { WidgetEntry } from '../domain/widget-summary';
import { tr } from '../strings';
import { formatDuration } from '../ui/format';
import type { NotificationText } from './types';

/** SF Symbols used by the Live Activity. */
export type ActivityIcon = 'book.fill' | 'cup.and.saucer.fill' | 'pause.fill';

export interface TimerActivityProps {
  /** Subject, and topic when one was chosen. */
  title: string;
  status: string;
  /** SF Symbol shown next to the title and in the compact Dynamic Island. */
  icon: ActivityIcon;
  from: number;
  to: number;
  countsDown: boolean;
  pausedAt: number | null;
  /** Pomodoro: phase progress bar; `progress` is used while paused (no live range then). */
  showProgress: boolean;
  progress: number;
  /**
   * Shown once the Live Activity is stale: the pomodoro phase after the current one and its end
   * time. Without push the activity cannot change again by itself, so after that phase its clock
   * stays at 0:00 while the end time keeps saying when the phase ended.
   */
  nextStatus: string | null;
  nextIcon: ActivityIcon | null;
  nextFrom: number | null;
  nextTo: number | null;
}

export interface TodayWidgetProps {
  title: string;
  /** Today's total, formatted (shown while not counting). */
  total: string;
  /** Live count-up start while study time grows; `null` = show `total`. */
  countingFrom: number | null;
  runningNote: string | null;
  goalLine: string | null;
  goalRatio: number;
  /** Live goal progress range while counting towards an unmet goal. */
  goalFrom: number | null;
  goalTo: number | null;
  streakLine: string | null;
}

function phaseLabel(phase: PomodoroPhase, blockInSet: number, longEvery: number): string {
  if (phase === 'short_break') return tr.pomodoro.shortBreak;
  if (phase === 'long_break') return tr.pomodoro.longBreak;
  return tr.pomodoro.work(blockInSet, longEvery);
}

/** Istanbul clock time `10:30` of the instant `ms`. */
function clockTime(ms: number): string {
  const { hours, minutes } = istanbulTimeOfDay(ms);
  return tr.reminders.time(hours, minutes);
}

function phaseIcon(phase: PomodoroPhase | null): ActivityIcon {
  return phase === 'short_break' || phase === 'long_break' ? 'cup.and.saucer.fill' : 'book.fill';
}

export function timerActivityProps(session: ActiveSession, view: LiveTimerView): TimerActivityProps {
  const topic = topicName(session.topicId);
  const title = topic ? `${tr.subject(session.subjectId)} · ${topic}` : tr.subject(session.subjectId);
  const longEvery = session.pomodoro?.config.longEvery ?? 4;
  const { clock } = view;
  const status =
    view.phase === null
      ? view.paused
        ? tr.timer.paused
        : tr.timer.running
      : view.paused
        ? `${phaseLabel(view.phase, view.blockInSet ?? 1, longEvery)} · ${tr.pomodoro.paused}`
        : phaseLabel(view.phase, view.blockInSet ?? 1, longEvery);
  const span = clock.to - clock.from;
  const shownAt = clock.pausedAt ?? clock.from;
  return {
    title,
    status,
    icon: view.paused ? 'pause.fill' : phaseIcon(view.phase),
    from: clock.from,
    to: clock.to,
    countsDown: clock.countsDown,
    pausedAt: clock.pausedAt,
    showProgress: view.mode === 'pomodoro',
    progress: span > 0 ? Math.min(1, Math.max(0, (shownAt - clock.from) / span)) : 0,
    nextStatus:
      view.next === null
        ? null
        : tr.liveActivity.phaseEnds(
            phaseLabel(view.next.phase, view.next.blockInSet, longEvery),
            clockTime(view.next.clock.to),
          ),
    nextIcon: view.next === null ? null : phaseIcon(view.next.phase),
    nextFrom: view.next?.clock.from ?? null,
    nextTo: view.next?.clock.to ?? null,
  };
}

export function todayWidgetProps(entry: WidgetEntry): TodayWidgetProps {
  const goalMs = entry.goalMinutes === null ? null : entry.goalMinutes * 60_000;
  const live = entry.counting && entry.goalReachedAt !== null && goalMs !== null;
  return {
    title: tr.widget.today,
    total: formatDuration(entry.todayMs),
    countingFrom: entry.counting ? entry.at - entry.todayMs : null,
    runningNote: entry.counting ? tr.widget.running : null,
    goalLine:
      goalMs === null ? null : entry.goalMet ? tr.widget.goalMet : tr.widget.goal(formatDuration(goalMs)),
    goalRatio: entry.goalRatio,
    goalFrom: live ? entry.at - entry.todayMs : null,
    goalTo: live ? entry.goalReachedAt : null,
    streakLine: entry.streakDays === null ? null : tr.widget.streak(entry.streakDays),
  };
}

/** Title, body and in-app route of a planned local notification. */
export function notificationText(n: PlannedNotification): NotificationText {
  const t = tr.notification;
  switch (n.kind) {
    case 'long_session':
      return { title: t.longSessionTitle, body: t.longSessionBody(n.hours), url: '/' };
    case 'pomodoro':
      return n.ended === 'work'
        ? { title: t.workEndedTitle, body: n.next === 'long_break' ? t.longBreakBody : t.shortBreakBody, url: '/' }
        : { title: t.breakEndedTitle, body: t.workBody, url: '/' };
    case 'daily':
      return { title: t.dailyTitle, body: t.dailyBody, url: '/' };
    case 'exam_analysis':
      return { title: t.examTitle, body: t.examBody(n.count), url: '/denemeler' };
  }
}

/** Shown after "Tüm verileri sil" and before the first profile: nothing personal. */
export function emptyWidgetProps(): TodayWidgetProps {
  return {
    title: tr.widget.today,
    total: formatDuration(0),
    countingFrom: null,
    runningNote: null,
    goalLine: null,
    goalRatio: 0,
    goalFrom: null,
    goalTo: null,
    streakLine: null,
  };
}
