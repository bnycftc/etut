import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { GROUPS_ENABLED } from '@/config/features';
import { AppStateProvider, useAppState } from '@/state/app-state';
import { tr } from '@/strings';
import { useReducedMotion } from '@/ui/motion';
import { usePalette } from '@/ui/theme';

function RootStack() {
  const { profile } = useAppState();
  const c = usePalette();
  const reduceMotion = useReducedMotion();
  return (
    <Stack
      screenOptions={{
        headerBackTitle: tr.common.back,
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.text,
        contentStyle: { backgroundColor: c.background },
        // Respect the system "Reduce Motion" setting: no sliding screen transitions.
        animation: reduceMotion ? 'none' : 'default',
      }}>
      <Stack.Protected guard={profile !== null}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="gecmis" options={{ title: tr.history.title }} />
        <Stack.Screen
          name="deneme/yeni"
          options={{ title: tr.exams.newTitle, presentation: 'modal' }}
        />
        <Stack.Screen name="deneme/[id]" options={{ title: tr.exams.detailTitle }} />
        <Stack.Screen name="konular" options={{ title: tr.topics.title }} />
        <Stack.Screen name="elle-ekle" options={{ title: tr.manual.title }} />
        <Stack.Screen name="analiz/[id]" options={{ title: tr.analysis.title }} />
        <Stack.Screen name="haftalik" options={{ title: tr.weekly.title }} />
        <Stack.Screen name="paylas" options={{ title: tr.share.title }} />
        <Stack.Screen name="yedek" options={{ title: tr.backup.title }} />
      </Stack.Protected>
      {/* Group module screens exist only while it is on, and never for under-15 profiles (K-16). */}
      <Stack.Protected guard={GROUPS_ENABLED && profile !== null && !profile.soloOnly}>
        <Stack.Screen name="grup/[id]" options={{ title: tr.group.title }} />
        <Stack.Screen name="veli" options={{ title: tr.parent.title }} />
        <Stack.Screen name="gizlilik" options={{ title: tr.privacy.title }} />
      </Stack.Protected>
      <Stack.Protected guard={profile === null}>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack.Protected>
      {/* Legal texts are readable before onboarding too (aydınlatma before any answer is saved). */}
      <Stack.Screen name="hakkinda" options={{ title: tr.about.title }} />
      <Stack.Screen name="yasal/[doc]" options={{ title: tr.about.legalTitle }} />
      <Stack.Screen name="lisanslar" options={{ title: tr.about.licenses }} />

    </Stack>
  );
}

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppStateProvider>
        <RootStack />
        <StatusBar style="auto" />
      </AppStateProvider>
    </ThemeProvider>
  );
}
