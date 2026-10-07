import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { topicName } from '@/domain/curriculum';
import { examNeedsAnalysis } from '@/domain/exam-analysis';
import { formatNet, net } from '@/domain/net';
import { useAppState, useStored } from '@/state/app-state';
import { deleteMockExam, getExamMarks, getMockExam } from '@/storage/mock-exams';
import { tr } from '@/strings';
import { Button, Card, Label, Row, Screen, Tag } from '@/ui/components';
import { formatDay } from '@/ui/format';

export default function ExamDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dataVersion, notifyDataChanged } = useAppState();
  const exam = useStored(`${id}|${dataVersion}`, () => (id ? getMockExam(id) : null));
  const marks = useStored(`marks|${id}|${dataVersion}`, () => (id ? getExamMarks(id) : []));
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
              {formatNet(net(s.correct, s.wrong, exam.kind))}
            </Label>
          </Row>
        ))}
        <Row>
          <Label variant="heading" style={{ flex: 1 }}>
            {tr.exams.totalNet}
          </Label>
          <Label variant="heading" testID="exam-detail-total">{formatNet(exam.totalNet)}</Label>
        </Row>
      </Card>

      {examNeedsAnalysis(exam.scores) ? (
        <Card>
          <Row>
            <Label variant="heading" style={{ flex: 1 }}>
              {tr.analysis.marksTitle}
            </Label>
            {exam.analysisDoneAt === null ? <Tag title={tr.analysis.pendingTag} /> : null}
          </Row>
          {marks.length === 0 ? <Label variant="muted">{tr.analysis.noMarks}</Label> : null}
          {marks.map((m) => (
            <Row key={`${m.sectionId}|${m.topicId}`}>
              <Label variant="muted" style={{ flex: 1 }}>
                {tr.subject(m.sectionId)} · {topicName(m.topicId) ?? tr.analysis.unknownTopic}
              </Label>
              <Label variant="muted">{tr.analysis.markRow(m.wrong, m.blank)}</Label>
            </Row>
          ))}
          <Button
            testID="exam-open-analysis"
            kind={exam.analysisDoneAt === null ? 'primary' : 'secondary'}
            title={exam.analysisDoneAt === null ? tr.analysis.complete : tr.analysis.edit}
            onPress={() => router.push({ pathname: '/analiz/[id]', params: { id: exam.id } })}
          />
        </Card>
      ) : null}

      <Button
        testID="exam-edit"
        kind="secondary"
        title={tr.exams.edit}
        onPress={() => router.push({ pathname: '/deneme/duzenle/[id]', params: { id: exam.id } })}
      />

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
