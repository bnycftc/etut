import { DarkTheme, DefaultTheme, type ErrorBoundaryProps, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import type { ComponentProps } from 'react';
import { useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GROUPS_ENABLED } from '@/config/features';
import { contactEmail } from '@/domain/contact';
import { AppStateProvider, useAppState } from '@/state/app-state';
import { SystemSync } from '@/state/system-sync';
import { DATA_CONTROLLER, tr } from '@/strings';
import { Button, Card, Label, Screen } from '@/ui/components';
import { useReducedMotion } from '@/ui/motion';
import { usePalette } from '@/ui/theme';

function RootStack() {
  const { profile } = useAppState();
  const c = usePalette();
  const reduceMotion = useReducedMotion();
  const sheet: ComponentProps<typeof Stack.Screen>['options'] = {
    presentation: 'formSheet',
    sheetAllowedDetents: [0.45, 1],
    sheetGrabberVisible: true,
    headerShown: false,
    contentStyle: { backgroundColor: c.surface },
  };
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
        <Stack.Screen
          name="deneme/duzenle/[id]"
          options={{ title: tr.exams.editTitle, presentation: 'modal' }}
        />
        <Stack.Screen name="konular" options={{ title: tr.topics.title }} />
        <Stack.Screen name="elle-ekle" options={{ title: tr.manual.title }} />
        <Stack.Screen name="analiz/[id]" options={{ title: tr.analysis.title }} />
        <Stack.Screen name="haftalik" options={{ title: tr.weekly.title }} />
        <Stack.Screen name="karne/[subject]" options={{ title: tr.report.title }} />
        <Stack.Screen name="paylas" options={{ title: tr.share.title }} />
        <Stack.Screen name="yedek" options={{ title: tr.backup.title }} />
        <Stack.Screen name="hatirlaticilar" options={{ title: tr.reminders.title }} />
        {/* System sheets: grabber, half height first; a second detent for large text sizes. */}
        <Stack.Screen name="hedef" options={sheet} />
        <Stack.Screen name="tur" options={sheet} />
        {/* Pre-permission screen: left only through its button (HIG), so no swipe-down. */}
        <Stack.Screen
          name="bildirim-izni"
          options={{ title: tr.notificationPermission.title, presentation: 'modal', gestureEnabled: false }}
        />
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
      {/* Help text only (no data): a sheet, so an (i) link also works from the exam form modal. */}
      <Stack.Screen name="nasil-calisir" options={{ title: tr.guide.title, presentation: 'modal' }} />

    </Stack>
  );
}

export default function RootLayout() {
  const scheme = useColorScheme();
  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AppStateProvider>
        <RootStack />
        <SystemSync />
        <StatusBar style="auto" />
      </AppStateProvider>
    </ThemeProvider>
  );
}

/**
 * Any error thrown while rendering (a broken stored row, unexpected JSON) lands here instead of
 * closing the app. It replaces this layout, so no app state or storage is used: plain text and
 * "Yeniden dene", which renders the layout again. Nothing is deleted and the error is not shown or
 * sent anywhere (no telemetry).
 */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  const c = usePalette();
  const email = contactEmail(DATA_CONTROLLER.contact);
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }}>
      <StatusBar style="auto" />
      <Screen testID="error-screen">
        <Card>
          <Label variant="title">{tr.crash.title}</Label>
          <Label>{tr.crash.body}</Label>
          {email !== null ? (
            <Label variant="small" testID="error-contact">
              {tr.crash.contact(email)}
            </Label>
          ) : null}
        </Card>
        <Button
          large
          testID="error-retry"
          title={tr.crash.retry}
          onPress={() => {
            void retry();
          }}
        />
      </Screen>
    </SafeAreaView>
  );
}
