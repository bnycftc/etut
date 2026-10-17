import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { router } from 'expo-router';

import { DATA_CONTROLLER, LEGAL_DOC_IDS, type LegalDocId, tr } from '@/strings';
import { Button, Card, Label, ListRow, Row, Screen, Section } from '@/ui/components';
import { useContactMail } from '@/ui/contact-mail';
import type { IconName } from '@/ui/icon';
import { openGuide } from '@/ui/info-link';

/** The symbol in front of each legal text's row. */
const DOC_ICONS: Record<LegalDocId, IconName> = {
  aydinlatma: 'document',
  gizlilik: 'privacy',
  kullanim: 'terms',
};

/** Settings → Hakkında: version, how it works, contact, legal texts, data controller and licenses. */
export default function AboutScreen() {
  const version = Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? '–';
  const build = Application.nativeBuildVersion ?? '–';
  // Disabled ("Yakında") while the address is still the placeholder (src/ui/contact-mail.ts).
  const { email, failed: mailFailed, open: writeToUs } = useContactMail();
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
      </Card>
      <ListRow icon="guide" testID="about-open-guide" title={tr.help.guide} onPress={() => openGuide()} />

      {/* An action (writes an e-mail), so a button, not a row. */}
      <Section title={tr.contact.title}>
        <Card>
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
      </Section>

      <Section title={tr.about.legalTitle}>
        {LEGAL_DOC_IDS.map((id) => (
          <ListRow
            key={id}
            icon={DOC_ICONS[id]}
            testID={`about-doc-${id}`}
            title={tr.legal[id].title}
            onPress={() => router.push({ pathname: '/yasal/[doc]', params: { doc: id } })}
          />
        ))}
        <ListRow
          icon="licenses"
          testID="about-licenses"
          title={tr.about.licenses}
          onPress={() => router.push('/lisanslar')}
        />
      </Section>

      <Card>
        <Row>
          <Label variant="muted" style={{ flex: 1 }}>
            {tr.about.controller}
          </Label>
          <Label testID="about-controller">{DATA_CONTROLLER.name}</Label>
        </Row>
        <Row>
          <Label variant="muted" style={{ flex: 1 }}>
            {tr.about.address}
          </Label>
          <Label testID="about-address">{DATA_CONTROLLER.address}</Label>
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
