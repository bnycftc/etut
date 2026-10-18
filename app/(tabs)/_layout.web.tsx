import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';

import { useAppState } from '@/state/app-state';
import { tr } from '@/strings';
import { Icon, type IconName } from '@/ui/icon';
import { usePalette } from '@/ui/theme';

/** Outline symbol, filled when the tab is selected (iOS convention). Decorative: the tab is announced by its title. */
function tabIcon(outline: IconName, filled: IconName) {
  return function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Icon name={focused ? filled : outline} color={color} size={24} />;
  };
}

/**
 * The web preview (test only) keeps the JavaScript tab bar: the native tabs' web fallback carries
 * no `testID`, which `scripts/test-web.mjs` taps. Each tab's own stack draws its header
 * (`src/ui/tab-stack.tsx`), the same as on the device. Same tabs and rules as `_layout.tsx`.
 */
export default function TabsLayout() {
  const { profile } = useAppState();
  const c = usePalette();
  // K-01/K-02: the personal timer is always the first tab; groups are optional and hidden
  // entirely for solo-only (under 15) profiles (K-16).
  const showGroups = profile !== null && !profile.soloOnly;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        tabBarLabelStyle: { fontWeight: '600' },
      }}>
      <Tabs.Screen
        name="(timer)"
        options={{
          title: tr.tabs.timer,
          tabBarButtonTestID: 'tab-timer',
          tabBarIcon: tabIcon('timer', 'timerFill'),
        }}
      />
      <Tabs.Screen
        name="denemeler"
        options={{
          title: tr.tabs.exams,
          tabBarButtonTestID: 'tab-exams',
          tabBarIcon: tabIcon('exams', 'examsFill'),
        }}
      />
      <Tabs.Protected guard={showGroups}>
        <Tabs.Screen
          name="gruplar"
          options={{
            // While the module is off (no server yet) the tab shows the "Yakında" preview
            // (bny, 2026-10-18; it replaced the 2026-10-11 "no tab" decision).
            title: tr.tabs.groups,
            tabBarButtonTestID: 'tab-groups',
            tabBarIcon: tabIcon('groups', 'groupsFill'),
          }}
        />
      </Tabs.Protected>
      <Tabs.Screen
        name="ayarlar"
        options={{
          title: tr.tabs.settings,
          tabBarButtonTestID: 'tab-settings',
          tabBarIcon: tabIcon('settings', 'settingsFill'),
        }}
      />
    </Tabs>
  );
}
