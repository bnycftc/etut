import { type ReactNode, useEffect, useState } from 'react';
import { Animated, Easing, Platform, View, type ViewStyle } from 'react-native';

import { useReducedMotion } from './motion';

/** With `fillFrom`, the ring fills to its share in this time, easing out. */
export const RING_FILL_MS = 600;

const nativeDriver = Platform.OS !== 'web';

/**
 * Progress ring ("halka", the motif of the app icon), drawn with plain Views: no SVG library and
 * nothing native, so it looks the same on the phone, in the web preview and in tests.
 *
 * A full circle in `track` lies under two arcs in `color`. Each arc is half a circle outline
 * (two border sides coloured, two transparent), clipped to one half of the ring and turned in
 * from the hidden half by the progress: the right half fills first (12 → 6 o'clock), then the
 * left. `ratio` 0…1, clamped. `fillFrom` (0…1): the ring fills from there to `ratio` once, as it
 * appears (the session that reached the daily goal); with Reduce Motion it is simply at `ratio`.
 * `children` sit in the middle. Decorative: the text next to it says the same in words.
 */
export function Ring({
  ratio,
  color,
  track,
  size = 64,
  thickness = 10,
  fillFrom,
  children,
  testID,
}: {
  ratio: number;
  color: string;
  track: string;
  size?: number;
  thickness?: number;
  fillFrom?: number;
  children?: ReactNode;
  testID?: string;
}) {
  const reduced = useReducedMotion();
  const arcs = { size, thickness, color, testID };
  return (
    <View
      testID={testID}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View style={[circleStyle(size, thickness), { left: 0, borderColor: track }]} />
      {fillFrom !== undefined && !reduced ? (
        <FillingArcs {...arcs} from={clamp(fillFrom)} to={clamp(ratio)} />
      ) : (
        <Arcs {...arcs} turned={clamp(ratio) * 360} />
      )}
      {children}
    </View>
  );
}

const clamp = (ratio: number) => Math.min(1, Math.max(0, ratio));

function circleStyle(size: number, thickness: number): ViewStyle {
  return { position: 'absolute', top: 0, width: size, height: size, borderRadius: size / 2, borderWidth: thickness };
}

function halfStyle(size: number): ViewStyle {
  return { position: 'absolute', top: 0, width: size / 2, height: size, overflow: 'hidden' };
}

interface ArcProps {
  size: number;
  thickness: number;
  color: string;
  testID?: string;
}

/** The arcs at rest, `turned` degrees from 12 o'clock; an empty half is not drawn at all. */
function Arcs({ size, thickness, color, testID, turned }: ArcProps & { turned: number }) {
  const circle = circleStyle(size, thickness);
  const half = halfStyle(size);
  return (
    <>
      {turned > 0 ? (
        // Right half. The bottom + left sides (135°–315°) turned by 45° lie on the hidden left
        // half; turning further brings `turned` degrees of it in from 12 o'clock.
        <View style={[half, { left: size / 2 }]}>
          <View
            testID={testID ? `${testID}-right` : undefined}
            style={[
              circle,
              {
                left: -size / 2,
                borderColor: 'transparent',
                borderBottomColor: color,
                borderLeftColor: color,
                transform: [{ rotate: `${45 + Math.min(turned, 180)}deg` }],
              },
            ]}
          />
        </View>
      ) : null}
      {turned > 180 ? (
        // Left half, from 6 o'clock on: the top + right sides parked on the right half.
        <View style={[half, { left: 0 }]}>
          <View
            testID={testID ? `${testID}-left` : undefined}
            style={[
              circle,
              {
                left: 0,
                borderColor: 'transparent',
                borderTopColor: color,
                borderRightColor: color,
                transform: [{ rotate: `${45 + turned - 180}deg` }],
              },
            ]}
          />
        </View>
      ) : null}
    </>
  );
}

/** The same two arcs turned by one animated value, from `from` to `to` in `RING_FILL_MS`. */
function FillingArcs({ size, thickness, color, testID, from, to }: ArcProps & { from: number; to: number }) {
  const [progress] = useState(() => new Animated.Value(from));
  useEffect(() => {
    const fill = Animated.timing(progress, {
      toValue: to,
      duration: RING_FILL_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: nativeDriver,
    });
    fill.start();
    return () => fill.stop();
  }, [progress, to]);
  // 0…50 % turns the right arc in (45° → 225°), 50…100 % the left one.
  const right = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['45deg', '225deg', '225deg'] });
  const left = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: ['45deg', '45deg', '225deg'] });
  const circle = circleStyle(size, thickness);
  const half = halfStyle(size);
  return (
    <>
      <View style={[half, { left: size / 2 }]}>
        <Animated.View
          testID={testID ? `${testID}-right` : undefined}
          style={[
            circle,
            {
              left: -size / 2,
              borderColor: 'transparent',
              borderBottomColor: color,
              borderLeftColor: color,
              transform: [{ rotate: right }],
            },
          ]}
        />
      </View>
      <View style={[half, { left: 0 }]}>
        <Animated.View
          testID={testID ? `${testID}-left` : undefined}
          style={[
            circle,
            {
              left: 0,
              borderColor: 'transparent',
              borderTopColor: color,
              borderRightColor: color,
              transform: [{ rotate: left }],
            },
          ]}
        />
      </View>
    </>
  );
}
