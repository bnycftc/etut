import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { hoursMinutes } from '@/domain/clock';
import { weeklySummary } from '@/domain/compare';
import { activeSpan, type SessionSpan } from '@/domain/daily-totals';
import { addDays, DAY_MS, dayStartMs, istanbulDayKey, istanbulWeekday } from '@/domain/istanbul-day';
import { canShareCard } from '@/domain/share-card';
import { weekStartOf } from '@/domain/streak';
import { isPaused } from '@/domain/timer';
import { useAppState, useNow, useStored } from '@/state/app-state';
import { useStudyStats } from '@/state/study-stats';
import { sessionsOverlapping } from '@/storage/sessions';
import { tr } from '@/strings';
import { BarChart, Button, Card, Dot, EmptyState, Label, Row, Screen, Tag } from '@/ui/components';
import { formatDay, formatDuration } from '@/ui/format';
import { subjectColor } from '@/ui/subject-colors';
import { usePalette } from '@/ui/theme';

/** Weekly summary (Monday–Sunday, Istanbul): own numbers only, no comparison with others. */
export default function WeeklyScreen() {
  const { active, dataVersion, profile } = useAppState();
  const c = usePalette();
  const now = useNow(active !== null && !isPaused(active), 30_000);
  const stats = useStudyStats(now);
  const thisWeek = weekStartOf(stats.today);
  const [offset, setOffset] = useState(0);
  const weekStart = addDays(thisWeek, offset * 7);
  const previousStart = addDays(weekStart, -7);

  const stored = useStored(`${weekStart}|${dataVersion}`, () =>
    sessionsOverlapping(dayStartMs(previousStart), dayStartMs(weekStart) + 7 * DAY_MS),
  );
  const spans: SessionSpan[] = [...stored];
  if (active !== null && offset === 0) spans.push(activeSpan(active, now));

  const week = weeklySummary(spans, weekStart, stats.goal);
  const previous = weeklySummary(spans, previousStart, null);

  return (
    <Screen>
      <Row>
        <Button testID="weekly-prev" kind="secondary" title={tr.weekly.prev} onPress={() => setOffset(offset - 1)} />
        <Button
          testID="weekly-next"
          kind="secondary"
          title={tr.weekly.next}
          disabled={offset >= 0}
          onPress={() => setOffset(offset + 1)}
        />
      </Row>
      <Label variant="muted">{tr.weekly.range(formatDay(weekStart), formatDay(addDays(weekStart, 6)))}</Label>

      <Card>
        <Row>
          <Label variant="heading" style={{ flex: 1 }}>
            {tr.weekly.total}
          </Label>
          <Label testID="weekly-total" variant="heading">
            {formatDuration(week.totalMs)}
          </Label>
        </Row>
        <Label variant="muted">{tr.weekly.previousWeek(formatDuration(previous.totalMs))}</Label>
        <Label variant="muted">{tr.weekly.activeDays(week.activeDays)}</Label>
        {week.goalDays !== null ? <Label variant="muted">{tr.weekly.goalDays(week.goalDays)}</Label> : null}
        {week.manualMs > 0 ? (
          <Row>
            <Tag title={tr.manualTag} />
            <Label variant="small">{tr.weekly.manual(formatDuration(week.manualMs))}</Label>
          </Row>
        ) : null}
        <BarChart
          bars={week.days.map((d) => {
            const { hours, minutes } = hoursMinutes(d.totalMs);
            return {
              key: d.day,
              label: tr.weekdayShort(istanbulWeekday(d.day)),
              value: d.totalMs,
              valueLabel: d.totalMs === 0 ? '' : tr.history.barValue(hours, minutes),
              highlight: d.day === stats.today,
            };
          })}
        />
      </Card>

      {week.totalMs === 0 ? (
        <EmptyState testID="weekly-empty" title={tr.empty.weeklyTitle} body={tr.empty.weeklyBody} />
      ) : offset === 0 && canShareCard(profile) ? (
        <Button
          testID="weekly-share"
          kind="secondary"
          title={tr.share.open}
          onPress={() => router.push('/paylas')}
        />
      ) : null}

      {week.bySubject.length > 0 ? (
        <Card>
          <Label variant="heading">{tr.weekly.subjects}</Label>
          {week.bySubject.map((s) => (
            <Row key={s.subjectId}>
              <Dot color={subjectColor(s.subjectId, c)} />
              <Label style={{ flex: 1 }}>{tr.subject(s.subjectId)}</Label>
              <Label variant="muted">{tr.weekly.percent(Math.round((s.ms * 100) / week.totalMs))}</Label>
              <Label>{formatDuration(s.ms)}</Label>
            </Row>
          ))}
        </Card>
      ) : null}

      {week.longest !== null ? (
        <Card>
          <Label variant="heading">{tr.weekly.longest}</Label>
          <Row>
            <View style={{ flex: 1 }}>
              <Label>{tr.subject(week.longest.subjectId)}</Label>
              <Label variant="small">{formatDay(istanbulDayKey(week.longest.startedAt))}</Label>
            </View>
            <Label testID="weekly-longest">{formatDuration(week.longest.ms)}</Label>
            {week.longest.manual ? <Tag title={tr.manualTag} /> : null}
          </Row>
        </Card>
      ) : null}

      {stats.streak !== null ? (
        <Card>
          <Label variant="heading">{tr.weekly.streak}</Label>
          <Label>{tr.goal.streak(stats.streak.current)}</Label>
          <Label variant="small">{stats.streak.restUsedThisWeek ? tr.goal.restUsed : tr.goal.restFree}</Label>
        </Card>
      ) : null}
    </Screen>
  );
}
