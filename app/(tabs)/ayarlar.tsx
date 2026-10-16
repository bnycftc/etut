import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { GROUPS_ENABLED } from '@/config/features';

import { examDateKind, formatDayInput, readExamDayInput, resolveExamDate } from '@/domain/exam-dates';
import { canUseParentMode } from '@/domain/groups';
import { istanbulDayKey, istanbulYear } from '@/domain/istanbul-day';
import type { YksArea } from '@/domain/net';
import {
  DEFAULT_POMODORO,
  normalizePomodoroConfig,
  type PomodoroConfig,
  POMODORO_LIMITS,
  POMODORO_PRESETS,
  samePomodoroConfig,
} from '@/domain/pomodoro';
import { EXAM_TYPES, type ExamType, YKS_AREAS } from '@/domain/profile';
import { effectiveReminderPrefs } from '@/domain/reminders';
import { GOAL_MAX_MINUTES, GOAL_MIN_MINUTES } from '@/domain/streak';
import { useAppState, useStored } from '@/state/app-state';
import { backupExportText, shareBackup } from '@/state/backup-export';
import { useNotificationPermission } from '@/state/notification-permission';
import {
  clearTipsSeen,
  loadCustomExamDate,
  loadDailyGoal,
  loadPomodoroConfig,
  loadReminderPrefs,
  loadRemindersConfirmed,
  storeCustomExamDate,
  storeDailyGoal,
  storePomodoroConfig,
} from '@/storage/kv';
import { loadGroupsAccount, loadParentAccount } from '@/storage/groups-kv';
import { tr } from '@/strings';
import { groupApi, isAccountGone } from '@/sync/api';
import { LastBackupLabel } from '@/ui/backup-reminder';
import { Button, Card, Chip, ChipRow, Field, Label, Row, Screen, Stepper, Tag } from '@/ui/components';
import { formatDay, formatDuration } from '@/ui/format';
import { openGuide } from '@/ui/info-link';
import { useReducedMotion } from '@/ui/motion';
import { usePalette } from '@/ui/theme';
import { TimerSettingsCard } from '@/ui/timer-safety';

const DEFAULT_GOAL_MINUTES = 120;
const GOAL_STEP_MINUTES = 15;

const POMODORO_FIELDS: {
  key: keyof PomodoroConfig;
  label: string;
  step: number;
  format: (n: number) => string;
}[] = [
  { key: 'workMin', label: tr.pomodoro.workLabel, step: 5, format: tr.pomodoro.minutes },
  { key: 'shortBreakMin', label: tr.pomodoro.shortLabel, step: 1, format: tr.pomodoro.minutes },
  { key: 'longBreakMin', label: tr.pomodoro.longLabel, step: 5, format: tr.pomodoro.minutes },
  { key: 'longEvery', label: tr.pomodoro.everyLabel, step: 1, format: tr.pomodoro.every },
];

export default function SettingsScreen() {
  const { profile, resetAll, dataVersions, notifyDataChanged, updateExam, createBackup } = useAppState();
  const [confirming, setConfirming] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [backupNote, setBackupNote] = useState<{ message: string } | { error: string } | null>(null);
  // `null` = no unsaved choice: the chips show the profile (which a backup restore can change).
  const [draft, setDraft] = useState<{ exam: ExamType; area: YksArea | null } | null>(null);
  const [examSaved, setExamSaved] = useState(false);
  const draftExam = draft?.exam ?? profile?.examType ?? 'YKS';
  const draftArea = draft === null ? (profile?.yksArea ?? null) : draft.area;
  const setDraftExam = (exam: ExamType) => setDraft({ exam, area: draftArea });
  const setDraftArea = (area: YksArea) => setDraft({ exam: draftExam, area });
  const examChanged =
    profile !== null &&
    (draftExam !== profile.examType || (draftExam === 'YKS' && draftArea !== profile.yksArea));
  const saveExam = () => {
    const saved = updateExam(draftExam, draftExam === 'YKS' ? draftArea : null);
    if (saved) setDraft(null);
    setExamSaved(saved);
  };
  const goal = useStored(`goal|${dataVersions.settings}`, loadDailyGoal);
  const setGoal = (minutes: number | null) => {
    storeDailyGoal(minutes);
    notifyDataChanged('settings');
  };
  const pomodoro = useStored(`pomodoro|${dataVersions.settings}`, loadPomodoroConfig);
  const setPomodoro = (config: PomodoroConfig) => {
    storePomodoroConfig(normalizePomodoroConfig(config));
    notifyDataChanged('settings');
  };
  const c = usePalette();
  const reduceMotion = useReducedMotion();
  const examType = profile?.examType ?? 'DIGER';
  const customDay = useStored(`examDate|${examType}|${dataVersions.settings}`, () => loadCustomExamDate(examType));
  const examDate = resolveExamDate(examType, customDay);
  // Estimate, official, the student's own or none: the line under the date says which (no year in it).
  const examDateInfo = tr.countdown.settingsInfo(examType, examDateKind(examDate));
  const [dateText, setDateText] = useState('');
  const [dateError, setDateError] = useState(false);
  // Bumped when the error appears or the field is left with a wrong date, so VoiceOver reads it again.
  const [dateAttempt, setDateAttempt] = useState(0);
  // Saved as soon as the field holds a valid date: settings have no Kaydet button (bny, 12 Oct 2026).
  const changeDate = (text: string, left = false) => {
    const day = readExamDayInput(text, dateText, istanbulDayKey(Date.now()), left);
    setDateError(day === 'invalid');
    if (day === 'invalid' && (left || !dateError)) setDateAttempt((n) => n + 1);
    if (day === null || day === 'invalid') {
      setDateText(text);
      return;
    }
    storeCustomExamDate(examType, day);
    setDateText('');
    notifyDataChanged('settings');
  };
  const permission = useNotificationPermission();
  const reminderPrefs = useStored(`reminders|${dataVersions.settings}`, () =>
    effectiveReminderPrefs(loadReminderPrefs(), loadRemindersConfirmed()),
  );
  const enabledReminders = Object.values(reminderPrefs).filter((r) => r.enabled).length;
  const version = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '–';
  const build = Application.nativeBuildVersion ?? '–';
  const parentMode = GROUPS_ENABLED && profile !== null && canUseParentMode(profile.birthYear, istanbulYear(Date.now()));

  // With the group module, "delete all" removes the server account first; if that fails nothing is
  // deleted, so the student can retry instead of losing the way to delete the server data.
  // An account that is already gone (deleted elsewhere, purged after inactivity, no session left
  // on this device) has nothing left to delete there and must not block the local wipe.
  const deleteAll = async () => {
    setDeleteError(false);
    if (GROUPS_ENABLED && (loadGroupsAccount() || loadParentAccount())) {
      setDeleting(true);
      try {
        await groupApi().deleteMyAccount();
      } catch (e) {
        const gone = isAccountGone(e) || !(await groupApi().hasSession().catch(() => true));
        if (!gone) {
          setDeleteError(true);
          return;
        }
      } finally {
        setDeleting(false);
      }
    }
    setConfirming(false);
    resetAll();
  };

  // "Önce yedek al": the export of the Yedek screen. Nothing is deleted and the dialog stays open,
  // so deleting is still a choice of its own.
  const backupFirst = async () => {
    if (backingUp) return;
    setBackingUp(true);
    setBackupNote(null);
    try {
      const appVersion = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '';
      const result = await shareBackup(createBackup(appVersion));
      if (result.kind === 'shared') notifyDataChanged('settings');
      const shown =
        result.kind === 'check_failed' ? { error: tr.settings.deleteAllBackupCheckFailed } : backupExportText(result);
      // Closing the share sheet without saving also counts as shared: say so above "Evet, hepsini sil".
      setBackupNote('message' in shown ? { message: tr.settings.deleteAllBackupDone(shown.message) } : shown);
    } catch {
      setBackupNote({ error: tr.backup.failed });
    } finally {
      setBackingUp(false);
    }
  };
  // The dialog is drawn under the status bar and the home indicator.
  const insets = useSafeAreaInsets();

  return (
    <Screen testID="settings-screen">
      {profile !== null ? (
        <Card>
          <Label variant="heading">{tr.settings.profile}</Label>
          <Row>
            <Label variant="muted" style={{ flex: 1 }}>
              {tr.settings.exam}
            </Label>
            <Label testID="settings-exam-current">
              {tr.examType(profile.examType)}
              {profile.yksArea ? ` · ${tr.yksArea(profile.yksArea)}` : ''}
            </Label>
          </Row>
          {/* K-20: neither the birth year nor an age group is shown anywhere. */}
          <Label variant="heading">{tr.settings.examChangeTitle}</Label>
          <Label variant="small">{tr.settings.examChangeInfo}</Label>
          <ChipRow>
            {EXAM_TYPES.map((t) => (
              <Chip
                key={t}
                testID={`settings-exam-type-${t}`}
                title={tr.examType(t)}
                selected={t === draftExam}
                onPress={() => {
                  setDraftExam(t);
                  setExamSaved(false);
                }}
              />
            ))}
          </ChipRow>
          {draftExam === 'YKS' ? (
            <>
              <Label variant="muted">{tr.settings.examChangeArea}</Label>
              <ChipRow>
                {YKS_AREAS.map((a) => (
                  <Chip
                    key={a}
                    testID={`settings-yks-area-${a}`}
                    title={tr.yksArea(a)}
                    selected={a === draftArea}
                    onPress={() => {
                      setDraftArea(a);
                      setExamSaved(false);
                    }}
                  />
                ))}
              </ChipRow>
            </>
          ) : null}
          <Button
            testID="settings-exam-save"
            kind="secondary"
            title={tr.settings.examChangeSave}
            disabled={!examChanged || (draftExam === 'YKS' && draftArea === null)}
            onPress={saveExam}
          />
          {examSaved ? (
            <Label testID="settings-exam-saved" variant="small" live>
              {tr.settings.examChangeSaved}
            </Label>
          ) : null}
          {/* K-17: the declared age can not be edited; say so instead of offering a control. */}
          <Label variant="small">{tr.settings.ageFixed}</Label>
        </Card>
      ) : null}

      {profile !== null ? (
        <Card>
          <Label variant="heading">{tr.countdown.settingsTitle}</Label>
          <Row>
            <Label testID="settings-exam-date" style={{ flex: 1 }}>
              {examDate === null ? tr.countdown.none : formatDay(examDate.day)}
            </Label>
            {examDate?.estimated ? <Tag title={tr.countdown.estimated} /> : null}
            {examDate?.custom ? <Tag title={tr.countdown.custom} /> : null}
          </Row>
          {examDateInfo !== null ? (
            <Label variant="small" testID="settings-exam-date-info">
              {examDateInfo}
            </Label>
          ) : null}
          <Row>
            <Field
              testID="settings-exam-date-input"
              label={tr.countdown.input}
              value={dateText}
              onChange={(text) => changeDate(text)}
              onBlur={() => changeDate(dateText, true)}
              maxLength={10}
              numeric={false}
              placeholder={examDate === null ? tr.countdown.placeholder : formatDayInput(examDate.day)}
            />
          </Row>
          {dateError ? (
            <Label variant="small" live={dateAttempt} style={{ color: c.danger }}>
              {tr.countdown.invalid}
            </Label>
          ) : null}
          {examDate?.custom ? (
            <Button
              testID="settings-exam-date-reset"
              kind="secondary"
              title={tr.countdown.reset(examDateKind(resolveExamDate(examType, null)))}
              onPress={() => {
                storeCustomExamDate(profile.examType, null);
                notifyDataChanged('settings');
              }}
            />
          ) : null}
        </Card>
      ) : null}

      <Card>
        <Label variant="heading">{tr.goal.title}</Label>
        <Label variant="small">{tr.goal.info}</Label>
        {goal === null ? (
          <Button
            testID="settings-goal-on"
            kind="secondary"
            title={tr.goal.turnOn}
            onPress={() => setGoal(DEFAULT_GOAL_MINUTES)}
          />
        ) : (
          <>
            <Stepper
              testID="settings-goal"
              label={tr.goal.title}
              value={formatDuration(goal * 60_000)}
              onMinus={() => setGoal(goal - GOAL_STEP_MINUTES)}
              onPlus={() => setGoal(goal + GOAL_STEP_MINUTES)}
              minusDisabled={goal <= GOAL_MIN_MINUTES}
              plusDisabled={goal >= GOAL_MAX_MINUTES}
            />
            <Button
              testID="settings-goal-off"
              kind="secondary"
              title={tr.goal.turnOff}
              onPress={() => setGoal(null)}
            />
          </>
        )}
      </Card>

      <Card>
        <Label variant="heading">{tr.pomodoro.settingsTitle}</Label>
        <Label variant="small">{tr.pomodoro.breakNote}</Label>
        <Label variant="muted">{tr.pomodoro.presets}</Label>
        <ChipRow>
          {POMODORO_PRESETS.map((preset) => (
            <Chip
              key={`${preset.workMin}-${preset.shortBreakMin}`}
              testID={`settings-pomodoro-preset-${preset.workMin}-${preset.shortBreakMin}`}
              title={tr.pomodoro.preset(preset.workMin, preset.shortBreakMin)}
              accessibilityLabel={tr.pomodoro.presetA11y(preset.workMin, preset.shortBreakMin)}
              selected={samePomodoroConfig(pomodoro, preset)}
              onPress={() => setPomodoro(preset)}
            />
          ))}
        </ChipRow>
        {POMODORO_FIELDS.map(({ key, label, step, format }) => (
          <Stepper
            key={key}
            testID={`settings-pomodoro-${key}`}
            label={label}
            value={format(pomodoro[key])}
            onMinus={() => setPomodoro({ ...pomodoro, [key]: pomodoro[key] - step })}
            onPlus={() => setPomodoro({ ...pomodoro, [key]: pomodoro[key] + step })}
            minusDisabled={pomodoro[key] <= POMODORO_LIMITS[key].min}
            plusDisabled={pomodoro[key] >= POMODORO_LIMITS[key].max}
          />
        ))}
        <Button
          testID="settings-pomodoro-reset"
          kind="secondary"
          title={tr.pomodoro.reset}
          onPress={() => setPomodoro(DEFAULT_POMODORO)}
        />
      </Card>

      <TimerSettingsCard />

      <Card>
        <Label variant="heading">{tr.reminders.title}</Label>
        <Label testID="settings-reminders-summary" variant="small">
          {permission === 'granted'
            ? tr.reminders.summaryOn(enabledReminders)
            : permission === 'unsupported'
              ? tr.reminders.unsupported
              : tr.reminders.summaryOff}
        </Label>
        <Button
          testID="settings-reminders"
          kind="secondary"
          title={tr.reminders.open}
          onPress={() => router.push('/hatirlaticilar')}
        />
      </Card>

      <Card>
        <Label variant="heading">{tr.settings.dataTitle}</Label>
        <Label variant="muted">{GROUPS_ENABLED ? tr.settings.dataInfoGroups : tr.settings.dataInfo}</Label>
        <LastBackupLabel testID="settings-last-backup" />
        <Button
          testID="settings-open-backup"
          kind="secondary"
          title={tr.backup.title}
          onPress={() => router.push('/yedek')}
        />
        <Button
          kind="danger"
          testID="settings-delete-all"
          title={tr.settings.deleteAll}
          onPress={() => {
            setBackupNote(null);
            setConfirming(true);
          }}
        />
      </Card>

      {/* The button sits at the bottom of a long screen: confirm in a centred dialog so the
          destructive choice is always on screen, never hidden behind the tab bar. At large text
          sizes only the text scrolls: Vazgeç and "Evet, hepsini sil" stay visible below it. */}
      <Modal
        visible={confirming}
        transparent
        animationType={reduceMotion ? 'none' : 'fade'}
        onRequestClose={() => setConfirming(false)}>
        <View style={[styles.backdrop, { paddingTop: 24 + insets.top, paddingBottom: 24 + insets.bottom }]}>
          {/* Tapping the dimmed area cancels (decorative for screen readers: Vazgeç does the same). */}
          <Pressable
            testID="settings-delete-all-backdrop"
            style={StyleSheet.absoluteFill}
            onPress={() => setConfirming(false)}
            accessible={false}
            importantForAccessibility="no"
          />
          <View
            testID="settings-delete-all-dialog"
            accessibilityViewIsModal
            style={[styles.dialog, { backgroundColor: c.surface, borderColor: c.border }]}>
            <ScrollView
              testID="settings-delete-all-scroll"
              style={styles.dialogText}
              contentContainerStyle={styles.dialogTextContent}>
              <Label variant="heading">{tr.settings.deleteAll}</Label>
              <Label>{tr.settings.deleteAllConfirm}</Label>
              <Label variant="small">{tr.settings.deleteAllAgeNote}</Label>
              <Button
                kind="secondary"
                testID="settings-delete-all-backup"
                title={tr.settings.deleteAllBackupFirst}
                disabled={deleting || backingUp}
                onPress={() => void backupFirst()}
              />
              {backupNote !== null ? (
                <Label
                  testID="settings-delete-all-backup-note"
                  variant="small"
                  live
                  style={'error' in backupNote ? { color: c.danger } : undefined}>
                  {'error' in backupNote ? backupNote.error : backupNote.message}
                </Label>
              ) : null}
              {deleteError ? (
                <>
                  <Label variant="small" live style={{ color: c.danger }}>
                    {tr.settings.deleteAllServerFailed}
                  </Label>
                  {/* Offline or the server is down: the device data can always be deleted (KVKK m.7). */}
                  <Button
                    kind="secondary"
                    testID="settings-delete-local-only"
                    title={tr.settings.deleteAllLocalOnly}
                    disabled={deleting}
                    onPress={() => {
                      setConfirming(false);
                      setDeleteError(false);
                      resetAll();
                    }}
                  />
                </>
              ) : null}
            </ScrollView>
            {/* Vazgeç first: if anything is ever cut off, it is not the way out. */}
            <Button
              kind="secondary"
              testID="settings-delete-all-cancel"
              title={tr.common.cancel}
              onPress={() => setConfirming(false)}
            />
            <Button
              kind="danger"
              testID="settings-delete-all-confirm"
              title={tr.settings.deleteAllYes}
              disabled={deleting || backingUp}
              onPress={() => void deleteAll()}
            />
          </View>
        </View>
      </Modal>

      {GROUPS_ENABLED && profile !== null && !profile.soloOnly ? (
        <Card>
          <Label variant="heading">{tr.privacy.title}</Label>
          <Button
            testID="settings-privacy"
            kind="secondary"
            title={tr.privacy.settingsEntry}
            onPress={() => router.push('/gizlilik')}
          />
        </Card>
      ) : null}

      {parentMode ? (
        <Card>
          <Label variant="heading">{tr.parent.entry}</Label>
          <Label variant="small">{tr.parent.entryInfo}</Label>
          <Button testID="settings-parent-mode" kind="secondary" title={tr.parent.entry} onPress={() => router.push('/veli')} />
        </Card>
      ) : null}

      <Card>
        <Label variant="heading">{tr.help.title}</Label>
        <Label variant="small">{tr.help.info}</Label>
        <Button testID="settings-open-guide" kind="secondary" title={tr.help.guide} onPress={() => openGuide()} />
        <Button
          testID="settings-show-tips"
          kind="secondary"
          title={tr.help.showTips}
          onPress={() => {
            // The timer tab opens the tips again when it is shown (src/ui/tips.tsx).
            clearTipsSeen();
            router.navigate('/');
          }}
        />
      </Card>

      <Card>
        <Label variant="heading">{tr.settings.about}</Label>
        <Row>
          <Label variant="muted" style={{ flex: 1 }}>
            {tr.settings.version}
          </Label>
          <Label>{version}</Label>
        </Row>
        <Row>
          <Label variant="muted" style={{ flex: 1 }}>
            {tr.settings.build}
          </Label>
          <Label>{build}</Label>
        </Row>
        <Button
          testID="settings-open-about"
          kind="secondary"
          title={tr.settings.openAbout}
          onPress={() => router.push('/hakkinda')}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  dialog: {
    gap: 12,
    padding: 20,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: '100%',
  },
  // Sized to its text, and shrinks (then scrolls) when the dialog reaches the screen height.
  dialogText: { flexGrow: 0, flexShrink: 1 },
  dialogTextContent: { gap: 12 },
});
