import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { type ExamKind, examKindsInOrder, formatNet } from '@/domain/net';
import { useAppState, useStored } from '@/state/app-state';
import { listMockExams } from '@/storage/mock-exams';
import { tr } from '@/strings';
import { BarChart, Button, Card, Chip, ChipRow, Label, Row, Screen } from '@/ui/components';
import { formatDay } from '@/ui/format';

const CHART_LIMIT = 10;

export default function ExamsScreen() {
  const { profile, dataVersion } = useAppState();
  const [chartKind, setChartKind] = useState<ExamKind>('TYT');
  const exams = useStored(String(dataVersion), listMockExams);

  const chartExams = exams
    .filter((e) => e.kind === chartKind && e.scope === 'genel')
    .slice(0, CHART_LIMIT)
    .reverse();
  const kinds = examKindsInOrder(profile?.yksArea ?? null);

  return (
    <Screen>
      {profile !== null && profile.examType !== 'YKS' ? (
        <Label variant="muted">{tr.exams.onlyYksNote}</Label>
      ) : null}

      <Button large title={tr.exams.add} onPress={() => router.push('/deneme/yeni')} />

      <Card>
        <Label variant="heading">{tr.exams.chartTitle(tr.examKind(chartKind))}</Label>
        <ChipRow>
          {kinds.map((k) => (
            <Chip key={k} title={tr.examKind(k)} selected={k === chartKind} onPress={() => setChartKind(k)} />
          ))}
        </ChipRow>
        {chartExams.length === 0 ? (
          <Label variant="muted">{tr.exams.chartEmpty}</Label>
        ) : (
          <BarChart
            bars={chartExams.map((e) => ({
              key: e.id,
              label: e.takenOn.slice(8, 10) + '.' + e.takenOn.slice(5, 7),
              value: Math.max(0, e.totalNet),
              valueLabel: formatNet(e.totalNet),
            }))}
          />
        )}
      </Card>

      <Label variant="heading">{tr.exams.listTitle}</Label>
      {exams.length === 0 ? <Label variant="muted">{tr.exams.empty}</Label> : null}
      {exams.map((e) => (
        <Pressable
          key={e.id}
          accessibilityRole="button"
          onPress={() => router.push({ pathname: '/deneme/[id]', params: { id: e.id } })}>
          <Card>
            <Row>
              <Label variant="heading" style={{ flex: 1 }}>
                {tr.examKind(e.kind)}
              </Label>
              <Label variant="heading">
                {formatNet(e.totalNet)} {tr.exams.net}
              </Label>
            </Row>
            <Label variant="muted">
              {formatDay(e.takenOn)} ·{' '}
              {e.scope === 'genel'
                ? tr.exams.scopeGenel
                : tr.exams.bransLabel(tr.subject(e.bransSectionId ?? ''))}
            </Label>
          </Card>
        </Pressable>
      ))}
    </Screen>
  );
}
