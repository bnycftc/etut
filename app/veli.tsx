import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { canUseParentMode, formatCode, normalizeCode, stepDailyLimit } from '@/domain/groups';
import { istanbulDayKey, istanbulYear } from '@/domain/istanbul-day';
import { parentActions } from '@/domain/minor-policy';
import { useAppState } from '@/state/app-state';
import { loadParentAccount, storeParentAccount } from '@/storage/groups-kv';
import { tr } from '@/strings';
import {
  type ChildSummary,
  type DayTotal,
  groupApi,
  isAccountGone,
  type ParentControls,
  type ParentNotice,
} from '@/sync/api';
import { minorApi, type ParentApproval } from '@/sync/minor-api';
import { BarChart, Button, Card, Label, Row, Screen, Stepper, TextField } from '@/ui/components';
import { formatDuration } from '@/ui/format';
import { errorText, Message, ToggleRow } from '@/ui/group-ui';

const m = tr.minor.parent;

/**
 * Parent mode on the parent's own device (K-22): enter the code shown on the student's screen,
 * then lock group settings, set a daily limit and see the weekly study time. No e-mail or phone.
 * Purchase approval is left to the stores' family features (K-24). K-23: the parent approves the
 * student's group account ("Onaylıyorum") or objects, which deletes it after a confirmation.
 */
export default function ParentScreen() {
  const { profile } = useAppState();
  const api = groupApi();
  const minor = minorApi();
  const adult = profile !== null && canUseParentMode(profile.birthYear, istanbulYear(Date.now()));

  const [code, setCode] = useState('');
  const [children, setChildren] = useState<ChildSummary[]>([]);
  const [notices, setNotices] = useState<ParentNotice[]>([]);
  const [summaries, setSummaries] = useState<Record<string, DayTotal[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState<string | null>(null);
  const [approvals, setApprovals] = useState<Record<string, ParentApproval>>({});
  const [confirmObject, setConfirmObject] = useState<string | null>(null);
  const [linked, setLinked] = useState(loadParentAccount);

  const load = useCallback(async () => {
    if (!loadParentAccount()) return;
    try {
      const [list, notes] = await Promise.all([api.parentChildren(), api.parentNotices()]);
      setChildren(list);
      setNotices(notes);
      const entries = await Promise.all(
        list.map(async (child) => [child.childId, await api.parentWeeklySummary(child.childId)] as const),
      );
      setSummaries(Object.fromEntries(entries));
      // Without the approvals the rest of the screen still works; they come back on next focus.
      const approvalList = await minor.parentApprovals().catch(() => [] as ParentApproval[]);
      setApprovals(Object.fromEntries(approvalList.map((a) => [a.childId, a] as const)));
    } catch (e) {
      if (isAccountGone(e)) {
        // The parent account was purged (unused) or removed: forget it, so "Tüm verileri sil"
        // does not wait for a server account that no longer exists.
        storeParentAccount(false);
        setLinked(false);
        setChildren([]);
        setNotice(tr.parent.accountGone);
      } else {
        setError(errorText(e));
      }
    }
  }, [api, minor]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const run = async (task: () => Promise<string | void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const message = await task();
      if (typeof message === 'string') setNotice(message);
      await load();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (!adult) {
    return (
      <Screen>
        <Card>
          <Label variant="muted">{tr.groups.unavailable}</Label>
        </Card>
      </Screen>
    );
  }

  const claim = () =>
    run(async () => {
      await api.ensureSignedIn();
      const result = await api.claimParentCode(normalizeCode(code));
      if (result.status === 'linked') {
        storeParentAccount(true);
        setLinked(true);
        setCode('');
      }
      return tr.parent.claimStatus[result.status];
    });

  const update = (child: ChildSummary, change: Partial<ParentControls>) =>
    run(() =>
      api.parentSetControls(child.childId, {
        groupsDisabled: child.groupsDisabled,
        forceInvisible: child.forceInvisible,
        dailyLimitMinutes: child.dailyLimitMinutes,
        ...change,
      }),
    );

  return (
    <Screen testID="parent-screen">
      <Card>
        <Label variant="heading">{tr.parent.title}</Label>
        <Label variant="muted">{tr.parent.intro}</Label>
        <Row>
          <TextField
            testID="parent-code"
            label={tr.parent.code}
            value={code}
            onChange={setCode}
            placeholder={formatCode('ABCDEFGH')}
            maxLength={9}
            code
          />
        </Row>
        <Button testID="parent-link" title={tr.parent.link} onPress={claim} disabled={busy} />
        <Message text={error} error testID="parent-error" />
        <Message text={notice} testID="parent-notice" />
      </Card>

      <Card>
        <Label variant="heading">{tr.parent.children}</Label>
        {children.length === 0 ? (
          <Label testID="parent-none" variant="muted">
            {linked ? tr.parent.linkGone : tr.parent.none}
          </Label>
        ) : null}
        {notices.map((n, index) => (
          <Label key={`${n.kind}-${n.createdAt}`} testID={`parent-notice-${index}`} variant="small">
            {tr.parent.noticeLine(tr.parent.noticeKinds[n.kind], istanbulDayKey(Date.parse(n.createdAt)))}
          </Label>
        ))}
      </Card>

      {children.map((child, index) => {
        const days = summaries[child.childId] ?? [];
        const approval = approvals[child.childId];
        const actions = approval === undefined ? null : parentActions(approval.policy, approval.approved);
        return (
          <Card key={child.childId}>
            <Label variant="heading" testID={`parent-child-${index}`}>
              {child.nickname}
            </Label>
            {child.otherParents > 0 ? (
              <Label testID={`parent-others-${index}`} variant="small">
                {tr.parent.otherParents(child.otherParents)}
              </Label>
            ) : null}
            <ToggleRow
              testID={`parent-groups-off-${index}`}
              label={tr.parent.groupsOff}
              on={child.groupsDisabled}
              disabled={busy}
              onToggle={() => update(child, { groupsDisabled: !child.groupsDisabled })}
            />
            <ToggleRow
              testID={`parent-invisible-${index}`}
              label={tr.parent.forceInvisible}
              on={child.forceInvisible}
              disabled={busy}
              onToggle={() => update(child, { forceInvisible: !child.forceInvisible })}
            />
            <Stepper
              testID={`parent-limit-${index}`}
              label={tr.parent.dailyLimit}
              value={child.dailyLimitMinutes === null ? tr.parent.noLimit : formatDuration(child.dailyLimitMinutes * 60_000)}
              onMinus={() => update(child, { dailyLimitMinutes: stepDailyLimit(child.dailyLimitMinutes, -1) })}
              onPlus={() => update(child, { dailyLimitMinutes: stepDailyLimit(child.dailyLimitMinutes, 1) })}
              minusDisabled={busy || child.dailyLimitMinutes === null}
              plusDisabled={busy}
            />
            <Label variant="small">{tr.parent.weekly}</Label>
            <BarChart
              bars={days.map((d) => ({
                key: d.day,
                label: d.day.slice(8),
                value: d.seconds,
                valueLabel: d.seconds > 0 ? formatDuration(d.seconds * 1000) : '',
              }))}
            />
            {approval !== undefined && actions !== null ? (
              <>
                <Label variant="small">{m.title}</Label>
                {approval.approvedAt !== null ? (
                  <Label testID={`parent-approved-${index}`}>
                    {m.approvedOn(istanbulDayKey(Date.parse(approval.approvedAt)))}
                  </Label>
                ) : approval.approved ? (
                  <Label testID={`parent-approved-${index}`}>{m.approvedByOther}</Label>
                ) : null}
                {actions.approve && (approval.policy === 'strict' || approval.policy === 'basic') ? (
                  <>
                    <Label variant="small">{m.approveInfo(approval.policy)}</Label>
                    <Button
                      testID={`parent-approve-${index}`}
                      title={m.approve}
                      disabled={busy}
                      onPress={() =>
                        run(async () => {
                          await minor.parentApprove(child.childId);
                          return m.approvedNotice;
                        })
                      }
                    />
                  </>
                ) : null}
                {actions.object && confirmObject === child.childId ? (
                  <>
                    <Label testID={`parent-object-text-${index}`}>{m.objectConfirm(child.nickname)}</Label>
                    <Row>
                      <Button
                        testID={`parent-object-confirm-${index}`}
                        kind="danger"
                        title={m.objectYes}
                        disabled={busy}
                        onPress={() =>
                          run(async () => {
                            await minor.parentObject(child.childId);
                            setConfirmObject(null);
                            return m.objected;
                          })
                        }
                      />
                      <Button
                        testID={`parent-object-cancel-${index}`}
                        kind="secondary"
                        title={tr.common.cancel}
                        onPress={() => setConfirmObject(null)}
                      />
                    </Row>
                  </>
                ) : actions.object ? (
                  <>
                    <Label variant="small">{m.objectInfo}</Label>
                    <Button
                      testID={`parent-object-${index}`}
                      kind="secondary"
                      title={m.object}
                      onPress={() => setConfirmObject(child.childId)}
                    />
                  </>
                ) : null}
              </>
            ) : null}
            <Label variant="small">{tr.parent.purchases}</Label>
            {confirmUnlink === child.childId ? (
              <>
                <Label>{tr.parent.unlinkConfirm}</Label>
                <Row>
                  <Button
                    testID={`parent-unlink-confirm-${index}`}
                    kind="danger"
                    title={tr.parent.unlink}
                    disabled={busy}
                    onPress={() =>
                      run(async () => {
                        await api.parentUnlink(child.childId);
                        setConfirmUnlink(null);
                      })
                    }
                  />
                  <Button
                    testID={`parent-unlink-cancel-${index}`}
                    kind="secondary"
                    title={tr.common.cancel}
                    onPress={() => setConfirmUnlink(null)}
                  />
                </Row>
              </>
            ) : (
              <Button
                testID={`parent-unlink-${index}`}
                kind="secondary"
                title={tr.parent.unlink}
                onPress={() => setConfirmUnlink(child.childId)}
              />
            )}
          </Card>
        );
      })}
    </Screen>
  );
}
