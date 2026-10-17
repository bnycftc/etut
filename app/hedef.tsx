import { router } from 'expo-router';

import { istanbulDayKey } from '@/domain/istanbul-day';
import { useAppState, useStored } from '@/state/app-state';
import { loadDailyGoal, storeDailyGoal } from '@/storage/kv';
import { GoalSheet } from '@/ui/goal-sheet';

/** The daily goal sheet of the timer screen (a form sheet, `app/_layout.tsx`). */
export default function GoalSheetScreen() {
  const { dataVersions, notifyDataChanged } = useAppState();
  const goal = useStored(`goal|${dataVersions.settings}`, loadDailyGoal);
  const setGoal = (minutes: number | null) => {
    // The day of the tap, not of a render clock.
    storeDailyGoal(minutes, istanbulDayKey(Date.now()));
    notifyDataChanged('settings');
  };
  return <GoalSheet goal={goal} onChange={setGoal} onClose={() => router.back()} />;
}
