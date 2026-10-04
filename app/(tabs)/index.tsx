import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatClock } from '@/domain/clock';
import { topicName } from '@/domain/curriculum';
import { goalRatio } from '@/domain/streak';
import { defaultSubject, SUBJECTS_BY_EXAM } from '@/domain/subjects';
import { elapsedMs, isPaused } from '@/domain/timer';
import { useAppState, useNow } from '@/state/app-state';
import { useStudyStats } from '@/state/study-stats';
import { loadLastSubject } from '@/storage/kv';
import { tr } from '@/strings';
import { Button, Card, Chip, ChipRow, Label, ProgressBar, Row, Screen } from '@/ui/components';
import { formatDuration } from '@/ui/format';
import { usePalette } from '@/ui/theme';
import { TopicPicker } from '@/ui/topic-picker';

export default function TimerScreen() {
  const app = useAppState();
  const { active, profile } = app;
  const c = usePalette();
  const running = active !== null && !isPaused(active);
  const now = useNow(running);

  const examType = profile?.examType ?? 'DIGER';
  const yksArea = profile?.yksArea ?? null;
  const [subjectId, setSubjectIdState] = useState(() => defaultSubject(examType, loadLastSubject()));
  const [topicId, setTopicId] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const setSubjectId = (id: string) => {
    if (id !== subjectId) setTopicId(null);
    setSubjectIdState(id);
  };

  const { todayTotal, todayManual, comparison, goal, streak } = useStudyStats(now);

  const finish = () => {
    const done = app.finish();
    if (done !== null) {
      setSavedMessage(
        tr.timer.saved(done.durationMs < 60_000 ? tr.timer.lessThanMinute : formatDuration(done.durationMs)),
      );
      setSubjectId(done.subjectId);
    }
  };

  return (
    <Screen>
      <Card>
        <Row>
          <View style={{ flex: 1 }}>
            <Label variant="muted">{tr.timer.today}</Label>
            <Label variant="heading">{formatDuration(todayTotal)}</Label>
            {todayManual > 0 ? (
              <Label variant="small">{tr.timer.manualPart(formatDuration(todayManual))}</Label>
            ) : null}
          </View>
          <View>
            <Button kind="secondary" title={tr.timer.history} onPress={() => router.push('/gecmis')} />
          </View>
        </Row>
        {goal !== null && streak !== null ? (
          <>
            <ProgressBar ratio={goalRatio(todayTotal, goal)} />
            <Label testID="goal-progress" variant="small">
              {streak.todayMet
                ? tr.goal.met
                : tr.goal.progress(formatDuration(goal * 60_000), Math.floor(goalRatio(todayTotal, goal) * 100))}
            </Label>
            <Label testID="streak">{tr.goal.streak(streak.current)}</Label>
            <Label variant="small">{streak.restUsedThisWeek ? tr.goal.restUsed : tr.goal.restFree}</Label>
          </>
        ) : (
          <Row>
            <Button
              testID="goal-set"
              kind="secondary"
              title={tr.goal.set}
              onPress={() => router.push('/ayarlar')}
            />
          </Row>
        )}
      </Card>

      {active?.pendingAway ? (
        <Card>
          <Label style={{ color: c.warning, fontWeight: '600' }}>
            {tr.timer.awayTitle(formatAway(active.pendingAway.end - active.pendingAway.start))}
          </Label>
          <Label variant="muted">{tr.timer.awayBody}</Label>
          <Button title={tr.timer.awayCredit} onPress={app.creditAway} />
          <Button kind="secondary" title={tr.timer.awayDismiss} onPress={app.dismissAway} />
        </Card>
      ) : null}

      {active === null ? (
        <>
          <Card>
            <Label variant="heading">{tr.timer.pickSubject}</Label>
            <ChipRow>
              {SUBJECTS_BY_EXAM[examType].map((id) => (
                <Chip
                  key={id}
                  testID={`subject-${id}`}
                  title={tr.subject(id)}
                  selected={id === subjectId}
                  onPress={() => setSubjectId(id)}
                />
              ))}
            </ChipRow>
            <TopicPicker
              examType={examType}
              yksArea={yksArea}
              subjectId={subjectId}
              topicId={topicId}
              onChange={setTopicId}
            />
          </Card>
          <Button
            large
            title={tr.timer.start}
            onPress={() => {
              setSavedMessage(null);
              app.start(subjectId, { topicId });
            }}
          />
          {savedMessage ? <Label variant="muted">{savedMessage}</Label> : null}
          <Row>
            <Button
              testID="open-manual"
              kind="secondary"
              title={tr.timer.addManual}
              onPress={() => router.push('/elle-ekle')}
            />
            <Button
              testID="open-topics"
              kind="secondary"
              title={tr.timer.topics}
              onPress={() => router.push('/konular')}
            />
          </Row>
        </>
      ) : (
        <Card>
          <Label variant="muted" style={{ textAlign: 'center' }}>
            {tr.subject(active.subjectId)}
            {topicName(active.topicId) ? ` · ${topicName(active.topicId)}` : ''}
          </Label>
          <Text
            accessibilityRole="timer"
            style={[styles.clock, { color: running ? c.text : c.textMuted }]}
            numberOfLines={1}
            adjustsFontSizeToFit>
            {formatClock(elapsedMs(active, now))}
          </Text>
          <Label variant="muted" style={{ textAlign: 'center' }}>
            {running ? tr.timer.running : tr.timer.paused}
          </Label>
          <Row>
            {running ? (
              <Button large kind="secondary" title={tr.timer.pause} onPress={app.pause} />
            ) : (
              <Button large title={tr.timer.resume} onPress={app.resume} />
            )}
            <Button large kind="danger" title={tr.timer.finish} onPress={finish} />
          </Row>
        </Card>
      )}

      <Card>
        <Label variant="heading">{tr.compare.title}</Label>
        <CompareRow
          testID="compare-yesterday"
          label={tr.compare.yesterday}
          value={comparison.yesterdaySameTime}
        />
        <CompareRow label={tr.compare.thisWeek} value={comparison.thisWeek} />
        <CompareRow
          testID="compare-last-week"
          label={tr.compare.lastWeek}
          value={comparison.lastWeekSameTime}
        />
        <Button
          testID="open-weekly"
          kind="secondary"
          title={tr.compare.weekly}
          onPress={() => router.push('/haftalik')}
        />
      </Card>
    </Screen>
  );
}

function CompareRow({ label, value, testID }: { label: string; value: number; testID?: string }) {
  return (
    <Row>
      <Label variant="muted" style={{ flex: 1 }}>
        {label}
      </Label>
      <Label testID={testID}>{formatDuration(value)}</Label>
    </Row>
  );
}

function formatAway(ms: number): string {
  return ms < 60_000 ? tr.timer.lessThanMinute : formatDuration(ms);
}

const styles = StyleSheet.create({
  clock: {
    fontSize: 80,
    fontWeight: '200',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
});
