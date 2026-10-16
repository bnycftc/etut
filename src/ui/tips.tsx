import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { loadTipsSeen, storeTipsSeen } from '../storage/kv';
import { tr } from '../strings';
import { Button, Label, ResponsiveRow } from './components';
import { useReducedMotion } from './motion';
import { space, usePalette } from './theme';

/**
 * Three short first-use tips, shown once after onboarding on the timer screen. Closing them
 * ("Geç", "Anladım" or a tap outside the card) is remembered; Ayarlar → "Turu yeniden göster"
 * (and "Tüm verileri sil") clears that, and the tips open again from the first step when the
 * timer tab is shown.
 */
export function FirstUseTips() {
  const c = usePalette();
  const reduceMotion = useReducedMotion();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(() => !loadTipsSeen());
  const [step, setStep] = useState(0);
  useFocusEffect(
    useCallback(() => {
      if (loadTipsSeen()) return;
      setStep(0);
      setVisible(true);
    }, []),
  );
  if (!visible) return null;

  const steps = tr.tips.steps;
  const last = step === steps.length - 1;
  const close = () => {
    storeTipsSeen();
    setVisible(false);
  };

  return (
    <Modal
      transparent
      visible
      animationType={reduceMotion ? 'none' : 'fade'}
      onRequestClose={close}>
      <View
        style={[
          styles.backdrop,
          {
            backgroundColor: 'rgba(0,0,0,0.5)',
            paddingTop: space.lg + insets.top,
            paddingBottom: space.lg + insets.bottom,
          },
        ]}>
        {/* Tapping the dimmed area closes the tips (decorative for screen readers: "Geç" does the same). */}
        <Pressable
          testID="tips-backdrop"
          style={StyleSheet.absoluteFill}
          onPress={close}
          accessible={false}
          importantForAccessibility="no"
        />
        <View
          testID="tips-card"
          style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
          accessibilityViewIsModal>
          {/* At large text sizes only the text scrolls (from the top on each step); Geç / İleri stay below it. */}
          <ScrollView key={step} testID="tips-scroll" style={styles.text} contentContainerStyle={styles.textContent}>
            <Label variant="small">
              {tr.tips.title} · {tr.tips.step(step + 1, steps.length)}
            </Label>
            <Label variant="heading" testID="tips-step-title">
              {steps[step].title}
            </Label>
            <Label>{steps[step].body}</Label>
          </ScrollView>
          <ResponsiveRow>
            {!last ? <Button testID="tips-skip" kind="secondary" title={tr.tips.skip} onPress={close} /> : null}
            <Button
              testID={last ? 'tips-done' : 'tips-next'}
              title={last ? tr.tips.done : tr.tips.next}
              onPress={last ? close : () => setStep(step + 1)}
            />
          </ResponsiveRow>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: space.lg },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space.xl,
    gap: space.md,
    maxWidth: 480,
    width: '100%',
    maxHeight: '100%',
    alignSelf: 'center',
  },
  // Sized to its text, and shrinks (then scrolls) when the card reaches the screen height.
  text: { flexGrow: 0, flexShrink: 1 },
  textContent: { gap: space.md },
});
