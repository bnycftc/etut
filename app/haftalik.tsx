import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { hoursMinutes } from '@/domain/clock';
import { weeklySummary } from '@/domain/compare';
import { activeSpan, type SessionSpan } from '@/domain/daily-totals';
import { addDays, DAY_MS, dayStartMs, istanbulDayKey, istanbulWeekday } from '@/domain/istanbul-day';
import { addMonths, monthStartOf, monthView } from '@/domain/month-calendar';
import { questionTotals } from '@/domain/questions';
import { canShareCard } from '@/domain/share-card';
import { weekStartOf } from '@/domain/streak';
import { subjectTargetProgress } from '@/domain/subject-targets';
import { isPaused } from '@/domain/timer';
import { useAppState, useNow, useStored } from '@/state/app-state';
import { useStudyStats } from '@/state/study-stats';
import { sessionsOverlapping } from '@/storage/sessions';
import { loadSubjectTargets } from '@/storage/subject-targets';
import { tr } from '@/strings';
import { BarChart, Button, Card, Dot, EmptyState, Label, ProgressBar, Row, Screen, Tag } from '@/ui/components';
import { formatDay, formatDuration } from '@/ui/format';
import { Icon } from '@/ui/icon';
import { MonthCalendar } from '@/ui/month-calendar';
import { subjectColor } from '@/ui/subject-colors';
import { space, usePalette } from '@/ui/theme';

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
  const weekDayKeys = week.days.map((d) => d.day);
  const questions = questionTotals(stored, weekDayKeys);
  const targets = useStored(`targets|${dataVersion}`, loadSubjectTargets);
  const weekMsOf = (subjectId: string) => week.bySubject.find((s) => s.subjectId === subjectId)?.ms ?? 0;
  const targetRows = Object.entries(targets).map(([subjectId, minutes]) => ({
    subjectId,
    progress: subjectTargetProgress(weekMsOf(subjectId), minutes),
  }));

  // Monthly calendar: its own month with its own arrows (this month by default).
  const [monthOffset, setMonthOffset] = useState(0);
  const month = addMonths(monthStartOf(stats.today), monthOffset);
  const monthStored = useStored(`month|${month}|${dataVersion}`, () =>
    sessionsOverlapping(dayStartMs(month), dayStartMs(addMonths(month, 1))),
  );
  const monthSpans: SessionSpan[] = [...monthStored];
  if (active !== null && monthOffset === 0) monthSpans.push(activeSpan(active, now));
  const monthly = monthView(monthSpans, month, stats.today);

  const openReport = (subjectId: string) =>
    router.push({ pathname: '/karne/[subject]', params: { subject: subjectId } });

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
        {questions.total > 0 ? (
          <>
            <Label testID="weekly-questions">{tr.questions.weekTotal(questions.total)}</Label>
            <View
              accessible
              accessibilityLabel={tr.questions.byDayA11y(
                weekDayKeys
                  .map((d) => tr.questions.dayItem(tr.weekdayShort(istanbulWeekday(d)), questions.byDay[d] ?? 0))
                  .join(', '),
              )}
              style={styles.dayRow}>
              {weekDayKeys.map((d) => (
                <View key={d} style={styles.dayCell}>
                  <Text style={[styles.dayCount, { color: c.text }]} maxFontSizeMultiplier={1.3}>
                    {questions.byDay[d] ?? 0}
                  </Text>
                  <Text style={[styles.dayName, { color: c.textMuted }]} maxFontSizeMultiplier={1.3}>
                    {tr.weekdayShort(istanbulWeekday(d))}
                  </Text>
                </View>
              ))}
            </View>
          </>
        ) : null}
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
          {week.bySubject.map((s) => {
            const percent = Math.round((s.ms * 100) / week.totalMs);
            const count = questions.bySubject[s.subjectId] ?? 0;
            return (
              <Pressable
                key={s.subjectId}
                testID={`weekly-subject-${s.subjectId}`}
                accessibilityRole="button"
                accessibilityLabel={tr.report.rowA11y(tr.subject(s.subjectId), formatDuration(s.ms), percent)}
                onPress={() => openReport(s.subjectId)}
                style={({ pressed }) => [styles.subjectRow, { opacity: pressed ? 0.6 : 1 }]}>
                <Dot color={subjectColor(s.subjectId, c)} />
                <View style={styles.grow}>
                  <Label>{tr.subject(s.subjectId)}</Label>
                  {count > 0 ? <Label variant="small">{tr.questions.count(count)}</Label> : null}
                </View>
                <Label variant="muted">{tr.weekly.percent(percent)}</Label>
                <Label>{formatDuration(s.ms)}</Label>
                <Icon name="chevron" color={c.textMuted} size={16} />
              </Pressable>
            );
          })}
        </Card>
      ) : null}

      <Card testID="weekly-targets">
        <Label variant="heading">{tr.subjectTargets.weeklyTitle}</Label>
        {targetRows.length === 0 ? <Label variant="muted">{tr.subjectTargets.hint}</Label> : null}
        {targetRows.map(({ subjectId, progress }) => (
          <View key={subjectId} style={{ gap: space.xs }}>
            <Row>
              <Dot color={subjectColor(subjectId, c)} />
              <Label style={styles.grow}>{tr.subject(subjectId)}</Label>
              <Label variant="muted" testID={`weekly-target-${subjectId}`}>
                {tr.subjectTargets.progress(
                  formatDuration(weekMsOf(subjectId)),
                  formatDuration(progress.targetMs),
                  progress.percent,
                )}
              </Label>
            </Row>
            <ProgressBar ratio={progress.ratio} label={tr.subjectTargets.barLabel(tr.subject(subjectId))} />
          </View>
        ))}
      </Card>

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

      <Card testID="monthly-card">
        <Label variant="heading">{tr.monthly.title}</Label>
        <Row>
          <Button
            testID="monthly-prev"
            kind="secondary"
            title={tr.monthly.prev}
            onPress={() => setMonthOffset(monthOffset - 1)}
          />
          <Button
            testID="monthly-next"
            kind="secondary"
            title={tr.monthly.next}
            disabled={monthOffset >= 0}
            onPress={() => setMonthOffset(monthOffset + 1)}
          />
        </Row>
        <Label variant="heading" testID="monthly-month">
          {tr.monthly.month(monthly.year, monthly.month)}
        </Label>
        {monthly.studyDays === 0 ? (
          <Label variant="muted" testID="monthly-empty">
            {tr.monthly.empty}
          </Label>
        ) : (
          <View style={{ gap: 2 }}>
            <Label testID="monthly-total">{tr.monthly.total(formatDuration(monthly.totalMs))}</Label>
            <Label variant="muted">{tr.monthly.studyDays(monthly.studyDays, monthly.elapsedDays)}</Label>
            <Label variant="muted">{tr.monthly.restDays(monthly.restDays)}</Label>
            {monthly.bestDay !== null ? (
              <Label variant="muted" testID="monthly-best">
                {tr.monthly.best(formatDay(monthly.bestDay.day), formatDuration(monthly.bestDay.ms))}
              </Label>
            ) : null}
            <Label variant="muted">{tr.monthly.average(formatDuration(monthly.averageStudyDayMs))}</Label>
          </View>
        )}
        <MonthCalendar testID="monthly-grid" view={monthly} today={stats.today} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grow: { flex: 1 },
  subjectRow: { flexDirection: 'row', gap: space.md, alignItems: 'center', minHeight: 44 },
  dayRow: { flexDirection: 'row', gap: space.xs },
  dayCell: { flex: 1, alignItems: 'center' },
  dayCount: { fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  dayName: { fontSize: 12 },
});
