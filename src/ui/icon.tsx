import { type AnimationSpec, SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ColorValue } from 'react-native';

/**
 * App icons: SF Symbols on iOS (native, follow Dynamic Type weight and the system look),
 * the matching Material Symbol on Android and web (bundled font, no network).
 */
const ICONS = {
  timer: { ios: 'stopwatch', android: 'timer', web: 'timer' },
  timerFill: { ios: 'stopwatch.fill', android: 'timer', web: 'timer' },
  exams: { ios: 'doc.text', android: 'description', web: 'description' },
  examsFill: { ios: 'doc.text.fill', android: 'description', web: 'description' },
  groups: { ios: 'person.3', android: 'groups', web: 'groups' },
  groupsFill: { ios: 'person.3.fill', android: 'groups', web: 'groups' },
  settings: { ios: 'gearshape', android: 'settings', web: 'settings' },
  settingsFill: { ios: 'gearshape.fill', android: 'settings', web: 'settings' },
  history: { ios: 'clock.arrow.circlepath', android: 'history', web: 'history' },
  saved: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' },
  goalDone: { ios: 'checkmark.seal.fill', android: 'verified', web: 'verified' },
  // The streak badge: a calm check, no flame (the Halka visual plan: no fire or loss imagery).
  streak: { ios: 'checkmark.circle', android: 'check_circle', web: 'check_circle' },
  goal: { ios: 'target', android: 'flag', web: 'flag' },
  manual: { ios: 'square.and.pencil', android: 'edit_note', web: 'edit_note' },
  topics: { ios: 'checklist', android: 'checklist', web: 'checklist' },
  weekly: { ios: 'chart.bar', android: 'bar_chart', web: 'bar_chart' },
  share: { ios: 'square.and.arrow.up', android: 'ios_share', web: 'ios_share' },
  chevron: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  chevronLeft: { ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' },
  info: { ios: 'info.circle', android: 'info', web: 'info' },
  report: { ios: 'list.clipboard', android: 'assignment', web: 'assignment' },
  chevronDown: { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' },
  // Ayarlar and Hakkında rows.
  reminders: { ios: 'bell', android: 'notifications', web: 'notifications' },
  backup: { ios: 'arrow.down.doc', android: 'download', web: 'download' },
  guide: { ios: 'questionmark.circle', android: 'help', web: 'help' },
  tips: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
  document: { ios: 'doc.text', android: 'description', web: 'description' },
  privacy: { ios: 'hand.raised', android: 'pan_tool', web: 'pan_tool' },
  terms: { ios: 'scroll', android: 'receipt_long', web: 'receipt_long' },
  licenses: { ios: 'books.vertical', android: 'menu_book', web: 'menu_book' },
  parent: { ios: 'person.2', android: 'family_restroom', web: 'family_restroom' },
  // Groups "Yakında" screen (src/ui/groups-teaser.tsx).
  invite: { ios: 'key', android: 'key', web: 'key' },
  live: { ios: 'clock', android: 'schedule', web: 'schedule' },
  cheers: { ios: 'hands.clap', android: 'celebration', web: 'celebration' },
  home: { ios: 'house', android: 'home', web: 'home' },
} as const satisfies Record<string, SymbolViewProps['name']>;

export type IconName = keyof typeof ICONS;

/** The symbol's own bounce, played once (iOS 17+; elsewhere the icon stays still). */
const BOUNCE: AnimationSpec = { effect: { type: 'bounce' } };

/**
 * Decorative: the control or text next to it carries the meaning for screen readers. `bounce`
 * plays the bounce once when it turns on (callers leave it off with Reduce Motion).
 */
export function Icon({
  name,
  color,
  size = 22,
  bounce = false,
}: {
  name: IconName;
  color: ColorValue;
  size?: number;
  bounce?: boolean;
}) {
  return (
    <SymbolView
      name={ICONS[name]}
      tintColor={color}
      size={size}
      animationSpec={bounce ? BOUNCE : undefined}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    />
  );
}
