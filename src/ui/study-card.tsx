import { forwardRef } from 'react';
import { StyleSheet, Text, type TextStyle, View } from 'react-native';

import type { StudyCard } from '../domain/share-card';
import { tr } from '../strings';
import { formatDay, formatDuration } from './format';
import { DARK, LIGHT, type Palette } from './theme';

export type CardScheme = 'light' | 'dark';

/** Card size in points is `width` × `width · 16/9` (9:16). Exported at 1080 × 1920 pixels. */
export const CARD_EXPORT = { width: 1080, height: 1920 } as const;

/**
 * The shareable 9:16 study card. Study numbers only (no name, age, school, exam type) and the
 * "Etüt" brand. Text does not follow the system font size: this is an image with a fixed layout
 * (the preview has a spoken summary for screen readers instead).
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

    return (
      <View
        ref={ref}
        collapsable={false}
        style={[styles.card, { width, height: (width * 16) / 9, padding: 28 * u, backgroundColor: p.background }]}>
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

        <View
          style={[
            styles.panel,
            { marginTop: 20 * u, padding: 20 * u, borderRadius: 18 * u, backgroundColor: p.surface, borderColor: p.border },
          ]}>
          <Text allowFontScaling={false} style={t(14, p.textMuted)}>
            {tr.share.total}
          </Text>
          <Text allowFontScaling={false} style={t(46, p.accent, '700')} numberOfLines={1}>
            {formatDuration(card.totalMs)}
          </Text>
        </View>

        <View
          style={[
            styles.panel,
            {
              marginTop: 14 * u,
              padding: 20 * u,
              borderRadius: 18 * u,
              gap: 12 * u,
              backgroundColor: p.surface,
              borderColor: p.border,
              flex: 1,
            },
          ]}>
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
              <View style={{ height: 8 * u, borderRadius: 4 * u, backgroundColor: p.barMuted, overflow: 'hidden' }}>
                <View
                  style={{
                    width: `${Math.max(2, r.percent)}%`,
                    height: '100%',
                    borderRadius: 4 * u,
                    backgroundColor: p.accent,
                  }}
                />
              </View>
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
                  borderWidth: 1,
                  borderColor: p.controlBorder,
                  backgroundColor: p.surface,
                }}>
                <Text allowFontScaling={false} style={t(13, p.text, '600')}>
                  {s}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text allowFontScaling={false} style={[t(13, p.textMuted), { marginTop: 18 * u, textAlign: 'center' }]}>
          {tr.share.footer}
        </Text>
      </View>
    );
  },
);

/** The app mark: a timer arc (three quarters) around an "E". Same idea as the app icon. */
export function LogoMark({ size, palette }: { size: number; palette: Palette }) {
  const ring = size * 0.14;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: ring,
          borderColor: palette.accent,
          borderTopColor: palette.barMuted,
          transform: [{ rotate: '45deg' }],
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
  panel: { borderWidth: StyleSheet.hairlineWidth },
});
