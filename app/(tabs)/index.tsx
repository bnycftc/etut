import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, Vibration, View } from 'react-native';

import { formatClock } from '@/domain/clock';
import { topicName, topicOfSubject } from '@/domain/curriculum';
import { daysUntil, resolveExamDate } from '@/domain/exam-dates';
import { goalStep, UNDO_FINISH_MS } from '@/domain/finish';
import { pomodoroStatus, type PomodoroStatus } from '@/domain/pomodoro';
import { canShareCard } from '@/domain/share-card';
import { goalRatio } from '@/domain/streak';
import { defaultSubject, subjectsFor } from '@/domain/subjects';
import { elapsedMs, isPaused } from '@/domain/timer';
import { useAppState, useNow, useStored } from '@/state/app-state';
import { useStudyStats } from '@/state/study-stats';
import {
  loadCustomExamDate,
  loadLastSubject,
  loadPomodoroConfig,
  loadTimerMode,
  storeDailyGoal,
  storeTimerMode,
  type TimerMode,
} from '@/storage/kv';
import { tr } from '@/strings';
import { isSyncActive } from '@/sync/session-sync';
import {
  Button,
  Card,
  Chip,
  ChipRow,
  Dot,
  Label,
  ListRow,
  ProgressBar,
  ResponsiveRow,
  Row,
  Screen,
  Tag,
} from '@/ui/components';
import { announce, hapticSuccess, hapticTap } from '@/ui/feedback';
import { formatDuration } from '@/ui/format';
import { GoalSheet } from '@/ui/goal-sheet';
import { Icon } from '@/ui/icon';
import { subjectColor } from '@/ui/subject-colors';
import { MAX_FONT_SCALE, space, usePalette } from '@/ui/theme';
import { FirstUseTips } from '@/ui/tips';
import { TopicPicker } from '@/ui/topic-picker';

/** A phase change seen within this time of the previous render tick happened on screen. */
const PHASE_SIGNAL_MAX_GAP_MS = 3_000;

/** What the summary after "Bitir" shows; frozen at that moment. */
interface Finished {
  /** "Kaydedildi: 45 dk" (E2E reads this text). */
  saved: string;
  subjectId: string;
  topicId: string | null;
  durationMs: number;
  /** Today's total including the session. */
  todayAfterMs: number;
  at: number;
  undoable: boolean;
}

export default function TimerScreen() {
  const app = useAppState();
  const { active, profile } = app;
  const c = usePalette();
  const running = active !== null && !isPaused(active);
  const now = useNow(running);

  const examType = profile?.examType ?? 'DIGER';
  const yksArea = profile?.yksArea ?? null;
  const [pickedSubject, setSubjectIdState] = useState(() =>
    defaultSubject(examType, loadLastSubject(), yksArea),
  );
  // The exam or area can change in Settings while this tab stays mounted.
  const subjects = subjectsFor(examType, yksArea);
  const subjectId = subjects.includes(pickedSubject)
    ? pickedSubject
    : defaultSubject(examType, loadLastSubject(), yksArea);
  const [pickedTopic, setTopicId] = useState<string | null>(null);
  const topicId = topicOfSubject(examType, yksArea, subjectId, pickedTopic);
  const [finished, setFinished] = useState<Finished | null>(null);
  const [goalOpen, setGoalOpen] = useState(false);
  const [mode, setModeState] = useState<TimerMode>(loadTimerMode);
  const setSubjectId = (id: string) => {
    if (id !== subjectId) setTopicId(null);
    setSubjectIdState(id);
  };
  const setMode = (m: TimerMode) => {
    storeTimerMode(m);
    setModeState(m);
  };
  const pomodoroConfig = useStored(`pomodoro|${app.dataVersion}`, loadPomodoroConfig);

  const { today, todayTotal, todayManual, comparison, goal, streak } = useStudyStats(now);
  const customExamDay = useStored(`examDate|${examType}|${app.dataVersion}`, () =>
    loadCustomExamDate(examType),
  );
  const examDate = resolveExamDate(examType, customExamDay);
  const daysLeft = examDate === null ? null : daysUntil(examDate.day, today);
  // The render clock ticks once a second; never show a moment before the last "Molayı geç".
  const lastSkipAt = active?.pomodoro?.skips[active.pomodoro.skips.length - 1]?.at ?? 0;
  const shownNow = Math.max(now, lastSkipAt);
  const pomodoro = active === null ? null : pomodoroStatus(active, shownNow);
  const onBreak = pomodoro !== null && pomodoro.phase !== 'work';
  const clockMs = active === null ? 0 : pomodoro !== null ? pomodoro.remainingMs : elapsedMs(active, shownNow);

  // A short vibration when a pomodoro phase ends while the student is looking at the app (the
  // scheduled phase notification is not shown in the foreground). Not after returning from the
  // background (big time jump) and not for a change the student made ("Molayı geç"). The new
  // phase is read out by VoiceOver in both cases.
  const phaseKey = pomodoro === null ? null : `${pomodoro.block}|${pomodoro.phase}`;
  const lastPhase = useRef({ key: phaseKey, at: shownNow });
  const skipped = useRef(false);
  useEffect(() => {
    const prev = lastPhase.current;
    const changed = phaseKey !== null && prev.key !== null && phaseKey !== prev.key;
    const foreground = AppState.currentState !== 'background';
    if (changed && !skipped.current && shownNow - prev.at <= PHASE_SIGNAL_MAX_GAP_MS && foreground) {
      Vibration.vibrate();
    }
    if (changed && foreground && pomodoro !== null) {
      announce(tr.announce.phase(pomodoroPhaseLabel(pomodoro, active?.pomodoro?.config.longEvery ?? 4)));
    }
    if (changed) skipped.current = false;
    lastPhase.current = { key: phaseKey, at: shownNow };
  }, [phaseKey, shownNow]);
  const skipBreak = () => {
    skipped.current = true;
    app.skipBreak();
  };

  // The "you were away" card appears without any tap: tell screen reader users what happened.
  const awayStart = active?.pendingAway?.start ?? null;
  useEffect(() => {
    const away = active?.pendingAway;
    if (away) announce(tr.announce.away(tr.timer.awayTitle(formatAway(away.end - away.start)), tr.timer.awayBody));
  }, [awayStart]);

  // "Geri al" disappears when its window closes.
  useEffect(() => {
    if (finished === null || !finished.undoable) return;
    const id = setTimeout(
      () => setFinished((f) => (f === null ? f : { ...f, undoable: false })),
      Math.max(0, finished.at + UNDO_FINISH_MS - Date.now()),
    );
    return () => clearTimeout(id);
  }, [finished?.at, finished?.undoable]);

  const finish = () => {
    const done = app.finish();
    if (done !== null) {
      const saved = tr.timer.saved(
        done.durationMs < 60_000 ? tr.timer.lessThanMinute : formatDuration(done.durationMs),
      );
      setFinished({
        saved,
        subjectId: done.subjectId,
        topicId: done.topicId,
        durationMs: done.durationMs,
        // The running session was already part of today's total on this render.
        todayAfterMs: todayTotal,
        at: Date.now(),
        undoable: done.durationMs > 0 && !isSyncActive(),
      });
      setSubjectId(done.subjectId);
      hapticSuccess();
      announce(tr.finish.announce(saved, formatDuration(todayTotal)));
    }
  };

  const undo = () => {
    if (app.undoFinish()) {
      setFinished(null);
      hapticTap();
      announce(tr.finish.undone);
    } else {
      setFinished((f) => (f === null ? f : { ...f, undoable: false }));
    }
  };

  const setGoal = (minutes: number | null) => {
    storeDailyGoal(minutes);
    app.notifyDataChanged();
  };

  const goalStreak = goal !== null && streak !== null ? { goal, streak } : null;
  const step = finished !== null && goal !== null ? goalStep(finished.todayAfterMs, finished.durationMs, goal) : null;

  return (
    <Screen testID="timer-screen">
      <FirstUseTips />
      <GoalSheet visible={goalOpen} goal={goal} onChange={setGoal} onClose={() => setGoalOpen(false)} />

      {/* Today: exam countdown, today's total, goal and streak; the summary after Bitir lives here too. */}
      <Card tone="accent">
        {examDate !== null && daysLeft !== null && daysLeft >= 0 ? (
          <Row>
            <Label testID="countdown" style={{ fontWeight: '700', flex: 1, color: c.accent }}>
              {daysLeft === 0 ? tr.countdown.today : tr.countdown.days(examType, daysLeft)}
            </Label>
            {examDate.estimated ? <Tag title={tr.countdown.estimated} /> : null}
          </Row>
        ) : null}

        {finished !== null ? (
          <View testID="finish-summary" style={{ gap: space.xs }}>
            <ResponsiveRow>
              <View style={[styles.inline, styles.grow]}>
                <Icon name="saved" color={c.success} />
                <Label variant="heading" testID="timer-saved" style={{ color: c.success, flexShrink: 1 }}>
                  {finished.saved}
                </Label>
              </View>
              {finished.undoable ? (
                <Button
                  compact
                  testID="finish-undo"
                  kind="secondary"
                  title={tr.finish.undo}
                  accessibilityHint={tr.finish.undoHint}
                  onPress={undo}
                />
              ) : null}
            </ResponsiveRow>
            <Label variant="small" testID="finish-detail">
              {(topicName(finished.topicId)
                ? tr.finish.studiedTopic(tr.subject(finished.subjectId), topicName(finished.topicId) ?? '')
                : tr.finish.studied(tr.subject(finished.subjectId))) +
                (step !== null && !step.reached ? ` · ${tr.finish.goalStep(step.beforePercent, step.afterPercent)}` : '')}
            </Label>
            {step?.reached ? (
              <Label variant="small" testID="finish-goal-reached" style={{ color: c.success, fontWeight: '600' }}>
                {tr.finish.goalReached}
                {streak !== null && streak.current > 0 ? ` ${tr.finish.streak(streak.current)}` : ''}
              </Label>
            ) : null}
          </View>
        ) : null}

        <ResponsiveRow>
          <View style={styles.grow}>
            <Label variant="muted">{tr.timer.today}</Label>
            <Label variant="title" testID="today-total">
              {formatDuration(todayTotal)}
            </Label>
            {todayManual > 0 ? (
              <Label variant="small">{tr.timer.manualPart(formatDuration(todayManual))}</Label>
            ) : null}
          </View>
          {goalStreak !== null ? (
            <View style={styles.inline}>
              <Icon name="streak" color={c.streak} size={20} />
              <Label testID="streak" style={{ color: c.streak, fontWeight: '700' }}>
                {tr.goal.streak(goalStreak.streak.current)}
              </Label>
            </View>
          ) : (
            <Button
              compact
              testID="goal-set"
              kind="secondary"
              title={tr.goal.set}
              onPress={() => setGoalOpen(true)}
            />
          )}
        </ResponsiveRow>
        {goalStreak !== null ? (
          <>
            <ProgressBar ratio={goalRatio(todayTotal, goalStreak.goal)} label={tr.goal.title} />
            <ResponsiveRow>
              <Label testID="goal-progress" variant="small" style={styles.grow}>
                {goalStreak.streak.todayMet
                  ? tr.goal.met
                  : tr.goal.progress(
                      formatDuration(goalStreak.goal * 60_000),
                      Math.floor(goalRatio(todayTotal, goalStreak.goal) * 100),
                    )}
              </Label>
              <Button
                compact
                testID="goal-edit"
                kind="secondary"
                title={tr.home.goalEdit}
                accessibilityLabel={tr.home.goalEditA11y}
                onPress={() => setGoalOpen(true)}
              />
            </ResponsiveRow>
          </>
        ) : null}
      </Card>

      {active?.pendingAway ? (
        <Card>
          <Label testID="away-title" style={{ color: c.warning, fontWeight: '600' }}>
            {tr.timer.awayTitle(formatAway(active.pendingAway.end - active.pendingAway.start))}
          </Label>
          <Label variant="muted">{tr.timer.awayBody}</Label>
          <Button testID="away-credit" title={tr.timer.awayCredit} onPress={app.creditAway} />
          <Button
            testID="away-dismiss"
            kind="secondary"
            title={tr.timer.awayDismiss}
            onPress={app.dismissAway}
          />
        </Card>
      ) : null}

      {active === null ? (
        <>
          {/* Core loop: pick a subject (last one is pre-selected), tap Başla. Topic and mode are optional. */}
          <Card>
            <Label variant="heading">{tr.timer.pickSubject}</Label>
            <ChipRow>
              {subjects.map((id) => (
                <Chip
                  key={id}
                  testID={`subject-${id}`}
                  title={tr.subject(id)}
                  color={subjectColor(id, c)}
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
            <View style={styles.modeRow}>
              <Label variant="small">{tr.pomodoro.mode}</Label>
              <Chip
                testID="mode-stopwatch"
                title={tr.pomodoro.stopwatch}
                selected={mode === 'stopwatch'}
                onPress={() => setMode('stopwatch')}
              />
              <Chip
                testID="mode-pomodoro"
                title={tr.pomodoro.pomodoro}
                selected={mode === 'pomodoro'}
                onPress={() => setMode('pomodoro')}
              />
            </View>
            {mode === 'pomodoro' ? (
              <Label variant="small">
                {tr.pomodoro.summary(
                  pomodoroConfig.workMin,
                  pomodoroConfig.shortBreakMin,
                  pomodoroConfig.longBreakMin,
                  pomodoroConfig.longEvery,
                )}
              </Label>
            ) : null}
          </Card>
          <Button
            large
            testID="timer-start"
            title={tr.timer.start}
            onPress={() => {
              setFinished(null);
              hapticTap();
              app.start(subjectId, { topicId, pomodoro: mode === 'pomodoro' ? pomodoroConfig : null });
            }}
          />
        </>
      ) : (
        <Card outline={running && !onBreak ? subjectColor(active.subjectId, c) : c.controlBorder}>
          <View style={[styles.inline, { justifyContent: 'center' }]}>
            <Dot color={subjectColor(active.subjectId, c)} />
            <Label variant="muted" testID="timer-subject" style={{ textAlign: 'center', flexShrink: 1 }}>
              {tr.subject(active.subjectId)}
              {topicName(active.topicId) ? ` · ${topicName(active.topicId)}` : ''}
            </Label>
          </View>
          {pomodoro !== null ? (
            <Label testID="pomodoro-phase" variant="heading" style={{ textAlign: 'center' }}>
              {pomodoroPhaseLabel(pomodoro, active.pomodoro?.config.longEvery ?? 4)}
            </Label>
          ) : null}
          <Text
            testID="timer-clock"
            accessibilityRole="timer"
            maxFontSizeMultiplier={MAX_FONT_SCALE.clock}
            style={[styles.clock, { color: running && !onBreak ? c.text : c.textMuted }]}
            numberOfLines={1}
            adjustsFontSizeToFit>
            {formatClock(clockMs)}
          </Text>
          <View
            style={[
              styles.pill,
              { backgroundColor: running && !onBreak ? c.successSoft : 'transparent' },
            ]}>
            <Label
              testID="timer-status"
              style={{
                textAlign: 'center',
                fontWeight: '600',
                color: !running ? c.warning : onBreak ? c.textMuted : c.success,
              }}>
              {pomodoro !== null
                ? running
                  ? tr.pomodoro.studied(formatClock(elapsedMs(active, shownNow)))
                  : tr.pomodoro.paused
                : running
                  ? tr.timer.running
                  : tr.timer.paused}
            </Label>
          </View>
          {pomodoro !== null && pomodoro.phase !== 'work' ? (
            <>
              <Label variant="small" style={{ textAlign: 'center' }}>
                {tr.pomodoro.breakNote}
              </Label>
              {running ? (
                <Button testID="pomodoro-skip" kind="secondary" title={tr.pomodoro.skip} onPress={skipBreak} />
              ) : null}
            </>
          ) : null}
          <ResponsiveRow>
            {running ? (
              <Button
                large
                testID="timer-pause"
                kind="secondary"
                title={tr.timer.pause}
                onPress={app.pause}
              />
            ) : (
              <Button
                large
                testID="timer-resume"
                title={tr.timer.resume}
                onPress={() => {
                  hapticTap();
                  app.resume();
                }}
              />
            )}
            <Button large testID="timer-finish" kind="danger" title={tr.timer.finish} onPress={finish} />
          </ResponsiveRow>
        </Card>
      )}

      {/* Secondary: everything that is not "pick a subject and start". Geçmiş is in the header. */}
      <Card>
        <Label variant="heading">{tr.home.shortcuts}</Label>
        {active === null ? (
          <>
            <ListRow
              icon="manual"
              testID="open-manual"
              title={tr.timer.addManual}
              onPress={() => router.push('/elle-ekle')}
            />
            <ListRow icon="topics" testID="open-topics" title={tr.timer.topics} onPress={() => router.push('/konular')} />
          </>
        ) : null}
        <ListRow icon="weekly" testID="open-weekly" title={tr.compare.weekly} onPress={() => router.push('/haftalik')} />
        {canShareCard(profile) ? (
          <ListRow icon="share" testID="open-share" title={tr.share.open} onPress={() => router.push('/paylas')} />
        ) : null}
      </Card>

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
      </Card>
    </Screen>
  );
}

function pomodoroPhaseLabel(status: PomodoroStatus, longEvery: number): string {
  if (status.phase === 'short_break') return tr.pomodoro.shortBreak;
  if (status.phase === 'long_break') return tr.pomodoro.longBreak;
  return tr.pomodoro.work(status.blockInSet, longEvery);
}

function CompareRow({ label, value, testID }: { label: string; value: number; testID?: string }) {
  return (
    <ResponsiveRow>
      <Label variant="muted" style={styles.grow}>
        {label}
      </Label>
      <Label testID={testID}>{formatDuration(value)}</Label>
    </ResponsiveRow>
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
  grow: { flexGrow: 1, flexShrink: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  pill: { alignSelf: 'center', borderRadius: 999, paddingHorizontal: space.md, paddingVertical: 2 },
});
