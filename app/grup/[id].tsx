import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';

import { formatCode, GROUP_REFRESH_MS, liveElapsedMs, REACTION_KINDS, REPORT_REASONS } from '@/domain/groups';
import { useNow } from '@/state/app-state';
import { tr } from '@/strings';
import {
  type BoardMember,
  groupApi,
  type GroupSummary,
  type JoinRequest,
  type LeaderRow,
  type Period,
} from '@/sync/api';
import { Button, Card, Chip, ChipRow, Label, Row, Screen, Tag } from '@/ui/components';
import { formatDuration } from '@/ui/format';
import { errorText, hoursLeft, Message } from '@/ui/group-ui';

/** One group: who is studying now (K-12), ranking (K-06: group only), reactions, moderation. */
export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = typeof id === 'string' ? id : '';
  const api = groupApi();
  const now = useNow(true, 30_000);

  const [info, setInfo] = useState<GroupSummary | null>(null);
  const [board, setBoard] = useState<BoardMember[]>([]);
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [period, setPeriod] = useState<Period>('day');
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [mine, members, ranking] = await Promise.all([
        api.myGroups(),
        api.groupBoard(groupId),
        api.groupLeaderboard(groupId, period),
      ]);
      const current = mine.find((g) => g.groupId === groupId) ?? null;
      setInfo(current);
      setBoard(members);
      setLeaders(ranking);
      setRequests(current?.role === 'owner' ? await api.listJoinRequests(groupId) : []);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, [api, groupId, period]);

  // Poll while the screen is open (no realtime socket); stop when it is left.
  useFocusEffect(
    useCallback(() => {
      void load();
      const timer = setInterval(() => void load(), GROUP_REFRESH_MS);
      return () => clearInterval(timer);
    }, [load]),
  );

  const run = async (task: () => Promise<string | null | void>) => {
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

  const isOwner = info?.role === 'owner';
  const member = board.find((m) => m.userId === selected) ?? null;

  return (
    <Screen testID="group-screen">
      <Label variant="title">{info?.name ?? tr.group.title}</Label>
      <Message text={error} error testID="group-error" />
      <Message text={notice} testID="group-notice" />

      <Card>
        <Label variant="heading">{tr.group.live}</Label>
        {board.map((m, index) => (
          <Pressable
            key={m.userId}
            testID={`group-member-${index}`}
            accessibilityRole="button"
            disabled={m.isMe}
            onPress={() => {
              setSelected(m.userId === selected ? null : m.userId);
              setReporting(false);
            }}
            style={{ paddingVertical: 6 }}>
            <Row>
              <Label style={{ flex: 1 }}>{m.nickname}</Label>
              {m.isMe ? <Tag title={tr.group.you} /> : null}
              {m.role === 'owner' ? <Tag title={tr.groups.owner} /> : null}
            </Row>
            <Label variant="small">
              {m.studying
                ? m.paused
                  ? tr.group.paused
                  : tr.group.studying(tr.subject(m.subjectId ?? ''), formatDuration(liveElapsedMs(m.startedAt, now)))
                : tr.group.notStudying}
            </Label>
          </Pressable>
        ))}
      </Card>

      {member !== null ? (
        <Card>
          <Label variant="heading">{tr.group.memberActions(member.nickname)}</Label>
          <Label variant="small">{tr.group.sendReaction}</Label>
          <ChipRow>
            {REACTION_KINDS.map((kind) => (
              <Chip
                key={kind}
                testID={`group-react-${kind}`}
                title={tr.reactionKinds[kind]}
                selected={false}
                onPress={() =>
                  run(async () => tr.group.reactionStatus[await api.sendReaction(groupId, member.userId, kind)])
                }
              />
            ))}
          </ChipRow>
          {reporting ? (
            <View style={{ gap: 8 }}>
              <Label variant="small">{tr.group.reportReason}</Label>
              <ChipRow>
                {REPORT_REASONS.filter((r) => r !== 'group_name').map((reason) => (
                  <Chip
                    key={reason}
                    testID={`group-report-${reason}`}
                    title={tr.reportReasons[reason]}
                    selected={false}
                    onPress={() =>
                      run(async () => {
                        const status = await api.report(member.userId, groupId, reason);
                        setReporting(false);
                        return reason === 'danger'
                          ? `${tr.group.reportStatus[status]} ${tr.group.dangerNote}`
                          : tr.group.reportStatus[status];
                      })
                    }
                  />
                ))}
              </ChipRow>
            </View>
          ) : null}
          <Row>
            <Button testID="group-report" kind="secondary" title={tr.group.report} onPress={() => setReporting(!reporting)} />
            <Button
              testID="group-block"
              kind="secondary"
              title={tr.group.block}
              disabled={busy}
              onPress={() =>
                run(async () => {
                  await api.blockUser(member.userId);
                  setSelected(null);
                  return tr.group.blocked;
                })
              }
            />
          </Row>
          {isOwner ? (
            <Button
              testID="group-remove"
              kind="danger"
              title={tr.group.remove}
              disabled={busy}
              onPress={() =>
                run(async () => {
                  await api.removeMember(groupId, member.userId);
                  setSelected(null);
                })
              }
            />
          ) : null}
        </Card>
      ) : null}

      <Card>
        <Label variant="heading">{tr.group.ranking}</Label>
        <ChipRow>
          <Chip testID="group-period-day" title={tr.group.today} selected={period === 'day'} onPress={() => setPeriod('day')} />
          <Chip testID="group-period-week" title={tr.group.week} selected={period === 'week'} onPress={() => setPeriod('week')} />
        </ChipRow>
        {leaders.map((l) => (
          <Row key={l.userId}>
            <Label style={{ width: 28 }}>{l.rank}.</Label>
            <Label style={{ flex: 1, fontWeight: l.isMe ? '700' : undefined }}>{l.nickname}</Label>
            <Label>{formatDuration(l.seconds * 1000)}</Label>
            {l.manualSeconds > 0 ? <Tag title={tr.group.manualPart(formatDuration(l.manualSeconds * 1000))} /> : null}
          </Row>
        ))}
        <Label variant="small">{tr.group.updated}</Label>
      </Card>

      {isOwner && info !== null ? (
        <Card>
          <Label variant="heading">{tr.group.inviteTitle}</Label>
          <Label testID="group-invite-code" variant="heading">
            {info.inviteCode === null
              ? tr.group.inviteNone
              : tr.group.inviteValid(formatCode(info.inviteCode), hoursLeft(info.inviteExpiresAt, now))}
          </Label>
          <Label variant="small">{tr.group.inviteInfo}</Label>
          <Row>
            <Button
              testID="group-invite-rotate"
              kind="secondary"
              title={tr.group.rotate}
              disabled={busy}
              onPress={() => run(async () => void (await api.rotateInvite(groupId)))}
            />
            {info.inviteCode !== null ? (
              <Button
                testID="group-invite-revoke"
                kind="secondary"
                title={tr.group.revoke}
                disabled={busy}
                onPress={() => run(() => api.revokeInvite(groupId))}
              />
            ) : null}
          </Row>
          <Label variant="heading">{tr.group.requestsTitle}</Label>
          {requests.length === 0 ? <Label variant="muted">{tr.group.noRequests}</Label> : null}
          {requests.map((r, index) => (
            <Row key={r.requestId}>
              <Label style={{ flex: 1 }}>{r.nickname}</Label>
              <Button
                testID={`group-request-approve-${index}`}
                title={tr.group.approve}
                disabled={busy}
                onPress={() => run(async () => tr.group.decideStatus[await api.decideJoinRequest(r.requestId, true)])}
              />
              <Button
                testID={`group-request-reject-${index}`}
                kind="secondary"
                title={tr.group.reject}
                disabled={busy}
                onPress={() => run(async () => tr.group.decideStatus[await api.decideJoinRequest(r.requestId, false)])}
              />
            </Row>
          ))}
        </Card>
      ) : null}

      <Card>
        <Button
          testID="group-report-name"
          kind="secondary"
          title={tr.group.reportGroup}
          disabled={busy}
          onPress={() => run(async () => tr.group.reportStatus[await api.report(null, groupId, 'group_name')])}
        />
        {confirmLeave ? (
          <View style={{ gap: 8 }}>
            <Label>{tr.group.leaveConfirm}</Label>
            <Button
              testID="group-leave-confirm"
              kind="danger"
              title={tr.group.leave}
              disabled={busy}
              onPress={async () => {
                setBusy(true);
                try {
                  await api.leaveGroup(groupId);
                  router.back();
                } catch (e) {
                  setError(errorText(e));
                } finally {
                  setBusy(false);
                }
              }}
            />
            <Button kind="secondary" title={tr.common.cancel} onPress={() => setConfirmLeave(false)} />
          </View>
        ) : (
          <Button testID="group-leave" kind="danger" title={tr.group.leave} onPress={() => setConfirmLeave(true)} />
        )}
      </Card>
    </Screen>
  );
}
