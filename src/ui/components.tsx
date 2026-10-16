import { type ReactNode, useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, type TextStyle, View } from 'react-native';

import { tr } from '../strings';
import { announce } from './feedback';
import { Icon, type IconName } from './icon';
import { MAX_FONT_SCALE, space, typography, useLargeText, usePalette } from './theme';

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

/**
 * A surface on the screen background: no hairline, no shadow, 16 pt corners. The `hero` card
 * (one per screen, the "today" card) is the soft brand tint with 20 pt corners and a 1 pt edge
 * (`heroBorder`): the tint alone is close to the background in both themes.
 */
export function Card({
  children,
  testID,
  tone = 'default',
  outline,
  tint,
}: {
  children: ReactNode;
  testID?: string;
  /** `hero`: soft brand tint (the "today" card); `accent` is its older name. */
  tone?: 'default' | 'hero' | 'accent';
  /** A 2 pt coloured outline (e.g. the running subject). */
  outline?: string;
  /** Background instead of the surface (the running card's subject tint, `subjectTint`). */
  tint?: string;
}) {
  const c = usePalette();
  const hero = tone !== 'default';
  return (
    <View
      testID={testID}
      style={[
        styles.card,
        hero ? styles.cardHero : null,
        { backgroundColor: tint ?? (hero ? c.accentSoft : c.surface) },
        hero ? { borderWidth: 1, borderColor: c.heroBorder } : null,
        outline ? { borderColor: outline, borderWidth: 2 } : null,
      ]}>
      {children}
    </View>
  );
}

/**
 * A titled group of the screen, like an iOS grouped list: the title stands above its content,
 * outside any card, in muted capitals, with a section's 32 pt above it (cards in a section stay
 * 16 apart). The content is secondary rows (`ListRow`) on the background, or a `Card`.
 */
export function Section({ title, children, testID }: { title: string; children: ReactNode; testID?: string }) {
  const c = usePalette();
  return (
    <View testID={testID} style={styles.section}>
      <Text
        accessibilityRole="header"
        // Read as written, not letter by letter; Turkish capitals (i → İ) on screen.
        accessibilityLabel={title}
        style={[styles.sectionTitle, { color: c.textMuted }]}>
        {title.toLocaleUpperCase('tr-TR')}
      </Text>
      {children}
    </View>
  );
}

/** Small round colour mark (subject colour) next to a name. Decorative. */
export function Dot({ color, size = 10 }: { color: string; size?: number }) {
  return (
    <View
      accessible={false}
      importantForAccessibility="no"
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }}
    />
  );
}

/** A `Row` that stacks its children at accessibility text sizes, so side-by-side controls never clip. */
export function ResponsiveRow({ children }: { children: ReactNode }) {
  const large = useLargeText();
  return <View style={large ? styles.stack : styles.row}>{children}</View>;
}

type TextVariant = 'display' | 'displaySmall' | 'largeTitle' | 'title' | 'heading' | 'body' | 'muted' | 'small';

/**
 * Titles and headings are announced as headers, so screen readers can jump between them.
 * `display` / `displaySmall` are hero numbers (rounded, tabular digits; see `typography`).
 */
export function Label({
  children,
  variant = 'body',
  style,
  testID,
  maxFontSizeMultiplier,
  live = false,
}: {
  children: ReactNode;
  variant?: TextVariant;
  style?: TextStyle;
  testID?: string;
  maxFontSizeMultiplier?: number;
  /**
   * A message that appears after an action (saved, an error): screen readers read it out when it
   * appears or changes, without the student having to find it. A number (a count of attempts)
   * also reads out an unchanged message again when it goes up: a second failed "Kaydet".
   */
  live?: boolean | number;
}) {
  const c = usePalette();
  const color = variant === 'muted' || variant === 'small' ? c.textMuted : c.text;
  const spoken = live !== false && typeof children === 'string' ? children : null;
  useEffect(() => {
    if (spoken !== null) announce(spoken);
  }, [spoken, live]);
  return (
    <Text
      testID={testID}
      accessibilityRole={
        variant === 'largeTitle' || variant === 'title' || variant === 'heading' ? 'header' : undefined
      }
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[styles[variant], { color }, style]}>
      {children}
    </Text>
  );
}

/**
 * `primary`: filled brand blue. `secondary`: tonal (iOS "tinted": soft blue fill, blue label, no
 * outline; an outline means "can be typed into or picked"). `dangerSoft`: tonal red for a
 * destructive step that can still be taken back ("Bitir", "Geri al"). `danger`: full red, only
 * for the final destructive confirmation ("Evet, hepsini sil").
 */
type ButtonKind = 'primary' | 'secondary' | 'dangerSoft' | 'danger';

/** Faded, not greyed: a grey fill read like a selected segment. */
const DISABLED_OPACITY = 0.4;

export function Button({
  title,
  onPress,
  kind = 'primary',
  disabled = false,
  large = false,
  tall = false,
  compact = false,
  testID,
  accessibilityLabel,
  accessibilityHint,
}: {
  title: string;
  onPress: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  /** 72 pt: the timer's own actions (Başla, Duraklat, Bitir). */
  large?: boolean;
  /** 56 pt: the main action at the top of a list screen ("Deneme ekle"). */
  tall?: boolean;
  /** Small 36 pt pill (44 pt touch area) that does not stretch, for actions inside a card row. */
  compact?: boolean;
  testID?: string;
  /** Defaults to `title`. */
  accessibilityLabel?: string;
  accessibilityHint?: string;
}) {
  const c = usePalette();
  const background =
    kind === 'primary' ? c.primary : kind === 'secondary' ? c.secondaryFill : kind === 'dangerSoft' ? c.dangerSoft : c.dangerFill;
  const color =
    kind === 'primary' ? c.onPrimary : kind === 'secondary' ? c.accent : kind === 'dangerSoft' ? c.danger : c.onDanger;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={compact ? 4 : undefined}
      style={({ pressed }) => [
        styles.button,
        large && styles.buttonLarge,
        tall && styles.buttonTall,
        compact && styles.buttonCompact,
        {
          backgroundColor: background,
          opacity: disabled ? DISABLED_OPACITY : pressed ? 0.85 : 1,
          // Pressed: a slight press-in (no animation, so nothing moves with Reduce Motion either).
          transform: pressed ? [{ scale: 0.98 }] : undefined,
        },
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

/** One of the two buttons of a `PeriodNav`. */
export interface PeriodStep {
  /** What the button does, for screen readers ("Önceki hafta"). */
  title: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
}

/**
 * The period on screen (a week, a month, a day) between ‹ and › buttons that step back and
 * forward. The 44 pt round buttons keep their place at every text size; the name wraps between
 * them. With `heading` the name is announced as a header (the month on its card).
 */
export function PeriodNav({
  label,
  labelTestID,
  heading = false,
  prev,
  next,
}: {
  label: string;
  labelTestID?: string;
  heading?: boolean;
  prev: PeriodStep;
  next: PeriodStep;
}) {
  const c = usePalette();
  const step = (s: PeriodStep, icon: IconName) => (
    <Pressable
      testID={s.testID}
      accessibilityRole="button"
      accessibilityLabel={s.title}
      accessibilityState={{ disabled: s.disabled === true }}
      disabled={s.disabled}
      onPress={s.onPress}
      style={({ pressed }) => [
        styles.periodStep,
        { backgroundColor: c.secondaryFill, opacity: s.disabled ? DISABLED_OPACITY : pressed ? 0.85 : 1 },
      ]}>
      <Icon name={icon} color={c.accent} size={18} />
    </Pressable>
  );
  return (
    <View style={styles.row}>
      {step(prev, 'chevronLeft')}
      <Label
        variant={heading ? 'heading' : 'body'}
        testID={labelTestID}
        style={heading ? styles.periodLabel : styles.periodLabelBody}>
        {label}
      </Label>
      {step(next, 'chevron')}
    </View>
  );
}

/** Text button, with an icon or without ("Vazgeç"), for a navigation header ("Geçmiş"). */
export function HeaderButton({
  icon,
  title,
  onPress,
  testID,
}: {
  icon?: IconName;
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
      {icon ? <Icon name={icon} color={c.accent} size={20} /> : null}
      <Text style={{ color: c.accent, fontSize: 17 }} maxFontSizeMultiplier={MAX_FONT_SCALE.header}>
        {title}
      </Text>
    </Pressable>
  );
}

/**
 * Selectable chip; announced as a button with its selected state. With `toggle` it is an on/off
 * control instead: announced as a switch ("açık"/"kapalı") named by `accessibilityLabel`.
 * A `badge` (a count) is drawn after the title; say it in `accessibilityLabel` too.
 * Unselected: outlined surface. Selected: filled, with the subject colour when `color` is given
 * (the name stays the cue; the colour only repeats it), else the brand blue.
 */
export function Chip({
  title,
  selected,
  onPress,
  testID,
  accessibilityLabel,
  accessibilityHint,
  color,
  toggle = false,
  badge,
  disabled,
}: {
  title: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  /** Leading colour dot (the subject colour), and the fill when selected. */
  color?: string;
  toggle?: boolean;
  badge?: string;
  /** Faded like a disabled button. Left out, the chip states nothing about it. */
  disabled?: boolean;
}) {
  const c = usePalette();
  const state = toggle ? { checked: selected } : { selected };
  const fill = selected ? (color ?? c.primary) : c.surface;
  const label = selected ? (color ? c.onSubject : c.onPrimary) : c.text;
  return (
    <Pressable
      testID={testID}
      accessibilityRole={toggle ? 'switch' : 'button'}
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityHint={accessibilityHint}
      accessibilityState={disabled ? { ...state, disabled } : state}
      disabled={disabled}
      onPress={onPress}
      // Same layout as before; the touch target grows to ≥ 44 pt (the row gap is 8).
      hitSlop={4}
      style={[
        styles.chip,
        color || badge !== undefined ? styles.chipWithDot : null,
        {
          backgroundColor: fill,
          borderColor: selected ? fill : c.controlBorder,
          opacity: disabled ? DISABLED_OPACITY : 1,
        },
      ]}>
      {/* On its own colour the dot takes the label colour, so the chip keeps its width. */}
      {color ? <Dot color={selected ? label : color} /> : null}
      <Text style={{ color: label, fontSize: 15 }}>{title}</Text>
      {badge !== undefined ? (
        <View style={[styles.badge, { backgroundColor: selected ? label : c.primary }]}>
          <Text style={{ color: selected ? fill : c.onPrimary, fontSize: 13, fontWeight: '700' }}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

/** With `accessibilityLabel` the row is one screen-reader element read as that sentence. */
export function Row({ children, accessibilityLabel }: { children: ReactNode; accessibilityLabel?: string }) {
  return (
    <View
      style={styles.row}
      accessible={accessibilityLabel === undefined ? undefined : true}
      accessibilityLabel={accessibilityLabel}>
      {children}
    </View>
  );
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
  onBlur,
  testID,
  accessibilityLabel = label,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  numeric?: boolean;
  /** The field lost focus (the student is done with it). */
  onBlur?: () => void;
  testID?: string;
  /** Defaults to `label`; add the group when one screen has two "Saat" fields. */
  accessibilityLabel?: string;
}) {
  const c = usePalette();
  return (
    <View style={{ flex: 1, gap: 4 }}>
      <Text style={[styles.small, { color: c.textMuted }]} importantForAccessibility="no" accessibilityElementsHidden>
        {label}
      </Text>
      <TextInput
        testID={testID}
        accessibilityLabel={accessibilityLabel}
        value={value}
        onChangeText={onChange}
        onBlur={onBlur}
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

/**
 * − value + control. Each button announces the current value. At accessibility text sizes the
 * label gets its own line above − value +, so neither is squeezed into a narrow column.
 */
export function Stepper({
  label,
  value,
  onMinus,
  onPlus,
  minusDisabled = false,
  plusDisabled = false,
  testID,
  accessibilityLabel = label,
}: {
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  minusDisabled?: boolean;
  plusDisabled?: boolean;
  testID?: string;
  /** What the buttons announce they change; defaults to `label` (e.g. add the item's name). */
  accessibilityLabel?: string;
}) {
  const c = usePalette();
  const large = useLargeText();
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
      // A button, so tonal like a secondary button (outlines are for what can be typed into or picked).
      style={[styles.stepButton, { backgroundColor: c.secondaryFill, opacity: disabled ? DISABLED_OPACITY : 1 }]}>
      <Text style={{ color: c.accent, fontSize: 18, fontWeight: '600' }} maxFontSizeMultiplier={1.4}>
        {symbol}
      </Text>
    </Pressable>
  );
  return (
    <View style={large ? styles.stack : styles.row}>
      <Text style={[styles.muted, { color: c.textMuted }, large ? null : { flex: 1 }]}>{label}</Text>
      <View style={styles.row}>
        {button('−', tr.a11y.decrease(accessibilityLabel), onMinus, minusDisabled, 'minus')}
        <Text style={[styles.body, { color: c.text, minWidth: 64, textAlign: 'center' }, large ? { flex: 1 } : null]}>
          {value}
        </Text>
        {button('+', tr.a11y.increase(accessibilityLabel), onPlus, plusDisabled, 'plus')}
      </View>
    </View>
  );
}

/** Icon, title, short explanation and an optional action, for screens without data yet. */
export function EmptyState({
  icon,
  title,
  body,
  action,
  onAction,
  testID,
}: {
  /** Small decorative symbol of the screen (e.g. the tab icon) in front of the title. */
  icon?: IconName;
  title?: string;
  body: string;
  action?: string;
  onAction?: () => void;
  testID?: string;
}) {
  const c = usePalette();
  return (
    <Card testID={testID}>
      {icon || title ? (
        <View style={styles.row}>
          {icon ? <Icon name={icon} color={c.accent} size={28} /> : null}
          {title ? (
            <Label variant="heading" style={{ flex: 1 }}>
              {title}
            </Label>
          ) : null}
        </View>
      ) : null}
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
  /** What a screen reader says for the value when `valueLabel` is shorthand (`2:05` → `2 sa 5 dk`). */
  a11yValue?: string;
  highlight?: boolean;
}

/**
 * Plain vertical bar chart built from Views (no chart library). Screen readers get the values
 * as one summary instead of every bar and label separately.
 */
export function BarChart({ bars, height = 140 }: { bars: Bar[]; height?: number }) {
  const c = usePalette();
  const max = Math.max(...bars.map((b) => b.value), 0);
  const summary = tr.a11y.chart(bars.map((b) => tr.a11y.chartItem(b.label, b.a11yValue ?? b.valueLabel)).join(', '));
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
  // Cards 16 apart; a `Section` adds its own space above to make 32 between sections.
  screen: { padding: space.lg, gap: space.lg, paddingBottom: space.xl * 2 },
  card: { borderRadius: 16, padding: space.lg, gap: space.md },
  cardHero: { borderRadius: 20 },
  section: { marginTop: space.xxl - space.lg, gap: space.xs },
  sectionTitle: { ...typography.section, paddingHorizontal: space.xs, paddingBottom: space.xs },
  display: typography.display,
  displaySmall: typography.displaySmall,
  largeTitle: typography.largeTitle,
  title: typography.title,
  heading: typography.heading,
  body: typography.body,
  muted: typography.muted,
  small: typography.small,
  button: {
    minHeight: 48,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
  buttonLarge: { minHeight: 72, borderRadius: 16 },
  buttonTall: { minHeight: 56, borderRadius: 14 },
  buttonCompact: { minHeight: 36, paddingHorizontal: space.md, paddingVertical: 6, flexGrow: 0, borderRadius: 999 },
  buttonText: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
  buttonTextLarge: { fontSize: 22 },
  buttonTextCompact: { fontSize: 15 },
  periodStep: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  periodLabel: { flex: 1, textAlign: 'center' },
  periodLabelBody: { flex: 1, textAlign: 'center', fontWeight: '600' },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipWithDot: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  badge: { borderRadius: 999, paddingHorizontal: 6, minWidth: 22, alignItems: 'center' },
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
    alignItems: 'center',
    justifyContent: 'center',
  },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xs },
  barColumn: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: space.xs },
  barValue: { fontSize: 11 },
  barLabel: { fontSize: 12 },
});
