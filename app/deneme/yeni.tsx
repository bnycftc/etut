import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { addDays, istanbulDayKey } from '@/domain/istanbul-day';
import {
  EXAM_SECTIONS,
  type ExamKind,
  examKindsInOrder,
  type ExamScope,
  formatNet,
  net,
  type SectionScore,
  sectionsFor,
  totalNet,
  validateScore,
} from '@/domain/net';
import { useAppState } from '@/state/app-state';
import { newId } from '@/storage/db';
import { saveMockExam } from '@/storage/mock-exams';
import { tr } from '@/strings';
import { Button, Card, Chip, ChipRow, Label, Row, Screen } from '@/ui/components';
import { formatDay } from '@/ui/format';
import { usePalette } from '@/ui/theme';

type Entry = { correct: string; wrong: string };

/** Empty input counts as 0; anything else must be a whole number. */
function parseCount(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return 0;
  return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

export default function NewExamScreen() {
  const { profile, notifyDataChanged } = useAppState();
  const c = usePalette();
  const [kind, setKind] = useState<ExamKind>('TYT');
  const [scope, setScope] = useState<ExamScope>('genel');
  const [bransId, setBransId] = useState<string>(EXAM_SECTIONS.TYT[0].id);
  const [day, setDay] = useState(() => istanbulDayKey(Date.now()));
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [showErrors, setShowErrors] = useState(false);

  const today = istanbulDayKey(Date.now());
  const sections = sectionsFor(kind, scope, bransId);
  const scores: SectionScore[] = sections.map((s) => ({
    sectionId: s.id,
    questions: s.questions,
    correct: parseCount(entries[s.id]?.correct ?? ''),
    wrong: parseCount(entries[s.id]?.wrong ?? ''),
  }));
  const errors = scores.map(validateScore);
  const hasErrors = errors.some((e) => e !== null);
  const kinds = examKindsInOrder(profile?.yksArea ?? null);

  const chooseKind = (k: ExamKind) => {
    setKind(k);
    setBransId(EXAM_SECTIONS[k][0].id);
    setEntries({});
    setShowErrors(false);
  };

  const setEntry = (sectionId: string, field: keyof Entry, value: string) => {
    setEntries((prev) => ({
      ...prev,
      [sectionId]: { ...(prev[sectionId] ?? { correct: '', wrong: '' }), [field]: value },
    }));
  };

  const save = () => {
    if (hasErrors || sections.length === 0) {
      setShowErrors(true);
      return;
    }
    saveMockExam(
      {
        id: newId(),
        kind,
        scope,
        bransSectionId: scope === 'brans' ? bransId : null,
        takenOn: day,
        createdAt: Date.now(),
      },
      scores,
    );
    notifyDataChanged();
    router.back();
  };

  return (
    <Screen>
      <Card>
        <Label variant="heading">{tr.exams.kind}</Label>
        <ChipRow>
          {kinds.map((k) => (
            <Chip
              key={k}
              title={tr.examKind(k)}
              selected={k === kind}
              onPress={() => chooseKind(k)}
            />
          ))}
        </ChipRow>

        <Label variant="heading">{tr.exams.scope}</Label>
        <ChipRow>
          <Chip title={tr.exams.scopeGenel} selected={scope === 'genel'} onPress={() => setScope('genel')} />
          <Chip title={tr.exams.scopeBrans} selected={scope === 'brans'} onPress={() => setScope('brans')} />
        </ChipRow>

        {scope === 'brans' ? (
          <>
            <Label variant="heading">{tr.exams.section}</Label>
            <ChipRow>
              {EXAM_SECTIONS[kind].map((s) => (
                <Chip
                  key={s.id}
                  title={tr.subject(s.id)}
                  selected={s.id === bransId}
                  onPress={() => setBransId(s.id)}
                />
              ))}
            </ChipRow>
          </>
        ) : null}

        <Label variant="heading">{tr.exams.date}</Label>
        <Row>
          <Button kind="secondary" title={tr.exams.prevDay} onPress={() => setDay(addDays(day, -1))} />
          <Button
            kind="secondary"
            title={tr.exams.nextDay}
            disabled={day >= today}
            onPress={() => setDay(addDays(day, 1))}
          />
        </Row>
        <Label variant="muted">{formatDay(day)}</Label>
      </Card>

      <Card>
        {sections.map((s, i) => {
          const score = scores[i];
          const error = errors[i];
          return (
            <View key={s.id} style={styles.section}>
              <Row>
                <Label style={{ flex: 1, fontWeight: '600' }}>{tr.subject(s.id)}</Label>
                <Label variant="small">{tr.exams.questions(s.questions)}</Label>
              </Row>
              <Row>
                <CountInput
                  label={tr.exams.correct}
                  value={entries[s.id]?.correct ?? ''}
                  onChange={(v) => setEntry(s.id, 'correct', v)}
                />
                <CountInput
                  label={tr.exams.wrong}
                  value={entries[s.id]?.wrong ?? ''}
                  onChange={(v) => setEntry(s.id, 'wrong', v)}
                />
                <View style={styles.netBox}>
                  <Label variant="small">{tr.exams.net}</Label>
                  <Label variant="heading">
                    {error === null ? formatNet(net(score.correct, score.wrong)) : '–'}
                  </Label>
                </View>
              </Row>
              {error !== null && (showErrors || error === 'too_many') ? (
                <Label variant="small" style={{ color: c.danger }}>
                  {tr.scoreError(error)}
                </Label>
              ) : null}
            </View>
          );
        })}
        <Row>
          <Label variant="heading" style={{ flex: 1 }}>
            {tr.exams.totalNet}
          </Label>
          <Label variant="heading">{hasErrors ? '–' : formatNet(totalNet(scores))}</Label>
        </Row>
      </Card>

      {showErrors && hasErrors ? (
        <Label style={{ color: c.danger }}>{tr.exams.fixErrors}</Label>
      ) : null}
      <Button large title={tr.common.save} onPress={save} />
    </Screen>
  );
}

function CountInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const c = usePalette();
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Label variant="small">{label}</Label>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={3}
        placeholder="0"
        placeholderTextColor={c.textMuted}
        style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.background }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8, paddingBottom: 8 },
  netBox: { flex: 1, alignItems: 'flex-end', gap: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
  },
});
