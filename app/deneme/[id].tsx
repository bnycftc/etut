import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { formatNet, net } from '@/domain/net';
import { useAppState, useStored } from '@/state/app-state';
import { deleteMockExam, getMockExam } from '@/storage/mock-exams';
import { tr } from '@/strings';
import { Button, Card, Label, Row, Screen } from '@/ui/components';
import { formatDay } from '@/ui/format';

export default function ExamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dataVersion, notifyDataChanged } = useAppState();
  const exam = useStored(`${id}|${dataVersion}`, () => (id ? getMockExam(id) : null));
  const [confirming, setConfirming] = useState(false);

  if (exam === null) {
    return (
      <Screen>
        <Label variant="muted">{tr.exams.notFound}</Label>
      </Screen>
    );
  }

  return (
    <Screen>
      <Card>
        <Label variant="title">{tr.examKind(exam.kind)}</Label>
        <Label variant="muted">
          {formatDay(exam.takenOn)} ·{' '}
          {exam.scope === 'genel'
            ? tr.exams.scopeGenel
            : tr.exams.bransLabel(tr.subject(exam.bransSectionId ?? ''))}
        </Label>
      </Card>
      <Card>
        {exam.scores.map((s) => (
          <Row key={s.sectionId}>
            <Label style={{ flex: 1 }}>{tr.subject(s.sectionId)}</Label>
            <Label variant="muted">
              {tr.exams.correctWrongShort(s.correct, s.wrong)}
            </Label>
            <Label style={{ minWidth: 56, textAlign: 'right', fontWeight: '600' }}>
              {formatNet(net(s.correct, s.wrong))}
            </Label>
          </Row>
        ))}
        <Row>
          <Label variant="heading" style={{ flex: 1 }}>
            {tr.exams.totalNet}
          </Label>
          <Label variant="heading">{formatNet(exam.totalNet)}</Label>
        </Row>
      </Card>

      {confirming ? (
        <Card>
          <Label>{tr.exams.deleteConfirm}</Label>
          <Button
            kind="danger"
            title={tr.common.delete}
            onPress={() => {
              deleteMockExam(exam.id);
              notifyDataChanged();
              router.back();
            }}
          />
          <Button kind="secondary" title={tr.common.cancel} onPress={() => setConfirming(false)} />
        </Card>
      ) : (
        <Button kind="secondary" title={tr.common.delete} onPress={() => setConfirming(true)} />
      )}
    </Screen>
  );
}
