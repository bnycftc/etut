import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { loadTipsSeen, storeTipsSeen } from '../storage/kv';
import { tr } from '../strings';
import { Button, Label, ResponsiveRow } from './components';
import { space, usePalette } from './theme';

/**
 * Three short first-use tips, shown once after onboarding on the timer screen. Closing them
 * ("Geç", "Anladım" or swiping the sheet down) is remembered; Ayarlar → "Turu yeniden göster"
 * (and "Tüm verileri sil") clears that, and the tips open again from the first step when the
 * timer tab is shown. On the timer screen this only opens the sheet (`app/tur.tsx`).
 */
export function FirstUseTips() {
  useFocusEffect(
    useCallback(() => {
      if (!loadTipsSeen()) router.push('/tur');
    }, []),
  );
  return null;
}

/** The tips sheet itself (a system form sheet). Only the text scrolls: Geç / İleri stay below it. */
export function TipsSheet() {
  const c = usePalette();
  const [step, setStep] = useState(0);
  // However the sheet goes (a button, a swipe down), the tips count as closed.
  useEffect(() => storeTipsSeen, []);

  const steps = tr.tips.steps;
  const last = step === steps.length - 1;
  const close = () => {
    storeTipsSeen();
    router.back();
  };

  return (
    <View testID="tips-card" style={[styles.card, { backgroundColor: c.surface }]}>
      {/* At large text sizes only the text scrolls (from the top on each step). */}
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
  );
}

const styles = StyleSheet.create({
  // The sheet is as tall as its detent: the text takes what the buttons leave.
  card: { flex: 1, padding: space.xl, paddingTop: space.xxl, gap: space.md },
  text: { flex: 1 },
  textContent: { gap: space.md },
});
