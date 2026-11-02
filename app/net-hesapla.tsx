import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { type CountEntry, encodePrefill, scoresFromEntries } from '@/domain/net-calc';
import {
  EXAM_KINDS,
  type ExamKind,
  examKindsFor,
  formatNet,
  isEmptyExam,
  net,
  totalNet,
  validateScore,
  wrongsPerCorrect,
} from '@/domain/net';
import { useAppState } from '@/state/app-state';
import { tr } from '@/strings';
import { Button, Card, Chip, ChipRow, Field, Label, Row } from '@/ui/components';
import { InfoLink } from '@/ui/info-link';
import { space, usePalette } from '@/ui/theme';

/**
 * "Net hesapla" (a form sheet, `app/_layout.tsx`): correct and wrong counts per section of a paper,
 * the section nets and the total as they are typed, by the rule in `domain/net.ts`. Nothing is
 * saved here; "Deneme olarak kaydet" opens the new-exam form filled in with the same counts.
 */
export default function NetCalculatorScreen() {
  const c = usePalette();
  const { profile } = useAppState();
  // The student's own papers; "Diğer" has none, so every paper is offered (to calculate only).
  const own = examKindsFor(profile?.examType ?? 'YKS', profile?.yksArea ?? null);
  const kinds: readonly ExamKind[] = own.length > 0 ? own : EXAM_KINDS;
  const [picked, setPicked] = useState<ExamKind>(kinds[0]);
  const kind = kinds.includes(picked) ? picked : kinds[0];
  const [entries, setEntries] = useState<Record<string, CountEntry>>({});

  const scores = scoresFromEntries(kind, entries);
  const errors = scores.map(validateScore);
  const hasErrors = errors.some((e) => e !== null);
  const canSave = own.includes(kind) && !hasErrors && !isEmptyExam(scores);

  const chooseKind = (k: ExamKind) => {
    if (k === kind) return;
    setPicked(k);
    setEntries({});
  };
  const setEntry = (sectionId: string, field: keyof CountEntry, value: string) => {
    setEntries((prev) => ({
      ...prev,
      [sectionId]: { ...(prev[sectionId] ?? { correct: '', wrong: '' }), [field]: value },
    }));
  };

  return (
    <ScrollView
      testID="net-calc"
      style={{ backgroundColor: c.surface }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets>
      <Label variant="heading">{tr.netCalc.title}</Label>
      <ChipRow>
        {kinds.map((k) => (
          <Chip
            key={k}
            testID={`net-calc-kind-${k}`}
            title={tr.examKind(k)}
            accessibilityLabel={tr.exams.choiceLabel(tr.netCalc.kind, tr.examKind(k))}
            selected={k === kind}
            onPress={() => chooseKind(k)}
          />
        ))}
      </ChipRow>
      <Row wrap>
        <Label variant="small" testID="net-calc-hint" style={{ flexShrink: 1 }}>
          {tr.netCalc.hint(wrongsPerCorrect(kind))}
        </Label>
        <InfoLink testID="net-calc-info" section="net" term={tr.infoLink.net} />
      </Row>

      <Card>
        {scores.map((score, i) => {
          const error = errors[i];
          const name = tr.subject(score.sectionId);
          const sectionNet = error === null ? formatNet(net(score.correct, score.wrong, kind)) : '–';
          return (
            <View key={score.sectionId} style={styles.section}>
              <Row>
                <Label style={{ flex: 1, fontWeight: '600' }}>{name}</Label>
                <Label variant="small">{tr.exams.questions(score.questions)}</Label>
              </Row>
              <Row>
                <Field
                  testID={`net-calc-correct-${score.sectionId}`}
                  label={tr.netCalc.correct}
                  accessibilityLabel={tr.netCalc.countLabel(name, tr.netCalc.correct)}
                  value={entries[score.sectionId]?.correct ?? ''}
                  onChange={(v) => setEntry(score.sectionId, 'correct', v)}
                  placeholder="0"
                />
                <Field
                  testID={`net-calc-wrong-${score.sectionId}`}
                  label={tr.netCalc.wrong}
                  accessibilityLabel={tr.netCalc.countLabel(name, tr.netCalc.wrong)}
                  value={entries[score.sectionId]?.wrong ?? ''}
                  onChange={(v) => setEntry(score.sectionId, 'wrong', v)}
                  placeholder="0"
                />
                <View
                  style={styles.netBox}
                  accessible
                  accessibilityLabel={tr.netCalc.sectionA11y(name, sectionNet)}>
                  <Label variant="small">{tr.netCalc.net}</Label>
                  <Label variant="heading" testID={`net-calc-net-${score.sectionId}`}>
                    {sectionNet}
                  </Label>
                </View>
              </Row>
              {error !== null ? (
                <Label variant="small" style={{ color: c.danger }}>
                  {tr.scoreError(error)}
                </Label>
              ) : null}
            </View>
          );
        })}
      </Card>

      <Card>
        <Label variant="small">{tr.netCalc.total}</Label>
        <Label variant="title" testID="net-calc-total">
          {hasErrors ? '–' : formatNet(totalNet(scores, kind))}
        </Label>
      </Card>

      {own.includes(kind) ? (
        <Button
          testID="net-calc-save"
          title={tr.netCalc.saveAsExam}
          disabled={!canSave}
          onPress={() => {
            if (!canSave) return;
            router.push({ pathname: '/deneme/yeni', params: { prefill: encodePrefill(kind, scores) } });
          }}
        />
      ) : null}
      <Button testID="net-calc-close" kind="secondary" title={tr.netCalc.close} onPress={() => router.back()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.md, paddingBottom: space.xl },
  section: { gap: 8, paddingBottom: 8 },
  netBox: { flex: 1, alignItems: 'flex-end', gap: 4 },
});
