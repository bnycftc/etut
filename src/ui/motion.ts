import { useEffect, useState } from 'react';
import { AccessibilityInfo, LayoutAnimation } from 'react-native';

/**
 * The last value the system reported. The root layout reads the setting at launch, so a view that
 * appears later (the summary after Bitir) starts with it instead of `false` and never moves
 * before the answer comes in.
 */
let lastKnown = false;

/**
 * The system "Reduce Motion" setting (iOS: Ayarlar → Erişilebilirlik → Hareket; web:
 * `prefers-reduced-motion`). Screen transitions, the tips dialog, the timer card's layout changes
 * and the moment after Bitir do not animate when it is on.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(lastKnown);
  useEffect(() => {
    let mounted = true;
    const startedWith = lastKnown;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        lastKnown = value;
        // Only a change from the value the view started with needs a re-render.
        if (mounted && value !== startedWith) setReduced(value);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value: boolean) => {
      lastKnown = value;
      if (mounted) setReduced(value);
    });
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}

/**
 * The next layout change (the timer card replacing the subject card, the summary after Bitir)
 * eases in and out instead of jumping; with Reduce Motion it simply happens.
 */
export function easeNextLayout(reduced: boolean): void {
  if (!reduced) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}
