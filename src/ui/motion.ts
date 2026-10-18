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
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        lastKnown = value;
        // The same value as the view started with re-renders nothing (React bails out). No copy of
        // `lastKnown` taken before the call: the React Compiler read such a copy as `lastKnown`
        // itself, after the line above, so the answer never reached a view mounted before it (the
        // timer screen at launch kept animating with Reduce Motion on).
        if (mounted) setReduced(value);
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
