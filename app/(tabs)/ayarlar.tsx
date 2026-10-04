import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';

import {
  formatDayInput,
  isValidCustomExamDay,
  parseDayInput,
  resolveExamDate,
} from '@/domain/exam-dates';
import { istanbulDayKey } from '@/domain/istanbul-day';
import type { YksArea } from '@/domain/net';
import {
  DEFAULT_POMODORO,
  normalizePomodoroConfig,
  type PomodoroConfig,
  POMODORO_LIMITS,
} from '@/domain/pomodoro';
import { EXAM_TYPES, type ExamType, YKS_AREAS } from '@/domain/profile';
import { GOAL_MAX_MINUTES, GOAL_MIN_MINUTES } from '@/domain/streak';
import { useAppState, useStored } from '@/state/app-state';
import {
  loadCustomExamDate,
  loadDailyGoal,
  loadPomodoroConfig,
  storeCustomExamDate,
  storeDailyGoal,
  storePomodoroConfig,
} from '@/storage/kv';
import { tr } from '@/strings';
import { Button, Card, Chip, ChipRow, Field, Label, Row, Screen, Stepper, Tag } from '@/ui/components';
import { formatDay, formatDuration } from '@/ui/format';
import { useReducedMotion } from '@/ui/motion';
import { usePalette } from '@/ui/theme';

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
  const { profile, resetAll, dataVersion, notifyDataChanged, updateExam } = useAppState();
  const [confirming, setConfirming] = useState(false);
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
  const goal = useStored(`goal|${dataVersion}`, loadDailyGoal);
  const setGoal = (minutes: number | null) => {
    storeDailyGoal(minutes);
    notifyDataChanged();
  };
  const pomodoro = useStored(`pomodoro|${dataVersion}`, loadPomodoroConfig);
  const setPomodoro = (config: PomodoroConfig) => {
    storePomodoroConfig(normalizePomodoroConfig(config));
    notifyDataChanged();
  };
  const c = usePalette();
  const reduceMotion = useReducedMotion();
  const examType = profile?.examType ?? 'DIGER';
  const customDay = useStored(`examDate|${examType}|${dataVersion}`, () => loadCustomExamDate(examType));
  const examDate = resolveExamDate(examType, customDay);
  const [dateText, setDateText] = useState('');
  const [dateError, setDateError] = useState(false);
  const saveDate = () => {
    const day = parseDayInput(dateText);
    const ok = day !== null && isValidCustomExamDay(day, istanbulDayKey(Date.now()));
    setDateError(!ok);
    if (!ok) return;
    storeCustomExamDate(examType, day);
    setDateText('');
    notifyDataChanged();
  };
  const version = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '–';
  const build = Application.nativeBuildVersion ?? '–';

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
            <Label testID="settings-exam-saved" variant="small">
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
          <Label variant="small">{tr.countdown.settingsInfo}</Label>
          <Row>
            <Field
              testID="settings-exam-date-input"
              label={tr.countdown.input}
              value={dateText}
              onChange={setDateText}
              maxLength={10}
              numeric={false}
              placeholder={examDate === null ? tr.countdown.placeholder : formatDayInput(examDate.day)}
            />
          </Row>
          {dateError ? (
            <Label variant="small" style={{ color: c.danger }}>
              {tr.countdown.invalid}
            </Label>
          ) : null}
          <Row>
            <Button testID="settings-exam-date-save" kind="secondary" title={tr.countdown.save} onPress={saveDate} />
            {examDate?.custom ? (
              <Button
                testID="settings-exam-date-reset"
                kind="secondary"
                title={tr.countdown.reset}
                onPress={() => {
                  storeCustomExamDate(profile.examType, null);
                  notifyDataChanged();
                }}
              />
            ) : null}
          </Row>
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

      <Card>
        <Label variant="heading">{tr.settings.dataTitle}</Label>
        <Label variant="muted">{tr.settings.dataInfo}</Label>
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
          onPress={() => setConfirming(true)}
        />
      </Card>

      {/* The button sits at the bottom of a long screen: confirm in a centred dialog so the
          destructive choice is always on screen, never hidden behind the tab bar. */}
      <Modal
        visible={confirming}
        transparent
        animationType={reduceMotion ? 'none' : 'fade'}
        onRequestClose={() => setConfirming(false)}>
        <View style={styles.backdrop}>
          <View
            testID="settings-delete-all-dialog"
            accessibilityViewIsModal
            style={[styles.dialog, { backgroundColor: c.surface, borderColor: c.border }]}>
            <Label variant="heading">{tr.settings.deleteAll}</Label>
            <Label>{tr.settings.deleteAllConfirm}</Label>
            <Label variant="small">{tr.settings.deleteAllAgeNote}</Label>
            <Button
              kind="danger"
              testID="settings-delete-all-confirm"
              title={tr.settings.deleteAllYes}
              onPress={() => {
                setConfirming(false);
                resetAll();
              }}
            />
            <Button
              kind="secondary"
              testID="settings-delete-all-cancel"
              title={tr.common.cancel}
              onPress={() => setConfirming(false)}
            />
          </View>
        </View>
      </Modal>

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
  },
});
