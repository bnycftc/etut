import { Fragment, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { chartScale, netTrend } from '../domain/exam-analysis';
import { formatNet } from '../domain/net';
import { tr } from '../strings';
import { space, usePalette } from './theme';

export interface NetPoint {
  key: string;
  /** Short date under the point. */
  label: string;
  value: number;
  /** Hollow dot (branch exam next to general ones). */
  hollow?: boolean;
}

const AXIS_WIDTH = 28;
const TOP = 20;
const BOTTOM = 22;
const SIDE = 14;
const DOT = 10;
/** Above this many points only the first and last date/value are written (no overlap). */
const LABEL_ALL_MAX = 5;

/**
 * Net trend as dots joined by lines (no chart library). The scale runs from 0 to a round number
 * above the best net (`chartScale`), so a single exam is one point, never a bar filling the card.
 * An optional target is a dashed line. Screen readers get one summary instead of every point.
 */
export function NetChart({
  points,
  questions,
  target = null,
  height = 140,
  testID,
}: {
  points: NetPoint[];
  /** Question count of the paper or section: the scale never goes above it. */
  questions: number;
  target?: number | null;
  height?: number;
  testID?: string;
}) {
  const c = usePalette();
  const window = useWindowDimensions();
  // Before the first layout (and in tests) assume the usual card width.
  const [measured, setMeasured] = useState(0);
  const width = measured > 0 ? measured : Math.max(200, window.width - 4 * space.lg);
  const { min, max } = chartScale(
    points.map((p) => p.value),
    target,
    questions,
  );
  const plotLeft = AXIS_WIDTH + SIDE;
  const plotWidth = Math.max(1, width - plotLeft - SIDE);
  const x = (i: number) =>
    points.length === 1 ? plotLeft + plotWidth / 2 : plotLeft + (i * plotWidth) / (points.length - 1);
  const y = (v: number) => TOP + ((max - Math.min(max, Math.max(min, v))) / (max - min)) * height;
  const labelled = (i: number) => points.length <= LABEL_ALL_MAX || i === 0 || i === points.length - 1;

  const trend = netTrend(points.map((p) => p.value));
  const caption =
    trend === null
      ? ''
      : trend.change === null
        ? tr.exams.chartSingle(formatNet(trend.last))
        : tr.exams.chartChange(formatNet(trend.last), signed(trend.change));
  const summary = tr.a11y.chart(
    [...points.map((p) => tr.a11y.chartItem(p.label, formatNet(p.value))), caption].join(', '),
  );

  const dashes = target === null ? [] : Array.from({ length: Math.floor(plotWidth / 10) + 1 }, (_, i) => i);

  return (
    <View style={{ gap: space.sm }}>
      <View
        testID={testID}
        accessible
        accessibilityRole="image"
        accessibilityLabel={summary}
        onLayout={(e) => setMeasured(e.nativeEvent.layout.width)}
        style={{ height: TOP + height + BOTTOM }}>
        {/* Scale: top value and zero line. */}
        <Text style={[styles.axis, { color: c.textMuted, top: TOP - 8 }]} maxFontSizeMultiplier={1.3}>
          {formatNet(max)}
        </Text>
        <View style={[styles.grid, { top: TOP, left: plotLeft - SIDE, width: plotWidth + 2 * SIDE, backgroundColor: c.border }]} />
        <Text style={[styles.axis, { color: c.textMuted, top: y(0) - 8 }]} maxFontSizeMultiplier={1.3}>
          0
        </Text>
        <View
          style={[styles.grid, { top: y(0), left: plotLeft - SIDE, width: plotWidth + 2 * SIDE, backgroundColor: c.border }]}
        />
        {dashes.map((i) => (
          <View
            key={`t${i}`}
            style={{
              position: 'absolute',
              left: plotLeft + i * 10,
              top: y(target ?? 0) - 1,
              width: 5,
              height: 2,
              backgroundColor: c.warning,
            }}
          />
        ))}
        {points.slice(1).map((p, i) => {
          const x1 = x(i);
          const y1 = y(points[i].value);
          const x2 = x(i + 1);
          const y2 = y(p.value);
          const length = Math.hypot(x2 - x1, y2 - y1);
          return (
            <View
              key={`l${p.key}`}
              style={{
                position: 'absolute',
                left: (x1 + x2) / 2 - length / 2,
                top: (y1 + y2) / 2 - 1,
                width: length,
                height: 2,
                backgroundColor: c.bar,
                transform: [{ rotate: `${Math.atan2(y2 - y1, x2 - x1)}rad` }],
              }}
            />
          );
        })}
        {points.map((p, i) => (
          <Fragment key={p.key}>
            <View
              style={{
                position: 'absolute',
                left: x(i) - DOT / 2,
                top: y(p.value) - DOT / 2,
                width: DOT,
                height: DOT,
                borderRadius: DOT / 2,
                borderWidth: 2,
                borderColor: c.accent,
                backgroundColor: p.hollow ? c.surface : c.accent,
              }}
            />
            {labelled(i) ? (
              <>
                <Text
                  style={[styles.value, { color: c.text, left: x(i) - 30, top: y(p.value) - DOT / 2 - 17 }]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.3}>
                  {formatNet(p.value)}
                </Text>
                <Text
                  style={[styles.value, { color: c.textMuted, left: x(i) - 30, top: TOP + height + 6 }]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.3}>
                  {p.label}
                </Text>
              </>
            ) : null}
          </Fragment>
        ))}
      </View>
      {caption ? (
        <Text testID={testID ? `${testID}-caption` : undefined} style={[styles.caption, { color: c.textMuted }]}>
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

/** `+2,5`, `−1`, `0` */
function signed(change: number): string {
  if (change > 0) return `+${formatNet(change)}`;
  if (change < 0) return `−${formatNet(-change)}`;
  return '0';
}

const styles = StyleSheet.create({
  axis: { position: 'absolute', left: 0, width: AXIS_WIDTH, fontSize: 11, textAlign: 'right' },
  grid: { position: 'absolute', height: StyleSheet.hairlineWidth },
  value: { position: 'absolute', width: 60, fontSize: 11, textAlign: 'center' },
  caption: { fontSize: 13 },
});
