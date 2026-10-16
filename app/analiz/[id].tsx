import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { type Topic, topicName, topicsForSection } from '@/domain/curriculum';
import {
  blankCount,
  type MarkError,
  type MarkKind,
  markKindFor,
  orderTopicsByMisses,
  sectionNeedsAnalysis,
  type TopicMark,
  topMissedTopics,
  validateSectionMarks,
} from '@/domain/exam-analysis';
import { useAppState, useStored } from '@/state/app-state';
import { getExamMarks, getMockExam, listAllMarks, saveExamAnalysis } from '@/storage/mock-exams';
import { tr } from '@/strings';
import { Button, Card, Chip, ChipRow, Label, Row, Screen, Stepper } from '@/ui/components';
import { announce } from '@/ui/feedback';
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

const ALL = Number.POSITIVE_INFINITY;

/**
 * Step 2 of a mock exam: tag wrong and blank questions with topics ("analizi tamamla"). Quick
 * analysis: each section has a Yanlış | Boş switch and its topic chips are always shown (most
 * missed in recent exams first); one tap adds 1 of the chosen kind to the topic. The steppers to
 * lower a count are folded under "Ayrıntı". No long press anywhere (VoiceOver).
 */
export default function ExamAnalysisScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dataVersions, notifyDataChanged } = useAppState();
  const c = usePalette();
  const exam = useStored(`${id}|${dataVersions.exams}`, () => (id ? getMockExam(id) : null));
  // Read once per exam change, so the chips do not move under the finger while tagging.
  const pastMarks = useStored(`${dataVersions.exams}`, () => listAllMarks());
  const [draft, setDraft] = useState<Draft>(() => (id ? toDraft(getExamMarks(id)) : {}));
  const [picked, setPicked] = useState<Record<string, MarkKind>>({});
  const [details, setDetails] = useState<Record<string, boolean>>({});
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
    notifyDataChanged('exams');
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
        const kind = markKindFor(s, picked[s.sectionId] ?? null);
        const room = kind === 'wrong' ? wrongTagged < s.wrong : blankTagged < blank;
        const curriculum = topicsForSection(exam.kind, s.sectionId);
        const known = new Set(curriculum.map((t) => t.id));
        const chips: Topic[] = [
          // Window over the exams that marked a topic of this list (not AYT marks on a TYT test).
          ...orderTopicsByMisses(
            curriculum,
            topMissedTopics(
              pastMarks.filter((m) => known.has(m.topicId)),
              ALL,
            ),
          ),
          // Tagged under a topic no longer in the list: still shown with its count.
          ...Object.keys(tagged)
            .filter((topicId) => !known.has(topicId))
            .map((topicId) => ({ id: topicId, name: topicName(topicId) ?? tr.analysis.unknownTopic })),
        ];
        const hasTags = Object.keys(tagged).length > 0;
        const open = hasTags && details[s.sectionId] === true;
        const sectionName = tr.subject(s.sectionId);
        return (
          <Card key={s.sectionId}>
            <Row>
              <Label variant="heading" style={{ flex: 1 }}>
                {sectionName}
              </Label>
              <Label variant="muted">{tr.analysis.sectionSummary(s.wrong, blank)}</Label>
            </Row>
            <Label variant="small" testID={`analysis-tagged-${s.sectionId}`}>
              {tr.analysis.tagged(wrongTagged, s.wrong, blankTagged, blank)}
            </Label>
            {s.wrong > 0 && blank > 0 ? (
              <ChipRow>
                <Chip
                  testID={`analysis-kind-${s.sectionId}-wrong`}
                  title={tr.analysis.wrong}
                  accessibilityLabel={tr.analysis.kindA11y(tr.analysis.wrong, wrongTagged, s.wrong)}
                  selected={kind === 'wrong'}
                  onPress={() => setPicked((prev) => ({ ...prev, [s.sectionId]: 'wrong' }))}
                />
                <Chip
                  testID={`analysis-kind-${s.sectionId}-blank`}
                  title={tr.analysis.blank}
                  accessibilityLabel={tr.analysis.kindA11y(tr.analysis.blank, blankTagged, blank)}
                  selected={kind === 'blank'}
                  onPress={() => setPicked((prev) => ({ ...prev, [s.sectionId]: 'blank' }))}
                />
              </ChipRow>
            ) : null}
            {/* Was the "Konu ekle" button (same id): the chips below are always shown now. */}
            <Label variant="small" testID={`analysis-add-topic-${s.sectionId}`}>
              {room ? tr.analysis.tapHint(kind) : tr.analysis.allTagged(kind)}
            </Label>
            <ChipRow>
              {chips.map((t) => {
                const counts = tagged[t.id] ?? { wrong: 0, blank: 0 };
                return (
                  <Chip
                    key={t.id}
                    testID={`analysis-add-${t.id}`}
                    title={t.name}
                    badge={counts.wrong + counts.blank > 0 ? tr.analysis.markRow(counts.wrong, counts.blank) : undefined}
                    accessibilityLabel={tr.analysis.topicA11y(t.name, counts.wrong, counts.blank)}
                    accessibilityHint={tr.analysis.topicHint(kind)}
                    selected={false}
                    disabled={!room}
                    onPress={() => {
                      const next = { ...counts, [kind]: counts[kind] + 1 };
                      setCount(s.sectionId, t.id, kind, next[kind]);
                      const last = kind === 'wrong' ? wrongTagged + 1 >= s.wrong : blankTagged + 1 >= blank;
                      announce(
                        tr.analysis.tappedA11y(
                          tr.analysis.topicA11y(t.name, next.wrong, next.blank),
                          last ? tr.analysis.allTagged(kind) : null,
                        ),
                      );
                    }}
                  />
                );
              })}
            </ChipRow>
            {hasTags ? (
              <Button
                testID={`analysis-details-${s.sectionId}`}
                kind="secondary"
                title={open ? tr.analysis.detailsHide : tr.analysis.detailsShow}
                accessibilityLabel={tr.analysis.detailsA11y(sectionName, open)}
                onPress={() => setDetails((prev) => ({ ...prev, [s.sectionId]: !open }))}
              />
            ) : null}
            {open ? <Label variant="small">{tr.analysis.detailsNote}</Label> : null}
            {open
              ? Object.entries(tagged).map(([topicId, counts]) => {
                  const name = topicName(topicId) ?? tr.analysis.unknownTopic;
                  return (
                    <View key={topicId} style={{ gap: 4 }}>
                      <Label style={{ fontWeight: '600' }}>{name}</Label>
                      <Stepper
                        testID={`analysis-wrong-${topicId}`}
                        label={tr.analysis.wrong}
                        accessibilityLabel={tr.analysis.countLabel(name, tr.analysis.wrong)}
                        value={String(counts.wrong)}
                        onMinus={() => setCount(s.sectionId, topicId, 'wrong', counts.wrong - 1)}
                        onPlus={() => setCount(s.sectionId, topicId, 'wrong', counts.wrong + 1)}
                        minusDisabled={counts.wrong === 0}
                        plusDisabled={wrongTagged >= s.wrong}
                      />
                      <Stepper
                        testID={`analysis-blank-${topicId}`}
                        label={tr.analysis.blank}
                        accessibilityLabel={tr.analysis.countLabel(name, tr.analysis.blank)}
                        value={String(counts.blank)}
                        onMinus={() => setCount(s.sectionId, topicId, 'blank', counts.blank - 1)}
                        onPlus={() => setCount(s.sectionId, topicId, 'blank', counts.blank + 1)}
                        minusDisabled={counts.blank === 0}
                        plusDisabled={blankTagged >= blank}
                      />
                    </View>
                  );
                })
              : null}
            {errors[s.sectionId] ? (
              <Label variant="small" style={{ color: c.danger }}>
                {tr.analysis.markErrors[errors[s.sectionId]]}
              </Label>
            ) : null}
          </Card>
        );
      })}

      <Button testID="analysis-save" large title={tr.analysis.save} onPress={save} />
    </Screen>
  );
}
