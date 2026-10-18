import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform } from 'react-native';

import { contactEmail, feedbackMailUrl } from '@/domain/contact';
import { DATA_CONTROLLER, LEGAL_DOC_IDS, tr } from '@/strings';
import { Button, Card, Label, Row, Screen } from '@/ui/components';
import { openGuide } from '@/ui/info-link';

/** "iOS 26.1": only the system and its version, nothing that identifies the phone or the student. */
function systemName(): string {
  const name = Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web';
  return Platform.OS === 'web' ? name : `${name} ${String(Platform.Version)}`;
}

/** Settings → Hakkında: version, how it works, contact, legal texts, data controller and licenses. */
export default function AboutScreen() {
  const version = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '–';
  const build = Application.nativeBuildVersion ?? '–';
  // `null` while DATA_CONTROLLER.contact is still the `[DOLDURULACAK]` placeholder (or not an
  // e-mail address): the row stays disabled ("Yakında"). No address is made up here; bny fills it
  // in strings.ts before release.
  const email = contactEmail(DATA_CONTROLLER.contact);
  const [mailFailed, setMailFailed] = useState(false);
  const writeToUs = () => {
    if (email === null) return;
    setMailFailed(false);
    Linking.openURL(feedbackMailUrl(email, tr.contact.subject(version, build, systemName()))).catch(() =>
      setMailFailed(true),
    );
  };
  return (
    <Screen testID="about-screen">
      <Card>
        <Label variant="title">{tr.appName}</Label>
        <Row>
          <Label variant="muted" style={{ flex: 1 }}>
            {tr.settings.version}
          </Label>
          <Label testID="about-version">{version}</Label>
        </Row>
        <Row>
          <Label variant="muted" style={{ flex: 1 }}>
            {tr.settings.build}
          </Label>
          <Label>{build}</Label>
        </Row>
        <Label variant="small">{tr.about.noNetwork}</Label>
        <Button testID="about-open-guide" kind="secondary" title={tr.help.guide} onPress={() => openGuide()} />
      </Card>

      <Card>
        <Label variant="heading">{tr.contact.title}</Label>
        <Label variant="small">{email === null ? tr.contact.soonInfo : tr.contact.info}</Label>
        <Button
          testID="about-contact"
          kind="secondary"
          title={email === null ? tr.contact.soon : tr.contact.send}
          disabled={email === null}
          onPress={writeToUs}
        />
        {mailFailed && email !== null ? (
          <Label testID="about-contact-failed" variant="small">
            {tr.contact.failed(email)}
          </Label>
        ) : null}
      </Card>

      <Card>
        <Label variant="heading">{tr.about.legalTitle}</Label>
        {LEGAL_DOC_IDS.map((id) => (
          <Button
            key={id}
            testID={`about-doc-${id}`}
            kind="secondary"
            title={tr.legal[id].title}
            onPress={() => router.push({ pathname: '/yasal/[doc]', params: { doc: id } })}
          />
        ))}
        <Button
          testID="about-licenses"
          kind="secondary"
          title={tr.about.licenses}
          onPress={() => router.push('/lisanslar')}
        />
      </Card>

      <Card>
        <Row>
          <Label variant="muted" style={{ flex: 1 }}>
            {tr.about.controller}
          </Label>
          <Label testID="about-controller">{DATA_CONTROLLER.name}</Label>
        </Row>
        <Row>
          <Label variant="muted" style={{ flex: 1 }}>
            {tr.about.contact}
          </Label>
          <Label>{DATA_CONTROLLER.contact}</Label>
        </Row>
      </Card>
    </Screen>
  );
}
