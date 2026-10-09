/**
 * Loads the stored sessions that the home screen and the weekly summary need and feeds them to
 * the domain rules (totals, "dünkü sen" comparison, streak). Glue only: no rules here.
 */

import { useRef } from 'react';

import { compareWithPast, type SelfComparison } from '../domain/compare';
import { activeSpan, dailyTotals, pastDayTotals, type SessionSpan } from '../domain/daily-totals';
import { addDays, DAY_MS, type DayKey, dayStartMs, istanbulDayKey, lastDays } from '../domain/istanbul-day';
import { computeStreak, goalMet, STREAK_LOOKBACK_DAYS, type StreakResult, weekStartOf } from '../domain/streak';
import { loadDailyGoal } from '../storage/kv';
import { sessionsOverlapping } from '../storage/sessions';
import { useAppState, useStored } from './app-state';

export interface StudyStats {
  today: DayKey;
  todayTotal: number;
  todayManual: number;
  comparison: SelfComparison;
  /** Daily goal in minutes; `null` = none. */
  goal: number | null;
  streak: StreakResult | null;
}

export function useStudyStats(now: number): StudyStats {
  // Out of the React Compiler like useStored: the streak cache below is a ref read and written
  // during render, which must run exactly as written.
  'use no memo';
  const { active, dataVersions } = useAppState();
  const today = istanbulDayKey(now);
  // Only sessions and the goal are read here: a topic mark or a mock exam needs no reload.
  const stored = useStored(`${today}|${dataVersions.sessions}|${dataVersions.settings}`, () => {
    const todayStart = dayStartMs(today);
    const sessions = sessionsOverlapping(
      dayStartMs(addDays(today, -STREAK_LOOKBACK_DAYS)),
      todayStart + DAY_MS,
    );
    // Past days do not change while the screen is open; computed once per day/data change.
    const past = new Map(
      dailyTotals(sessions, lastDays(todayStart - 1, STREAK_LOOKBACK_DAYS)).map((t) => [t.day, t.totalMs]),
    );
    const recentFrom = dayStartMs(weekStartOf(today)) - 7 * DAY_MS;
    return { past, recent: sessions.filter((s) => s.endedAt > recentFrom), goal: loadDailyGoal() };
  });

  const spans: SessionSpan[] = [...stored.recent];
  const running = active === null ? null : activeSpan(active, now);
  if (running !== null) spans.push(running);
  const todayTotal = dailyTotals(spans, [today])[0].totalMs;
  const todayManual = dailyTotals(
    spans.filter((s) => s.source === 'manual'),
    [today],
  )[0].totalMs;
  // A running session that crossed one or more midnights also counts towards those days.
  const runningPast = running === null ? null : pastDayTotals([running], today);
  const goal = stored.goal;
  // The streak walks 400 days back. While the clock ticks only today's total changes, and the
  // streak depends on it only through "goal met today": recompute when that (or the data) changes.
  const todayMet = goal !== null && goalMet(todayTotal, goal);
  const runningPastKey = runningPast === null ? '' : JSON.stringify([...runningPast]);
  const streakKey = `${today}|${goal}|${todayMet}|${runningPastKey}`;
  const streakCache = useRef<{ stored: unknown; key: string; value: StreakResult | null } | null>(null);
  let streak: StreakResult | null;
  if (streakCache.current?.stored === stored && streakCache.current.key === streakKey) {
    streak = streakCache.current.value;
  } else {
    streak =
      goal === null
        ? null
        : computeStreak(
            (day) =>
              day === today
                ? todayTotal
                : (stored.past.get(day) ?? 0) + (runningPast?.get(day) ?? 0),
            today,
            goal,
          );
    streakCache.current = { stored, key: streakKey, value: streak };
  }

  return { today, todayTotal, todayManual, comparison: compareWithPast(spans, now), goal, streak };
}
