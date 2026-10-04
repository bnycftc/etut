import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { useState } from 'react';

import {
  formatDayInput,
  isValidCustomExamDay,
  parseDayInput,
  resolveExamDate,
} from '@/domain/exam-dates';
import { istanbulDayKey } from '@/domain/istanbul-day';
import {
  DEFAULT_POMODORO,
  normalizePomodoroConfig,
  type PomodoroConfig,
  POMODORO_LIMITS,
} from '@/domain/pomodoro';
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
import { Button, Card, Field, Label, Row, Screen, Stepper, Tag } from '@/ui/components';
import { formatDay, formatDuration } from '@/ui/format';
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
  const { profile, resetAll, dataVersion, notifyDataChanged } = useAppState();
  const [confirming, setConfirming] = useState(false);
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
            <Label>
              {tr.examType(profile.examType)}
              {profile.yksArea ? ` · ${tr.yksArea(profile.yksArea)}` : ''}
            </Label>
          </Row>
          {/* K-20: neither the birth year nor an age group is shown anywhere. */}
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
        <Button kind="secondary" title={tr.pomodoro.reset} onPress={() => setPomodoro(DEFAULT_POMODORO)} />
      </Card>

      <Card>
        <Label variant="heading">{tr.settings.dataTitle}</Label>
        <Label variant="muted">{tr.settings.dataInfo}</Label>
        {confirming ? (
          <>
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
            <Button kind="secondary" title={tr.common.cancel} onPress={() => setConfirming(false)} />
          </>
        ) : (
          <Button
            kind="danger"
            testID="settings-delete-all"
            title={tr.settings.deleteAll}
            onPress={() => setConfirming(true)}
          />
        )}
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
      </Card>
    </Screen>
  );
}
