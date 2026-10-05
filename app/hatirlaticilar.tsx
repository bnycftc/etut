import { router } from 'expo-router';
import { Linking, View } from 'react-native';

import {
  DAILY_MINUTE_STEP,
  effectiveReminderPrefs,
  LONG_SESSION_HOURS,
  type ReminderKey,
  type ReminderPrefs,
} from '@/domain/reminders';
import { useAppState, useStored } from '@/state/app-state';
import { useNotificationPermission } from '@/state/notification-permission';
import { loadReminderPrefs, loadRemindersConfirmed, storeReminderPrefs } from '@/storage/kv';
import { tr } from '@/strings';
import { Button, Card, Chip, Label, Row, Screen, Stepper } from '@/ui/components';
import { usePalette } from '@/ui/theme';

export default function RemindersScreen() {
  const { dataVersion, notifyDataChanged } = useAppState();
  const stored = useStored(`reminders|${dataVersion}`, loadReminderPrefs);
  const confirmed = useStored(`reminders-confirmed|${dataVersion}`, loadRemindersConfirmed);
  // Before the first confirmation every reminder is shown (and is) off.
  const prefs = effectiveReminderPrefs(stored, confirmed);
  const permission = useNotificationPermission();
  const c = usePalette();

  const save = (next: ReminderPrefs) => {
    storeReminderPrefs(next);
    notifyDataChanged();
  };
  const setEnabled = (key: ReminderKey, enabled: boolean) => {
    // Turning a reminder on goes through the explanation screen the first time (also when the
    // system permission is already granted: Android 12 and older, or after "Tüm verileri sil"),
    // and whenever the system prompt has not been answered (`null` = not known yet: explain first).
    if (enabled && (!confirmed || permission === 'undetermined' || permission === null)) {
      router.push({ pathname: '/bildirim-izni', params: { enable: key } });
      return;
    }
    save({ ...prefs, [key]: { ...prefs[key], enabled } });
  };
  const daily = prefs.daily;
  const setDaily = (hour: number, minute: number) => {
    const total = (((hour * 60 + minute) % 1440) + 1440) % 1440;
    save({ ...prefs, daily: { ...daily, hour: Math.floor(total / 60), minute: total % 60 } });
  };

  return (
    <Screen testID="reminders-screen">
      <Card>
        <Label variant="small">{tr.reminders.info}</Label>
        {permission === 'undetermined' ? (
          <>
            <Label testID="reminders-permission-missing" style={{ color: c.warning }}>
              {tr.reminders.permissionMissing}
            </Label>
            <Button
              testID="reminders-permission"
              title={tr.reminders.permissionAsk}
              onPress={() => router.push('/bildirim-izni')}
            />
          </>
        ) : null}
        {permission === 'denied' ? (
          <>
            <Label testID="reminders-permission-denied" style={{ color: c.warning }}>
              {tr.reminders.permissionDenied}
            </Label>
            <Button
              testID="reminders-open-settings"
              kind="secondary"
              title={tr.reminders.openSettings}
              onPress={() => void Linking.openSettings()}
            />
          </>
        ) : null}
        {permission === 'unsupported' ? <Label variant="muted">{tr.reminders.unsupported}</Label> : null}
      </Card>

      <Card>
        <ToggleRow
          testID="reminder-long"
          label={tr.reminders.longSession}
          info={tr.reminders.longSessionInfo(prefs.longSession.hours)}
          on={prefs.longSession.enabled}
          onToggle={() => setEnabled('longSession', !prefs.longSession.enabled)}
        />
        {prefs.longSession.enabled ? (
          <Stepper
            testID="reminder-long-hours"
            label={tr.reminders.longSessionHours}
            value={tr.reminders.hours(prefs.longSession.hours)}
            onMinus={() => save({ ...prefs, longSession: { ...prefs.longSession, hours: prefs.longSession.hours - 1 } })}
            onPlus={() => save({ ...prefs, longSession: { ...prefs.longSession, hours: prefs.longSession.hours + 1 } })}
            minusDisabled={prefs.longSession.hours <= LONG_SESSION_HOURS.min}
            plusDisabled={prefs.longSession.hours >= LONG_SESSION_HOURS.max}
          />
        ) : null}
      </Card>

      <Card>
        <ToggleRow
          testID="reminder-pomodoro"
          label={tr.reminders.pomodoro}
          info={tr.reminders.pomodoroInfo}
          on={prefs.pomodoro.enabled}
          onToggle={() => setEnabled('pomodoro', !prefs.pomodoro.enabled)}
        />
      </Card>

      <Card>
        <ToggleRow
          testID="reminder-daily"
          label={tr.reminders.daily}
          info={tr.reminders.dailyInfo}
          on={daily.enabled}
          onToggle={() => setEnabled('daily', !daily.enabled)}
        />
        {daily.enabled ? (
          <>
            <Label testID="reminder-daily-time" variant="heading">
              {tr.reminders.time(daily.hour, daily.minute)}
            </Label>
            <Stepper
              testID="reminder-daily-hour"
              label={tr.reminders.dailyHour}
              value={String(daily.hour).padStart(2, '0')}
              onMinus={() => setDaily(daily.hour - 1, daily.minute)}
              onPlus={() => setDaily(daily.hour + 1, daily.minute)}
            />
            <Stepper
              testID="reminder-daily-minute"
              label={tr.reminders.dailyMinute}
              value={String(daily.minute).padStart(2, '0')}
              onMinus={() => setDaily(daily.hour, daily.minute - DAILY_MINUTE_STEP)}
              onPlus={() => setDaily(daily.hour, daily.minute + DAILY_MINUTE_STEP)}
            />
          </>
        ) : null}
      </Card>

      <Card>
        <ToggleRow
          testID="reminder-exam"
          label={tr.reminders.examAnalysis}
          info={tr.reminders.examAnalysisInfo}
          on={prefs.examAnalysis.enabled}
          onToggle={() => setEnabled('examAnalysis', !prefs.examAnalysis.enabled)}
        />
      </Card>
    </Screen>
  );
}

function ToggleRow({
  label,
  info,
  on,
  onToggle,
  testID,
}: {
  label: string;
  info: string;
  on: boolean;
  onToggle: () => void;
  testID: string;
}) {
  return (
    <View style={{ gap: 4 }}>
      <Row>
        <Label variant="heading" style={{ flex: 1 }}>
          {label}
        </Label>
        <Chip testID={`${testID}-toggle`} title={on ? tr.reminders.on : tr.reminders.off} selected={on} onPress={onToggle} />
      </Row>
      <Label variant="small">{info}</Label>
    </View>
  );
}
