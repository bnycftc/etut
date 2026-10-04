import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { useState } from 'react';

import { GOAL_MAX_MINUTES, GOAL_MIN_MINUTES } from '@/domain/streak';
import { useAppState, useStored } from '@/state/app-state';
import { loadDailyGoal, storeDailyGoal } from '@/storage/kv';
import { tr } from '@/strings';
import { Button, Card, Label, Row, Screen, Stepper } from '@/ui/components';
import { formatDuration } from '@/ui/format';

const DEFAULT_GOAL_MINUTES = 120;
const GOAL_STEP_MINUTES = 15;

export default function SettingsScreen() {
  const { profile, resetAll, dataVersion, notifyDataChanged } = useAppState();
  const [confirming, setConfirming] = useState(false);
  const goal = useStored(`goal|${dataVersion}`, loadDailyGoal);
  const setGoal = (minutes: number | null) => {
    storeDailyGoal(minutes);
    notifyDataChanged();
  };
  const version = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '–';
  const build = Application.nativeBuildVersion ?? '–';

  return (
    <Screen>
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
          <Row>
            <Label variant="muted" style={{ flex: 1 }}>
              {tr.settings.birthYear}
            </Label>
            <Label>{String(profile.birthYear)}</Label>
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
        <Label variant="heading">{tr.settings.dataTitle}</Label>
        <Label variant="muted">{tr.settings.dataInfo}</Label>
        {confirming ? (
          <>
            <Label>{tr.settings.deleteAllConfirm}</Label>
            <Button
              kind="danger"
              title={tr.settings.deleteAllYes}
              onPress={() => {
                setConfirming(false);
                resetAll();
              }}
            />
            <Button kind="secondary" title={tr.common.cancel} onPress={() => setConfirming(false)} />
          </>
        ) : (
          <Button kind="danger" title={tr.settings.deleteAll} onPress={() => setConfirming(true)} />
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
