/**
 * "Hesap kodu": the permanent code that lets the student have the group account deleted once the
 * app is gone (e-mail to the contact address, /hesap-sil; K-37, kvkk/07 A Yol 2). Shows the code
 * with a copy/save action and says what it is for. The integration step (WP-J) places it under
 * Gruplar → Grup hesabı; it is meant for an account that exists on the server (it never signs in).
 * Copying goes through the system share sheet (its "Kopyala", Notes, …): the app has no clipboard
 * module; the code text can also be selected.
 */

import { useCallback, useEffect, useState } from 'react';
import { Share, Text, View } from 'react-native';

import { DATA_CONTROLLER, tr } from '../strings';
import { type AccountCode, type AccountCodeApi, accountCodeApi, formatAccountCode } from '../sync/account-code-api';
import { Button, Card, Label, Row } from './components';
import { errorText, Message } from './group-ui';
import { MAX_FONT_SCALE, typography, usePalette } from './theme';

const t = tr.accountCode;

export function AccountCodeCard({ api = accountCodeApi() }: { api?: AccountCodeApi }) {
  const c = usePalette();
  const [state, setState] = useState<AccountCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRenew, setConfirmRenew] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setState(await api.accountCode());
    } catch (e) {
      setError(errorText(e));
    }
  }, [api]);

  useEffect(() => {
    void load();
  }, [load]);

  async function renew() {
    setBusy(true);
    setError(null);
    try {
      setState(await api.renewAccountCode());
      setConfirmRenew(false);
      setNotice(t.renewed);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  const code = state?.code ?? null;
  const shown = code === null ? null : formatAccountCode(code);

  return (
    <Card testID="account-code-card">
      <Label variant="heading">{t.title}</Label>
      <Label variant="muted">{t.info(DATA_CONTROLLER.contact)}</Label>

      {state === null && error === null ? <Label variant="small">{t.loading}</Label> : null}

      {shown !== null ? (
        <View style={{ gap: 8 }}>
          <Text
            testID="account-code-value"
            selectable
            accessibilityLabel={t.codeLabel(shown.split('').join(' '))}
            maxFontSizeMultiplier={MAX_FONT_SCALE.header}
            style={[typography.displaySmall, { color: c.text, letterSpacing: 1 }]}>
            {shown}
          </Text>
          <Row>
            <Button
              testID="account-code-copy"
              kind="secondary"
              title={t.copy}
              onPress={() => void Share.share({ message: t.copyMessage(shown) }).catch(() => undefined)}
            />
          </Row>
        </View>
      ) : null}

      {state !== null && code === null ? (
        <View style={{ gap: 8 }}>
          <Label testID="account-code-missing">{t.missing}</Label>
          {confirmRenew ? (
            <View style={{ gap: 8 }}>
              <Label>{t.renewConfirm}</Label>
              <Button testID="account-code-renew-confirm" title={t.renewYes} disabled={busy} onPress={() => void renew()} />
              <Button
                testID="account-code-renew-cancel"
                kind="secondary"
                title={tr.common.cancel}
                onPress={() => setConfirmRenew(false)}
              />
            </View>
          ) : (
            <Button testID="account-code-renew" kind="secondary" title={t.renew} onPress={() => setConfirmRenew(true)} />
          )}
        </View>
      ) : null}

      <Label variant="small">{t.secret}</Label>
      <Message testID="account-code-notice" text={notice} />
      {error !== null ? (
        <View style={{ gap: 8 }}>
          <Message testID="account-code-error" text={error} error />
          {state === null ? (
            <Button testID="account-code-retry" kind="secondary" title={t.retry} onPress={() => void load()} />
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}
