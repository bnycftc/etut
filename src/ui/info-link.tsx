import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { tr } from '../strings';
import { usePalette } from './theme';

/** Sections of the "Nasıl çalışır" screen, in screen order (the `bolum` route parameter). */
export const GUIDE_SECTIONS = [
  'sayac',
  'pomodoro',
  'elle',
  'net',
  'analiz',
  'hedef',
  'seri',
  'tarih',
  'kilit',
  'yedek',
] as const;

export type GuideSection = (typeof GUIDE_SECTIONS)[number];

export function isGuideSection(value: unknown): value is GuideSection {
  return typeof value === 'string' && (GUIDE_SECTIONS as readonly string[]).includes(value);
}

/** Opens "Nasıl çalışır", scrolled to `section` when given. */
export function openGuide(section?: GuideSection): void {
  if (section === undefined) router.push('/nasil-calisir');
  else router.push({ pathname: '/nasil-calisir', params: { bolum: section } });
}

/**
 * Small "Nedir?" link next to a term ("tahmini", "elle", Seri, the net formula). Text, not an
 * icon, so it reads the same everywhere; the touch area grows to about 44 pt without moving the
 * layout around it.
 */
export function InfoLink({ section, term, testID }: { section: GuideSection; term: string; testID?: string }) {
  const c = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={tr.infoLink.a11y(term)}
      hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
      onPress={() => openGuide(section)}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <Text style={{ color: c.accent, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' }}>
        {tr.infoLink.title}
      </Text>
    </Pressable>
  );
}
