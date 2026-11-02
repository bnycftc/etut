import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import {
  MISSED_WINDOW,
  missedSinceMs,
  parseTargetNet,
  studyTargetForTopic,
  TARGET_WINDOW,
  targetExample,
  targetKey,
  targetProgress,
  topMissedTopics,
} from '@/domain/exam-analysis';
import { EXAM_SECTIONS, type ExamKind, examKindsFor, examKindsToShow, formatNet } from '@/domain/net';
import { toggleStatus } from '@/domain/topics';
import { useAppState, useStored } from '@/state/app-state';
import { setSavedExamNotice, useSavedExamNotice } from '@/state/saved-exam-notice';
import { loadNetTargets, loadPomodoroConfig, loadTimerMode, storeNetTarget } from '@/storage/kv';
import {
  listAllMarks,
  listExamsNeedingAnalysis,
  listMockExams,
  sectionNetHistory,
} from '@/storage/mock-exams';
import { topicStudySince } from '@/storage/sessions';
import { loadTopicStatuses, setTopicStatus } from '@/storage/topics';
import { tr } from '@/strings';
import {
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  Field,
  Label,
  ResponsiveRow,
  Row,
  Screen,
  Tag,
} from '@/ui/components';
import { formatDay, formatDuration, topicLabel } from '@/ui/format';
import { Icon } from '@/ui/icon';
import { NetChart } from '@/ui/net-chart';
import { space, usePalette } from '@/ui/theme';

const CHART_LIMIT = 10;
/** Under a minute reads as no time ("0 dk" would look like a mistake). */
const MINUTE_MS = 60_000;
/** Exam rows drawn at first and per "Daha fazla göster" (the list is not virtualised). */
const LIST_PAGE = 20;

function shortDay(day: string): string {
  return day.slice(8, 10) + '.' + day.slice(5, 7);
}

export default function ExamsScreen() {
  const app = useAppState();
  const { profile, dataVersions, notifyDataChanged } = app;
  const c = usePalette();
  const examType = profile?.examType ?? 'YKS';
  const yksArea = profile?.yksArea ?? null;
  const [pickedKind, setChartKindState] = useState<ExamKind | null>(null);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [targetText, setTargetText] = useState('');
  const [targetError, setTargetError] = useState(false);
  // Each refused "Hedefi kaydet" reads the error out again.
  const [targetAttempt, setTargetAttempt] = useState(0);
  const data = useStored(`${dataVersions.exams}|${dataVersions.topics}|${dataVersions.settings}`, () => ({
    exams: listMockExams(),
    pending: listExamsNeedingAnalysis(),
    missed: topMissedTopics(listAllMarks()),
    targets: loadNetTargets(),
    statuses: loadTopicStatuses(),
  }));
  const { exams, pending } = data;
  // "o denemeden beri X dk": read apart, so a finished session does not reload the exam list.
  const studiedSince = useStored(`${dataVersions.exams}|${dataVersions.sessions}`, () =>
    topicStudySince(Object.fromEntries(data.missed.map((m) => [m.topicId, missedSinceMs(m)]))),
  );
  // The papers of the student's exam (and area), plus papers that already have exams.
  const ownKinds = examKindsFor(examType, yksArea);
  const kinds = examKindsToShow(
    examType,
    yksArea,
    exams.map((e) => e.kind),
  );
  const chartKind: ExamKind | null =
    pickedKind !== null && kinds.includes(pickedKind) ? pickedKind : (kinds[0] ?? null);
  // When the paper falls back (area changed, exams replaced), the picked section may not exist in it.
  const sections = chartKind === null ? [] : EXAM_SECTIONS[chartKind];
  const section = sections.find((s) => s.id === sectionId) ?? sections[0] ?? null;
  const history = useStored(`${chartKind}|${section?.id}|${dataVersions.exams}`, () =>
    chartKind === null || section === null ? [] : sectionNetHistory(chartKind, section.id),
  );
  const pendingIds = new Set(pending.map((e) => e.id));
  const [listLimit, setListLimit] = useState(LIST_PAGE);

  // "11,5 net kaydedildi" right after the new-exam form closes; gone once the student leaves the list.
  const savedId = useSavedExamNotice();
  useFocusEffect(useCallback(() => () => setSavedExamNotice(null), []));
  const saved = savedId === null ? null : (exams.find((e) => e.id === savedId) ?? null);
  const savedPending = saved !== null && pendingIds.has(saved.id);

  const setChartKind = (k: ExamKind) => {
    setChartKindState(k);
    setSectionId(null);
    setTargetText('');
    setTargetError(false);
  };

  const chartExams = exams
    .filter((e) => e.kind === chartKind && e.scope === 'genel')
    .slice(0, CHART_LIMIT)
    .reverse();
  const paperQuestions = sections.reduce((sum, s) => sum + s.questions, 0);

  const key = chartKind === null || section === null ? '' : targetKey(chartKind, section.id);
  const target = data.targets[key] ?? null;
  const sectionPoints = history.slice(-CHART_LIMIT);
  const progress =
    target === null ? null : targetProgress(target, [...history].reverse().map((p) => p.net));

  const saveTarget = () => {
    if (section === null) return;
    const value = parseTargetNet(targetText, section.questions);
    setTargetError(value === null);
    if (value === null) {
      setTargetAttempt((n) => n + 1);
      return;
    }
    storeNetTarget(key, value);
    setTargetText('');
    notifyDataChanged('settings');
  };

  const studyTopic = (subjectId: string, topicId: string) => {
    app.start(subjectId, { topicId, pomodoro: loadTimerMode() === 'pomodoro' ? loadPomodoroConfig() : null });
    router.navigate('/');
  };

  const missed = data.missed.map((m) => ({
    ...m,
    // With TYT/AYT where both papers have the topic name: both can be in the list.
    name: topicLabel(m.topicId) ?? tr.analysis.unknownTopic,
    study: studyTargetForTopic(examType, yksArea, m.topicId),
  }));

  return (
    <Screen testID="exams-screen">
      {ownKinds.length === 0 ? (
        <Label variant="muted" testID="exams-no-form">
          {tr.exams.noFormNote}
        </Label>
      ) : (
        <Button tall testID="exams-add" title={tr.exams.add} onPress={() => router.push('/deneme/yeni')} />
      )}

      {saved !== null ? (
        <Card testID="exams-saved">
          <ResponsiveRow>
            <View style={{ flexGrow: 1, flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              <Icon name="saved" color={c.success} />
              <Label variant="heading" testID="exams-saved-title" style={{ color: c.success, flexShrink: 1 }}>
                {tr.exams.saved(formatNet(saved.totalNet))}
              </Label>
            </View>
            <Button
              compact
              testID="exams-saved-dismiss"
              kind="secondary"
              title={tr.exams.savedDismiss}
              accessibilityLabel={tr.exams.savedDismissA11y}
              onPress={() => setSavedExamNotice(null)}
            />
          </ResponsiveRow>
          {savedPending ? (
            <>
              <Label variant="muted">{tr.exams.savedAnalysisHint}</Label>
              <Button
                testID="exams-saved-analysis"
                title={tr.analysis.start}
                onPress={() => {
                  setSavedExamNotice(null);
                  router.push({ pathname: '/analiz/[id]', params: { id: saved.id } });
                }}
              />
            </>
          ) : null}
        </Card>
      ) : null}

      {/* The card above already offers the analysis of the exam just saved. */}
      {pending.length > 0 && !savedPending ? (
        <Card>
          {/* Neutral, not a warning colour: an analysis is never overdue. */}
          <Label testID="analysis-reminder" variant="heading">
            {tr.analysis.pendingTitle(pending.length)}
          </Label>
          <Label variant="muted">{tr.analysis.pendingBody}</Label>
          <Button
            testID="analysis-reminder-start"
            title={tr.analysis.start}
            onPress={() => router.push({ pathname: '/analiz/[id]', params: { id: pending[0].id } })}
          />
        </Card>
      ) : null}

      {chartKind !== null && section !== null ? (
        <>
          <Card>
            <Label variant="heading">{tr.exams.chartTitle(tr.examKind(chartKind))}</Label>
            <ChipRow>
              {kinds.map((k) => (
                <Chip
                  key={k}
                  testID={`exams-chart-kind-${k}`}
                  title={tr.examKind(k)}
                  accessibilityLabel={tr.exams.choiceLabel(tr.exams.kind, tr.examKind(k))}
                  selected={k === chartKind}
                  onPress={() => setChartKind(k)}
                />
              ))}
            </ChipRow>
            {chartExams.length === 0 ? (
              <Label variant="muted">{tr.exams.chartEmpty}</Label>
            ) : (
              <NetChart
                testID="exams-chart"
                questions={paperQuestions}
                points={chartExams.map((e) => ({ key: e.id, label: shortDay(e.takenOn), value: e.totalNet }))}
              />
            )}
          </Card>

          <Card>
            <Label variant="heading">{tr.trend.title(tr.examKind(chartKind))}</Label>
            <ChipRow>
              {sections.map((s) => (
                <Chip
                  key={s.id}
                  testID={`trend-section-${s.id}`}
                  title={tr.subject(s.id)}
                  accessibilityLabel={tr.exams.choiceLabel(tr.exams.section, tr.subject(s.id))}
                  selected={s.id === section.id}
                  onPress={() => {
                    setSectionId(s.id);
                    setTargetText('');
                    setTargetError(false);
                  }}
                />
              ))}
            </ChipRow>
            {sectionPoints.length === 0 ? (
              <Label variant="muted">{tr.trend.empty}</Label>
            ) : (
              <>
                <NetChart
                  testID="trend-chart"
                  questions={section.questions}
                  target={target}
                  points={sectionPoints.map((p) => ({
                    key: p.examId,
                    label: shortDay(p.takenOn),
                    value: p.net,
                    hollow: p.scope === 'brans',
                  }))}
                />
                {sectionPoints.some((p) => p.scope === 'brans') ? (
                  <Label variant="small">{tr.exams.chartBransLegend}</Label>
                ) : null}
              </>
            )}

            <Label variant="heading">{tr.trend.target}</Label>
            <Label testID="trend-target-rule" variant="small">
              {tr.trend.targetRule(TARGET_WINDOW)}
            </Label>
            <Label testID="trend-target">
              {target === null ? tr.trend.targetNone : tr.trend.targetCurrent(formatNet(target))}
            </Label>
            {progress !== null ? (
              <Label testID="trend-gap" variant="muted">
                {progress.reached
                  ? tr.trend.reached(formatNet(progress.recentAverage))
                  : tr.trend.gap(formatNet(progress.gap), formatNet(progress.recentAverage))}
              </Label>
            ) : null}
            <Row>
              <Field
                testID="trend-target-input"
                label={tr.trend.target}
                value={targetText}
                onChange={setTargetText}
                maxLength={6}
                numeric={false}
                placeholder={tr.trend.targetPlaceholder(formatNet(targetExample(section.questions)))}
              />
            </Row>
            {targetError ? (
              <Label variant="small" live={targetAttempt} style={{ color: c.danger }}>
                {tr.trend.targetInvalid(section.questions, formatNet(targetExample(section.questions)))}
              </Label>
            ) : null}
            <ResponsiveRow>
              <Button testID="trend-target-save" kind="secondary" title={tr.trend.targetSave} onPress={saveTarget} />
              {target !== null ? (
                <Button
                  testID="trend-target-clear"
                  kind="secondary"
                  title={tr.trend.targetClear}
                  onPress={() => {
                    storeNetTarget(key, null);
                    notifyDataChanged('settings');
                  }}
                />
              ) : null}
            </ResponsiveRow>
          </Card>
        </>
      ) : null}

      <Card>
        <Label variant="heading">{tr.analysis.topMissedTitle}</Label>
        {missed.length === 0 ? (
          <Label variant="muted">{tr.analysis.topMissedEmpty}</Label>
        ) : (
          <Label variant="small" testID="missed-window">
            {tr.analysis.topMissedWindow(MISSED_WINDOW)}
          </Label>
        )}
        {missed.map((m, i) => {
          const status = data.statuses[m.topicId];
          const since = studiedSince[m.topicId] ?? 0;
          return (
            <View key={m.topicId} style={{ gap: 6 }}>
              <Row>
                <Label style={{ flex: 1 }}>
                  {i + 1}. {m.name}
                </Label>
                <Label variant="muted">{tr.analysis.markRow(m.wrong, m.blank)}</Label>
              </Row>
              <Row>
                <Chip
                  testID={`missed-review-${m.topicId}`}
                  title={tr.analysis.review}
                  accessibilityLabel={tr.analysis.reviewA11y(m.name)}
                  selected={status === 'review'}
                  onPress={() => {
                    setTopicStatus(m.topicId, toggleStatus(status, 'review'), Date.now());
                    notifyDataChanged('topics');
                  }}
                />
                {m.study !== null ? (
                  <View style={{ flex: 1 }}>
                    <Button
                      testID={`missed-study-${m.topicId}`}
                      kind="secondary"
                      title={tr.analysis.study}
                      accessibilityLabel={tr.analysis.studyA11y(m.name)}
                      accessibilityHint={app.active !== null ? tr.analysis.studyBusy : undefined}
                      disabled={app.active !== null}
                      onPress={() => {
                        const study = m.study;
                        if (study !== null) studyTopic(study.subjectId, study.topicId);
                      }}
                    />
                  </View>
                ) : null}
              </Row>
              <Label variant="small" testID={`missed-since-${m.topicId}`}>
                {tr.analysis.missedSince(formatDay(m.lastMissedOn), since >= MINUTE_MS ? formatDuration(since) : null)}
              </Label>
            </View>
          );
        })}
        {app.active !== null && missed.some((m) => m.study !== null) ? (
          <Label variant="small">{tr.analysis.studyBusy}</Label>
        ) : null}
      </Card>

      <Label variant="heading">{tr.exams.listTitle}</Label>
      {exams.length === 0 ? (
        <EmptyState
          testID="exams-empty"
          icon="exams"
          title={tr.empty.examsTitle}
          body={ownKinds.length > 0 ? tr.empty.examsBody : tr.empty.examsBodyNoForm}
          // "Deneme ekle" sits at the top, out of sight once the student scrolls down to here.
          action={ownKinds.length > 0 ? tr.empty.addFirstExam : undefined}
          onAction={() => router.push('/deneme/yeni')}
        />
      ) : null}
      {exams.slice(0, listLimit).map((e, index) => (
        <Pressable
          key={e.id}
          testID={`exam-item-${index}`}
          accessibilityRole="button"
          accessibilityLabel={tr.exams.itemA11y(
            tr.examKind(e.kind),
            formatNet(e.totalNet),
            formatDay(e.takenOn),
            e.scope === 'genel' ? tr.exams.scopeGenel : tr.exams.bransLabel(tr.subject(e.bransSectionId ?? '')),
            pendingIds.has(e.id),
          )}
          accessibilityHint={tr.exams.itemHint}
          onPress={() => router.push({ pathname: '/deneme/[id]', params: { id: e.id } })}>
          <Card>
            <Row>
              <Label variant="heading" testID={`exam-item-${index}-kind`} style={{ flex: 1 }}>
                {tr.examKind(e.kind)}
              </Label>
              <Label variant="heading" testID={`exam-item-${index}-net`}>
                {formatNet(e.totalNet)} {tr.exams.net}
              </Label>
            </Row>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Label variant="muted">
                {formatDay(e.takenOn)} ·{' '}
                {e.scope === 'genel'
                  ? tr.exams.scopeGenel
                  : tr.exams.bransLabel(tr.subject(e.bransSectionId ?? ''))}
              </Label>
              {pendingIds.has(e.id) ? <Tag title={tr.analysis.pendingTag} /> : null}
            </View>
          </Card>
        </Pressable>
      ))}
      {exams.length > listLimit ? (
        <Button
          testID="exams-more"
          kind="secondary"
          title={tr.exams.showMore}
          onPress={() => setListLimit((n) => n + LIST_PAGE)}
        />
      ) : null}
    </Screen>
  );
}
