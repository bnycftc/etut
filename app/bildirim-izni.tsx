import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { DEFAULT_REMINDER_PREFS, type ReminderKey, type ReminderPrefs } from '@/domain/reminders';
import { useAppState, useStored } from '@/state/app-state';
import { loadReminderPrefs, storeReminderPrefs } from '@/storage/kv';
import { tr } from '@/strings';
import { notifications } from '@/system/notifications';
import type { NotificationPermission } from '@/system/types';
import { Button, Card, Label, Screen } from '@/ui/components';

const REMINDER_KEYS = Object.keys(DEFAULT_REMINDER_PREFS) as ReminderKey[];

function reminderLabel(key: ReminderKey, prefs: ReminderPrefs): string {
  switch (key) {
    case 'longSession':
      return `${tr.reminders.longSession} (${tr.reminders.hours(prefs.longSession.hours)})`;
    case 'pomodoro':
      return tr.reminders.pomodoro;
    case 'daily':
      return `${tr.reminders.daily} (${tr.reminders.time(prefs.daily.hour, prefs.daily.minute)})`;
    case 'examAnalysis':
      return tr.reminders.examAnalysis;
  }
}

/**
 * Explains the reminders before the system permission prompt. Opened only when the student
 * turns a reminder on (or asks for the permission on the reminders screen).
 */
export default function NotificationPermissionScreen() {
  const { enable } = useLocalSearchParams<{ enable?: string }>();
  const { dataVersion, notifyDataChanged } = useAppState();
  const stored = useStored(`reminders|${dataVersion}`, loadReminderPrefs);
  const [result, setResult] = useState<NotificationPermission | null>(null);
  const [asking, setAsking] = useState(false);

  const key = REMINDER_KEYS.find((k) => k === enable) ?? null;
  // What will be on once the permission is granted (the requested one included).
  const prefs: ReminderPrefs = key === null ? stored : { ...stored, [key]: { ...stored[key], enabled: true } };
  const willBeOn = REMINDER_KEYS.filter((k) => prefs[k].enabled);

  const allow = async () => {
    setAsking(true);
    const answer = await notifications.requestPermission();
    setAsking(false);
    setResult(answer);
    if (answer === 'granted') {
      storeReminderPrefs(prefs);
      notifyDataChanged();
      router.back();
    }
  };

  return (
    <Screen testID="notification-permission-screen">
      <Card>
        <Label variant="heading">{tr.notificationPermission.heading}</Label>
        <Label>{tr.notificationPermission.body}</Label>
        <Label variant="muted">{tr.notificationPermission.willBeOn}</Label>
        {willBeOn.map((k) => (
          <Label key={k} testID={`notification-permission-item-${k}`}>
            {`• ${reminderLabel(k, prefs)}`}
          </Label>
        ))}
        <Label variant="small">{tr.notificationPermission.local}</Label>
        <Label variant="small">{tr.notificationPermission.later}</Label>
      </Card>
      {result !== null && result !== 'granted' ? (
        <>
          <Label testID="notification-permission-denied">{tr.notificationPermission.denied}</Label>
          <Button
            testID="notification-permission-close"
            kind="secondary"
            title={tr.notificationPermission.close}
            onPress={() => router.back()}
          />
        </>
      ) : (
        <>
          <Button
            testID="notification-permission-allow"
            title={tr.notificationPermission.allow}
            disabled={asking}
            onPress={() => void allow()}
          />
          <Button
            testID="notification-permission-later"
            kind="secondary"
            title={tr.notificationPermission.notNow}
            onPress={() => router.back()}
          />
        </>
      )}
    </Screen>
  );
}
