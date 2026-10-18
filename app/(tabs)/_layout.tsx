import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { HeaderTitle, type HeaderTitleProps } from 'expo-router/react-navigation';
import type { ColorValue } from 'react-native';

import { useAppState } from '@/state/app-state';
import { tr } from '@/strings';
import { HeaderButton } from '@/ui/components';
import { Icon, type IconName } from '@/ui/icon';
import { MAX_FONT_SCALE, usePalette } from '@/ui/theme';

/** Outline symbol, filled when the tab is selected (iOS convention). Decorative: the tab is announced by its title. */
function tabIcon(outline: IconName, filled: IconName) {
  return function TabIcon({ color, focused }: { color: ColorValue; focused: boolean }) {
    return <Icon name={focused ? filled : outline} color={color} size={24} />;
  };
}

/**
 * The tab header's bar keeps its fixed height at any text size, so the title grows only as far as
 * the "Geçmiş" button beside it (IOS-03: at accessibility sizes "Sayaç" lost its ç and the bottom
 * of every letter).
 */
function TabHeaderTitle(props: HeaderTitleProps) {
  return <HeaderTitle {...props} maxFontSizeMultiplier={MAX_FONT_SCALE.header} />;
}

export default function TabsLayout() {
  const { profile } = useAppState();
  const c = usePalette();
  // K-01/K-02: the personal timer is always the first tab; groups are optional and hidden
  // entirely for solo-only (under 15) profiles (K-16).
  const showGroups = profile !== null && !profile.soloOnly;
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.accent,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.border },
        tabBarLabelStyle: { fontWeight: '600' },
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.text,
        headerTitleStyle: { fontWeight: '700' },
        headerTitle: TabHeaderTitle,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: tr.tabs.timer,
          tabBarButtonTestID: 'tab-timer',
          tabBarIcon: tabIcon('timer', 'timerFill'),
          // Geçmiş sits in the header: always one tap away, out of the way of the core loop.
          headerRight: () => (
            <HeaderButton
              testID="open-history"
              icon="history"
              title={tr.timer.history}
              onPress={() => router.push('/gecmis')}
            />
          ),
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
