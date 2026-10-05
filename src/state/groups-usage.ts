/**
 * Time spent on the group screens today, for the parent's daily limit (K-22 c). Every group
 * screen calls this hook, so the limit covers the group detail screen too. Time counts only while
 * the screen is focused and the app is in the foreground.
 */

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState } from 'react-native';

import { istanbulDayKey } from '../domain/istanbul-day';
import { loadGroupsUsage, storeGroupsUsage } from '../storage/groups-kv';

const USAGE_TICK_MS = 30_000;

export function useGroupsUsage(): number {
  const [usedMs, setUsedMs] = useState(() => loadGroupsUsage(istanbulDayKey(Date.now())));

  useFocusEffect(
    useCallback(() => {
      let since: number | null = AppState.currentState === 'background' ? null : Date.now();
      setUsedMs(loadGroupsUsage(istanbulDayKey(Date.now())));
      const flush = () => {
        if (since === null) return;
        const now = Date.now();
        // A tick across midnight starts the new day's count (it is at most 30 s).
        const day = istanbulDayKey(now);
        const total = loadGroupsUsage(day) + (now - since);
        since = now;
        storeGroupsUsage(day, total);
        setUsedMs(total);
      };
      const timer = setInterval(flush, USAGE_TICK_MS);
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'background') {
          // Time in the background is not group use.
          flush();
          since = null;
        } else if (state === 'active' && since === null) {
          since = Date.now();
          setUsedMs(loadGroupsUsage(istanbulDayKey(since)));
        }
      });
      return () => {
        clearInterval(timer);
        subscription.remove();
        flush();
        since = null;
      };
    }, []),
  );

  return usedMs;
}
