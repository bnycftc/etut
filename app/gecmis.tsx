import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { hoursMinutes } from '@/domain/clock';
import { topicName } from '@/domain/curriculum';
import { activeSpan, dailyTotals, type SessionSpan, subjectBreakdown } from '@/domain/daily-totals';
import {
  DAY_MS,
  type DayKey,
  dayStartMs,
  istanbulDayKey,
  istanbulTimeOfDay,
  istanbulWeekday,
  lastDays,
} from '@/domain/istanbul-day';
import { questionTotals } from '@/domain/questions';
import type { CompletedSession } from '@/domain/timer';
import { useAppState, useNow, useStored } from '@/state/app-state';
import { deleteTimerSession, sessionsOverlapping } from '@/storage/sessions';
import { tr } from '@/strings';
import { syncManualDeleted } from '@/sync/session-sync';
import { BarChart, Button, Card, Dot, EmptyState, fillText, Label, Row, Screen, Tag } from '@/ui/components';
import { formatDay, formatDuration, formatStudyTime } from '@/ui/format';
import { InfoLink } from '@/ui/info-link';
import { subjectColor } from '@/ui/subject-colors';
import { space, usePalette } from '@/ui/theme';

const LIST_DAYS = 30;

export default function HistoryScreen() {
  const { active, dataVersions, notifyDataChanged } = useAppState();
  const c = usePalette();
  const now = useNow(active !== null, 30_000);
  const today = istanbulDayKey(now);
  const days = lastDays(now, LIST_DAYS);

  const stored = useStored(`${today}|${dataVersions.sessions}`, () =>
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
  // "Nedir?" once, on the newest day with an "elle" part, not on every card.
  const firstManualDay = listed.find((t) => (manualByDay.get(t.day) ?? 0) > 0)?.day;
  // Timer sessions by the day they started (manual ones are deleted in Elle ekle).
  const timerByDay = new Map<DayKey, CompletedSession[]>();
  for (const s of stored) {
    if (s.source !== 'timer') continue;
    const day = istanbulDayKey(s.startedAt);
    timerByDay.set(day, [...(timerByDay.get(day) ?? []), s]);
  }
  const [openDay, setOpenDay] = useState<DayKey | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const remove = (id: string) => {
    deleteTimerSession(id);
    syncManualDeleted(id);
    setConfirmingId(null);
    notifyDataChanged('sessions');
  };

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
              a11yValue: formatStudyTime(t.totalMs),
              highlight: t.day === today,
            };
          })}
        />
      </Card>

      <Label variant="heading">{tr.history.days}</Label>
      {listed.length === 0 ? (
        <EmptyState
          testID="history-empty"
          icon="history"
          title={tr.empty.historyTitle}
          body={tr.empty.historyBody}
          action={tr.empty.startTimer}
          onAction={() => router.navigate('/')}
        />
      ) : null}
      {listed.map((t) => (
        <Card key={t.day}>
          <Row wrap>
            <Label variant="heading" style={fillText}>
              {t.day === today ? tr.history.todayLabel : formatDay(t.day)}
            </Label>
            <Label variant="heading">{formatStudyTime(t.totalMs)}</Label>
          </Row>
          {(questions.byDay[t.day] ?? 0) > 0 ? (
            <Label variant="small" testID={`history-questions-${t.day}`}>
              {tr.questions.count(questions.byDay[t.day] ?? 0)}
            </Label>
          ) : null}
          {(manualByDay.get(t.day) ?? 0) > 0 ? (
            <Row wrap>
              <Tag title={tr.manualTag} />
              <Label variant="small" style={{ flexShrink: 1 }}>{tr.history.manualLine(formatDuration(manualByDay.get(t.day) ?? 0))}</Label>
              {t.day === firstManualDay ? (
                <InfoLink testID="history-manual-info" section="elle" term={tr.infoLink.manual} />
              ) : null}
            </Row>
          ) : null}
          <View style={{ gap: 4 }}>
            {subjectBreakdown(t).map((s) => (
              <Row key={s.subjectId} wrap>
                <Dot color={subjectColor(s.subjectId, c)} />
                <Label variant="muted" style={fillText}>
                  {tr.subject(s.subjectId)}
                </Label>
                <Label variant="muted">{formatStudyTime(s.ms)}</Label>
              </Row>
            ))}
          </View>
          {(timerByDay.get(t.day) ?? []).length > 0 ? (
            <Button
              compact
              testID={`history-sessions-${t.day}`}
              kind="secondary"
              title={openDay === t.day ? tr.history.sessionsHide : tr.history.sessionsShow}
              onPress={() => {
                setConfirmingId(null);
                setOpenDay(openDay === t.day ? null : t.day);
              }}
            />
          ) : null}
          {openDay === t.day
            ? (timerByDay.get(t.day) ?? []).map((s) => {
                const line = sessionLine(s);
                return (
                  <View key={s.id} testID={`history-session-${s.id}`} style={{ gap: space.xs }}>
                    <Row wrap>
                      <Dot color={subjectColor(s.subjectId, c)} />
                      <Label style={fillText}>{line}</Label>
                      <Label>{formatStudyTime(s.durationMs)}</Label>
                    </Row>
                    {confirmingId === s.id ? (
                      <>
                        <Label>{tr.history.deleteConfirm}</Label>
                        <Row>
                          <Button
                            testID={`history-delete-yes-${s.id}`}
                            kind="danger"
                            title={tr.common.delete}
                            onPress={() => remove(s.id)}
                          />
                          <Button
                            testID={`history-delete-no-${s.id}`}
                            kind="secondary"
                            title={tr.common.cancel}
                            onPress={() => setConfirmingId(null)}
                          />
                        </Row>
                      </>
                    ) : (
                      <Button
                        compact
                        testID={`history-delete-${s.id}`}
                        kind="secondary"
                        title={tr.common.delete}
                        accessibilityLabel={tr.history.deleteA11y(line)}
                        onPress={() => setConfirmingId(s.id)}
                      />
                    )}
                  </View>
                );
              })
            : null}
        </Card>
      ))}
    </Screen>
  );
}

/** `Fizik · Konu · 14:30–16:05` (Istanbul time). */
function sessionLine(s: CompletedSession): string {
  const topic = topicName(s.topicId);
  const title = topic ? `${tr.subject(s.subjectId)} · ${topic}` : tr.subject(s.subjectId);
  const from = istanbulTimeOfDay(s.startedAt);
  const to = istanbulTimeOfDay(s.endedAt);
  return tr.history.sessionLine(
    title,
    tr.reminders.time(from.hours, from.minutes),
    tr.reminders.time(to.hours, to.minutes),
  );
}
