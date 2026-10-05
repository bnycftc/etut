import { Tabs } from 'expo-router/js-tabs';
import { type ColorValue, Text } from 'react-native';

import { useAppState } from '@/state/app-state';
import { tr } from '@/strings';
import { usePalette } from '@/ui/theme';

function Glyph({ symbol, color }: { symbol: string; color: ColorValue }) {
  // Decorative: the tab button is announced by its title.
  return (
    <Text
      accessible={false}
      importantForAccessibility="no"
      maxFontSizeMultiplier={1.3}
      style={{ color, fontSize: 20, lineHeight: 24 }}>
      {symbol}
    </Text>
  );
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
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.text,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: tr.tabs.timer,
          tabBarButtonTestID: 'tab-timer',
          tabBarIcon: ({ color }) => <Glyph symbol="◷" color={color} />,
        }}
      />
      <Tabs.Screen
        name="denemeler"
        options={{
          title: tr.tabs.exams,
          tabBarButtonTestID: 'tab-exams',
          tabBarIcon: ({ color }) => <Glyph symbol="✎" color={color} />,
        }}
      />
      <Tabs.Protected guard={showGroups}>
        <Tabs.Screen
          name="gruplar"
          options={{
            title: tr.tabs.groups,
            tabBarButtonTestID: 'tab-groups',
            tabBarIcon: ({ color }) => <Glyph symbol="◎" color={color} />,
          }}
        />
      </Tabs.Protected>
      <Tabs.Screen
        name="ayarlar"
        options={{
          title: tr.tabs.settings,
          tabBarButtonTestID: 'tab-settings',
          tabBarIcon: ({ color }) => <Glyph symbol={'⚙︎'}color={color} />,
        }}
      />
    </Tabs>
  );
}
