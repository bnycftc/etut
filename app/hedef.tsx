import { router } from 'expo-router';

import { istanbulDayKey } from '@/domain/istanbul-day';
import { goalFromTomorrow, goalOfDay } from '@/domain/streak';
import { useAppState, useStored } from '@/state/app-state';
import { studiedToday } from '@/state/study-stats';
import { loadDailyGoal, loadDailyGoalHistory, storeDailyGoal } from '@/storage/kv';
import { GoalSheet } from '@/ui/goal-sheet';

/** The daily goal sheet of the timer screen (a form sheet, `app/_layout.tsx`). */
export default function GoalSheetScreen() {
  const { active, dataVersions, notifyDataChanged } = useAppState();
  const goal = useStored(`goal|${dataVersions.settings}`, loadDailyGoal);
  const goalHistory = useStored(`goalHistory|${dataVersions.settings}`, loadDailyGoalHistory);
  const setGoal = (minutes: number | null) => {
    // The day of the tap, not of a render clock.
    const now = Date.now();
    const today = istanbulDayKey(now);
    // A raise over today's goal waits for tomorrow once today's goal is met (V-03): only then is
    // today's study time needed, so other changes read no sessions.
    const todayGoal = goal === null ? null : goalOfDay(goalHistory, goal, today)(today);
    const raise = minutes !== null && todayGoal !== null && minutes > todayGoal;
    storeDailyGoal(minutes, today, raise ? studiedToday(active, now) : 0);
    notifyDataChanged('settings');
  };
  return (
    <GoalSheet
      goal={goal}
      startsTomorrow={goalFromTomorrow(goalHistory, istanbulDayKey(Date.now())) !== null}
      onChange={setGoal}
      onClose={() => router.back()}
    />
  );
}
