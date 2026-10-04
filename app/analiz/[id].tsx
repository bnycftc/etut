import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { topicName, topicsForSection } from '@/domain/curriculum';
import {
  blankCount,
  type MarkError,
  sectionNeedsAnalysis,
  type TopicMark,
  validateSectionMarks,
} from '@/domain/exam-analysis';
import { useAppState, useStored } from '@/state/app-state';
import { getExamMarks, getMockExam, saveExamAnalysis } from '@/storage/mock-exams';
import { tr } from '@/strings';
import { Button, Card, Chip, ChipRow, Label, Row, Screen, Stepper } from '@/ui/components';
import { formatDay } from '@/ui/format';
import { usePalette } from '@/ui/theme';

type Counts = { wrong: number; blank: number };
/** sectionId → topicId → counts, in the order the topics were added. */
type Draft = Record<string, Record<string, Counts>>;

function toDraft(marks: TopicMark[]): Draft {
  const draft: Draft = {};
  for (const m of marks) {
    draft[m.sectionId] = { ...(draft[m.sectionId] ?? {}), [m.topicId]: { wrong: m.wrong, blank: m.blank } };
  }
  return draft;
}

function toMarks(draft: Draft): TopicMark[] {
  return Object.entries(draft).flatMap(([sectionId, topics]) =>
    Object.entries(topics).map(([topicId, c]) => ({ sectionId, topicId, wrong: c.wrong, blank: c.blank })),
  );
}

function sum(topics: Record<string, Counts> | undefined, field: keyof Counts): number {
  return Object.values(topics ?? {}).reduce((s, c) => s + c[field], 0);
}

/** Step 2 of a mock exam: tag wrong and blank questions with topics ("analizi tamamla"). */
export default function ExamAnalysisScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dataVersion, notifyDataChanged } = useAppState();
  const c = usePalette();
  const exam = useStored(`${id}|${dataVersion}`, () => (id ? getMockExam(id) : null));
  const [draft, setDraft] = useState<Draft>(() => (id ? toDraft(getExamMarks(id)) : {}));
  const [adding, setAdding] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, MarkError>>({});

  if (exam === null) {
    return (
      <Screen>
        <Label variant="muted">{tr.exams.notFound}</Label>
      </Screen>
    );
  }

  const sections = exam.scores.filter(sectionNeedsAnalysis);

  const setCount = (sectionId: string, topicId: string, field: keyof Counts, value: number) => {
    setDraft((prev) => {
      const section = { ...(prev[sectionId] ?? {}) };
      const next = { ...(section[topicId] ?? { wrong: 0, blank: 0 }), [field]: Math.max(0, value) };
      if (next.wrong + next.blank === 0) delete section[topicId];
      else section[topicId] = next;
      return { ...prev, [sectionId]: section };
    });
  };

  const save = () => {
    const marks = toMarks(draft);
    const found: Record<string, MarkError> = {};
    for (const s of exam.scores) {
      const e = validateSectionMarks(s, marks);
      if (e !== null) found[s.sectionId] = e;
    }
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    saveExamAnalysis(exam.id, marks, Date.now());
    notifyDataChanged();
    router.back();
  };

  return (
    <Screen>
      <Card>
        <Label variant="heading">{tr.examKind(exam.kind)}</Label>
        <Label variant="muted">{formatDay(exam.takenOn)}</Label>
        <Label variant="small">{sections.length === 0 ? tr.analysis.nothing : tr.analysis.partialNote}</Label>
      </Card>

      {sections.map((s) => {
        const blank = blankCount(s);
        const tagged = draft[s.sectionId] ?? {};
        const wrongTagged = sum(tagged, 'wrong');
        const blankTagged = sum(tagged, 'blank');
        const full = wrongTagged >= s.wrong && blankTagged >= blank;
        const available = topicsForSection(exam.kind, s.sectionId).filter((t) => !(t.id in tagged));
        return (
          <Card key={s.sectionId}>
            <Row>
              <Label variant="heading" style={{ flex: 1 }}>
                {tr.subject(s.sectionId)}
              </Label>
              <Label variant="muted">{tr.analysis.sectionSummary(s.wrong, blank)}</Label>
            </Row>
            <Label variant="small" testID={`analysis-tagged-${s.sectionId}`}>
              {tr.analysis.tagged(wrongTagged, s.wrong, blankTagged, blank)}
            </Label>
            {Object.entries(tagged).map(([topicId, counts]) => (
              <View key={topicId} style={{ gap: 4 }}>
                <Label style={{ fontWeight: '600' }}>{topicName(topicId) ?? topicId}</Label>
                <Stepper
                  testID={`analysis-wrong-${topicId}`}
                  label={tr.analysis.wrong}
                  value={String(counts.wrong)}
                  onMinus={() => setCount(s.sectionId, topicId, 'wrong', counts.wrong - 1)}
                  onPlus={() => setCount(s.sectionId, topicId, 'wrong', counts.wrong + 1)}
                  minusDisabled={counts.wrong === 0}
                  plusDisabled={wrongTagged >= s.wrong}
                />
                <Stepper
                  testID={`analysis-blank-${topicId}`}
                  label={tr.analysis.blank}
                  value={String(counts.blank)}
                  onMinus={() => setCount(s.sectionId, topicId, 'blank', counts.blank - 1)}
                  onPlus={() => setCount(s.sectionId, topicId, 'blank', counts.blank + 1)}
                  minusDisabled={counts.blank === 0}
                  plusDisabled={blankTagged >= blank}
                />
              </View>
            ))}
            {errors[s.sectionId] ? (
              <Label variant="small" style={{ color: c.danger }}>
                {tr.analysis.markErrors[errors[s.sectionId]]}
              </Label>
            ) : null}
            {adding === s.sectionId ? (
              <>
                <ChipRow>
                  {available.map((t) => (
                    <Chip
                      key={t.id}
                      testID={`analysis-add-${t.id}`}
                      title={t.name}
                      selected={false}
                      onPress={() => {
                        setCount(s.sectionId, t.id, wrongTagged < s.wrong ? 'wrong' : 'blank', 1);
                        setAdding(null);
                      }}
                    />
                  ))}
                </ChipRow>
                <Button kind="secondary" title={tr.analysis.close} onPress={() => setAdding(null)} />
              </>
            ) : (
              <Button
                testID={`analysis-add-topic-${s.sectionId}`}
                kind="secondary"
                title={tr.analysis.addTopic}
                disabled={full || available.length === 0}
                onPress={() => setAdding(s.sectionId)}
              />
            )}
          </Card>
        );
      })}

      <Button testID="analysis-save" large title={tr.analysis.save} onPress={save} />
    </Screen>
  );
}
