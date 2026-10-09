import { router } from 'expo-router';
import { View } from 'react-native';

import { hoursMinutes } from '@/domain/clock';
import { activeSpan, dailyTotals, type SessionSpan, subjectBreakdown } from '@/domain/daily-totals';
import { DAY_MS, dayStartMs, istanbulDayKey, istanbulWeekday, lastDays } from '@/domain/istanbul-day';
import { questionTotals } from '@/domain/questions';
import { useAppState, useNow, useStored } from '@/state/app-state';
import { sessionsOverlapping } from '@/storage/sessions';
import { tr } from '@/strings';
import { BarChart, Card, Dot, EmptyState, Label, Row, Screen, Tag } from '@/ui/components';
import { formatDay, formatDuration } from '@/ui/format';
import { subjectColor } from '@/ui/subject-colors';
import { usePalette } from '@/ui/theme';

const LIST_DAYS = 30;

export default function HistoryScreen() {
  const { active, dataVersion } = useAppState();
  const c = usePalette();
  const now = useNow(active !== null, 30_000);
  const today = istanbulDayKey(now);
  const days = lastDays(now, LIST_DAYS);

  const stored = useStored(`${today}|${dataVersion}`, () =>
    sessionsOverlapping(dayStartMs(days[0]), dayStartMs(today) + DAY_MS),
  );
  const spans: SessionSpan[] = [...stored];
  if (active !== null) spans.push(activeSpan(active, now));

  const totals = dailyTotals(spans, days);
  const manualByDay = new Map(
    dailyTotals(
      spans.filter((s) => s.source === 'manual'),
      days,
    ).map((t) => [t.day, t.totalMs]),
  );
  const questions = questionTotals(stored, days);
  const week = totals.slice(-7);
  const listed = [...totals].reverse().filter((t) => t.totalMs > 0);

  return (
    <Screen>
      <Card>
        <Label variant="heading">{tr.history.last7}</Label>
        <BarChart
          bars={week.map((t) => {
            const { hours, minutes } = hoursMinutes(t.totalMs);
            return {
              key: t.day,
              label: t.day === today ? tr.history.todayLabel : tr.weekdayShort(istanbulWeekday(t.day)),
              value: t.totalMs,
              valueLabel: t.totalMs === 0 ? '' : tr.history.barValue(hours, minutes),
              highlight: t.day === today,
            };
          })}
        />
      </Card>

      <Label variant="heading">{tr.history.days}</Label>
      {listed.length === 0 ? (
        <EmptyState
          testID="history-empty"
          title={tr.empty.historyTitle}
          body={tr.empty.historyBody}
          action={tr.empty.startTimer}
          onAction={() => router.navigate('/')}
        />
      ) : null}
      {listed.map((t) => (
        <Card key={t.day}>
          <Row>
            <Label variant="heading" style={{ flex: 1 }}>
              {t.day === today ? tr.history.todayLabel : formatDay(t.day)}
            </Label>
            <Label variant="heading">{formatDuration(t.totalMs)}</Label>
          </Row>
          {(questions.byDay[t.day] ?? 0) > 0 ? (
            <Label variant="small" testID={`history-questions-${t.day}`}>
              {tr.questions.count(questions.byDay[t.day] ?? 0)}
            </Label>
          ) : null}
          {(manualByDay.get(t.day) ?? 0) > 0 ? (
            <Row>
              <Tag title={tr.manualTag} />
              <Label variant="small">{tr.history.manualLine(formatDuration(manualByDay.get(t.day) ?? 0))}</Label>
            </Row>
          ) : null}
          <View style={{ gap: 4 }}>
            {subjectBreakdown(t).map((s) => (
              <Row key={s.subjectId}>
                <Dot color={subjectColor(s.subjectId, c)} />
                <Label variant="muted" style={{ flex: 1 }}>
                  {tr.subject(s.subjectId)}
                </Label>
                <Label variant="muted">{formatDuration(s.ms)}</Label>
              </Row>
            ))}
          </View>
        </Card>
      ))}
    </Screen>
  );
}
