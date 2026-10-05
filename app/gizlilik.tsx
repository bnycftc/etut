import { Linking } from 'react-native';

import { PRIVACY_NOTICE_URL } from '@/config/legal';
import { tr } from '@/strings';
import { Button, Card, Label, Screen } from '@/ui/components';

/**
 * Short privacy notice of the group module in plain words for 15–17 too (KVKK m.10, hukuk/03
 * K-21; docs/hukuk/kvkk/02). Reachable from the group intro and Settings. No consent box (K-35).
 */
export default function PrivacyScreen() {
  return (
    <Screen testID="privacy-screen">
      <Card>
        <Label variant="muted">{tr.privacy.intro}</Label>
      </Card>
      {tr.privacy.sections.map((s) => (
        <Card key={s.title}>
          <Label variant="heading">{s.title}</Label>
          <Label>{s.body}</Label>
        </Card>
      ))}
      <Card>
        <Label variant="heading">{tr.privacy.under18Title}</Label>
        <Label>{tr.privacy.under18}</Label>
      </Card>
      {PRIVACY_NOTICE_URL !== null ? (
        <Button
          testID="privacy-full-text"
          kind="secondary"
          title={tr.privacy.fullText}
          onPress={() => void Linking.openURL(PRIVACY_NOTICE_URL ?? '')}
        />
      ) : null}
    </Screen>
  );
}
