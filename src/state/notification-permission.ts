/** Current notification permission, refreshed when a screen gains focus or the app returns. */

import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { notifications } from '../system/notifications';
import type { NotificationPermission } from '../system/types';

/** `null` until the first answer arrives. */
export function useNotificationPermission(): NotificationPermission | null {
  const [permission, setPermission] = useState<NotificationPermission | null>(null);
  const refresh = useCallback(() => {
    let current = true;
    notifications.getPermission().then(
      (p) => {
        if (current) setPermission(p);
      },
      () => {
        if (current) setPermission('unsupported');
      },
    );
    return () => {
      current = false;
    };
  }, []);
  useFocusEffect(refresh);
  useEffect(() => {
    // Back from iOS Settings, where the student may have changed it.
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);
  return permission;
}
