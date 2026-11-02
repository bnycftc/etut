/**
 * "Bugünün planı": today's blocks of the weekly study plan (`domain/study-plan.ts`, read through
 * `storage/study-plan.ts`). Each block shows its subject colour, subject, minutes, topic and why it
 * is in the plan; "Başlat" starts the timer on that subject and topic. On a rest day the card says
 * so: it is never empty.
 */

import { StyleSheet, View } from 'react-native';

import { istanbulDayKey } from '../domain/istanbul-day';
import type { PlanBlock } from '../domain/study-plan';
import { useAppState, useStored } from '../state/app-state';
import { studiedThisWeek, type TodayPlanBlock, type TodaysPlan, todaysPlan } from '../storage/study-plan';
import { tr } from '../strings';
import { Button, Card, Dot, Label } from './components';
import { topicLabel } from './format';
import { Icon } from './icon';
import { subjectColor } from './subject-colors';
import { space, usePalette } from './theme';

/** Short reason text of a block (`planReason`). */
export function reasonText(reason: PlanBlock['reason']): string {
  return reason === 'exam-day' ? tr.plan.reason.examDay : tr.plan.reason[reason];
}

/**
 * Today's plan from storage, computed again when sessions, exams, topic marks or settings change, on
 * a new day, or when the exam changes.
 */
export function useTodaysPlan(now: number): TodaysPlan {
  const { profile, dataVersions } = useAppState();
  const examType = profile?.examType ?? 'DIGER';
  const yksArea = profile?.yksArea ?? null;
  const today = istanbulDayKey(now);
  const v = dataVersions;
  // Sessions are read only when they change (or on a new day): a topic mark or a setting does not.
  const studied = useStored(`planStudied|${today}|${v.sessions}`, () => studiedThisWeek(today));
  return useStored(
    `todaysPlan|${today}|${examType}|${yksArea}|${v.sessions}|${v.exams}|${v.topics}|${v.settings}`,
    () => todaysPlan({ examType, yksArea }, now, studied),
  );
}

export function PlanCard({
  blocks,
  onStart,
}: {
  blocks: readonly TodayPlanBlock[];
  onStart: (subjectId: string, topicId: string | null) => void;
}) {
  const c = usePalette();
  const done = blocks.filter((b) => b.done).length;
  return (
    <Card testID="plan-card">
      <View style={styles.head}>
        <Label variant="heading" style={styles.grow}>
          {tr.plan.today}
        </Label>
        {blocks.length > 0 ? (
          <Label variant="small" testID="plan-progress">
            {tr.plan.todayProgress(done, blocks.length)}
          </Label>
        ) : null}
      </View>
      {blocks.length === 0 ? (
        <Label variant="muted" testID="plan-rest">
          {tr.plan.rest}
        </Label>
      ) : (
        blocks.map((block, n) => {
          const subject = tr.subject(block.subjectId);
          const topic = topicLabel(block.topicId);
          return (
            <View key={`${block.subjectId}-${n}`} testID={`plan-block-${n}`} style={styles.block}>
              <View style={styles.dot}>
                <Dot color={subjectColor(block.subjectId, c)} />
              </View>
              <View style={styles.grow}>
                <Label style={styles.title}>{tr.plan.blockTitle(subject, block.minutes)}</Label>
                <Label variant="small">{tr.plan.blockDetail(topic, reasonText(block.reason))}</Label>
                {block.done ? (
                  <View
                    testID={`plan-block-done-${n}`}
                    accessible
                    accessibilityLabel={tr.plan.doneA11y}
                    style={styles.done}>
                    <Icon name="saved" color={c.success} size={14} />
                    <Label variant="small" style={{ color: c.success }}>
                      {tr.plan.blockDone}
                    </Label>
                  </View>
                ) : null}
              </View>
              <Button
                compact
                kind="secondary"
                testID={`plan-block-start-${n}`}
                title={tr.plan.start}
                accessibilityLabel={tr.plan.startA11y(subject, topic, block.minutes)}
                onPress={() => onStart(block.subjectId, block.topicId)}
              />
            </View>
          );
        })
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  grow: { flexGrow: 1, flexShrink: 1 },
  block: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { alignSelf: 'flex-start', paddingTop: 6 },
  title: { fontWeight: '600' },
  done: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
