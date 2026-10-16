import { View, type ViewStyle } from 'react-native';

/**
 * Progress ring ("halka", the motif of the app icon), drawn with plain Views: no SVG library and
 * nothing native, so it looks the same on the phone, in the web preview and in tests.
 *
 * A full circle in `track` lies under two arcs in `color`. Each arc is half a circle outline
 * (two border sides coloured, two transparent), clipped to one half of the ring and turned in
 * from the hidden half by the progress: the right half fills first (12 → 6 o'clock), then the
 * left. `ratio` 0…1, clamped. Decorative: the text next to it says the same in words.
 */
export function Ring({
  ratio,
  color,
  track,
  size = 64,
  thickness = 10,
  testID,
}: {
  ratio: number;
  color: string;
  track: string;
  size?: number;
  thickness?: number;
  testID?: string;
}) {
  const turned = Math.min(1, Math.max(0, ratio)) * 360;
  const circle: ViewStyle = {
    position: 'absolute',
    top: 0,
    width: size,
    height: size,
    borderRadius: size / 2,
    borderWidth: thickness,
  };
  const half: ViewStyle = { position: 'absolute', top: 0, width: size / 2, height: size, overflow: 'hidden' };
  return (
    <View
      testID={testID}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={{ width: size, height: size }}>
      <View style={[circle, { left: 0, borderColor: track }]} />
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
    </View>
  );
}
