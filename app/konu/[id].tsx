import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';

import { findTopic } from '@/domain/curriculum';
import { studyTargetForTopic } from '@/domain/exam-analysis';
import { istanbulDayKey } from '@/domain/istanbul-day';
import { recentTopicSessions, topicSource, topicStats } from '@/domain/topic-stats';
import { toggleStatus, type TopicStatus } from '@/domain/topics';
import { useAppState, useStored } from '@/state/app-state';
import { loadPomodoroConfig, loadTimerMode } from '@/storage/kv';
import { listAllMarks } from '@/storage/mock-exams';
import { allSessions } from '@/storage/sessions';
import { loadTopicStatuses, setTopicStatus } from '@/storage/topics';
import { tr } from '@/strings';
import { Button, Card, Chip, ChipRow, EmptyState, Label, Row, Screen } from '@/ui/components';
import { formatDay, formatStudyTime, topicLabel } from '@/ui/format';

const RECENT_SESSIONS = 10;

/** One topic: where it belongs, time spent on it, exam misses, its mark and its latest sessions. */
export default function TopicDetailScreen() {
  const app = useAppState();
  const { profile, dataVersions, notifyDataChanged } = app;
  const { id } = useLocalSearchParams<{ id: string }>();
  const topicId = typeof id === 'string' ? id : '';
  const topic = findTopic(topicId);

  const data = useStored(`${topicId}|${dataVersions.sessions}|${dataVersions.exams}|${dataVersions.topics}`, () => {
    const sessions = allSessions();
    return {
      stats: topicStats(topicId, sessions, listAllMarks()),
      recent: recentTopicSessions(topicId, sessions, RECENT_SESSIONS),
      status: loadTopicStatuses()[topicId] as TopicStatus | undefined,
    };
  });

  if (topic === undefined) {
    return (
      <Screen testID="topic-detail">
        <EmptyState testID="topic-detail-missing" body={tr.topicDetail.notFound} />
      </Screen>
    );
  }

  const name = topicLabel(topicId) ?? topic.name;
  const source = topicSource(topicId);
  const study = studyTargetForTopic(profile?.examType ?? 'DIGER', profile?.yksArea ?? null, topicId);
  const { stats } = data;

  const mark = (tapped: TopicStatus) => {
    setTopicStatus(topicId, toggleStatus(data.status, tapped), Date.now());
    notifyDataChanged('topics');
  };

  return (
    <Screen testID="topic-detail">
      <Card>
        <Label variant="title" testID="topic-detail-name">
          {name}
        </Label>
        {source !== null ? (
          <Label variant="muted" testID="topic-detail-source">
            {tr.topicDetail.source(tr.subject(source.subjectId), source.paper)}
          </Label>
        ) : null}
        {study !== null ? (
          <Button
            testID="topic-detail-start"
            title={tr.topicDetail.study}
            accessibilityHint={app.active !== null ? tr.topicDetail.studyBusy : undefined}
            disabled={app.active !== null}
            onPress={() => {
              app.start(study.subjectId, {
                topicId: study.topicId,
                pomodoro: loadTimerMode() === 'pomodoro' ? loadPomodoroConfig() : null,
              });
              router.navigate('/');
            }}
          />
        ) : null}
        {study !== null && app.active !== null ? <Label variant="small">{tr.topicDetail.studyBusy}</Label> : null}
      </Card>

      <Card>
        <Row>
          <Label style={{ flex: 1 }}>{tr.topicDetail.totalTime}</Label>
          <Label variant="heading" testID="topic-detail-time">
            {formatStudyTime(stats.totalMinutes * 60_000)}
          </Label>
        </Row>
        <Label variant="small" testID="topic-detail-session-count">
          {tr.topicDetail.sessionCount(stats.sessionCount)}
        </Label>
        <Row>
          <Label style={{ flex: 1 }}>{tr.topicDetail.lastStudied}</Label>
          <Label testID="topic-detail-last">
            {stats.lastStudiedAt === null ? tr.topicDetail.never : formatDay(istanbulDayKey(stats.lastStudiedAt))}
          </Label>
        </Row>
        <Row>
          <Label style={{ flex: 1 }}>{tr.topicDetail.wrongBlank}</Label>
          <Label testID="topic-detail-misses">{tr.topicDetail.wrongBlankValue(stats.wrong, stats.blank)}</Label>
        </Row>
        <Label variant="small">{tr.topicDetail.examCount(stats.examCount)}</Label>
      </Card>

      <Card testID="topic-detail-mark">
        <Label variant="heading">{tr.topicDetail.mark}</Label>
        <ChipRow>
          <Chip
            testID="topic-detail-done"
            title={tr.topics.done}
            accessibilityLabel={tr.topics.markA11y(name, tr.topics.done, null)}
            selected={data.status === 'done'}
            onPress={() => mark('done')}
          />
          <Chip
            testID="topic-detail-review"
            title={tr.topics.review}
            accessibilityLabel={tr.topics.markA11y(name, tr.topics.review, null)}
            selected={data.status === 'review'}
            onPress={() => mark('review')}
          />
        </ChipRow>
      </Card>

      <Card>
        <Label variant="heading">{tr.topicDetail.sessions}</Label>
        {data.recent.length === 0 ? (
          <Label variant="muted">{tr.topicDetail.sessionsEmpty}</Label>
        ) : (
          data.recent.map((s, i) => (
            <View key={s.id}>
              <Label testID={`topic-detail-session-${i}`}>
                {tr.topicDetail.sessionLine(formatDay(istanbulDayKey(s.startedAt)), formatStudyTime(s.durationMs))}
              </Label>
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}
