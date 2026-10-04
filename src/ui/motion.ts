import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * The system "Reduce Motion" setting (iOS: Ayarlar → Erişilebilirlik → Hareket; web:
 * `prefers-reduced-motion`). Screen transitions and the tips dialog do not animate when it is on.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        // Only a change from the default needs a re-render.
        if (mounted && value) setReduced(true);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);
  return reduced;
}
