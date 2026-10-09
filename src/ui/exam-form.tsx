import { useEffect, useRef, useState } from 'react';
import {
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { addDays, type DayKey, istanbulDayKey } from '../domain/istanbul-day';
import {
  EXAM_SECTIONS,
  type ExamKind,
  type ExamScope,
  formatNet,
  net,
  type SectionScore,
  sectionsFor,
  totalNet,
  validateScore,
  wrongsPerCorrect,
} from '../domain/net';
import { tr } from '../strings';
import { Button, Card, Chip, ChipRow, Label, Row } from './components';
import { formatDay } from './format';
import { space, usePalette } from './theme';

type Entry = { correct: string; wrong: string };
type Field = keyof Entry;

export interface ExamFormValues {
  kind: ExamKind;
  scope: ExamScope;
  bransSectionId: string | null;
  takenOn: DayKey;
  scores: SectionScore[];
}

/** Values to start from (editing a saved exam); a new exam starts with TYT, today, empty boxes. */
export interface ExamFormInitial {
  kind: ExamKind;
  scope: ExamScope;
  bransSectionId: string | null;
  takenOn: DayKey;
  scores: readonly SectionScore[];
}

/**
 * Height of the on-screen keyboard (0 while hidden). The number pad has no return or "done" key,
 * so the form draws its own Önceki / Sonraki / Bitti bar right above it. InputAccessoryView is not
 * used: it is not drawn inside the sheet the exam screens are presented in (E2E run 37818248269).
 */
function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);
  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const shown = Keyboard.addListener(showEvent, (e) => setHeight(e.endCoordinates.height));
    const hidden = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  return height;
}

/** Empty input counts as 0; anything else must be a whole number. */
function parseCount(text: string): number {
  const trimmed = text.trim();
  if (trimmed === '') return 0;
  return /^\d+$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

function entriesOf(scores: readonly SectionScore[]): Record<string, Entry> {
  return Object.fromEntries(
    scores.map((s) => [s.sectionId, { correct: String(s.correct), wrong: String(s.wrong) }]),
  );
}

/**
 * Mock exam form, for a new exam and for correcting a saved one. Number pad with
 * "‹ Önceki / Sonraki › / Bitti" above it on iOS (the pad has no return key) and a "next" return
 * key elsewhere; the focused box scrolls above the keyboard and the total with "Kaydet" stays at
 * the bottom of the screen. `onSave` runs once: further taps are ignored (no duplicate exam).
 */
export function ExamForm({
  kinds,
  initial,
  note,
  onSave,
}: {
  /** Papers offered (never empty). */
  kinds: readonly ExamKind[];
  initial?: ExamFormInitial;
  note?: string;
  onSave: (values: ExamFormValues) => void;
}) {
  const c = usePalette();
  const [kind, setKind] = useState<ExamKind>(initial?.kind ?? kinds[0]);
  const [scope, setScope] = useState<ExamScope>(initial?.scope ?? 'genel');
  const [bransId, setBransId] = useState<string>(
    initial?.bransSectionId ?? EXAM_SECTIONS[initial?.kind ?? kinds[0]][0].id,
  );
  const [day, setDay] = useState<DayKey>(() => initial?.takenOn ?? istanbulDayKey(Date.now()));
  const [entries, setEntries] = useState<Record<string, Entry>>(() =>
    initial ? entriesOf(initial.scores) : {},
  );
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const inputs = useRef<Record<string, TextInput | null>>({});
  const keyboardHeight = useKeyboardHeight();
  const [focused, setFocused] = useState<number | null>(null);

  const today = istanbulDayKey(Date.now());
  const yesterday = addDays(today, -1);
  const sections = sectionsFor(kind, scope, bransId);
  const scores: SectionScore[] = sections.map((s) => ({
    sectionId: s.id,
    questions: s.questions,
    correct: parseCount(entries[s.id]?.correct ?? ''),
    wrong: parseCount(entries[s.id]?.wrong ?? ''),
  }));
  const errors = scores.map(validateScore);
  const hasErrors = errors.some((e) => e !== null);
  const fields = sections.flatMap((s) => [`${s.id}:correct`, `${s.id}:wrong`]);

  const chooseKind = (k: ExamKind) => {
    if (k === kind) return;
    setKind(k);
    setBransId(EXAM_SECTIONS[k][0].id);
    setEntries({});
    setShowErrors(false);
  };

  const setEntry = (sectionId: string, field: Field, value: string) => {
    setEntries((prev) => ({
      ...prev,
      [sectionId]: { ...(prev[sectionId] ?? { correct: '', wrong: '' }), [field]: value },
    }));
  };

  const focusField = (index: number) => {
    const key = fields[index];
    if (key === undefined) {
      Keyboard.dismiss();
      return;
    }
    inputs.current[key]?.focus();
  };

  const save = () => {
    if (savingRef.current) return;
    if (hasErrors || sections.length === 0) {
      setShowErrors(true);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    onSave({ kind, scope, bransSectionId: scope === 'brans' ? bransId : null, takenOn: day, scores });
  };

  const choice = (group: string, item: string) => tr.exams.choiceLabel(group, item);

  return (
    <View style={{ flex: 1, backgroundColor: c.background }}>
      <ScrollView
        testID="exam-form"
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        automaticallyAdjustKeyboardInsets>
        {note ? <Label variant="small">{note}</Label> : null}
        <Card>
          <Label variant="heading" testID="exam-form-kind-title">
            {tr.exams.kind}
          </Label>
          <ChipRow>
            {kinds.map((k) => (
              <Chip
                key={k}
                testID={`exam-kind-${k}`}
                title={tr.examKind(k)}
                accessibilityLabel={choice(tr.exams.kind, tr.examKind(k))}
                selected={k === kind}
                onPress={() => chooseKind(k)}
              />
            ))}
          </ChipRow>
          <Label variant="small" testID="exam-net-rule">
            {tr.exams.netRule(wrongsPerCorrect(kind))}
          </Label>

          <Label variant="heading">{tr.exams.scope}</Label>
          <ChipRow>
            <Chip
              testID="exam-scope-genel"
              title={tr.exams.scopeGenel}
              accessibilityLabel={choice(tr.exams.scope, tr.exams.scopeGenel)}
              selected={scope === 'genel'}
              onPress={() => setScope('genel')}
            />
            <Chip
              testID="exam-scope-brans"
              title={tr.exams.scopeBrans}
              accessibilityLabel={choice(tr.exams.scope, tr.exams.scopeBrans)}
              selected={scope === 'brans'}
              onPress={() => setScope('brans')}
            />
          </ChipRow>

          {scope === 'brans' ? (
            <>
              <Label variant="heading">{tr.exams.section}</Label>
              <ChipRow>
                {EXAM_SECTIONS[kind].map((s) => (
                  <Chip
                    key={s.id}
                    testID={`exam-brans-${s.id}`}
                    title={tr.subject(s.id)}
                    accessibilityLabel={choice(tr.exams.section, tr.subject(s.id))}
                    selected={s.id === bransId}
                    onPress={() => setBransId(s.id)}
                  />
                ))}
              </ChipRow>
            </>
          ) : null}

          <Label variant="heading">{tr.exams.date}</Label>
          <ChipRow>
            <Chip
              testID="exam-day-today"
              title={tr.exams.today}
              accessibilityLabel={choice(tr.exams.date, tr.exams.today)}
              selected={day === today}
              onPress={() => setDay(today)}
            />
            <Chip
              testID="exam-day-yesterday"
              title={tr.exams.yesterday}
              accessibilityLabel={choice(tr.exams.date, tr.exams.yesterday)}
              selected={day === yesterday}
              onPress={() => setDay(yesterday)}
            />
          </ChipRow>
          <Row>
            <Button
              testID="exam-prev-day"
              kind="secondary"
              title={tr.exams.prevDay}
              onPress={() => setDay(addDays(day, -1))}
            />
            <Button
              testID="exam-next-day"
              kind="secondary"
              title={tr.exams.nextDay}
              disabled={day >= today}
              onPress={() => setDay(addDays(day, 1))}
            />
          </Row>
          <Label variant="muted" testID="exam-day">
            {formatDay(day)}
          </Label>
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
                  {(['correct', 'wrong'] as const).map((field) => {
                    const key = `${s.id}:${field}`;
                    const index = fields.indexOf(key);
                    const last = index === fields.length - 1;
                    const label = field === 'correct' ? tr.exams.correct : tr.exams.wrong;
                    return (
                      <CountInput
                        key={field}
                        testID={`exam-${field}-${s.id}`}
                        inputRef={(r) => {
                          inputs.current[key] = r;
                        }}
                        label={label}
                        a11yLabel={tr.exams.countLabel(tr.subject(s.id), label)}
                        value={entries[s.id]?.[field] ?? ''}
                        onChange={(v) => setEntry(s.id, field, v)}
                        last={last}
                        onFocus={() => setFocused(index)}
                        onSubmit={() => focusField(index + 1)}
                      />
                    );
                  })}
                  <View style={styles.netBox}>
                    <Label variant="small">{tr.exams.net}</Label>
                    <Label variant="heading" testID={`exam-net-${s.id}`}>
                      {error === null ? formatNet(net(score.correct, score.wrong, kind)) : '–'}
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
        </Card>

        {showErrors && hasErrors ? (
          <Label style={{ color: c.danger }}>{tr.exams.fixErrors}</Label>
        ) : null}
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={[styles.footer, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={{ flex: 1 }}>
          <Label variant="small">{tr.exams.totalNet}</Label>
          <Label variant="heading" testID="exam-total-net">
            {hasErrors ? '–' : formatNet(totalNet(scores, kind))}
          </Label>
        </View>
        <View style={{ flex: 1 }}>
          <Button testID="exam-save" title={tr.common.save} disabled={saving} onPress={save} />
        </View>
      </SafeAreaView>

      {keyboardHeight > 0 ? (
        <View
          testID="exam-keyboard-bar"
          style={[styles.accessory, { bottom: keyboardHeight, backgroundColor: c.surface, borderColor: c.border }]}>
            <Button
              testID="exam-keyboard-prev"
              kind="secondary"
              title={tr.exams.prevField}
              accessibilityLabel={tr.exams.prevFieldA11y}
              disabled={focused === null || focused <= 0}
              onPress={() => focusField((focused ?? 0) - 1)}
            />
            <Button
              testID="exam-keyboard-next"
              kind="secondary"
              title={tr.exams.nextField}
              accessibilityLabel={tr.exams.nextFieldA11y}
              disabled={focused === null || focused >= fields.length - 1}
              onPress={() => focusField((focused ?? -1) + 1)}
            />
            <Button testID="exam-keyboard-done" title={tr.exams.keyboardDone} onPress={() => Keyboard.dismiss()} />
        </View>
      ) : null}
    </View>
  );
}

function CountInput({
  label,
  a11yLabel,
  value,
  onChange,
  inputRef,
  last,
  onFocus,
  onSubmit,
  testID,
}: {
  label: string;
  a11yLabel: string;
  value: string;
  onChange: (value: string) => void;
  inputRef: (input: TextInput | null) => void;
  last: boolean;
  onFocus: () => void;
  onSubmit: () => void;
  testID?: string;
}) {
  const c = usePalette();
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Label variant="small">{label}</Label>
      <TextInput
        ref={inputRef}
        testID={testID}
        accessibilityLabel={a11yLabel}
        value={value}
        onChangeText={onChange}
        keyboardType="number-pad"
        inputMode="numeric"
        maxLength={3}
        placeholder="0"
        placeholderTextColor={c.textMuted}
        returnKeyType={last ? 'done' : 'next'}
        submitBehavior={last ? 'blurAndSubmit' : 'submit'}
        onSubmitEditing={onSubmit}
        onFocus={onFocus}
        selectTextOnFocus
        style={[styles.input, { color: c.text, borderColor: c.controlBorder, backgroundColor: c.background }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.lg, gap: space.lg, paddingBottom: space.xl },
  section: { gap: 8, paddingBottom: 8 },
  netBox: { flex: 1, alignItems: 'flex-end', gap: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  accessory: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: space.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
