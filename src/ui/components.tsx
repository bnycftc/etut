import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, type TextStyle, View } from 'react-native';

import { tr } from '../strings';
import { Icon, type IconName } from './icon';
import { MAX_FONT_SCALE, space, useLargeText, usePalette } from './theme';

export function Screen({ children, testID }: { children: ReactNode; testID?: string }) {
  const c = usePalette();
  return (
    <ScrollView
      testID={testID}
      style={{ flex: 1, backgroundColor: c.background }}
      contentContainerStyle={styles.screen}
      keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Card({
  children,
  testID,
  tone = 'default',
  outline,
}: {
  children: ReactNode;
  testID?: string;
  /** `accent`: soft brand tint (the "today" card). */
  tone?: 'default' | 'accent';
  /** A 2 pt coloured outline (e.g. the running subject). */
  outline?: string;
}) {
  const c = usePalette();
  return (
    <View
      testID={testID}
      style={[
        styles.card,
        { backgroundColor: tone === 'accent' ? c.accentSoft : c.surface, borderColor: c.border },
        outline ? { borderColor: outline, borderWidth: 2 } : null,
      ]}>
      {children}
    </View>
  );
}

/** Small round colour mark (subject colour) next to a name. Decorative. */
export function Dot({ color, size = 10, ring }: { color: string; size?: number; ring?: string }) {
  return (
    <View
      accessible={false}
      importantForAccessibility="no"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        borderWidth: ring ? 1.5 : 0,
        borderColor: ring,
      }}
    />
  );
}

/** A `Row` that stacks its children at accessibility text sizes, so side-by-side controls never clip. */
export function ResponsiveRow({ children }: { children: ReactNode }) {
  const large = useLargeText();
  return <View style={large ? styles.stack : styles.row}>{children}</View>;
}

type TextVariant = 'title' | 'heading' | 'body' | 'muted' | 'small';

/** Titles and headings are announced as headers, so screen readers can jump between them. */
export function Label({
  children,
  variant = 'body',
  style,
  testID,
  maxFontSizeMultiplier,
}: {
  children: ReactNode;
  variant?: TextVariant;
  style?: TextStyle;
  testID?: string;
  maxFontSizeMultiplier?: number;
}) {
  const c = usePalette();
  const color = variant === 'muted' || variant === 'small' ? c.textMuted : c.text;
  return (
    <Text
      testID={testID}
      accessibilityRole={variant === 'title' || variant === 'heading' ? 'header' : undefined}
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[styles[variant], { color }, style]}>
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
  compact = false,
  testID,
  accessibilityLabel,
  accessibilityHint,
}: {
  title: string;
  onPress: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  large?: boolean;
  /** Smaller (44 pt) button that does not stretch, for actions inside a card row. */
  compact?: boolean;
  testID?: string;
  /** Defaults to `title`. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const c = usePalette();
  // Disabled: a grey fill with a muted label instead of a faded colour (readable, clearly off).
  const background = disabled
    ? c.disabled
    : kind === 'primary'
      ? c.primary
      : kind === 'danger'
        ? c.dangerFill
        : c.surface;
  const color = disabled
    ? c.textMuted
    : kind === 'secondary'
      ? c.text
      : kind === 'danger'
        ? c.onDanger
        : c.onPrimary;
  const borderColor = disabled ? c.disabled : kind === 'secondary' ? c.controlBorder : background;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        large && styles.buttonLarge,
        compact && styles.buttonCompact,
        { backgroundColor: background, borderColor, opacity: pressed ? 0.8 : 1 },
      ]}>
      <Text style={[styles.buttonText, large && styles.buttonTextLarge, compact && styles.buttonTextCompact, { color }]}>
        {title}
      </Text>
    </Pressable>
  );
}

/**
 * Full-width list row with an icon, a title and a chevron (secondary navigation, e.g. the
 * shortcuts on the timer screen). Announced as a button with its title.
 */
export function ListRow({
  icon,
  title,
  onPress,
  testID,
}: {
  icon: IconName;
  title: string;
  onPress: () => void;
  testID?: string;
}) {
  const c = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => [styles.listRow, { opacity: pressed ? 0.6 : 1 }]}>
      <Icon name={icon} color={c.accent} />
      <Text style={[styles.body, { color: c.text, flex: 1 }]}>{title}</Text>
      <Icon name="chevron" color={c.textMuted} size={16} />
    </Pressable>
  );
}

/** Text button with an icon for a navigation header ("Geçmiş"). */
export function HeaderButton({
  icon,
  title,
  onPress,
  testID,
}: {
  icon: IconName;
  title: string;
  onPress: () => void;
  testID?: string;
}) {
  const c = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.headerButton, { opacity: pressed ? 0.6 : 1 }]}>
      <Icon name={icon} color={c.accent} size={20} />
      <Text style={{ color: c.accent, fontSize: 17 }} maxFontSizeMultiplier={MAX_FONT_SCALE.header}>
        {title}
      </Text>
    </Pressable>
  );
}

/** Selectable chip; announced as a button with its selected state. */
export function Chip({
  title,
  selected,
  onPress,
  testID,
  accessibilityLabel,
  color,
}: {
  title: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
  accessibilityLabel?: string;
  /** Leading colour dot (the subject colour). */
  color?: string;
}) {
  const c = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ selected }}
      onPress={onPress}
      // Same layout as before; the touch target grows to ≥ 44 pt (the row gap is 8).
      hitSlop={4}
      style={[
        styles.chip,
        color ? styles.chipWithDot : null,
        {
          backgroundColor: selected ? c.primary : c.surface,
          borderColor: selected ? c.primary : c.controlBorder,
        },
      ]}>
      {color ? <Dot color={color} ring={selected ? c.onPrimary : undefined} /> : null}
      <Text style={{ color: selected ? c.onPrimary : c.text, fontSize: 15 }}>{title}</Text>
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
    <View style={[styles.tag, { borderColor: c.controlBorder, backgroundColor: c.background }]}>
      <Text style={{ color: c.textMuted, fontSize: 12 }}>{title}</Text>
    </View>
  );
}

/** Horizontal progress bar, `ratio` 0…1. */
export function ProgressBar({
  ratio,
  label = tr.a11y.progress,
  testID,
}: {
  ratio: number;
  label?: string;
  testID?: string;
}) {
  const c = usePalette();
  const percent = Math.round(Math.min(1, Math.max(0, ratio)) * 100);
  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: percent, text: `%${percent}` }}
      style={[styles.progress, { backgroundColor: c.barMuted }]}>
      <View style={{ width: `${percent}%`, height: '100%', borderRadius: 4, backgroundColor: c.accent }} />
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
      <Text style={[styles.small, { color: c.textMuted }]} importantForAccessibility="no" accessibilityElementsHidden>
        {label}
      </Text>
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
        style={[styles.input, { color: c.text, borderColor: c.controlBorder, backgroundColor: c.background }]}
      />
    </View>
  );
}

/** Labelled free-text field (nickname, group name, codes). */
export function TextField({
  label,
  value,
  onChange,
  placeholder,
  maxLength,
  code = false,
  testID,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength: number;
  /** Codes: upper case, no autocorrect. */
  code?: boolean;
  testID?: string;
}) {
  const c = usePalette();
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={[styles.small, { color: c.textMuted }]} importantForAccessibility="no" accessibilityElementsHidden>
        {label}
      </Text>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        maxLength={maxLength}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        autoCapitalize={code ? 'characters' : 'sentences'}
        autoCorrect={false}
        style={[styles.input, { color: c.text, borderColor: c.controlBorder, backgroundColor: c.background }]}
      />
    </View>
  );
}

/** − value + control. Each button announces the current value. */
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
  const button = (symbol: string, a11yLabel: string, onPress: () => void, disabled: boolean, id: string) => (
    <Pressable
      testID={testID ? `${testID}-${id}` : undefined}
      accessibilityRole="button"
      accessibilityLabel={a11yLabel}
      accessibilityValue={{ text: value }}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={4}
      style={[styles.stepButton, { borderColor: c.controlBorder, opacity: disabled ? 0.4 : 1 }]}>
      <Text style={{ color: c.text, fontSize: 18, fontWeight: '600' }} maxFontSizeMultiplier={1.4}>
        {symbol}
      </Text>
    </Pressable>
  );
  return (
    <View style={styles.row}>
      <Text style={[styles.muted, { color: c.textMuted, flex: 1 }]}>{label}</Text>
      {button('−', tr.a11y.decrease(label), onMinus, minusDisabled, 'minus')}
      <Text style={[styles.body, { color: c.text, minWidth: 64, textAlign: 'center' }]}>{value}</Text>
      {button('+', tr.a11y.increase(label), onPlus, plusDisabled, 'plus')}
    </View>
  );
}

/** Title, short explanation and an optional action, for screens without data yet. */
export function EmptyState({
  title,
  body,
  action,
  onAction,
  testID,
}: {
  title?: string;
  body: string;
  action?: string;
  onAction?: () => void;
  testID?: string;
}) {
  return (
    <Card testID={testID}>
      {title ? <Label variant="heading">{title}</Label> : null}
      <Label variant="muted">{body}</Label>
      {action && onAction ? (
        <Row>
          <Button testID={testID ? `${testID}-action` : undefined} kind="secondary" title={action} onPress={onAction} />
        </Row>
      ) : null}
    </Card>
  );
}

export interface Bar {
  key: string;
  label: string;
  value: number;
  valueLabel: string;
  highlight?: boolean;
}

/**
 * Plain vertical bar chart built from Views (no chart library). Screen readers get the values
 * as one summary instead of every bar and label separately.
 */
export function BarChart({ bars, height = 140 }: { bars: Bar[]; height?: number }) {
  const c = usePalette();
  const max = Math.max(...bars.map((b) => b.value), 0);
  const summary = tr.a11y.chart(bars.map((b) => tr.a11y.chartItem(b.label, b.valueLabel)).join(', '));
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={summary}
      style={[styles.chart, { height: height + 44 }]}>
      {bars.map((b) => {
        const h = max > 0 ? Math.max(2, (b.value / max) * height) : 2;
        return (
          <View key={b.key} style={styles.barColumn}>
            <Text style={[styles.barValue, { color: c.textMuted }]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
              {b.valueLabel}
            </Text>
            <View
              style={{
                height: h,
                width: '70%',
                borderRadius: 4,
                backgroundColor: b.value > 0 ? (b.highlight ? c.accent : c.bar) : c.barMuted,
              }}
            />
            <Text
              style={[styles.barLabel, { color: b.highlight ? c.text : c.textMuted }]}
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}>
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
    paddingVertical: space.sm,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  buttonLarge: { minHeight: 72, borderRadius: 16 },
  buttonCompact: { minHeight: 44, paddingHorizontal: space.md, flexGrow: 0, borderRadius: 10 },
  buttonText: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
  buttonTextLarge: { fontSize: 22 },
  buttonTextCompact: { fontSize: 15 },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipWithDot: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  row: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  stack: { flexDirection: 'column', gap: space.sm, alignItems: 'stretch' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 44 },
  headerButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.lg, minHeight: 44 },
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
