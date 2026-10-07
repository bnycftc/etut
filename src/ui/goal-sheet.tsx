import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { GOAL_MAX_MINUTES, GOAL_MIN_MINUTES } from '../domain/streak';
import { tr } from '../strings';
import { Button, Chip, ChipRow, Label, ResponsiveRow, Stepper } from './components';
import { formatDuration } from './format';
import { useReducedMotion } from './motion';
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
 * Daily goal picker on the timer screen: presets, a 15 min fine tune and "turn off". Every change
 * is saved at once (like Settings); the same goal is edited in Settings too.
 */
export function GoalSheet({
  visible,
  goal,
  onChange,
  onClose,
}: {
  visible: boolean;
  goal: number | null;
  onChange: (minutes: number | null) => void;
  onClose: () => void;
}) {
  const c = usePalette();
  const reduceMotion = useReducedMotion();
  if (!visible) return null;
  return (
    <Modal transparent visible animationType={reduceMotion ? 'none' : 'slide'} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        {/* Tapping the dimmed area closes the sheet (decorative for screen readers: "Tamam" does the same). */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} importantForAccessibility="no" />
        <View
          testID="goal-sheet"
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: c.surface, borderColor: c.border }]}>
          <ScrollView contentContainerStyle={{ gap: space.md }}>
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
            <ResponsiveRow>
              {goal !== null ? (
                <Button testID="goal-sheet-off" kind="secondary" title={tr.goal.turnOff} onPress={() => onChange(null)} />
              ) : null}
              <Button testID="goal-sheet-done" title={tr.goalSheet.done} onPress={onClose} />
            </ResponsiveRow>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.xl,
    paddingBottom: space.xl * 2,
    maxHeight: '85%',
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
});
