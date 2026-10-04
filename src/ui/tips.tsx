import { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';

import { loadTipsSeen, storeTipsSeen } from '../storage/kv';
import { tr } from '../strings';
import { Button, Label, Row } from './components';
import { useReducedMotion } from './motion';
import { space, usePalette } from './theme';

/**
 * Three short first-use tips, shown once after onboarding on the timer screen. Closing them
 * ("Geç" or "Anladım") is remembered; "Tüm verileri sil" shows them again.
 */
export function FirstUseTips() {
  const c = usePalette();
  const reduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(() => !loadTipsSeen());
  const [step, setStep] = useState(0);
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
      <View style={[styles.backdrop, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
        <View
          testID="tips-card"
          style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
          accessibilityViewIsModal>
          <Label variant="small">
            {tr.tips.title} · {tr.tips.step(step + 1, steps.length)}
          </Label>
          <Label variant="heading" testID="tips-step-title">
            {steps[step].title}
          </Label>
          <Label>{steps[step].body}</Label>
          <Row>
            {!last ? <Button testID="tips-skip" kind="secondary" title={tr.tips.skip} onPress={close} /> : null}
            <Button
              testID={last ? 'tips-done' : 'tips-next'}
              title={last ? tr.tips.done : tr.tips.next}
              onPress={last ? close : () => setStep(step + 1)}
            />
          </Row>
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
    alignSelf: 'center',
  },
});
