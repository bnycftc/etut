import { ScrollView, StyleSheet, View } from 'react-native';

import { GOAL_MAX_MINUTES, GOAL_MIN_MINUTES } from '../domain/streak';
import { tr } from '../strings';
import { Button, Chip, ChipRow, Label, ResponsiveRow, Stepper } from './components';
import { formatDuration } from './format';
import { space, usePalette } from './theme';

/** Ready-made daily goals in hours (one tap instead of many 15 min steps). */
export const GOAL_PRESET_HOURS = [1, 2, 3, 4, 6] as const;
const STEP_MINUTES = 15;

/** Hour presets as chips; `testIDPrefix-60`, `-120`, … */
export function GoalPresets({
  goal,
  onPick,
  testIDPrefix,
}: {
  goal: number | null;
  onPick: (minutes: number) => void;
  testIDPrefix: string;
}) {
  return (
    <ChipRow>
      {GOAL_PRESET_HOURS.map((h) => (
        <Chip
          key={h}
          testID={`${testIDPrefix}-${h * 60}`}
          title={tr.goalSheet.hours(h)}
          accessibilityLabel={tr.goalSheet.presetA11y(h)}
          selected={goal === h * 60}
          onPress={() => onPick(h * 60)}
        />
      ))}
    </ChipRow>
  );
}

/**
 * Daily goal picker on the timer screen (`app/hedef.tsx`, a system form sheet): presets, a 15 min
 * fine tune and "turn off". Every change is saved at once (like Settings); the same goal is edited
 * in Settings too. Only the choices scroll: "Tamam" stays at the bottom of the sheet.
 * `startsTomorrow`: the goal shown was raised after today's goal was met and starts tomorrow
 * (`goalFromTomorrow`).
 */
export function GoalSheet({
  goal,
  startsTomorrow = false,
  onChange,
  onClose,
}: {
  goal: number | null;
  startsTomorrow?: boolean;
  onChange: (minutes: number | null) => void;
  onClose: () => void;
}) {
  const c = usePalette();
  return (
    <View testID="goal-sheet" style={[styles.sheet, { backgroundColor: c.surface }]}>
      <ScrollView style={styles.choices} contentContainerStyle={{ gap: space.md }}>
        <Label variant="heading">{tr.goalSheet.title}</Label>
        <Label variant="small">{tr.goal.info}</Label>
        <GoalPresets goal={goal} onPick={onChange} testIDPrefix="goal-preset" />
        {goal !== null ? (
          <Stepper
            testID="goal-sheet"
            label={tr.goalSheet.fineTune}
            value={formatDuration(goal * 60_000)}
            onMinus={() => onChange(goal - STEP_MINUTES)}
            onPlus={() => onChange(goal + STEP_MINUTES)}
            minusDisabled={goal <= GOAL_MIN_MINUTES}
            plusDisabled={goal >= GOAL_MAX_MINUTES}
          />
        ) : null}
        {goal !== null && startsTomorrow ? (
          <Label variant="small" testID="goal-starts-tomorrow">
            {tr.goal.startsTomorrow}
          </Label>
        ) : null}
      </ScrollView>
      <ResponsiveRow>
        {goal !== null ? (
          <Button testID="goal-sheet-off" kind="secondary" title={tr.goal.turnOff} onPress={() => onChange(null)} />
        ) : null}
        <Button testID="goal-sheet-done" title={tr.goalSheet.done} onPress={onClose} />
      </ResponsiveRow>
    </View>
  );
}

const styles = StyleSheet.create({
  // The sheet is as tall as its detent: the choices take what the buttons leave.
  sheet: { flex: 1, padding: space.xl, paddingTop: space.xxl, gap: space.md },
  choices: { flex: 1 },
});
