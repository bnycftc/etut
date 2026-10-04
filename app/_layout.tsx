import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';

import { AppStateProvider, useAppState } from '@/state/app-state';
import { tr } from '@/strings';
import { usePalette } from '@/ui/theme';

function RootStack() {
  const { profile } = useAppState();
  const c = usePalette();
  return (
    <Stack
      screenOptions={{
        headerBackTitle: tr.common.back,
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.text,
        contentStyle: { backgroundColor: c.background },
      }}>
      <Stack.Protected guard={profile !== null}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="gecmis" options={{ title: tr.history.title }} />
        <Stack.Screen
          name="deneme/yeni"
          options={{ title: tr.exams.newTitle, presentation: 'modal' }}
        />
        <Stack.Screen name="deneme/[id]" options={{ title: tr.exams.detailTitle }} />
      </Stack.Protected>
      <Stack.Protected guard={profile === null}>
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
      </Stack.Protected>
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
