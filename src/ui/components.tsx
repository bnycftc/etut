import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, type TextStyle, View } from 'react-native';

import { space, usePalette } from './theme';

export function Screen({ children }: { children: ReactNode }) {
  const c = usePalette();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Card({ children }: { children: ReactNode }) {
  const c = usePalette();
  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      {children}
    </View>
  );
}

type TextVariant = 'title' | 'heading' | 'body' | 'muted' | 'small';

export function Label({
  children,
  variant = 'body',
  style,
}: {
  children: ReactNode;
  variant?: TextVariant;
  style?: TextStyle;
}) {
  const c = usePalette();
  const color = variant === 'muted' || variant === 'small' ? c.textMuted : c.text;
  return <Text style={[styles[variant], { color }, style]}>{children}</Text>;
}

type ButtonKind = 'primary' | 'secondary' | 'danger';

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled = false,
  large = false,
}: {
  title: string;
  onPress: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  large?: boolean;
}) {
  const c = usePalette();
  const background = kind === 'primary' ? c.accent : kind === 'danger' ? c.danger : c.surface;
  const color = kind === 'secondary' ? c.text : c.accentText;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        large && styles.buttonLarge,
        {
          backgroundColor: background,
          borderColor: kind === 'secondary' ? c.border : background,
          opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
        },
      ]}>
      <Text style={[styles.buttonText, large && styles.buttonTextLarge, { color }]}>{title}</Text>
    </Pressable>
  );
}

export function Chip({
  title,
  selected,
  onPress,
}: {
  title: string;
  selected: boolean;
  onPress: () => void;
}) {
  const c = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? c.accent : c.surface,
          borderColor: selected ? c.accent : c.border,
        },
      ]}>
      <Text style={{ color: selected ? c.accentText : c.text, fontSize: 15 }}>{title}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

export function Row({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

export interface Bar {
  key: string;
  label: string;
  value: number;
  valueLabel: string;
  highlight?: boolean;
}

/** Plain vertical bar chart built from Views (no chart library). */
export function BarChart({ bars, height = 140 }: { bars: Bar[]; height?: number }) {
  const c = usePalette();
  const max = Math.max(...bars.map((b) => b.value), 0);
  return (
    <View style={[styles.chart, { height: height + 44 }]}>
      {bars.map((b) => {
        const h = max > 0 ? Math.max(2, (b.value / max) * height) : 2;
        return (
          <View key={b.key} style={styles.barColumn}>
            <Text style={[styles.barValue, { color: c.textMuted }]} numberOfLines={1}>
              {b.valueLabel}
            </Text>
            <View
              style={{
                height: h,
                width: '70%',
                borderRadius: 4,
                backgroundColor: b.value > 0 ? (b.highlight ? c.accent : c.bar) : c.barMuted,
                opacity: b.highlight || b.value === 0 ? 1 : 0.7,
              }}
            />
            <Text
              style={[styles.barLabel, { color: b.highlight ? c.text : c.textMuted }]}
              numberOfLines={1}>
              {b.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { padding: space.lg, gap: space.lg, paddingBottom: space.xl * 2 },
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: space.lg, gap: space.md },
  title: { fontSize: 28, fontWeight: '700' },
  heading: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 22 },
  muted: { fontSize: 15, lineHeight: 21 },
  small: { fontSize: 13 },
  button: {
    minHeight: 48,
    paddingHorizontal: space.lg,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  buttonLarge: { minHeight: 72, borderRadius: 16 },
  buttonText: { fontSize: 17, fontWeight: '600' },
  buttonTextLarge: { fontSize: 22 },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  row: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xs },
  barColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: space.xs },
  barValue: { fontSize: 11 },
  barLabel: { fontSize: 12 },
});
