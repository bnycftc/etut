import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

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

/**
 * The tips sheet itself (a system form sheet). The scroll view is the sheet's root, as in the goal
 * sheet (`goal-sheet.tsx`, IOS-02): nested in a padded `flex: 1` view, react-native-screens set it
 * to the screen's frame, so the first step showed only Geç / İleri and the others lost their
 * margins ("sa bir tur · 2/3"). Each step starts from the top.
 */
export function TipsSheet() {
  const c = usePalette();
  const [step, setStep] = useState(0);
  const scroll = useRef<ScrollView>(null);
  // However the sheet goes (a button, a swipe down), the tips count as closed.
  useEffect(() => storeTipsSeen, []);

  const steps = tr.tips.steps;
  const last = step === steps.length - 1;
  const close = () => {
    storeTipsSeen();
    router.back();
  };
  const next = () => {
    setStep(step + 1);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };

  return (
    <ScrollView
      ref={scroll}
      testID="tips-card"
      style={{ backgroundColor: c.surface }}
      contentContainerStyle={styles.content}>
      <Label variant="small">
        {tr.tips.title} · {tr.tips.step(step + 1, steps.length)}
      </Label>
      <Label variant="heading" testID="tips-step-title">
        {steps[step].title}
      </Label>
      <Label>{steps[step].body}</Label>
      <ResponsiveRow>
        {!last ? <Button testID="tips-skip" kind="secondary" title={tr.tips.skip} onPress={close} /> : null}
        <Button
          testID={last ? 'tips-done' : 'tips-next'}
          title={last ? tr.tips.done : tr.tips.next}
          onPress={last ? close : next}
        />
      </ResponsiveRow>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: space.xl, paddingTop: space.xxl, gap: space.md },
});
