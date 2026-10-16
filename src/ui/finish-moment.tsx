import { useEffect, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';

import { tr } from '../strings';
import { ResponsiveRow } from './components';
import { Icon } from './icon';
import { useReducedMotion } from './motion';
import { typography, usePalette } from './theme';

/**
 * The moment after "Bitir" (A5): the tick in front of the time just saved and, in the summary of
 * the session that reached the daily goal, the day's one celebration. Both are positive and
 * happen once; no confetti, no reward, no streak talk (K-14). With Reduce Motion nothing moves.
 */

/** The goal ring: 64 pt across, 10 pt thick (the size of the "Bugün" ring). */
const RING = 64;
const STROKE = 10;
/** The ring fills to 100 % in this time, easing out. */
export const GOAL_FILL_MS = 600;

const nativeDriver = Platform.OS !== 'web';

/**
 * The saved tick. It bounces once as it appears: the bounce is switched on when the tick has been
 * laid out on screen, as a symbol effect added to a view that is not drawn yet can be lost.
 */
export function SavedMark() {
  const c = usePalette();
  const reduced = useReducedMotion();
  const [onScreen, setOnScreen] = useState(false);
  return (
    <View onLayout={() => setOnScreen(true)}>
      <Icon name="saved" color={c.success} size={28} bounce={onScreen && !reduced} />
    </View>
  );
}

/**
 * "Bugünkü hedef tamam": the ring fills from where the day stood before this session (`fromRatio`,
 * 0…1) to 100 %, with a seal in it. Decorative for screen readers: the sentence next to it says it
 * (and Bitir's announcement does too).
 */
export function GoalDone({ fromRatio, testID }: { fromRatio: number; testID?: string }) {
  const c = usePalette();
  const reduced = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(reduced ? 1 : Math.min(1, Math.max(0, fromRatio))));
  useEffect(() => {
    if (reduced) {
      progress.stopAnimation();
      progress.setValue(1);
      return;
    }
    const fill = Animated.timing(progress, {
      toValue: 1,
      duration: GOAL_FILL_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: nativeDriver,
    });
    fill.start();
    return () => fill.stop();
  }, [progress, reduced]);

  // Two half-rings, each a circle with two coloured sides (half its edge) in a clip of one half:
  // the right one turns in first, then the left one (0…50 % and 50…100 %).
  const right = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['-135deg', '45deg', '45deg'] });
  const left = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['45deg', '45deg', '225deg'] });
  const arc = { borderTopColor: c.success, borderRightColor: c.success };
  return (
    <ResponsiveRow>
      <View
        style={styles.ring}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden>
        <View style={[styles.track, { borderColor: c.barMuted }]} />
        <View style={[styles.half, styles.rightHalf]}>
          <Animated.View style={[styles.arc, styles.rightArc, arc, { transform: [{ rotate: right }] }]} />
        </View>
        <View style={styles.half}>
          <Animated.View style={[styles.arc, arc, { transform: [{ rotate: left }] }]} />
        </View>
        <Icon name="goalDone" color={c.success} size={28} />
      </View>
      <Text testID={testID} style={[typography.heading, styles.title, { color: c.text }]}>
        {tr.finish.goalReached}
      </Text>
    </ResponsiveRow>
  );
}

const styles = StyleSheet.create({
  ring: { width: RING, height: RING, alignItems: 'center', justifyContent: 'center' },
  track: { position: 'absolute', top: 0, left: 0, width: RING, height: RING, borderRadius: RING / 2, borderWidth: STROKE },
  half: { position: 'absolute', top: 0, left: 0, width: RING / 2, height: RING, overflow: 'hidden' },
  rightHalf: { left: RING / 2 },
  arc: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: STROKE,
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
  },
  rightArc: { left: -RING / 2 },
  title: { flexShrink: 1 },
});
