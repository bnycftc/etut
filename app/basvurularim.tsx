import { Redirect, router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { GROUPS_ENABLED } from '@/config/features';
import { isUnseenAnswer, requestState } from '@/domain/dsr';
import { formatCode } from '@/domain/groups';
import { istanbulDayKey } from '@/domain/istanbul-day';
import { useAppState } from '@/state/app-state';
import { shareTextFile } from '@/storage/file-io';
import { loadGroupsAccount, loadParentAccount } from '@/storage/groups-kv';
import { DATA_CONTROLLER } from '@/strings';
import { requestsTr } from '@/strings-wp/requests';
import { isAccountGone } from '@/sync/api';
import { type DsrRequest, requestsApi } from '@/sync/requests-api';
import { Button, Card, Label, Screen, Tag } from '@/ui/components';
import { errorText, Message } from '@/ui/group-ui';
import { requestDate, requestDateTime } from '@/ui/requests-entry';

const t = requestsTr.list;
const a = requestsTr.answer;

/**
 * "Başvurularım" (kvkk/07 C4, C5): the own KVKK applications with the written answer, which never
 * changes, and when it was first opened (kept on the server as proof of delivery). Also
 * "Verilerimi indir": the server's data of this account as JSON through the share sheet.
 */
export default function MyRequestsScreen() {
  const { profile } = useAppState();
  // Group module screens only (K-16: never for an under-15 profile, even through a link).
  if (!GROUPS_ENABLED || profile === null || profile.soloOnly) return <Redirect href="/" />;
  return <MyRequests />;
}

function MyRequests() {
  const api = requestsApi();
  const [hasAccount, setHasAccount] = useState(() => loadGroupsAccount() || loadParentAccount());
  const [requests, setRequests] = useState<DsrRequest[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fail = useCallback((e: unknown) => {
    if (isAccountGone(e)) setHasAccount(false);
    else setError(errorText(e));
  }, []);

  const load = useCallback(async () => {
    if (!(loadGroupsAccount() || loadParentAccount())) return;
    try {
      setRequests(await api.myRequests());
      setError(null);
    } catch (e) {
      fail(e);
    } finally {
      setLoaded(true);
    }
  }, [api, fail]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const title = <Stack.Screen options={{ title: t.title }} />;
  if (!hasAccount) {
    return (
      <Screen testID="my-requests-screen">
        {title}
        <Card>
          <Label testID="my-requests-no-account">{requestsTr.form.noAccount}</Label>
        </Card>
      </Screen>
    );
  }

  const toggle = async (r: DsrRequest) => {
    if (open === r.id) {
      setOpen(null);
      return;
    }
    setOpen(r.id);
    if (r.seenAt !== null) return;
    try {
      const seenAt = await api.markRequestSeen(r.id);
      if (seenAt !== null) setRequests((list) => list.map((x) => (x.id === r.id ? { ...x, seenAt } : x)));
    } catch (e) {
      fail(e);
    }
  };

  const download = async () => {
    setBusy(true);
    setExportNote(null);
    setError(null);
    try {
      const data = await api.exportMyData();
      const result = await shareTextFile(requestsTr.export.fileName(istanbulDayKey(Date.now())), JSON.stringify(data, null, 2), {
        mimeType: 'application/json',
        uti: 'public.json',
        dialogTitle: requestsTr.export.dialogTitle,
      });
      setExportNote(result === 'shared' ? requestsTr.export.done : requestsTr.export.unavailable);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const now = Date.now();
  return (
    <Screen testID="my-requests-screen">
      {title}
      <Button testID="my-requests-new" kind="secondary" title={t.newRequest} onPress={() => router.push('/basvuru')} />
      <Message text={error} error testID="my-requests-error" />

      {loaded && requests.length === 0 ? (
        <Card>
          <Label testID="my-requests-empty" variant="muted">
            {t.empty}
          </Label>
        </Card>
      ) : null}

      {requests.map((r, index) => {
        const state = requestState(r, now);
        return (
          <Card key={r.id} testID={`my-request-${index}`}>
            <Label variant="heading">{requestsTr.form.kinds[r.kind] ?? r.kind}</Label>
            {isUnseenAnswer(r) ? <Tag title={t.newAnswer} /> : null}
            <Label variant="small">{t.number(formatCode(r.ref))}</Label>
            <Label variant="small">{t.submitted(requestDate(r.createdAt))}</Label>
            {r.body !== null ? <Label>{r.body}</Label> : null}
            <Label testID={`my-request-state-${index}`} variant="muted">
              {state === 'answered'
                ? t.answered(requestDate(r.answeredAt ?? r.createdAt))
                : state === 'overdue'
                  ? t.overdue(requestDate(r.dueAt))
                  : t.open(requestDate(r.dueAt))}
            </Label>
            {r.answeredAt !== null ? (
              <Button
                testID={`my-request-read-${index}`}
                kind="secondary"
                title={open === r.id ? t.hide : t.read}
                onPress={() => void toggle(r)}
              />
            ) : null}
            {open === r.id && r.answeredAt !== null ? <Answer request={r} index={index} /> : null}
          </Card>
        );
      })}

      <Card>
        <Label variant="heading">{requestsTr.export.title}</Label>
        <Label variant="muted">{requestsTr.export.info}</Label>
        <Button testID="my-data-export" title={requestsTr.export.button} onPress={() => void download()} disabled={busy} />
        <Message text={exportNote} testID="my-data-export-note" />
      </Card>
    </Screen>
  );
}

/** The answer laid out as in kvkk/07 C4. The text comes from the server as written, once. */
function Answer({ request: r, index }: { request: DsrRequest; index: number }) {
  return (
    <>
      <Label variant="heading">{a.title}</Label>
      <Label variant="small">{a.controller(DATA_CONTROLLER.name, DATA_CONTROLLER.contact)}</Label>
      <Label variant="small">{a.applicant}</Label>
      <Label variant="small">{a.numberDate(formatCode(r.ref), requestDate(r.createdAt))}</Label>
      <Label variant="small">{a.subject(requestsTr.form.kinds[r.kind] ?? r.kind)}</Label>
      <Label style={{ fontWeight: '600' }}>{a.explanations}</Label>
      <Label testID={`my-request-answer-${index}`}>{r.answerText ?? ''}</Label>
      {r.answerResult !== null ? <Label>{a.result(a.results[r.answerResult])}</Label> : null}
      {r.answeredAt !== null ? <Label variant="small">{a.date(requestDate(r.answeredAt))}</Label> : null}
      <Label variant="small">{a.objection}</Label>
      {r.seenAt !== null ? (
        <Label testID={`my-request-seen-${index}`} variant="small">
          {t.seenAt(requestDateTime(r.seenAt))}
        </Label>
      ) : null}
    </>
  );
}
