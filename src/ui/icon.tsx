import { SymbolView, type SymbolViewProps } from 'expo-symbols';
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
  streak: { ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' },
  goal: { ios: 'target', android: 'flag', web: 'flag' },
  manual: { ios: 'square.and.pencil', android: 'edit_note', web: 'edit_note' },
  topics: { ios: 'checklist', android: 'checklist', web: 'checklist' },
  weekly: { ios: 'chart.bar', android: 'bar_chart', web: 'bar_chart' },
  share: { ios: 'square.and.arrow.up', android: 'ios_share', web: 'ios_share' },
  chevron: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  server: { ios: 'server.rack', android: 'dns', web: 'dns' },
} as const satisfies Record<string, SymbolViewProps['name']>;

export type IconName = keyof typeof ICONS;

/** Decorative: the control or text next to it carries the meaning for screen readers. */
export function Icon({ name, color, size = 22 }: { name: IconName; color: ColorValue; size?: number }) {
  return (
    <SymbolView
      name={ICONS[name]}
      tintColor={color}
      size={size}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    />
  );
}
