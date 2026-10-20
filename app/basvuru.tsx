import { Redirect, router, Stack } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { GROUPS_ENABLED } from '@/config/features';
import {
  bodyRequired,
  checkRequestInput,
  REQUEST_APPLICANTS,
  REQUEST_BODY_MAX,
  REQUEST_KINDS,
  type RequestApplicant,
  type RequestKind,
} from '@/domain/dsr';
import { formatCode } from '@/domain/groups';
import { useAppState } from '@/state/app-state';
import { loadGroupsAccount, loadParentAccount } from '@/storage/groups-kv';
import { tr } from '@/strings';
import { ApiError, isAccountGone } from '@/sync/api';
import { requestsApi, type SubmittedRequest } from '@/sync/requests-api';
import { Button, Card, Label, Screen } from '@/ui/components';
import { useContactMail } from '@/ui/contact-mail';
import { errorText, Message } from '@/ui/group-ui';
import { ChoiceRow, requestDate } from '@/ui/requests-entry';
import { usePalette } from '@/ui/theme';

const t = tr.requests.form;

/**
 * In-app KVKK application and complaint form (KVKK m.11, m.13; hukuk/03 K-31, K-38; kvkk/07 C2).
 * The signed-in server account is the applicant: no name, ID number, e-mail or phone is asked for
 * (K-32). Only for a device that already has a server account; nothing here creates one.
 */
export default function RequestFormScreen() {
  const { profile } = useAppState();
  // Group module screens only (K-16: never for an under-15 profile, even through a link).
  if (!GROUPS_ENABLED || profile === null || profile.soloOnly) return <Redirect href="/" />;
  return <RequestForm />;
}

function RequestForm() {
  const api = requestsApi();
  const c = usePalette();
  const mail = useContactMail();
  const [hasAccount, setHasAccount] = useState(() => loadGroupsAccount() || loadParentAccount());
  const [kind, setKind] = useState<RequestKind | null>(null);
  const [applicant, setApplicant] = useState<RequestApplicant>('self');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<SubmittedRequest | null>(null);
  const [busy, setBusy] = useState(false);

  const title = <Stack.Screen options={{ title: t.title }} />;

  if (!hasAccount) {
    return (
      <Screen testID="request-form-screen">
        {title}
        <Card>
          <Label testID="request-no-account">{t.noAccount}</Label>
          {mail.email !== null ? (
            <Button testID="request-mail" kind="secondary" title={t.mail} onPress={mail.open} />
          ) : null}
          <Message text={mail.failed ? t.mailFailed : null} error />
        </Card>
      </Screen>
    );
  }

  if (receipt !== null) {
    return (
      <Screen testID="request-form-screen">
        {title}
        <Card>
          <Label testID="request-received" live>
            {t.received(formatCode(receipt.ref), requestDate(receipt.createdAt), requestDate(receipt.dueAt))}
          </Label>
          <Button testID="request-open-list" title={t.openList} onPress={() => router.replace('/basvurularim')} />
        </Card>
      </Screen>
    );
  }

  const submit = async () => {
    if (kind === null) return;
    const problem = checkRequestInput(kind, body);
    if (problem !== null) {
      setError(t.errors[problem]);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setReceipt(await api.submitRequest({ kind, applicant, body }));
    } catch (e) {
      if (isAccountGone(e)) setHasAccount(false);
      else if (e instanceof ApiError && e.code === 'rate_limited') setError(t.rateLimited);
      else if (e instanceof ApiError && e.code === 'invalid_input') setError(t.invalid);
      else setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  const length = body.trim().length;
  return (
    <Screen testID="request-form-screen">
      {title}
      <Card>
        <Label variant="muted">{t.intro}</Label>
      </Card>

      <Card>
        <Label variant="heading">{t.kind}</Label>
        {REQUEST_KINDS.map((k) => (
          <ChoiceRow
            key={k}
            testID={`request-kind-${k}`}
            title={t.kinds[k]}
            selected={kind === k}
            onPress={() => {
              setKind(k);
              setError(null);
            }}
          />
        ))}
      </Card>

      <Card>
        <Label variant="heading">{t.applicant}</Label>
        {REQUEST_APPLICANTS.map((a) => (
          <ChoiceRow
            key={a}
            testID={`request-applicant-${a}`}
            title={t.applicants[a]}
            selected={applicant === a}
            onPress={() => setApplicant(a)}
          />
        ))}
        {applicant === 'parent' ? <Label variant="small">{t.parentNote}</Label> : null}
      </Card>

      <Card>
        <View style={{ gap: 4 }}>
          <Label variant="small">{kind !== null && bodyRequired(kind) ? t.bodyRequired : t.body}</Label>
          <TextInput
            testID="request-body"
            accessibilityLabel={t.body}
            accessibilityHint={t.bodyHint}
            value={body}
            onChangeText={(v) => {
              setBody(v);
              setError(null);
            }}
            multiline
            // A little room for spaces the server trims; the count below is what is sent.
            maxLength={REQUEST_BODY_MAX + 100}
            textAlignVertical="top"
            style={{
              minHeight: 140,
              borderWidth: 1,
              borderRadius: 10,
              padding: 12,
              fontSize: 16,
              color: c.text,
              borderColor: c.controlBorder,
              backgroundColor: c.background,
            }}
          />
          <Label variant="small">{t.bodyHint}</Label>
          <Label testID="request-body-count" variant="small" style={length > REQUEST_BODY_MAX ? { color: c.danger } : undefined}>
            {t.bodyCount(length, REQUEST_BODY_MAX)}
          </Label>
        </View>
        <Button testID="request-submit" title={t.submit} onPress={() => void submit()} disabled={busy || kind === null} />
        <Message text={error} error testID="request-error" />
      </Card>
    </Screen>
  );
}
