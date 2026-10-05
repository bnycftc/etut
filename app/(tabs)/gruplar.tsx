import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { GROUPS_ENABLED } from '@/config/features';
import {
  ageBandFor,
  checkNameLocally,
  cleanName,
  formatCode,
  groupsAllowedForExam,
  nameMaxLength,
  normalizeCode,
  usageLimitReached,
} from '@/domain/groups';
import { istanbulYear } from '@/domain/istanbul-day';
import { useAppState } from '@/state/app-state';
import { useGroupsUsage } from '@/state/groups-usage';
import { loadGroupsAccount, storeGroupsAccount, storeGroupsMember, storeParentLinked } from '@/storage/groups-kv';
import { tr } from '@/strings';
import {
  type BlockedUser,
  type GroupSummary,
  groupApi,
  type IncomingReaction,
  isAccountGone,
  type Me,
} from '@/sync/api';
import { endGroupsAccount } from '@/sync/session-sync';
import { Button, Card, Chip, ChipRow, Label, Row, Screen, Tag, TextField } from '@/ui/components';
import { errorText, Message, minutesLeft, ToggleRow } from '@/ui/group-ui';
import { usePalette } from '@/ui/theme';

/** Shown solely to 15+ profiles (see (tabs)/_layout.tsx). */
export default function GroupsScreen() {
  if (!GROUPS_ENABLED) {
    // The module is off: no network request is ever made (src/config/features.ts).
    return (
      <Screen>
        <Card>
          <Label variant="title">{tr.groups.soon}</Label>
          <Label variant="muted">{tr.groups.body}</Label>
        </Card>
      </Screen>
    );
  }
  return <GroupsHome />;
}

function GroupsHome() {
  const { profile } = useAppState();
  const api = groupApi();
  const c = usePalette();
  const band = profile === null ? null : ageBandFor(profile.birthYear, istanbulYear(Date.now()));
  const usedMs = useGroupsUsage();

  const [hasAccount, setHasAccount] = useState(loadGroupsAccount);
  const [me, setMe] = useState<Me | null>(null);
  const [groups, setGroups] = useState<GroupSummary[]>([]);
  const [incoming, setIncoming] = useState<IncomingReaction[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [nickname, setNickname] = useState('');
  const [groupName, setGroupName] = useState('');
  const [code, setCode] = useState('');
  const [parentCode, setParentCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmUnlinkParents, setConfirmUnlinkParents] = useState(false);
  const [blocks, setBlocks] = useState<BlockedUser[] | null>(null);

  const accountGone = useCallback(() => {
    // The server account no longer exists (deleted, or purged after long inactivity): stop the
    // heartbeat and drop the queue so nothing of it reaches a new account.
    endGroupsAccount();
    setHasAccount(false);
    setMe(null);
    setGroups([]);
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      let current = await api.getMe();
      if (current === null) {
        accountGone();
        return;
      }
      // Turned 18 since the band was sent: the parent link ends (K-22 is for 15–17 only). The
      // server accepts it from the year after the 15–17 band was declared and refuses it before.
      // The exam type is only checked there, not stored, so it comes from the device profile.
      if (current.ageBand === '15_17' && band === '18_plus' && profile !== null) {
        const raised = await api
          .saveProfile({
            nickname: current.nickname,
            examType: profile.examType,
            yksArea: profile.yksArea,
            ageBand: '18_plus',
          })
          .then(() => true, () => false);
        if (raised) current = (await api.getMe()) ?? current;
      }
      setMe(current);
      // A linked parent sees the weekly time: sessions are sent even in no group (session-sync).
      storeParentLinked(current.parentCount > 0);
      if (!current.groupsDisabled) {
        // Reactions are marked as delivered when taken: show them even if the group list fails.
        const [mine, reactions] = await Promise.allSettled([api.myGroups(), api.takeReactions()]);
        if (reactions.status === 'fulfilled' && reactions.value.length > 0) setIncoming(reactions.value);
        if (mine.status === 'rejected') throw mine.reason;
        setGroups(mine.value);
        // Without any group the live status and sessions are not sent (session-sync, KVKK m.4).
        storeGroupsMember(mine.value.length > 0);
      }
    } catch (e) {
      if (isAccountGone(e)) accountGone();
      else setError(errorText(e));
    } finally {
      setLoaded(true);
    }
  }, [api, accountGone, band, profile]);

  // Load on focus; time spent here counts for the parent's daily limit (useGroupsUsage, K-22 c).
  useFocusEffect(
    useCallback(() => {
      if (hasAccount) void refresh();
    }, [hasAccount, refresh]),
  );

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await task();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  if (profile === null || band === null) {
    return (
      <Screen>
        <Card>
          <Label variant="muted">{tr.groups.unavailable}</Label>
        </Card>
      </Screen>
    );
  }

  if (!groupsAllowedForExam(profile.examType)) {
    return (
      <Screen testID="groups-unavailable-exam">
        <Card>
          <Label variant="muted">{tr.groups.unavailableLgs}</Label>
        </Card>
      </Screen>
    );
  }

  if (!hasAccount) {
    const enable = () =>
      run(async () => {
        const problem = checkNameLocally(nickname, 'nickname');
        if (problem !== null) {
          setError(tr.groupErrors[problem]);
          return;
        }
        await api.ensureSignedIn();
        await api.saveProfile({
          nickname: cleanName(nickname),
          examType: profile.examType,
          yksArea: profile.yksArea,
          ageBand: band,
        });
        storeGroupsAccount(true);
        setHasAccount(true);
        await refresh();
      });
    return (
      <Screen testID="groups-intro">
        <Card>
          <Label variant="title">{tr.groups.introTitle}</Label>
          <Label variant="muted">{tr.groups.introBody}</Label>
          <Label variant="small">{tr.groups.introData}</Label>
          <Label variant="small">{tr.groups.introSecurity}</Label>
          <Button
            testID="groups-privacy"
            kind="secondary"
            title={tr.groups.privacyLink}
            onPress={() => router.push('/gizlilik')}
          />
        </Card>
        <Card>
          <Row>
            <TextField
              testID="groups-nickname"
              label={tr.groups.nickname}
              value={nickname}
              onChange={setNickname}
              placeholder={tr.groups.nicknamePlaceholder}
              maxLength={nameMaxLength('nickname')}
            />
          </Row>
          <Label variant="small">{tr.groups.nicknameHint}</Label>
          <Message text={error} error testID="groups-error" />
          <Message text={notice} testID="groups-notice" />
          <Button testID="groups-enable" title={tr.groups.enable} onPress={enable} disabled={busy} />
        </Card>
      </Screen>
    );
  }

  if (!loaded || me === null) {
    return (
      <Screen>
        <Card>
          <Label variant="muted">{error ?? tr.groups.loading}</Label>
          {error !== null ? (
            <Button testID="groups-retry" kind="secondary" title={tr.groups.retry} onPress={() => void refresh()} />
          ) : null}
        </Card>
      </Screen>
    );
  }

  if (me.groupsDisabled) {
    return (
      <Screen testID="groups-locked">
        <Card>
          <Label variant="muted">{tr.groups.parentDisabled}</Label>
        </Card>
      </Screen>
    );
  }

  if (usageLimitReached(usedMs, me.dailyLimitMinutes)) {
    return (
      <Screen testID="groups-limit">
        <Card>
          <Label variant="muted">{tr.groups.limitReached}</Label>
        </Card>
      </Screen>
    );
  }

  const createGroup = () =>
    run(async () => {
      const problem = checkNameLocally(groupName, 'group');
      if (problem !== null) {
        setError(tr.groupErrors[problem]);
        return;
      }
      const created = await api.createGroup(cleanName(groupName));
      setGroupName('');
      await refresh();
      router.push({ pathname: '/grup/[id]', params: { id: created.groupId } });
    });

  const join = () =>
    run(async () => {
      const status = await api.requestJoin(normalizeCode(code));
      setNotice(tr.groups.joinStatus[status]);
      if (status === 'requested') {
        setCode('');
        await refresh();
      }
    });

  const setPrefs = (prefs: { invisible?: boolean; reactionsEnabled?: boolean }) =>
    run(async () => {
      await api.setPreferences(prefs);
      await refresh();
    });

  return (
    <Screen testID="groups-home">
      {incoming.length > 0 ? (
        <Card>
          <Label variant="heading">{tr.groups.reactionsTitle}</Label>
          {incoming.map((r) => (
            <Label key={r.id}>{tr.groups.reactionLine(r.fromNickname, tr.reactionKinds[r.kind], r.groupName)}</Label>
          ))}
          <Button testID="groups-reactions-close" kind="secondary" title={tr.group.close} onPress={() => setIncoming([])} />
        </Card>
      ) : null}

      <Card>
        <Label variant="heading">{tr.groups.myGroups}</Label>
        {groups.length === 0 ? <Label variant="muted">{tr.groups.noGroups}</Label> : null}
        {groups.map((g, index) => (
          <Pressable
            key={g.groupId}
            testID={`groups-row-${index}`}
            accessibilityRole="button"
            disabled={g.role === 'pending'}
            onPress={() => router.push({ pathname: '/grup/[id]', params: { id: g.groupId } })}
            style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: c.border }}>
            <Row>
              <Label style={{ flex: 1 }}>{g.name}</Label>
              {g.role === 'owner' ? <Tag title={tr.groups.owner} /> : null}
              {g.role === 'pending' ? <Tag title={tr.groups.pending} /> : <Label variant="small">{tr.groups.members(g.memberCount)}</Label>}
            </Row>
          </Pressable>
        ))}
      </Card>

      <Card>
        <Label variant="heading">{tr.groups.createTitle}</Label>
        <Row>
          <TextField
            testID="groups-create-name"
            label={tr.groups.groupName}
            value={groupName}
            onChange={setGroupName}
            placeholder={tr.groups.groupNamePlaceholder}
            maxLength={nameMaxLength('group')}
          />
        </Row>
        <ChipRow>
          {tr.groups.suggestions.map((s, index) => (
            <Chip
              key={s}
              testID={`groups-suggestion-${index}`}
              title={s}
              selected={groupName === s}
              onPress={() => setGroupName(s)}
            />
          ))}
        </ChipRow>
        <Button testID="groups-create" title={tr.groups.create} onPress={createGroup} disabled={busy} />
      </Card>

      <Card>
        <Label variant="heading">{tr.groups.joinTitle}</Label>
        <Label variant="small">{tr.groups.joinHint}</Label>
        <Row>
          <TextField
            testID="groups-join-code"
            label={tr.groups.code}
            value={code}
            onChange={setCode}
            placeholder={tr.groups.codePlaceholder}
            maxLength={9}
            code
          />
        </Row>
        <Button testID="groups-join" kind="secondary" title={tr.groups.join} onPress={join} disabled={busy} />
      </Card>

      <Message text={error} error testID="groups-error" />
      <Message text={notice} testID="groups-notice" />

      <Card>
        <Label variant="heading">{tr.groups.settingsTitle}</Label>
        <ToggleRow
          testID="groups-invisible"
          label={tr.groups.invisible}
          on={me.invisible}
          disabled={busy || me.forceInvisible}
          onToggle={() => setPrefs({ invisible: !me.invisible })}
        />
        <Label variant="small">{me.forceInvisible ? tr.groups.lockedByParent : tr.groups.invisibleInfo}</Label>
        <ToggleRow
          testID="groups-reactions"
          label={tr.groups.reactions}
          on={me.reactionsEnabled}
          disabled={busy}
          onToggle={() => setPrefs({ reactionsEnabled: !me.reactionsEnabled })}
        />
        <Label variant="small">{tr.groups.reactionsInfo}</Label>
        {me.dailyLimitMinutes !== null ? <Label variant="small">{tr.groups.limitInfo(me.dailyLimitMinutes)}</Label> : null}
        {blocks === null ? (
          <Button
            testID="groups-blocks-show"
            kind="secondary"
            title={tr.groups.blocksShow}
            disabled={busy}
            onPress={() => run(async () => setBlocks(await api.myBlocks()))}
          />
        ) : (
          <View style={{ gap: 8 }}>
            <Label variant="heading">{tr.groups.blocksTitle}</Label>
            {blocks.length === 0 ? <Label variant="muted">{tr.groups.blocksNone}</Label> : null}
            {blocks.map((b, index) => (
              <Row key={b.userId}>
                <Label style={{ flex: 1 }}>{b.nickname}</Label>
                <Button
                  testID={`groups-unblock-${index}`}
                  kind="secondary"
                  title={tr.groups.unblock}
                  disabled={busy}
                  onPress={() =>
                    run(async () => {
                      await api.unblockUser(b.userId);
                      setBlocks(await api.myBlocks());
                      setNotice(tr.groups.unblocked);
                    })
                  }
                />
              </Row>
            ))}
          </View>
        )}
      </Card>

      {me.ageBand === '15_17' ? (
        <Card>
          <Label variant="heading">{tr.groups.parentTitle}</Label>
          <Label variant="small">{tr.groups.parentInfo}</Label>
          {me.parentCount > 0 ? <Label testID="groups-parent-count">{tr.groups.parentLinked(me.parentCount)}</Label> : null}
          {me.parentCount > 0 ? (
            confirmUnlinkParents ? (
              <View style={{ gap: 8 }}>
                <Label>{tr.groups.parentUnlinkConfirm}</Label>
                <Button
                  testID="groups-parent-unlink-confirm"
                  kind="danger"
                  title={tr.groups.parentUnlink}
                  disabled={busy}
                  onPress={() =>
                    run(async () => {
                      await api.childUnlinkParents();
                      setConfirmUnlinkParents(false);
                      setNotice(tr.groups.parentUnlinked);
                      await refresh();
                    })
                  }
                />
                <Button
                  testID="groups-parent-unlink-cancel"
                  kind="secondary"
                  title={tr.common.cancel}
                  onPress={() => setConfirmUnlinkParents(false)}
                />
              </View>
            ) : (
              <Button
                testID="groups-parent-unlink"
                kind="secondary"
                title={tr.groups.parentUnlink}
                disabled={busy}
                onPress={() => setConfirmUnlinkParents(true)}
              />
            )
          ) : null}
          {parentCode !== null ? (
            <Label testID="groups-parent-code" variant="heading">
              {tr.groups.parentCodeShown(formatCode(parentCode.code), minutesLeft(parentCode.expiresAt, Date.now()))}
            </Label>
          ) : null}
          <Button
            testID="groups-parent-create"
            kind="secondary"
            title={tr.groups.parentCode}
            disabled={busy}
            onPress={() => run(async () => setParentCode(await api.createParentCode()))}
          />
        </Card>
      ) : null}

      <Card>
        <Label variant="heading">{tr.groups.accountTitle}</Label>
        {confirmDelete ? (
          <View style={{ gap: 8 }}>
            <Label>{tr.groups.deleteAccountConfirm}</Label>
            <Button
              testID="groups-delete-confirm"
              kind="danger"
              title={tr.groups.deleteAccountYes}
              disabled={busy}
              onPress={() =>
                run(async () => {
                  await api.deleteMyAccount();
                  // Also stops the heartbeat and empties the upload queue of this account.
                  endGroupsAccount();
                  setConfirmDelete(false);
                  setHasAccount(false);
                  setMe(null);
                  setGroups([]);
                  setNotice(tr.groups.deleted);
                })
              }
            />
            <Button
              testID="groups-delete-cancel"
              kind="secondary"
              title={tr.common.cancel}
              onPress={() => setConfirmDelete(false)}
            />
          </View>
        ) : (
          <Button testID="groups-delete" kind="danger" title={tr.groups.deleteAccount} onPress={() => setConfirmDelete(true)} />
        )}
      </Card>
    </Screen>
  );
}
