import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { Icon } from './icon';
import { useReducedMotion } from './motion';
import { usePalette } from './theme';

/**
 * The moment after "Bitir" (A5): the tick in front of the time just saved. The day's one
 * celebration (the goal ring filling to 100 % with the seal) is the "Bugün" card's own ring
 * (`ring.tsx`, `fillFrom`). Both are positive and happen once; no confetti, no reward, no streak
 * talk (K-14). With Reduce Motion nothing moves.
 */

/** The bounce is over well within this time; then it is switched off, so it never plays again. */
export const SAVED_BOUNCE_MS = 1_000;

/**
 * The saved tick. It bounces once as it appears: the bounce is switched on when the tick has been
 * laid out on screen, as a symbol effect added to a view that is not drawn yet can be lost, and
 * off again once it has played (a later prop change, such as the colour on a light/dark switch,
 * would play a bounce that is still on again).
 */
export function SavedMark() {
  const c = usePalette();
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<'waiting' | 'bouncing' | 'done'>('waiting');
  useEffect(() => {
    if (phase !== 'bouncing') return;
    const id = setTimeout(() => setPhase('done'), SAVED_BOUNCE_MS);
    return () => clearTimeout(id);
  }, [phase]);
  return (
    <View onLayout={() => setPhase((p) => (p === 'waiting' ? 'bouncing' : p))}>
      <Icon name="saved" color={c.success} size={28} bounce={phase === 'bouncing' && !reduced} />
    </View>
  );
}
