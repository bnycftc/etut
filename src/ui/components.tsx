import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, type TextStyle, View } from 'react-native';

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
  testID,
}: {
  children: ReactNode;
  variant?: TextVariant;
  style?: TextStyle;
  testID?: string;
}) {
  const c = usePalette();
  const color = variant === 'muted' || variant === 'small' ? c.textMuted : c.text;
  return (
    <Text testID={testID} style={[styles[variant], { color }, style]}>
      {children}
    </Text>
  );
}

type ButtonKind = 'primary' | 'secondary' | 'danger';

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled = false,
  large = false,
  testID,
}: {
  title: string;
  onPress: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  large?: boolean;
  testID?: string;
}) {
  const c = usePalette();
  const background = kind === 'primary' ? c.accent : kind === 'danger' ? c.danger : c.surface;
  const color = kind === 'secondary' ? c.text : c.accentText;
  return (
    <Pressable
      testID={testID}
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
  testID,
}: {
  title: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const c = usePalette();
  return (
    <Pressable
      testID={testID}
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

/** Small "elle" style tag next to a value. */
export function Tag({ title }: { title: string }) {
  const c = usePalette();
  return (
    <View style={[styles.tag, { borderColor: c.border, backgroundColor: c.background }]}>
      <Text style={{ color: c.textMuted, fontSize: 12 }}>{title}</Text>
    </View>
  );
}

/** Horizontal progress bar, `ratio` 0…1. */
export function ProgressBar({ ratio }: { ratio: number }) {
  const c = usePalette();
  const width = `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)}%` as const;
  return (
    <View style={[styles.progress, { backgroundColor: c.barMuted }]}>
      <View style={{ width, height: '100%', borderRadius: 4, backgroundColor: c.accent }} />
    </View>
  );
}

/** Labelled numeric text field. */
export function Field({
  label,
  value,
  onChange,
  placeholder,
  maxLength = 3,
  numeric = true,
  testID,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  numeric?: boolean;
  testID?: string;
}) {
  const c = usePalette();
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={[styles.small, { color: c.textMuted }]}>{label}</Text>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? 'number-pad' : 'numbers-and-punctuation'}
        inputMode={numeric ? 'numeric' : 'text'}
        maxLength={maxLength}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        style={[styles.input, { color: c.text, borderColor: c.border, backgroundColor: c.background }]}
      />
    </View>
  );
}

/** − value + control. */
export function Stepper({
  label,
  value,
  onMinus,
  onPlus,
  minusDisabled = false,
  plusDisabled = false,
  testID,
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  minusDisabled?: boolean;
  plusDisabled?: boolean;
  testID?: string;
}) {
  const c = usePalette();
  const button = (symbol: string, onPress: () => void, disabled: boolean, id: string) => (
    <Pressable
      testID={testID ? `${testID}-${id}` : undefined}
      accessibilityRole="button"
      accessibilityLabel={`${label} ${symbol}`}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.stepButton, { borderColor: c.border, opacity: disabled ? 0.4 : 1 }]}>
      <Text style={{ color: c.text, fontSize: 18, fontWeight: '600' }}>{symbol}</Text>
    </Pressable>
  );
  return (
    <View style={styles.row}>
      <Text style={[styles.muted, { color: c.textMuted, flex: 1 }]}>{label}</Text>
      {button('−', onMinus, minusDisabled, 'minus')}
      <Text style={[styles.body, { color: c.text, minWidth: 64, textAlign: 'center' }]}>{value}</Text>
      {button('+', onPlus, plusDisabled, 'plus')}
    </View>
  );
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
  tag: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  progress: { height: 8, borderRadius: 4, overflow: 'hidden' },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
  },
  stepButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xs },
  barColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: space.xs },
  barValue: { fontSize: 11 },
  barLabel: { fontSize: 12 },
});
