import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { topicName } from '@/domain/curriculum';
import { parseTargetNet, targetKey, targetProgress, topMissedTopics } from '@/domain/exam-analysis';
import { EXAM_SECTIONS, type ExamKind, examKindsToShow, formatNet } from '@/domain/net';
import { useAppState, useStored } from '@/state/app-state';
import { loadNetTargets, storeNetTarget } from '@/storage/kv';
import {
  listAllMarks,
  listExamsNeedingAnalysis,
  listMockExams,
  sectionNetHistory,
} from '@/storage/mock-exams';
import { tr } from '@/strings';
import {
  BarChart,
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  Field,
  Label,
  Row,
  Screen,
  Tag,
} from '@/ui/components';
import { formatDay } from '@/ui/format';
import { usePalette } from '@/ui/theme';

const CHART_LIMIT = 10;

function shortDay(day: string): string {
  return day.slice(8, 10) + '.' + day.slice(5, 7);
}

export default function ExamsScreen() {
  const { profile, dataVersion, notifyDataChanged } = useAppState();
  const c = usePalette();
  const [pickedKind, setChartKindState] = useState<ExamKind>('TYT');
  const [sectionId, setSectionId] = useState<string>(EXAM_SECTIONS.TYT[0].id);
  const [targetText, setTargetText] = useState('');
  const [targetError, setTargetError] = useState(false);
  const data = useStored(String(dataVersion), () => ({
    exams: listMockExams(),
    pending: listExamsNeedingAnalysis(),
    missed: topMissedTopics(listAllMarks()),
    targets: loadNetTargets(),
  }));
  const { exams, pending } = data;
  // TYT + the paper of the student's area, plus papers that already have exams.
  const kinds = examKindsToShow(
    profile?.yksArea ?? null,
    exams.map((e) => e.kind),
  );
  const chartKind = kinds.includes(pickedKind) ? pickedKind : 'TYT';
  // When the paper falls back (area changed, exams replaced), the picked section may not exist in it.
  const section = EXAM_SECTIONS[chartKind].find((s) => s.id === sectionId) ?? EXAM_SECTIONS[chartKind][0];
  const history = useStored(`${chartKind}|${section.id}|${dataVersion}`, () =>
    sectionNetHistory(chartKind, section.id),
  );
  const pendingIds = new Set(pending.map((e) => e.id));

  const setChartKind = (k: ExamKind) => {
    setChartKindState(k);
    setSectionId(EXAM_SECTIONS[k][0].id);
    setTargetText('');
    setTargetError(false);
  };

  const chartExams = exams
    .filter((e) => e.kind === chartKind && e.scope === 'genel')
    .slice(0, CHART_LIMIT)
    .reverse();

  const key = targetKey(chartKind, section.id);
  const target = data.targets[key] ?? null;
  const sectionPoints = history.slice(-CHART_LIMIT);
  const progress =
    target === null ? null : targetProgress(target, [...history].reverse().map((p) => p.net));

  const saveTarget = () => {
    const value = parseTargetNet(targetText, section.questions);
    setTargetError(value === null);
    if (value === null) return;
    storeNetTarget(key, value);
    setTargetText('');
    notifyDataChanged();
  };

  return (
    <Screen testID="exams-screen">
      {profile !== null && profile.examType !== 'YKS' ? (
        <Label variant="muted">{tr.exams.onlyYksNote}</Label>
      ) : null}

      <Button large testID="exams-add" title={tr.exams.add} onPress={() => router.push('/deneme/yeni')} />

      {pending.length > 0 ? (
        <Card>
          <Label testID="analysis-reminder" variant="heading" style={{ color: c.warning }}>
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

      <Card>
        <Label variant="heading">{tr.exams.chartTitle(tr.examKind(chartKind))}</Label>
        <ChipRow>
          {kinds.map((k) => (
            <Chip
              key={k}
              testID={`exams-chart-kind-${k}`}
              title={tr.examKind(k)}
              selected={k === chartKind}
              onPress={() => setChartKind(k)}
            />
          ))}
        </ChipRow>
        {chartExams.length === 0 ? (
          <Label variant="muted">{tr.exams.chartEmpty}</Label>
        ) : (
          <BarChart
            bars={chartExams.map((e) => ({
              key: e.id,
              label: shortDay(e.takenOn),
              value: Math.max(0, e.totalNet),
              valueLabel: formatNet(e.totalNet),
            }))}
          />
        )}
      </Card>

      <Card>
        <Label variant="heading">{tr.trend.title(tr.examKind(chartKind))}</Label>
        <ChipRow>
          {EXAM_SECTIONS[chartKind].map((s) => (
            <Chip
              key={s.id}
              testID={`trend-section-${s.id}`}
              title={tr.subject(s.id)}
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
          <BarChart
            bars={sectionPoints.map((p) => ({
              key: p.examId,
              label: shortDay(p.takenOn),
              value: Math.max(0, p.net),
              valueLabel: formatNet(p.net),
            }))}
          />
        )}

        <Label variant="heading">{tr.trend.target}</Label>
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
            placeholder={tr.trend.targetPlaceholder}
          />
        </Row>
        {targetError ? (
          <Label variant="small" style={{ color: c.danger }}>
            {tr.trend.targetInvalid(section.questions)}
          </Label>
        ) : null}
        <Row>
          <Button testID="trend-target-save" kind="secondary" title={tr.trend.targetSave} onPress={saveTarget} />
          {target !== null ? (
            <Button
              testID="trend-target-clear"
              kind="secondary"
              title={tr.trend.targetClear}
              onPress={() => {
                storeNetTarget(key, null);
                notifyDataChanged();
              }}
            />
          ) : null}
        </Row>
      </Card>

      <Card>
        <Label variant="heading">{tr.analysis.topMissedTitle}</Label>
        {data.missed.length === 0 ? <Label variant="muted">{tr.analysis.topMissedEmpty}</Label> : null}
        {data.missed.map((m, i) => (
          <Row key={m.topicId}>
            <Label style={{ flex: 1 }}>
              {i + 1}. {topicName(m.topicId) ?? m.topicId}
            </Label>
            <Label variant="muted">{tr.analysis.markRow(m.wrong, m.blank)}</Label>
          </Row>
        ))}
      </Card>

      <Label variant="heading">{tr.exams.listTitle}</Label>
      {exams.length === 0 ? (
        <EmptyState testID="exams-empty" title={tr.empty.examsTitle} body={tr.empty.examsBody} />
      ) : null}
      {exams.map((e, index) => (
        <Pressable
          key={e.id}
          testID={`exam-item-${index}`}
          accessibilityRole="button"
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
    </Screen>
  );
}
