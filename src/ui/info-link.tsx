import { router } from 'expo-router';
import { Pressable } from 'react-native';

import { tr } from '../strings';
import { Icon } from './icon';
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
 * Small (i) button next to a term ("tahmini", "elle", Seri, the net formula), as iOS draws it:
 * a 20 pt `info.circle` whose touch area grows to 44 pt without moving the layout around it.
 * Screen readers hear it as a link that names the term ("“Tahmini” tarih nedir?").
 */
export function InfoLink({ section, term, testID }: { section: GuideSection; term: string; testID?: string }) {
  const c = usePalette();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={tr.infoLink.a11y(term)}
      hitSlop={12}
      onPress={() => openGuide(section)}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>
      <Icon name="info" color={c.accent} size={20} />
    </Pressable>
  );
}
