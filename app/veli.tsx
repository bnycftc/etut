import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { canUseParentMode, formatCode, normalizeCode, stepDailyLimit } from '@/domain/groups';
import { istanbulYear } from '@/domain/istanbul-day';
import { useAppState } from '@/state/app-state';
import { loadParentAccount, storeParentAccount } from '@/storage/groups-kv';
import { tr } from '@/strings';
import { type ChildSummary, type DayTotal, groupApi, type ParentControls } from '@/sync/api';
import { BarChart, Button, Card, Label, Row, Screen, Stepper, TextField } from '@/ui/components';
import { formatDuration } from '@/ui/format';
import { errorText, Message, ToggleRow } from '@/ui/group-ui';

/**
 * Parent mode on the parent's own device (K-22): enter the code shown on the student's screen,
 * then lock group settings, set a daily limit and see the weekly study time. No e-mail or phone.
 * Purchase approval is left to the stores' family features (K-24).
 */
export default function ParentScreen() {
  const { profile } = useAppState();
  const api = groupApi();
  const adult = profile !== null && canUseParentMode(profile.birthYear, istanbulYear(Date.now()));

  const [code, setCode] = useState('');
  const [children, setChildren] = useState<ChildSummary[]>([]);
  const [summaries, setSummaries] = useState<Record<string, DayTotal[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!loadParentAccount()) return;
    try {
      const list = await api.parentChildren();
      setChildren(list);
      const entries = await Promise.all(
        list.map(async (child) => [child.childId, await api.parentWeeklySummary(child.childId)] as const),
      );
      setSummaries(Object.fromEntries(entries));
    } catch (e) {
      setError(errorText(e));
    }
  }, [api]);

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
        {children.length === 0 ? <Label variant="muted">{tr.parent.none}</Label> : null}
      </Card>

      {children.map((child, index) => {
        const days = summaries[child.childId] ?? [];
        return (
          <Card key={child.childId}>
            <Label variant="heading" testID={`parent-child-${index}`}>
              {child.nickname}
            </Label>
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
                  <Button kind="secondary" title={tr.common.cancel} onPress={() => setConfirmUnlink(null)} />
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
