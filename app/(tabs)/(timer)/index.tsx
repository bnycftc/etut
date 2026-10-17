import { router } from 'expo-router';
import { Fragment, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';

import { clockParts, formatClock } from '@/domain/clock';
import { comparisonLine, type ComparisonLine } from '@/domain/compare';
import { topicOfSubject } from '@/domain/curriculum';
import { activeSpan, dailyTotals } from '@/domain/daily-totals';
import { examDaysLeft, resolveExamDate } from '@/domain/exam-dates';
import { goalStep, topicMarkToRestore, UNDO_FINISH_MS } from '@/domain/finish';
import { pomodoroStatus, type PomodoroStatus } from '@/domain/pomodoro';
import { canShareCard } from '@/domain/share-card';
import { goalRatio } from '@/domain/streak';
import { defaultSubject, quickSubjects, subjectsFor } from '@/domain/subjects';
import { elapsedMs, isPaused } from '@/domain/timer';
import { type TimedTopicStatus, toggleStatus, type TopicStatus } from '@/domain/topics';
import { type FinishOptions, useAppState, useNow, useStored } from '@/state/app-state';
import { useReviewAfterFinish } from '@/state/review-prompt';
import { useStudyStats } from '@/state/study-stats';
import {
  loadCustomExamDate,
  loadLastSubject,
  loadPomodoroConfig,
  loadTimerMode,
  storeTimerMode,
  type TimerMode,
} from '@/storage/kv';
import { tr } from '@/strings';
import { setSessionQuestions } from '@/storage/report';
import { loadTopicMark, setTopicStatus } from '@/storage/topics';
import { isSyncActive } from '@/sync/session-sync';
import {
  Button,
  Card,
  Chip,
  ChipRow,
  Dot,
  Label,
  ListRow,
  ResponsiveRow,
  Screen,
  Section,
} from '@/ui/components';
import { BackupNudge } from '@/ui/backup-reminder';
import { announce, hapticSuccess, hapticTap } from '@/ui/feedback';
import { SavedMark } from '@/ui/finish-moment';
import { formatDuration, topicLabel } from '@/ui/format';
import { Icon } from '@/ui/icon';
import { InfoLink } from '@/ui/info-link';
import { easeNextLayout, useReducedMotion } from '@/ui/motion';
import { Ring } from '@/ui/ring';
import { subjectColor, subjectTint } from '@/ui/subject-colors';
import { MAX_FONT_SCALE, ROUNDED_FONT, space, typography, useLargeText, usePalette } from '@/ui/theme';
import { QuestionCount } from '@/ui/question-count';
import { awayCardText, TimerKeepAwake, useFinishCheck } from '@/ui/timer-safety';
import { FirstUseTips } from '@/ui/tips';
import { TopicPicker } from '@/ui/topic-picker';
import { noteFinishForWidgetTip, WidgetTip } from '@/ui/widget-tip';

/** A phase change seen within this time of the previous render tick happened on screen. */
const PHASE_SIGNAL_MAX_GAP_MS = 3_000;

/** Around the goal line on the "Bugün" card (13 pt text, 15–16 pt tall): a touch target of 44 pt or more. */
const GOAL_LINE_SLOP = { top: 15, bottom: 15 };

/** What the summary after "Bitir" shows; frozen at that moment. */
interface Finished {
  /** The saved session (for the optional question count). */
  id: string;
  /** "Kaydedildi: 45 dk": what VoiceOver says for the saved time (E2E reads this label). */
  saved: string;
  /** The big number on screen: "45 dk". */
  duration: string;
  subjectId: string;
  topicId: string | null;
  durationMs: number;
  /** Today's total including the session as saved. */
  todayAfterMs: number;
  /** The part of the saved session that fell on today (a session can cross midnight). */
  sessionTodayMs: number;
  at: number;
  undoable: boolean;
  /**
   * The topic's mark before the first "Bitti" / "Tekrar lazım" tap in the summary; "Geri al" puts
   * it back. `undefined` = no tap yet (`null` = the topic had no mark).
   */
  topicBefore?: TimedTopicStatus | null;
}

export default function TimerScreen() {
  const app = useAppState();
  const { active, profile } = app;
  const c = usePalette();
  const reduceMotion = useReducedMotion();
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
  // Stored, not screen state: a restored backup brings its own timer mode.
  const mode = useStored(`timerMode|${app.dataVersions.settings}`, loadTimerMode);
  const setSubjectId = (id: string) => {
    if (id !== subjectId) setTopicId(null);
    setSubjectIdState(id);
  };
  const setMode = (m: TimerMode) => {
    storeTimerMode(m);
    app.notifyDataChanged('settings');
  };
  const pomodoroConfig = useStored(`pomodoro|${app.dataVersions.settings}`, loadPomodoroConfig);

  const { today, todayTotal, todayManual, todayQuestions, comparison, goal, streak, studyDays, recentSubjects } =
    useStudyStats(now);
  const large = useLargeText();
  const compare = comparisonLine(comparison);
  const customExamDay = useStored(`examDate|${examType}|${app.dataVersions.settings}`, () =>
    loadCustomExamDate(examType),
  );
  const examDate = resolveExamDate(examType, customExamDay, today);
  const daysLeft = examDate === null ? null : examDaysLeft(examDate, today);
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
  const away = active?.pendingAway ? awayCardText(active) : null;
  const awayTitle = away?.title ?? '';
  const awayBody = away?.body ?? '';
  useEffect(() => {
    if (away !== null) announce(tr.announce.away(awayTitle, awayBody));
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

  const finish = (options?: FinishOptions) => {
    const done = app.finish(options);
    if (done !== null) {
      // This render's total holds the running session as it was shown; the saved one can differ
      // ("Çalışıyordum" adds the time away, "İlk 10 saati kaydet" cuts it): swap one for the other.
      const runningTodayMs = active === null ? 0 : dailyTotals([activeSpan(active, now)], [today])[0].totalMs;
      const sessionTodayMs = dailyTotals([done], [today])[0].totalMs;
      const todayAfterMs = Math.max(0, todayTotal - runningTodayMs) + sessionTodayMs;
      const duration = done.durationMs < 60_000 ? tr.timer.lessThanMinute : formatDuration(done.durationMs);
      const saved = tr.timer.saved(duration);
      const reached = goal !== null && goalStep(todayAfterMs, sessionTodayMs, goal).reached;
      // Running card out, summary in: one eased layout change instead of a jump.
      easeNextLayout(reduceMotion);
      setFinished({
        id: done.id,
        saved,
        duration,
        subjectId: done.subjectId,
        topicId: done.topicId,
        durationMs: done.durationMs,
        todayAfterMs,
        sessionTodayMs,
        at: Date.now(),
        undoable: done.durationMs > 0 && !isSyncActive(),
      });
      setSubjectId(done.subjectId);
      noteFinishForWidgetTip(done.durationMs);
      hapticSuccess();
      announce(tr.finish.announce(saved, formatDuration(todayAfterMs), reached));
    }
  };
  const finishCheck = useFinishCheck(finish);
  // App Store rating (X-7): after a session that keeps a 7-day goal streak, once "Geri al" is gone.
  useReviewAfterFinish(finished !== null && !finished.undoable ? finished : null, streak?.todayMet ? streak.current : 0);

  // "Bitti" / "Tekrar lazım" for the topic of the session just saved: the stored mark (also one set
  // on Konular in the meantime) shows on the chips.
  const finishedTopicId = finished !== null && topicLabel(finished.topicId) !== null ? finished.topicId : null;
  const finishedTopicStatus = useStored(`finishTopic|${finishedTopicId}|${app.dataVersions.topics}`, () =>
    finishedTopicId === null ? null : (loadTopicMark(finishedTopicId)?.status ?? null),
  );
  const markTopic = (tapped: TopicStatus) => {
    if (finished === null || finishedTopicId === null) return;
    // The mark from before the first tap is kept for "Geri al".
    const before = finished.topicBefore !== undefined ? finished.topicBefore : loadTopicMark(finishedTopicId);
    setTopicStatus(finishedTopicId, toggleStatus(finishedTopicStatus ?? undefined, tapped), Date.now());
    setFinished((f) => (f === null || f.topicBefore !== undefined ? f : { ...f, topicBefore: before }));
    app.notifyDataChanged('topics');
  };

  const undo = () => {
    const marked = finished;
    if (app.undoFinish()) {
      if (marked !== null && marked.topicId !== null && marked.topicBefore !== undefined) {
        const restore = topicMarkToRestore(marked.topicBefore, Date.now());
        setTopicStatus(marked.topicId, restore.status, restore.at);
        app.notifyDataChanged('topics');
      }
      easeNextLayout(reduceMotion);
      setFinished(null);
      hapticTap();
      announce(tr.finish.undone);
    } else {
      setFinished((f) => (f === null ? f : { ...f, undoable: false }));
    }
  };

  const goalStreak = goal !== null && streak !== null ? { goal, streak } : null;
  const step = finished !== null && goal !== null ? goalStep(finished.todayAfterMs, finished.sessionTodayMs, goal) : null;
  // The summary of the session that reached the goal: the day's one celebration (K-14).
  const stepReached = step?.reached === true;
  const goalShare = goalStreak === null ? 0 : goalRatio(todayTotal, goalStreak.goal);
  const goalPercent = Math.floor(goalShare * 100);
  const goalLine =
    goalStreak === null
      ? ''
      : goalStreak.streak.todayMet
        ? tr.goal.met
        : tr.goal.progress(formatDuration(goalStreak.goal * 60_000), goalPercent);
  const openGoal = () => router.push('/hedef');
  // No badge before the first day that meets the goal: never a "0" (and no loss to read into it).
  const streakDays = goalStreak !== null && goalStreak.streak.current > 0 ? goalStreak.streak.current : null;

  // The card's top line: the exam countdown (or that its date has passed), muted.
  const estimated = examDate?.estimated === true;
  const countdown =
    examDate !== null && daysLeft !== null && daysLeft >= 0 ? (
      <View style={[styles.inline, styles.grow]}>
        <Text
          testID="countdown"
          accessibilityLabel={daysLeft === 0 ? undefined : tr.countdown.lineA11y(examType, daysLeft, estimated)}
          style={[styles.countdown, { color: c.textMuted }]}>
          {daysLeft === 0
            ? estimated
              ? tr.countdown.todayEstimated
              : tr.countdown.today
            : tr.countdown.line(examType, daysLeft, estimated)}
        </Text>
        {estimated ? <InfoLink testID="countdown-info" section="tarih" term={tr.infoLink.estimated} /> : null}
      </View>
    ) : daysLeft !== null ? (
      // The date (built-in estimate or the student's) is behind us: say so instead of hiding it.
      <Label testID="countdown-passed" variant="muted" style={styles.grow}>
        {tr.countdownPassed}
      </Label>
    ) : null;

  // The card's one ring: today's share of the goal, idle and after Bitir. In the summary of the
  // session that reached the goal it fills from where the day stood to 100 % once, in the success
  // colour with the seal. It opens the goal sheet, as the goal line does (both are announced:
  // every touch target is a named control). Without a goal: the button that sets one.
  const ring =
    goalStreak !== null ? (
      <Pressable
        testID="goal-ring"
        accessibilityRole="button"
        accessibilityLabel={tr.goal.title}
        accessibilityValue={{ text: `%${stepReached ? 100 : goalPercent}` }}
        accessibilityHint={tr.home.goalEditA11y}
        onPress={openGoal}
        style={({ pressed }) => [{ alignSelf: large ? 'flex-start' : 'center', opacity: pressed ? 0.6 : 1 }]}>
        <Ring
          testID="goal-ring-progress"
          ratio={stepReached ? 1 : goalShare}
          color={stepReached || goalStreak.streak.todayMet ? c.success : c.accent}
          track={c.barSoft}
          fillFrom={stepReached && step !== null ? step.beforePercent / 100 : undefined}>
          {stepReached ? <Icon name="goalDone" color={c.success} size={28} /> : null}
        </Ring>
      </Pressable>
    ) : (
      <Button compact testID="goal-set" kind="secondary" title={tr.goal.set} onPress={openGoal} />
    );

  return (
    <Screen testID="timer-screen">
      <TimerKeepAwake running={running} />
      <FirstUseTips />

      {/* Today, the one hero of the screen: one big number and one ring under a muted countdown
          line and the streak badge. Idle the number is today's total; right after Bitir it is the
          time just saved, and today's total steps down to a muted line. */}
      <Card tone="hero" testID="today-card">
        {countdown !== null || streakDays !== null ? (
          <View style={styles.heroHead}>
            <View style={large ? styles.heroTopStack : styles.heroTop}>
              {countdown}
              {streakDays !== null ? (
                <View
                  testID="streak"
                  accessible
                  accessibilityLabel={tr.goal.streak(streakDays)}
                  style={[styles.badge, large ? null : styles.badgeEnd, { backgroundColor: c.surface }]}>
                  <Icon name="streak" color={c.streak} size={16} />
                  <Text style={[styles.badgeText, { color: c.streak }]}>{tr.goal.streakBadge(streakDays)}</Text>
                </View>
              ) : null}
            </View>
            {streakDays !== null ? (
              <View style={[styles.inline, large ? null : styles.toEnd]}>
                <Label variant="small" testID="streak-rest" style={{ flexShrink: 1, textAlign: large ? 'left' : 'right' }}>
                  {tr.goal.restRule}
                </Label>
                <InfoLink testID="streak-info" section="seri" term={tr.infoLink.streak} />
              </View>
            ) : null}
          </View>
        ) : null}

        {finished !== null ? (
          <View testID="finish-summary" style={{ gap: space.sm }}>
            <ResponsiveRow>
              <View style={[styles.grow, { gap: space.xs }]}>
                <View style={styles.inline}>
                  <SavedMark />
                  <View testID="timer-saved" accessible accessibilityLabel={finished.saved} style={styles.grow}>
                    <Label variant="muted">{tr.finish.savedTitle}</Label>
                    <Label variant="display">{finished.duration}</Label>
                  </View>
                </View>
                {stepReached ? (
                  <Text testID="finish-goal-reached" style={[typography.heading, { color: c.text, flexShrink: 1 }]}>
                    {tr.finish.goalReached}
                  </Text>
                ) : null}
                {/* Separate texts, not one sentence: E2E finds today-total by its id on iOS too. */}
                <View testID="finish-today" style={styles.todayLine}>
                  <Label variant="muted">{tr.timer.today}</Label>
                  <Label variant="muted" testID="today-total">
                    {formatDuration(todayTotal)}
                  </Label>
                  {todayQuestions > 0 ? (
                    <Label variant="muted" testID="today-questions">
                      {tr.timer.todayQuestions(todayQuestions)}
                    </Label>
                  ) : null}
                  {goalStreak !== null ? (
                    <Label variant="muted">{tr.finish.todayGoal(formatDuration(goalStreak.goal * 60_000))}</Label>
                  ) : null}
                </View>
              </View>
              {ring}
            </ResponsiveRow>
            <Label variant="muted" testID="finish-detail">
              {(topicLabel(finished.topicId)
                ? tr.finish.studiedTopic(tr.subject(finished.subjectId), topicLabel(finished.topicId) ?? '')
                : tr.finish.studied(tr.subject(finished.subjectId))) +
                (step !== null && !step.reached ? ` · ${tr.finish.goalStep(step.beforePercent, step.afterPercent)}` : '')}
            </Label>
            {finishedTopicId !== null ? (
              <View style={{ gap: space.xs }}>
                <Label variant="small">{tr.finish.topicMark}</Label>
                <ChipRow>
                  {(['done', 'review'] as const).map((status) => {
                    const title = status === 'done' ? tr.topics.done : tr.topics.review;
                    return (
                      <Chip
                        key={status}
                        testID={`finish-topic-${status}`}
                        title={title}
                        accessibilityLabel={tr.topics.markA11y(topicLabel(finishedTopicId) ?? '', title, null)}
                        selected={finishedTopicStatus === status}
                        onPress={() => markTopic(status)}
                      />
                    );
                  })}
                </ChipRow>
              </View>
            ) : null}
            {finished.durationMs > 0 ? (
              <QuestionCount
                key={finished.id}
                testID="finish-questions"
                onSave={(questions) => {
                  setSessionQuestions(finished.id, questions);
                  // "Geri al" would delete the row with its count and the next Bitir saves none:
                  // once the student has added to this record, it is no longer taken back.
                  setFinished((f) => (f === null ? f : { ...f, undoable: false }));
                  app.notifyDataChanged('sessions');
                }}
              />
            ) : null}
            {finished.undoable ? (
              // A tonal red step back (it deletes the record), last and at the end of the line.
              <View style={[styles.inline, styles.toEnd]}>
                <Button
                  compact
                  testID="finish-undo"
                  kind="dangerSoft"
                  title={tr.finish.undo}
                  accessibilityHint={finished.topicBefore !== undefined ? tr.finish.undoHintTopic : tr.finish.undoHint}
                  onPress={undo}
                />
              </View>
            ) : null}
          </View>
        ) : (
          <>
            <ResponsiveRow>
              <View style={styles.grow}>
                <Label variant="muted">{tr.timer.today}</Label>
                <View style={styles.totalLine}>
                  <Label variant="display" testID="today-total">
                    {formatDuration(todayTotal)}
                  </Label>
                  {todayQuestions > 0 ? (
                    <Label variant="muted" testID="today-questions">
                      {tr.timer.todayQuestions(todayQuestions)}
                    </Label>
                  ) : null}
                </View>
                {todayManual > 0 ? (
                  <Label variant="small">{tr.timer.manualPart(formatDuration(todayManual))}</Label>
                ) : null}
              </View>
              {ring}
            </ResponsiveRow>
            {goalStreak !== null ? (
              <Pressable
                testID="goal-edit"
                accessibilityRole="button"
                accessibilityLabel={goalLine}
                accessibilityHint={tr.home.goalEditA11y}
                onPress={openGoal}
                hitSlop={GOAL_LINE_SLOP}
                style={({ pressed }) => [styles.goalLine, { opacity: pressed ? 0.6 : 1 }]}>
                <Label testID="goal-progress" variant="small" style={{ flexShrink: 1 }}>
                  {goalLine}
                </Label>
                <Icon name="chevron" color={c.accent} size={14} />
              </Pressable>
            ) : null}
            {compare !== null ? <CompareLine line={compare} /> : null}
          </>
        )}
      </Card>

      {away !== null && !finishCheck.open ? (
        <Card>
          <Label testID="away-title" style={{ color: c.warning, fontWeight: '600' }}>
            {awayTitle}
          </Label>
          <Label variant="muted">{awayBody}</Label>
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
            <SubjectChips subjects={subjects} recent={recentSubjects} selected={subjectId} onPick={setSubjectId} />
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
              // The subject card makes way for the running card.
              easeNextLayout(reduceMotion);
              setFinished(null);
              hapticTap();
              app.start(subjectId, { topicId, pomodoro: mode === 'pomodoro' ? pomodoroConfig : null });
            }}
          />
        </>
      ) : (
        // Tinted with the subject's colour (8 %); the 2 pt outline in it while the time counts.
        <Card
          testID="timer-card"
          tint={subjectTint(active.subjectId, c)}
          outline={running && !onBreak ? subjectColor(active.subjectId, c) : c.controlBorder}>
          <View style={[styles.inline, { justifyContent: 'center' }]}>
            <Dot color={subjectColor(active.subjectId, c)} />
            <Label variant="muted" testID="timer-subject" style={{ textAlign: 'center', flexShrink: 1 }}>
              {tr.subject(active.subjectId)}
              {topicLabel(active.topicId) ? ` · ${topicLabel(active.topicId)}` : ''}
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
            // Pomodoro counts down: say it is the time left. Short, as it is read again on change.
            // (The stopwatch keeps its digits: Maestro reads them from the label on iOS.)
            accessibilityLabel={pomodoro !== null ? leftA11y(clockMs) : undefined}
            maxFontSizeMultiplier={MAX_FONT_SCALE.clock}
            style={[styles.clock, { color: running && !onBreak ? c.text : c.textMuted }]}
            numberOfLines={1}
            adjustsFontSizeToFit>
            {formatClock(clockMs)}
          </Text>
          {/* Plain text, no pill: "• Çalışıyorsun" / "• Moladasın" with a dot in the state's colour;
              pomodoro's running total ("Toplam çalışma: 0:08") is a muted fact. */}
          <View style={styles.status}>
            {!running || pomodoro === null ? <Dot color={running ? c.success : c.warning} size={6} /> : null}
            <Label
              variant="small"
              testID="timer-status"
              style={{
                textAlign: 'center',
                fontWeight: '600',
                flexShrink: 1,
                color: !running ? c.warning : pomodoro !== null ? c.textMuted : c.success,
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
                // Pomodoro: "Mola" is the phase; this button only stops the countdown.
                title={pomodoro !== null ? tr.pomodoro.pause : tr.timer.pause}
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
            {/* Same weight as Duraklat/Mola: tonal red, not a full red fill (that is only for deleting data). */}
            <Button large testID="timer-finish" kind="dangerSoft" title={tr.timer.finish} onPress={finishCheck.request} />
          </ResponsiveRow>
          {finishCheck.prompt}
        </Card>
      )}

      {/* Secondary: everything that is not "pick a subject and start". Geçmiş is in the header. */}
      <Section title={tr.home.shortcuts}>
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
        <ListRow
          icon="report"
          testID="open-report"
          title={tr.report.open}
          onPress={() =>
            router.push({ pathname: '/karne/[subject]', params: { subject: active?.subjectId ?? subjectId } })
          }
        />
      </Section>

      {active === null ? <BackupNudge studyDays={studyDays} now={now} /> : null}

      {active === null ? <WidgetTip finishedAt={finished?.at ?? null} /> : null}
    </Screen>
  );
}

/**
 * "Ders seç": the recently studied subjects (and the selected one) as chips, the rest of the list
 * behind "Tüm dersler". The selected chip is filled with its subject colour; its name stays the
 * cue. Opened, the whole list stays until the card goes (Başla), so a pick never jumps away.
 */
function SubjectChips({
  subjects,
  recent,
  selected,
  onPick,
}: {
  subjects: readonly string[];
  recent: readonly string[];
  selected: string;
  onPick: (id: string) => void;
}) {
  const c = usePalette();
  const [all, setAll] = useState(false);
  const quick = quickSubjects(subjects, recent, selected);
  const more = subjects.length - quick.length;
  return (
    <ChipRow>
      {(all ? subjects : quick).map((id) => (
        <Chip
          key={id}
          testID={`subject-${id}`}
          title={tr.subject(id)}
          color={subjectColor(id, c)}
          selected={id === selected}
          onPress={() => onPick(id)}
        />
      ))}
      {!all && more > 0 ? (
        <Chip
          testID="subjects-all"
          title={tr.timer.allSubjects}
          accessibilityHint={tr.timer.allSubjectsHint(more)}
          selected={false}
          onPress={() => setAll(true)}
        />
      ) : null}
    </ChipRow>
  );
}

function pomodoroPhaseLabel(status: PomodoroStatus, longEvery: number): string {
  if (status.phase === 'short_break') return tr.pomodoro.shortBreak;
  if (status.phase === 'long_break') return tr.pomodoro.longBreak;
  return tr.pomodoro.work(status.blockInSet, longEvery);
}

function leftA11y(ms: number): string {
  const { hours, minutes, seconds } = clockParts(ms);
  return tr.pomodoro.leftA11y(hours, minutes, seconds);
}

/** "Dün bu saate kadar 1 sa 20 dk · Geçen hafta bu zamana kadar 5 sa 0 dk": only the parts with time. */
function CompareLine({ line }: { line: ComparisonLine }) {
  const parts: { testID: string; label: string; ms: number }[] = [];
  if (line.yesterday !== null) parts.push({ testID: 'compare-yesterday', label: tr.compare.yesterday, ms: line.yesterday });
  if (line.lastWeek !== null) parts.push({ testID: 'compare-last-week', label: tr.compare.lastWeek, ms: line.lastWeek });
  return (
    <Label variant="small" testID="compare-line">
      {parts.map((p, i) => (
        <Fragment key={p.testID}>
          {i > 0 ? ' · ' : ''}
          {p.label} <Text testID={p.testID}>{formatDuration(p.ms)}</Text>
        </Fragment>
      ))}
    </Label>
  );
}

const styles = StyleSheet.create({
  // SF Rounded 72/700 with tabular digits: the same "clock voice" as the Live Activity and widget.
  clock: { ...typography.clock, textAlign: 'center' },
  grow: { flexGrow: 1, flexShrink: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  heroHead: { gap: space.xs },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  // Accessibility text sizes: the countdown, the badge and its hint one under the other.
  heroTopStack: { flexDirection: 'column', alignItems: 'flex-start', gap: space.xs },
  countdown: { ...typography.small, fontWeight: '600', flexShrink: 1 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: space.xs,
  },
  // Top right, also when there is no countdown on its left.
  badgeEnd: { marginLeft: 'auto' },
  badgeText: { fontFamily: ROUNDED_FONT, fontSize: 15, fontWeight: '600', fontVariant: ['tabular-nums'] },
  toEnd: { justifyContent: 'flex-end' },
  goalLine: { flexDirection: 'row', alignItems: 'center', gap: space.xs, alignSelf: 'flex-start' },
  modeRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  totalLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: space.sm },
  // After Bitir: "Bugün 3 sa 5 dk · hedef 3 sa 0 dk", muted, wrapping between its parts.
  todayLine: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: space.xs },
  status: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
});
