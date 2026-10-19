/**
 * Entry card of the KVKK application channel (K-31, K-38), plus small pieces shared by
 * app/basvuru.tsx and app/basvurularim.tsx. The integration step (WP-J) places the card in
 * Ayarlar → Gizlilik; nothing renders while GROUPS_ENABLED is false.
 */

import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { GROUPS_ENABLED } from '../config/features';
import { istanbulDayKey, istanbulTimeOfDay } from '../domain/istanbul-day';
import { requestsTr } from '../strings-wp/requests';
import { Card, Label, ListRow } from './components';
import { formatDay } from './format';
import { Icon } from './icon';
import { usePalette } from './theme';

export function RequestsEntry() {
  if (!GROUPS_ENABLED) return null;
  return (
    <Card testID="requests-entry">
      <Label variant="heading">{requestsTr.entry.title}</Label>
      <Label variant="muted">{requestsTr.entry.info}</Label>
      <ListRow testID="requests-entry-apply" icon="manual" title={requestsTr.entry.apply} onPress={() => router.push('/basvuru')} />
      <ListRow testID="requests-entry-list" icon="document" title={requestsTr.entry.list} onPress={() => router.push('/basvurularim')} />
    </Card>
  );
}

/** "19 Ekim 2026" (Istanbul day) of a server timestamp. */
export function requestDate(iso: string): string {
  return formatDay(istanbulDayKey(Date.parse(iso)));
}

/** "19 Ekim 2026 14:05" (Istanbul) of a server timestamp. */
export function requestDateTime(iso: string): string {
  const ms = Date.parse(iso);
  const { hours, minutes } = istanbulTimeOfDay(ms);
  return `${formatDay(istanbulDayKey(ms))} ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** One choice of a single-choice list (talep türü, başvuran), announced as a radio button. */
export function ChoiceRow({
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
      accessibilityRole="radio"
      accessibilityLabel={title}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        minHeight: 44,
        paddingVertical: 6,
        opacity: pressed ? 0.6 : 1,
      })}>
      {selected ? (
        <Icon name="saved" color={c.accent} size={22} />
      ) : (
        <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: c.controlBorder }} />
      )}
      <Text style={{ flex: 1, fontSize: 16, lineHeight: 22, color: c.text }}>{title}</Text>
    </Pressable>
  );
}
