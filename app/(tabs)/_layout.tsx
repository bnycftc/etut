import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { GROUPS_ENABLED } from '@/config/features';
import { useAppState } from '@/state/app-state';
import { tr } from '@/strings';
import { usePalette } from '@/ui/theme';

/**
 * System tab bar (UITabBarController: Liquid Glass on iOS 26). Each tab is a folder with its own
 * stack, which draws the large-title header (`src/ui/tab-stack.tsx`). `testID` is the tab item's
 * accessibility identifier, which Maestro matches. The web preview uses `_layout.web.tsx`.
 */
export default function TabsLayout() {
  const { profile } = useAppState();
  const c = usePalette();
  // K-01/K-02: the personal timer is always the first tab; groups are optional and hidden
  // entirely for solo-only (under 15) profiles (K-16). Native tabs have no `Protected`: a hidden
  // tab cannot be navigated to at all. While the module is off (no server yet) there is no tab:
  // one that only says "coming soon" is incomplete content for App Review (2.1).
  const showGroups = GROUPS_ENABLED && profile !== null && !profile.soloOnly;
  return (
    // Both icon states coloured: with `tintColor` alone the two would render in different modes.
    <NativeTabs tintColor={c.accent} iconColor={{ default: c.textMuted, selected: c.accent }}>
      <NativeTabs.Trigger name="(timer)" testID="tab-timer">
        <NativeTabs.Trigger.Label>{tr.tabs.timer}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'stopwatch', selected: 'stopwatch.fill' }} md="timer" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="denemeler" testID="tab-exams">
        <NativeTabs.Trigger.Label>{tr.tabs.exams}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'doc.text', selected: 'doc.text.fill' }} md="description" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="gruplar" testID="tab-groups" hidden={!showGroups}>
        <NativeTabs.Trigger.Label>{tr.tabs.groups}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'person.3', selected: 'person.3.fill' }} md="groups" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="ayarlar" testID="tab-settings">
        <NativeTabs.Trigger.Label>{tr.tabs.settings}</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} md="settings" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
