import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { addDays, istanbulDayKey } from '@/domain/istanbul-day';
import type { PlanPhase, Weekday } from '@/domain/study-plan';
import { useAppState, useNow, useStored } from '@/state/app-state';
import {
  AVAILABILITY_MAX_MIN,
  AVAILABILITY_STEP_MIN,
  availabilityOrDefault,
  currentWeekPlan,
  saveAvailability,
  studiedThisWeek,
  WEEKDAYS,
} from '@/storage/study-plan';
import { tr } from '@/strings';
import { Button, Card, Dot, Label, Screen, Section, Stepper } from '@/ui/components';
import { announce, hapticTap } from '@/ui/feedback';
import { formatDuration, topicLabel } from '@/ui/format';
import { reasonText } from '@/ui/plan-card';
import { subjectColor } from '@/ui/subject-colors';
import { space, usePalette } from '@/ui/theme';

const MINUTE_MS = 60_000;

function phaseLabel(phase: PlanPhase): string {
  if (phase === 'review') return tr.plan.phaseReview;
  if (phase === 'mixed') return tr.plan.phaseMixed;
  return tr.plan.phaseLearn;
}

/** `Pzt 02.11` */
function dayLabel(weekday: Weekday, day: string): string {
  return `${tr.weekdayShort(weekday)} ${day.slice(8, 10)}.${day.slice(5, 7)}`;
}

/**
 * Plan: this week's study plan (7 days, blocks per day with the reason for each), the phase and the
 * days left to the exam, and the availability editor the plan is built from. The plan is computed
 * from the stored data each time (never stored); "Planı yenile" computes it again.
 */
export default function PlanScreen() {
  const { profile, dataVersions, notifyDataChanged } = useAppState();
  const c = usePalette();
  const now = useNow(false);
  const today = istanbulDayKey(now);
  const examType = profile?.examType ?? 'DIGER';
  const yksArea = profile?.yksArea ?? null;
  const [refreshes, setRefreshes] = useState(0);
  const v = dataVersions;

  const availability = useStored(`availability|${v.settings}`, availabilityOrDefault);
  // Sessions are read only when they change (or on a new day, or "Planı yenile").
  const studied = useStored(`planStudied|${today}|${v.sessions}|${refreshes}`, () => studiedThisWeek(today));
  const plan = useStored(
    `weekPlan|${today}|${examType}|${yksArea}|${v.sessions}|${v.exams}|${v.topics}|${v.settings}|${refreshes}`,
    () => currentWeekPlan({ examType, yksArea }, now, studied),
  );

  const setDay = (day: Weekday, minutes: number) => {
    const next = { ...availability, [day]: Math.min(AVAILABILITY_MAX_MIN, Math.max(0, minutes)) };
    saveAvailability(next);
    hapticTap();
    notifyDataChanged('settings');
  };

  const refresh = () => {
    setRefreshes((n) => n + 1);
    hapticTap();
    announce(tr.plan.refreshed);
  };

  return (
    <Screen testID="plan-screen">
      <Card tone="hero" testID="plan-summary">
        <Label variant="heading" testID="plan-phase">
          {phaseLabel(plan.phase)}
        </Label>
        {plan.daysLeft !== null ? (
          <Label variant="muted" testID="plan-days-left">
            {tr.plan.daysLeft(plan.daysLeft)}
          </Label>
        ) : null}
        <Label variant="muted" testID="plan-week-total">
          {tr.plan.weekTotal(formatDuration(plan.totalMinutes * MINUTE_MS))}
        </Label>
        <Button testID="plan-refresh" kind="secondary" title={tr.plan.refresh} onPress={refresh} />
      </Card>

      <Section title={tr.plan.week} testID="plan-week">
        {WEEKDAYS.map((weekday) => {
          const day = addDays(plan.weekStart, weekday);
          const blocks = plan.blocks.filter((b) => b.day === weekday);
          const minutes = blocks.reduce((sum, b) => sum + b.minutes, 0);
          return (
            <Card key={weekday} testID={`plan-day-${weekday}`}>
              <View style={styles.head}>
                <Label variant="heading" style={styles.grow}>
                  {dayLabel(weekday, day)}
                </Label>
                <Label variant="small" testID={`plan-day-total-${weekday}`}>
                  {blocks.length === 0 ? tr.plan.restDay : formatDuration(minutes * MINUTE_MS)}
                </Label>
              </View>
              {blocks.map((block, n) => {
                const topic = topicLabel(block.topicId);
                return (
                  <View key={n} style={styles.block} testID={`plan-day-${weekday}-block-${n}`}>
                    <View style={styles.dot}>
                      <Dot color={subjectColor(block.subjectId, c)} />
                    </View>
                    <View style={styles.grow}>
                      <Label style={styles.title}>{tr.plan.blockTitle(tr.subject(block.subjectId), block.minutes)}</Label>
                      <Label variant="small">{tr.plan.blockDetail(topic, reasonText(block.reason))}</Label>
                    </View>
                  </View>
                );
              })}
            </Card>
          );
        })}
      </Section>

      <Section title={tr.plan.availability} testID="plan-availability">
        <Card>
          <Label variant="small">{tr.plan.availabilityInfo}</Label>
          {WEEKDAYS.map((weekday) => {
            const minutes = availability[weekday];
            return (
              <Stepper
                key={weekday}
                testID={`plan-availability-${weekday}`}
                label={tr.weekdayShort(weekday)}
                accessibilityLabel={tr.plan.availabilityA11y(tr.weekdayShort(weekday))}
                value={tr.plan.availabilityValue(minutes)}
                minusDisabled={minutes <= 0}
                plusDisabled={minutes >= AVAILABILITY_MAX_MIN}
                onMinus={() => setDay(weekday, minutes - AVAILABILITY_STEP_MIN)}
                onPlus={() => setDay(weekday, minutes + AVAILABILITY_STEP_MIN)}
              />
            );
          })}
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  grow: { flexGrow: 1, flexShrink: 1 },
  block: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { alignSelf: 'flex-start', paddingTop: 6 },
  title: { fontWeight: '600' },
});
