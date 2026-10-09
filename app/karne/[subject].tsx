import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { hoursMinutes } from '@/domain/clock';
import { weekDays } from '@/domain/compare';
import { topicName, topicsForSubject } from '@/domain/curriculum';
import { activeSpan, dailyTotals, type SessionSpan, spanStudyMs } from '@/domain/daily-totals';
import { targetKey } from '@/domain/exam-analysis';
import { addDays, DAY_MS, dayStartMs, istanbulDayKey } from '@/domain/istanbul-day';
import { examKindsToShow } from '@/domain/net';
import { questionTotals } from '@/domain/questions';
import {
  examSectionsForSubject,
  REPORT_TREND_WEEKS,
  subjectMissedTopics,
  subjectTopicSummary,
  subjectWeekTrend,
} from '@/domain/report-card';
import { weekStartOf } from '@/domain/streak';
import { stepSubjectTarget, subjectTargetProgress } from '@/domain/subject-targets';
import { defaultSubject, SUBJECTS_BY_EXAM, subjectsFor } from '@/domain/subjects';
import { isPaused } from '@/domain/timer';
import { useAppState, useNow, useStored } from '@/state/app-state';
import { loadLastSubject, loadNetTargets } from '@/storage/kv';
import { listAllMarks, listMockExams, sectionNetHistory } from '@/storage/mock-exams';
import { subjectAllTime } from '@/storage/report';
import { sessionsOverlapping, topicTotals } from '@/storage/sessions';
import { loadSubjectTargets, storeSubjectTarget } from '@/storage/subject-targets';
import { loadTopicStatuses } from '@/storage/topics';
import { tr } from '@/strings';
import {
  BarChart,
  Button,
  Card,
  Chip,
  ChipRow,
  Dot,
  Label,
  ProgressBar,
  ResponsiveRow,
  Row,
  Screen,
  Stepper,
} from '@/ui/components';
import { formatDuration } from '@/ui/format';
import { NetChart } from '@/ui/net-chart';
import { subjectColor } from '@/ui/subject-colors';
import { space, usePalette } from '@/ui/theme';

const CHART_LIMIT = 10;
const KNOWN_SUBJECTS = new Set(Object.values(SUBJECTS_BY_EXAM).flat());

/** `07.10` */
function shortDay(day: string): string {
  return `${day.slice(8, 10)}.${day.slice(5, 7)}`;
}

/**
 * Subject report card ("ders karnesi"): time, solved questions, the weekly target, topics and
 * mock-exam nets of one subject on one screen. Only the student's own data, no comparison.
 */
export default function ReportCardScreen() {
  const { profile, active, dataVersion, notifyDataChanged } = useAppState();
  const c = usePalette();
  const params = useLocalSearchParams<{ subject?: string }>();
  const examType = profile?.examType ?? 'DIGER';
  const yksArea = profile?.yksArea ?? null;
  const ownSubjects = subjectsFor(examType, yksArea);
  // A subject from an older exam or area still opens (its data stays); unknown ids fall back.
  const asked = typeof params.subject === 'string' ? params.subject : '';
  const subjectId = KNOWN_SUBJECTS.has(asked) ? asked : defaultSubject(examType, loadLastSubject(), yksArea);
  const chips = ownSubjects.includes(subjectId) ? ownSubjects : [subjectId, ...ownSubjects];
  const [showUntouched, setShowUntouched] = useState(false);

  const running = active !== null && !isPaused(active) && active.subjectId === subjectId;
  const now = useNow(running, 30_000);
  const today = istanbulDayKey(now);
  const weekStart = weekStartOf(today);
  const trendFrom = addDays(weekStart, -7 * (REPORT_TREND_WEEKS - 1));

  const data = useStored(`${subjectId}|${today}|${dataVersion}`, () => {
    const exams = listMockExams();
    const kinds = examKindsToShow(
      examType,
      yksArea,
      exams.map((e) => e.kind),
    );
    const netTargets = loadNetTargets();
    return {
      sessions: sessionsOverlapping(dayStartMs(trendFrom), dayStartMs(weekStart) + 7 * DAY_MS).filter(
        (s) => s.subjectId === subjectId,
      ),
      allTime: subjectAllTime(subjectId),
      topicMs: topicTotals(),
      statuses: loadTopicStatuses(),
      marks: listAllMarks(),
      target: loadSubjectTargets()[subjectId] ?? null,
      nets: examSectionsForSubject(subjectId, kinds)
        .map((section) => ({
          ...section,
          history: sectionNetHistory(section.kind, section.sectionId).slice(-CHART_LIMIT),
          target: netTargets[targetKey(section.kind, section.sectionId)] ?? null,
        }))
        .filter((s) => s.history.length > 0),
    };
  });

  const spans: SessionSpan[] = [...data.sessions];
  const live = active !== null && active.subjectId === subjectId ? activeSpan(active, now) : null;
  if (live !== null) spans.push(live);
  const todayMs = dailyTotals(spans, [today])[0].totalMs;
  const thisWeek = weekDays(weekStart);
  const weekMs = dailyTotals(spans, thisWeek).reduce((sum, t) => sum + t.totalMs, 0);
  const totalMs = data.allTime.ms + (live === null ? 0 : spanStudyMs(live));
  const questionsToday = questionTotals(data.sessions, [today]).total;
  const questionsWeek = questionTotals(data.sessions, thisWeek).total;
  const trend = subjectWeekTrend(spans, subjectId, weekStart);
  const progress = data.target === null ? null : subjectTargetProgress(weekMs, data.target);

  const topics = topicsForSubject(examType, yksArea, subjectId);
  const summary = subjectTopicSummary(topics, data.statuses, data.topicMs);
  const missed = subjectMissedTopics(data.marks, subjectId, data.topicMs);
  const subjectName = tr.subject(subjectId);

  const setTarget = (direction: 1 | -1) => {
    storeSubjectTarget(subjectId, stepSubjectTarget(data.target, direction));
    notifyDataChanged('settings');
  };

  return (
    <Screen testID="report-screen">
      <Stack.Screen options={{ title: tr.report.titleFor(subjectName) }} />
      <Label variant="muted">{tr.report.intro}</Label>
      <Card>
        <Label variant="heading">{tr.report.pickSubject}</Label>
        <ChipRow>
          {chips.map((id) => (
            <Chip
              key={id}
              testID={`report-subject-${id}`}
              title={tr.subject(id)}
              color={subjectColor(id, c)}
              selected={id === subjectId}
              onPress={() => router.setParams({ subject: id })}
            />
          ))}
        </ChipRow>
      </Card>

      <Card outline={subjectColor(subjectId, c)}>
        <Row>
          <Dot color={subjectColor(subjectId, c)} size={12} />
          <Label variant="heading">{tr.report.timeTitle}</Label>
        </Row>
        <TimeRow label={tr.report.today} value={formatDuration(todayMs)} testID="report-today" />
        <TimeRow label={tr.report.week} value={formatDuration(weekMs)} testID="report-week" />
        <TimeRow label={tr.report.total} value={formatDuration(totalMs)} testID="report-total" />
        {data.allTime.questions > 0 ? (
          <Label variant="small" testID="report-questions">
            {tr.report.questions(questionsToday, questionsWeek, data.allTime.questions)}
          </Label>
        ) : null}
      </Card>

      <Card>
        <Label variant="heading">{tr.subjectTargets.title}</Label>
        <Stepper
          testID="report-target"
          label={tr.subjectTargets.stepper}
          accessibilityLabel={tr.subjectTargets.barLabel(subjectName)}
          value={data.target === null ? tr.subjectTargets.off : formatDuration(data.target * 60_000)}
          minusDisabled={data.target === null}
          onMinus={() => setTarget(-1)}
          onPlus={() => setTarget(1)}
        />
        {progress !== null ? (
          <>
            <ProgressBar ratio={progress.ratio} label={tr.subjectTargets.barLabel(subjectName)} />
            <Label variant="muted" testID="report-target-progress">
              {tr.subjectTargets.progress(formatDuration(weekMs), formatDuration(progress.targetMs), progress.percent)}
            </Label>
            <Label variant="small">
              {progress.reached ? tr.subjectTargets.reached : tr.subjectTargets.left(formatDuration(progress.leftMs))}
            </Label>
          </>
        ) : null}
        <Label variant="small">{tr.subjectTargets.info}</Label>
      </Card>

      <Card>
        <Label variant="heading">{tr.report.trendTitle}</Label>
        {trend.every((w) => w.ms === 0) ? (
          <Label variant="muted">{tr.report.trendEmpty}</Label>
        ) : (
          <BarChart
            bars={trend.map((w) => {
              const { hours, minutes } = hoursMinutes(w.ms);
              return {
                key: w.weekStart,
                label: shortDay(w.weekStart),
                value: w.ms,
                valueLabel: w.ms === 0 ? '' : tr.history.barValue(hours, minutes),
                highlight: w.weekStart === weekStart,
              };
            })}
          />
        )}
      </Card>

      <Card testID="report-topics">
        <Label variant="heading">{tr.report.topicsTitle}</Label>
        {summary.total === 0 ? (
          <Label variant="muted">{tr.report.noTopics}</Label>
        ) : (
          <>
            <ProgressBar ratio={summary.done.length / summary.total} label={tr.report.topicsTitle} />
            <View style={{ gap: 2 }}>
              <Label testID="report-topics-done">{tr.report.done(summary.done.length)}</Label>
              <Label testID="report-topics-review">{tr.report.review(summary.review.length)}</Label>
              <Label>{tr.report.started(summary.started.length)}</Label>
              <Label testID="report-topics-untouched">{tr.report.untouched(summary.untouched.length)}</Label>
            </View>
            {summary.review.length > 0 ? (
              <View style={{ gap: 2 }}>
                <Label variant="muted">{tr.report.reviewList}</Label>
                {summary.review.map((t) => (
                  <ResponsiveRow key={t.id}>
                    <Label style={{ flexShrink: 1, flexGrow: 1 }}>{t.name}</Label>
                    <Label variant="small">
                      {(data.topicMs[t.id] ?? 0) > 0 ? formatDuration(data.topicMs[t.id] ?? 0) : tr.report.noTime}
                    </Label>
                  </ResponsiveRow>
                ))}
              </View>
            ) : null}
            {summary.untouched.length > 0 ? (
              <>
                <Button
                  testID="report-untouched-toggle"
                  kind="secondary"
                  title={showUntouched ? tr.report.untouchedHide : tr.report.untouchedShow(summary.untouched.length)}
                  onPress={() => setShowUntouched(!showUntouched)}
                />
                {showUntouched ? (
                  <View style={{ gap: 2 }}>
                    {summary.untouched.map((t) => (
                      <Label key={t.id} variant="muted">
                        {t.name}
                      </Label>
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}
            <Button
              testID="report-open-topics"
              kind="secondary"
              title={tr.report.openTopics}
              onPress={() => router.push({ pathname: '/konular', params: { subject: subjectId } })}
            />
          </>
        )}
      </Card>

      <Card testID="report-exams">
        <Label variant="heading">{tr.report.examsTitle}</Label>
        {subjectId === 'geometri' ? <Label variant="small">{tr.report.geometryNote}</Label> : null}
        {data.nets.length === 0 ? <Label variant="muted">{tr.report.examsEmpty}</Label> : null}
        {data.nets.map((s) => (
          <View key={`${s.kind}:${s.sectionId}`} style={{ gap: space.sm }}>
            <Label>{tr.report.sectionTitle(tr.examKind(s.kind), tr.subject(s.sectionId))}</Label>
            <NetChart
              testID={`report-net-${s.kind}-${s.sectionId}`}
              questions={s.questions}
              target={s.target}
              points={s.history.map((p) => ({
                key: p.examId,
                label: shortDay(p.takenOn),
                value: p.net,
                hollow: p.scope === 'brans',
              }))}
            />
          </View>
        ))}
        {data.nets.some((s) => s.history.some((p) => p.scope === 'brans')) ? (
          <Label variant="small">{tr.exams.chartBransLegend}</Label>
        ) : null}
      </Card>

      <Card testID="report-missed">
        <Label variant="heading">{tr.report.missedTitle}</Label>
        {missed.length === 0 ? <Label variant="muted">{tr.report.missedEmpty}</Label> : null}
        {missed.map((m, i) => (
          <View key={m.topicId} style={{ gap: 2 }}>
            <Label>
              {i + 1}. {topicName(m.topicId) ?? tr.analysis.unknownTopic}
            </Label>
            <Label variant="small">
              {tr.report.missedRow(m.wrong, m.blank, m.ms > 0 ? formatDuration(m.ms) : tr.report.noTime)}
            </Label>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

function TimeRow({ label, value, testID }: { label: string; value: string; testID: string }) {
  return (
    <ResponsiveRow>
      <Label variant="muted" style={{ flexGrow: 1, flexShrink: 1 }}>
        {label}
      </Label>
      <Label testID={testID} style={{ fontWeight: '600' }}>
        {value}
      </Label>
    </ResponsiveRow>
  );
}
