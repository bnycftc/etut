import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { useState } from 'react';

import { useAppState } from '@/state/app-state';
import { tr } from '@/strings';
import { Button, Card, Label, Row, Screen } from '@/ui/components';

export default function SettingsScreen() {
  const { profile, resetAll } = useAppState();
  const [confirming, setConfirming] = useState(false);
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
