import { Fragment, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { chartScale, netTrend } from '../domain/exam-analysis';
import { formatNet } from '../domain/net';
import { tr } from '../strings';
import { space, typography, usePalette } from './theme';

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
/** A point: a 12 pt dot in a 3 pt ring of the card colour, so it stands off the line. */
const DOT = 12;
const DOT_RING = 3;
const POINT = DOT + 2 * DOT_RING;
/** The line between points. */
const LINE = 3;
/** The target: a soft band this tall, its value written above its right end. */
const BAND = 10;
/** Height of one line of chart text (values, dates, the target). */
const LABEL_HEIGHT = 16;
const LABEL_WIDTH = 60;
const TARGET_LABEL_WIDTH = 72;
/** Above this many points only the first and last date/value are written (no overlap). */
const LABEL_ALL_MAX = 5;

/** A rectangle in the chart, in points from its top left. */
interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Net trend as dots joined by lines (no chart library). The scale runs from 0 to a round number
 * above the best net (`chartScale`), so a single exam is one point, never a bar filling the card.
 * An optional target is a soft band across the chart with "Hedef 30" at its right end; a value
 * that would be written over the band or that label goes under its point instead. Screen readers
 * get one summary (the target included) instead of every point.
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
    [
      ...points.map((p) => tr.a11y.chartItem(p.label, formatNet(p.value))),
      ...(target === null ? [] : [tr.exams.chartTargetA11y(formatNet(target))]),
      caption,
    ]
      .filter((part) => part !== '')
      .join(', '),
  );

  // The target band, and its label: above the band's right end, else wherever no point covers it
  // (left end, then under the band).
  const band = target === null ? null : { top: y(target) - BAND / 2, bottom: y(target) + BAND / 2 };
  const meets = (a: Box, b: Box) =>
    a.top < b.top + b.height && a.top + a.height > b.top && a.left < b.left + b.width && a.left + a.width > b.left;
  const pointBoxes: Box[] = points.map((p, i) => ({
    left: x(i) - POINT / 2,
    top: y(p.value) - POINT / 2,
    width: POINT,
    height: POINT,
  }));
  const targetLabel: (Box & { align: 'left' | 'right' }) | null = (() => {
    if (band === null) return null;
    const right = plotLeft + plotWidth + SIDE - TARGET_LABEL_WIDTH;
    const left = plotLeft - SIDE;
    const above = band.top - LABEL_HEIGHT;
    const tops = above >= 0 ? [above, band.bottom] : [band.bottom];
    const places = tops.flatMap((top) => [
      { left: right, top, align: 'right' as const },
      { left, top, align: 'left' as const },
    ]);
    const clear = places.find((place) =>
      pointBoxes.every((box) => !meets({ ...place, width: TARGET_LABEL_WIDTH, height: LABEL_HEIGHT }, box)),
    );
    return { ...(clear ?? places[0]), width: TARGET_LABEL_WIDTH, height: LABEL_HEIGHT };
  })();
  const onTarget = (box: Box) =>
    (band !== null && box.top < band.bottom && box.top + box.height > band.top) ||
    (targetLabel !== null && meets(box, targetLabel));
  /**
   * A value sits above its point; under it when the target is in the way above and not below (and
   * there is room above the dates). If both are in the way it stays above.
   */
  const valueTop = (i: number) => {
    const left = x(i) - LABEL_WIDTH / 2;
    const above = y(points[i].value) - POINT / 2 - LABEL_HEIGHT;
    const below = y(points[i].value) + POINT / 2;
    const room = below + LABEL_HEIGHT <= TOP + height + 4;
    const box = (top: number): Box => ({ left, top, width: LABEL_WIDTH, height: LABEL_HEIGHT });
    return room && onTarget(box(above)) && !onTarget(box(below)) ? below : above;
  };

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
        {target !== null && band !== null && targetLabel !== null ? (
          <>
            <View
              testID={testID ? `${testID}-target-band` : undefined}
              style={[
                styles.band,
                { top: band.top, left: plotLeft - SIDE, width: plotWidth + 2 * SIDE, backgroundColor: c.accentSoft },
              ]}
            />
            <Text
              testID={testID ? `${testID}-target` : undefined}
              style={[
                styles.label,
                styles.targetLabel,
                { color: c.accent, left: targetLabel.left, top: targetLabel.top, textAlign: targetLabel.align },
              ]}
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}>
              {tr.exams.chartTarget(formatNet(target))}
            </Text>
          </>
        ) : null}
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
                top: (y1 + y2) / 2 - LINE / 2,
                width: length,
                height: LINE,
                borderRadius: LINE / 2,
                backgroundColor: c.bar,
                transform: [{ rotate: `${Math.atan2(y2 - y1, x2 - x1)}rad` }],
              }}
            />
          );
        })}
        {points.map((p, i) => (
          <Fragment key={p.key}>
            <View
              testID={testID ? `${testID}-point-${i}` : undefined}
              style={[styles.point, { left: x(i) - POINT / 2, top: y(p.value) - POINT / 2, backgroundColor: c.surface }]}>
              <View
                style={[styles.dot, { borderColor: c.accent, backgroundColor: p.hollow ? c.surface : c.accent }]}
              />
            </View>
            {labelled(i) ? (
              <>
                <Text
                  testID={testID ? `${testID}-value-${i}` : undefined}
                  style={[styles.label, { color: c.text, left: x(i) - LABEL_WIDTH / 2, top: valueTop(i) }]}
                  numberOfLines={1}
                  maxFontSizeMultiplier={1.3}>
                  {formatNet(p.value)}
                </Text>
                <Text
                  style={[styles.label, { color: c.textMuted, left: x(i) - LABEL_WIDTH / 2, top: TOP + height + 6 }]}
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
  axis: { position: 'absolute', left: 0, width: AXIS_WIDTH, ...typography.chartLabel, textAlign: 'right' },
  grid: { position: 'absolute', height: StyleSheet.hairlineWidth },
  band: { position: 'absolute', height: BAND, borderRadius: BAND / 2 },
  point: { position: 'absolute', width: POINT, height: POINT, borderRadius: POINT / 2, padding: DOT_RING },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 2.5 },
  label: { position: 'absolute', width: LABEL_WIDTH, ...typography.chartLabel, textAlign: 'center' },
  targetLabel: { width: TARGET_LABEL_WIDTH },
  caption: { fontSize: 13 },
});
