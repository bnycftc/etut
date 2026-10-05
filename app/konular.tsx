import { useState } from 'react';
import { View } from 'react-native';

import { topicGroupsForSubject } from '@/domain/curriculum';
import { subjectsFor } from '@/domain/subjects';
import { toggleStatus, topicProgress, type TopicStatus } from '@/domain/topics';
import { useAppState, useStored } from '@/state/app-state';
import { loadLastSubject } from '@/storage/kv';
import { topicTotals } from '@/storage/sessions';
import { loadTopicStatuses, setTopicStatus } from '@/storage/topics';
import { tr } from '@/strings';
import { Card, Chip, ChipRow, EmptyState, Label, ProgressBar, Row, Screen } from '@/ui/components';
import { formatDuration } from '@/ui/format';

/** Topic tracking: time per topic, "bitti / tekrar lazım" and progress per subject. */
export default function TopicsScreen() {
  const { profile, dataVersion, notifyDataChanged } = useAppState();
  const examType = profile?.examType ?? 'DIGER';
  const yksArea = profile?.yksArea ?? null;
  const subjects = subjectsFor(examType, yksArea).filter(
    (id) => topicGroupsForSubject(examType, yksArea, id).length > 0,
  );
  const [pickedSubject, setSubjectId] = useState<string | null>(() => {
    const last = loadLastSubject();
    return last !== null && subjects.includes(last) ? last : (subjects[0] ?? null);
  });
  // The exam or area may have changed in Settings since the pick.
  const subjectId =
    pickedSubject !== null && subjects.includes(pickedSubject) ? pickedSubject : (subjects[0] ?? null);

  const data = useStored(String(dataVersion), () => ({
    statuses: loadTopicStatuses(),
    totals: topicTotals(),
  }));

  if (subjectId === null) {
    return (
      <Screen>
        <EmptyState testID="topics-unsupported" body={tr.topics.unsupported} />
      </Screen>
    );
  }
  const firstUse = Object.keys(data.statuses).length === 0 && Object.keys(data.totals).length === 0;

  const groups = topicGroupsForSubject(examType, yksArea, subjectId);
  const all = groups.flatMap((g) => g.topics);
  const progress = topicProgress(all, data.statuses);

  const mark = (topicId: string, tapped: TopicStatus) => {
    setTopicStatus(topicId, toggleStatus(data.statuses[topicId], tapped), Date.now());
    notifyDataChanged();
  };

  return (
    <Screen testID="topics-screen">
      {firstUse ? <EmptyState testID="topics-empty" body={tr.empty.topicsBody} /> : null}
      <Card>
        <Label variant="heading">{tr.topics.pickSubject}</Label>
        <ChipRow>
          {subjects.map((id) => (
            <Chip
              key={id}
              testID={`topics-subject-${id}`}
              title={tr.subject(id)}
              selected={id === subjectId}
              onPress={() => setSubjectId(id)}
            />
          ))}
        </ChipRow>
        <Label testID="topics-progress">
          {tr.topics.progress(progress.percent, progress.done, progress.total)}
        </Label>
        <ProgressBar ratio={progress.total === 0 ? 0 : progress.done / progress.total} />
        {progress.review > 0 ? <Label variant="muted">{tr.topics.reviewCount(progress.review)}</Label> : null}
      </Card>

      {groups.map((g) => {
        const p = topicProgress(g.topics, data.statuses);
        return (
          <Card key={g.paper ?? 'all'}>
            {g.paper ? (
              <Row>
                <Label variant="heading" style={{ flex: 1 }}>
                  {g.paper}
                </Label>
                <Label variant="muted">{tr.topics.percent(p.percent)}</Label>
              </Row>
            ) : null}
            {g.topics.map((t) => {
              const status = data.statuses[t.id];
              const ms = data.totals[t.id] ?? 0;
              return (
                <View key={t.id} style={{ gap: 6, paddingVertical: 4 }}>
                  <Row>
                    <Label style={{ flex: 1 }}>{t.name}</Label>
                    <Label variant="small">{ms > 0 ? formatDuration(ms) : tr.topics.noTime}</Label>
                  </Row>
                  <ChipRow>
                    <Chip
                      testID={`topic-done-${t.id}`}
                      title={tr.topics.done}
                      selected={status === 'done'}
                      onPress={() => mark(t.id, 'done')}
                    />
                    <Chip
                      testID={`topic-review-${t.id}`}
                      title={tr.topics.review}
                      selected={status === 'review'}
                      onPress={() => mark(t.id, 'review')}
                    />
                  </ChipRow>
                </View>
              );
            })}
          </Card>
        );
      })}
    </Screen>
  );
}
