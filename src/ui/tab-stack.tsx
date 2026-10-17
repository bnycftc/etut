import { Stack, useIsFocused } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { Platform } from 'react-native';

import { usePalette } from './theme';

const IOS = Platform.OS === 'ios';
/** iOS 26 draws the bar as glass over a scroll edge effect; older iOS needs a blur under the transparent header. */
const LIQUID_GLASS = IOS && parseInt(String(Platform.Version), 10) >= 26;

/**
 * The header of a tab's root screen (native tabs show none of their own). On iOS a large title
 * that collapses on scroll, the content sliding under the transparent bar (`Screen` adjusts its
 * insets); elsewhere the plain header the app had before.
 * Native tabs mount every tab at launch; a tab here renders once it is first shown, as the
 * JavaScript tabs did (launch reads only the timer's data).
 */
export function TabStack({ title, headerRight }: { title: string; headerRight?: () => ReactNode }) {
  const c = usePalette();
  const focused = useIsFocused();
  const [shown, setShown] = useState(focused);
  if (focused && !shown) setShown(true);
  if (!shown) return null;
  return (
    <Stack
      screenOptions={{
        headerTintColor: c.text,
        contentStyle: { backgroundColor: c.background },
        ...(IOS
          ? {
              headerLargeTitleEnabled: true,
              headerTransparent: true,
              headerBlurEffect: LIQUID_GLASS ? undefined : 'systemChromeMaterial',
              headerShadowVisible: false,
              headerLargeTitleShadowVisible: false,
            }
          : { headerStyle: { backgroundColor: c.surface }, headerTitleStyle: { fontWeight: '700' } }),
      }}>
      <Stack.Screen name="index" options={{ title, headerRight }} />
    </Stack>
  );
}
