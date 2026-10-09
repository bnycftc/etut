import { StyleSheet, Text, View } from 'react-native';

import type { MonthView } from '../domain/month-calendar';
import { tr } from '../strings';
import { Label } from './components';
import { formatDay, formatDuration } from './format';
import { heatColor } from './heat-colors';
import { space, usePalette } from './theme';

/** Day numbers stay inside their square at every text size; the label carries the rest. */
const CELL_FONT_SCALE = 1.3;

/**
 * Monday-first month grid, each day shaded by its study time (`heat-colors.ts`). Every day is its
 * own accessibility element ("7 Ekim 2026: 2 sa 10 dk"); the shade legend is one element.
 */
export function MonthCalendar({ view, today, testID }: { view: MonthView; today: string; testID?: string }) {
  const c = usePalette();
  return (
    <View testID={testID} style={{ gap: space.xs }}>
      <View style={styles.row} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {Array.from({ length: 7 }, (_, i) => (
          <Text key={i} style={[styles.weekday, { color: c.textMuted }]} maxFontSizeMultiplier={CELL_FONT_SCALE}>
            {tr.weekdayShort(i)}
          </Text>
        ))}
      </View>
      {view.weeks.map((week, w) => (
        <View key={w} style={styles.row}>
          {week.map((cell, i) => {
            if (cell === null) return <View key={`blank-${i}`} style={styles.cell} />;
            const date = formatDay(cell.day);
            const label = cell.future
              ? tr.monthly.cellFuture(date)
              : cell.ms > 0
                ? tr.monthly.cell(date, formatDuration(cell.ms))
                : tr.monthly.cellNone(date);
            const colors = heatColor(cell.level, c);
            return (
              <View
                key={cell.day}
                testID={`monthly-day-${cell.day}`}
                accessible
                accessibilityLabel={label}
                style={[
                  styles.cell,
                  styles.filled,
                  {
                    backgroundColor: cell.future ? 'transparent' : colors.fill,
                    borderColor: cell.day === today ? c.text : 'transparent',
                  },
                ]}>
                <Text
                  style={[styles.date, { color: cell.future ? c.textMuted : colors.text }]}
                  maxFontSizeMultiplier={CELL_FONT_SCALE}>
                  {cell.date}
                </Text>
              </View>
            );
          })}
        </View>
      ))}
      <Legend />
    </View>
  );
}

function Legend() {
  const c = usePalette();
  const levels = tr.monthly.levels;
  return (
    <View
      accessible
      accessibilityLabel={tr.monthly.legendA11y(levels.join(', '))}
      style={{ gap: space.xs, marginTop: space.xs }}>
      <View style={styles.legendRow}>
        {levels.map((name, level) => (
          <View key={name} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: heatColor(level as 0 | 1 | 2 | 3 | 4, c).fill }]} />
            <Text style={[styles.legendText, { color: c.textMuted }]}>{name}</Text>
          </View>
        ))}
      </View>
      <Label variant="small">{tr.monthly.legend}</Label>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.xs },
  weekday: { flex: 1, textAlign: 'center', fontSize: 12 },
  cell: { flex: 1, aspectRatio: 1 },
  filled: { borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  date: { fontSize: 13, fontWeight: '600', fontVariant: ['tabular-nums'] },
  legendRow: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.md, rowGap: space.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  swatch: { width: 14, height: 14, borderRadius: 3 },
  legendText: { fontSize: 12 },
});
