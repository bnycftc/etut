import { forwardRef } from 'react';
import { StyleSheet, Text, type TextStyle, View } from 'react-native';

import type { StudyCard } from '../domain/share-card';
import { tr } from '../strings';
import { formatDay, formatDuration } from './format';
import { Ring } from './ring';
import { subjectColor } from './subject-colors';
import { DARK, LIGHT, type Palette, ROUNDED_FONT } from './theme';

export type CardScheme = 'light' | 'dark';

/** Card size in points is `width` × `width · 16/9` (9:16). Exported at 1080 × 1920 pixels. */
export const CARD_EXPORT = { width: 1080, height: 1920 } as const;

/**
 * The total (in 1/360 of the card width): its numbers 56 pt, its units ("sa", "dk") smaller,
 * all on one line; scaled down together only if a total would not fit the panel.
 */
const TOTAL_SIZE = 56;
const TOTAL_UNIT_SIZE = 24;
/** Width of the total's panel text (card 360 − 2 × 28 padding − 2 × 20 panel padding). */
const TOTAL_WIDTH = 264;
/** A rounded heavy digit is about this share of its font size wide; a unit letter or space less. */
const DIGIT_WIDTH = 0.6;
const UNIT_WIDTH = 0.55;

/** `2 sa 30 dk` → numbers and units apart (`['2', ' sa ', '30', ' dk']`), with their scale. */
export function totalParts(total: string): { parts: { text: string; number: boolean }[]; scale: number } {
  const parts = total
    .split(/(\d+)/)
    .filter((text) => text !== '')
    .map((text) => ({ text, number: /^\d+$/.test(text) }));
  const width = parts.reduce(
    (sum, part) =>
      sum + part.text.length * (part.number ? DIGIT_WIDTH * TOTAL_SIZE : UNIT_WIDTH * TOTAL_UNIT_SIZE),
    0,
  );
  return { parts, scale: Math.min(1, TOTAL_WIDTH / width) };
}

/** Share of the daily goal (day card) or of goal days in the week (week card), 0…1; `null` without a goal. */
function goalShare(card: StudyCard): number | null {
  if (card.goalPercent !== null) return card.goalPercent / 100;
  if (card.goalDays !== null) return card.goalDays / 7;
  return null;
}

/**
 * The shareable 9:16 study card. Study numbers only (no name, age, school, exam type, no link
 * or code; K-09) and the "Etüt" brand. Halka style: the soft brand tint around white panels, the
 * total as the one rounded hero number, each subject's bar in its own colour and, with a goal,
 * the ring of the app icon filled to it in the corner. Text does not follow the system font
 * size: this is an image with a fixed layout (the preview has a spoken summary instead).
 */
export const StudyCardView = forwardRef<View, { card: StudyCard; scheme: CardScheme; width: number }>(
  function StudyCardView({ card, scheme, width }, ref) {
    const p = scheme === 'dark' ? DARK : LIGHT;
    const u = width / 360;
    const t = (size: number, color: string, weight: TextStyle['fontWeight'] = '400'): TextStyle => ({
      fontSize: size * u,
      lineHeight: size * u * 1.25,
      color,
      fontWeight: weight,
    });
    const period = card.period === 'day' ? tr.share.cardDay : tr.share.cardWeek;
    const range =
      card.period === 'day' ? formatDay(card.from) : tr.weekly.range(formatDay(card.from), formatDay(card.to));
    const stats: string[] = [];
    if (card.streakDays !== null) stats.push(tr.share.streak(card.streakDays));
    if (card.goalPercent !== null) stats.push(tr.share.goalDay(card.goalPercent));
    if (card.goalDays !== null) stats.push(tr.share.goalWeek(card.goalDays));
    if (card.activeDays !== null) stats.push(tr.share.activeDays(card.activeDays));
    const total = formatDuration(card.totalMs);
    const totalLine = totalParts(total);
    const totalSize = TOTAL_SIZE * totalLine.scale;
    const goal = goalShare(card);

    return (
      <View
        ref={ref}
        collapsable={false}
        style={[styles.card, { width, height: (width * 16) / 9, padding: 28 * u, backgroundColor: p.accentSoft }]}>
        <View style={[styles.row, { gap: 10 * u }]}>
          <LogoMark size={40 * u} palette={p} />
          <Text allowFontScaling={false} style={t(26, p.text, '700')}>
            {tr.appName}
          </Text>
        </View>

        <View style={{ marginTop: 36 * u, gap: 4 * u }}>
          <Text allowFontScaling={false} style={t(20, p.text, '600')}>
            {period}
          </Text>
          <Text allowFontScaling={false} style={t(14, p.textMuted)}>
            {range}
          </Text>
        </View>

        <View style={{ marginTop: 20 * u, padding: 20 * u, borderRadius: 20 * u, backgroundColor: p.surface }}>
          <Text allowFontScaling={false} style={t(14, p.textMuted)}>
            {tr.share.total}
          </Text>
          <Text
            allowFontScaling={false}
            style={[t(totalSize, p.accent, '800'), styles.total, { lineHeight: totalSize * u * 1.15 }]}
            numberOfLines={1}>
            {totalLine.parts.map((part, i) =>
              part.number ? (
                part.text
              ) : (
                <Text key={i} style={{ fontSize: TOTAL_UNIT_SIZE * totalLine.scale * u, fontWeight: '700' }}>
                  {part.text}
                </Text>
              ),
            )}
          </Text>
        </View>

        <View
          style={{
            marginTop: 14 * u,
            padding: 20 * u,
            borderRadius: 20 * u,
            gap: 12 * u,
            backgroundColor: p.surface,
            flex: 1,
          }}>
          <Text allowFontScaling={false} style={t(14, p.textMuted)}>
            {tr.share.subjects}
          </Text>
          {card.rows.length === 0 ? (
            <Text allowFontScaling={false} style={t(15, p.text)}>
              {tr.share.noStudy}
            </Text>
          ) : null}
          {card.rows.map((r) => (
            <View key={r.subjectId ?? 'rest'} style={{ gap: 5 * u }}>
              <View style={[styles.row, { justifyContent: 'space-between' }]}>
                <Text allowFontScaling={false} style={[t(15, p.text, '600'), { flex: 1 }]} numberOfLines={1}>
                  {r.subjectId === null ? tr.share.otherSubjects : tr.subject(r.subjectId)}
                </Text>
                <Text allowFontScaling={false} style={t(14, p.textMuted)}>
                  {formatDuration(r.ms)} · %{r.percent}
                </Text>
              </View>
              {/* The subject's own colour on the panel (≥ 3:1); the rest of the subjects muted. */}
              <View
                testID={`share-card-bar-${r.subjectId ?? 'rest'}`}
                style={{
                  width: `${Math.max(2, r.percent)}%`,
                  height: 10 * u,
                  borderRadius: 5 * u,
                  backgroundColor: r.subjectId === null ? p.textMuted : subjectColor(r.subjectId, p),
                }}
              />
            </View>
          ))}
        </View>

        {stats.length > 0 ? (
          <View style={[styles.row, { flexWrap: 'wrap', gap: 8 * u, marginTop: 14 * u }]}>
            {stats.map((s) => (
              <View
                key={s}
                style={{
                  paddingHorizontal: 12 * u,
                  paddingVertical: 6 * u,
                  borderRadius: 999,
                  backgroundColor: p.surface,
                }}>
                <Text allowFontScaling={false} style={t(13, p.text, '600')}>
                  {s}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={[styles.row, { marginTop: 18 * u, gap: 12 * u, minHeight: 36 * u }]}>
          <Text allowFontScaling={false} style={[t(13, p.textMuted), { flex: 1 }]}>
            {tr.share.footer}
          </Text>
          {goal !== null ? (
            <Ring
              testID="share-card-goal-ring"
              ratio={goal}
              color={goal >= 1 ? p.success : p.accent}
              track={p.barSoft}
              size={36 * u}
              thickness={6 * u}
            />
          ) : null}
        </View>
      </View>
    );
  },
);

/**
 * The app mark, mapped to the app icon (scripts/gen-icons.mjs): a timer arc of three quarters with
 * its gap at the top left (12 to 9 o'clock), the stopwatch crown above it, an "E" inside.
 */
export function LogoMark({ size, palette }: { size: number; palette: Palette }) {
  const ring = size * 0.14;
  // The icon's crown (128 × 62 above a 684 ring, 28 apart), at this size.
  const crown = { width: size * 0.19, height: Math.max(3, size * 0.09), gap: size * 0.04 };
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          top: -(crown.gap + crown.height),
          width: crown.width,
          height: crown.height,
          borderRadius: crown.height / 2,
          backgroundColor: palette.accent,
        }}
      />
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: ring,
          borderColor: palette.accent,
          borderTopColor: palette.barMuted,
          // The muted top quarter turned to the top left, where the icon's arc is open.
          transform: [{ rotate: '-45deg' }],
        }}
      />
      <Text
        allowFontScaling={false}
        style={{ color: palette.accent, fontSize: size * 0.5, lineHeight: size * 0.6, fontWeight: '800' }}>
        {tr.appName.charAt(0)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center' },
  total: { fontFamily: ROUNDED_FONT, fontVariant: ['tabular-nums'], letterSpacing: -0.5 },
});
