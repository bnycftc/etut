/**
 * In-memory stand-in for the group server, for Jest only. It mirrors the server rules the
 * screens depend on (founder approval, 3 reactions a day per person, parent locks); the real
 * rules are tested with pgTAP in supabase/tests.
 */

import type { ReactionKind } from '../../domain/groups';
import type { SessionPayload, SubmitStatus } from '../../domain/outbox';
import {
  ApiError,
  type BoardMember,
  type ChildSummary,
  type GroupApi,
  type GroupSummary,
  type JoinRequest,
  type LeaderRow,
  type Me,
  type ParentControls,
} from '../api';

interface FakeGroup {
  id: string;
  name: string;
  code: string | null;
  members: { userId: string; nickname: string; role: 'owner' | 'member' }[];
  requests: JoinRequest[];
}

export interface FakeServer {
  api: GroupApi;
  calls: string[];
  me: Me | null;
  signedIn: boolean;
  groups: FakeGroup[];
  /** Other users' live status shown on boards. */
  studying: Record<string, { subjectId: string; startedAt: string }>;
  seconds: Record<string, number>;
  reactionsSent: Record<string, number>;
  submitted: SessionPayload[];
  deleted: string[];
  beats: { sessionId: string; subjectId: string; paused: boolean }[];
  children: ChildSummary[];
  controls: Record<string, ParentControls>;
  parentCodes: Record<string, { childId: string; nickname: string }>;
  failNext: ApiError | null;
}

export const ME_ID = 'me-0000';

export function createFakeServer(): FakeServer {
  const s: FakeServer = {
    api: undefined as unknown as GroupApi,
    calls: [],
    me: null,
    signedIn: false,
    groups: [],
    studying: {},
    seconds: {},
    reactionsSent: {},
    submitted: [],
    deleted: [],
    beats: [],
    children: [],
    controls: {},
    parentCodes: {},
    failNext: null,
  };
  let seq = 0;
  const next = (prefix: string) => `${prefix}-${++seq}`;

  async function step(name: string): Promise<void> {
    s.calls.push(name);
    if (s.failNext !== null) {
      const error = s.failNext;
      s.failNext = null;
      throw error;
    }
  }
  function requireMe(): Me {
    if (s.me === null) throw new ApiError('no_profile');
    return s.me;
  }
  function group(id: string): FakeGroup {
    const g = s.groups.find((x) => x.id === id);
    if (!g || !g.members.some((m) => m.userId === ME_ID)) throw new ApiError('not_member');
    return g;
  }
  function owned(id: string): FakeGroup {
    const g = group(id);
    if (!g.members.some((m) => m.userId === ME_ID && m.role === 'owner')) throw new ApiError('not_owner');
    return g;
  }

  s.api = {
    async ensureSignedIn() {
      await step('ensureSignedIn');
      s.signedIn = true;
    },
    async hasSession() {
      return s.signedIn;
    },
    async linkIdToken() {
      await step('linkIdToken');
    },
    async getMe() {
      await step('getMe');
      return s.me === null ? null : { ...s.me };
    },
    async saveProfile(input) {
      await step('saveProfile');
      if (!s.signedIn) throw new ApiError('not_authenticated');
      s.me = {
        nickname: input.nickname,
        examType: input.examType,
        yksArea: input.yksArea,
        ageBand: input.ageBand,
        invisible: false,
        reactionsEnabled: true,
        groupsDisabled: false,
        forceInvisible: false,
        dailyLimitMinutes: null,
        parentCount: 0,
        ...(s.me ? { invisible: s.me.invisible } : {}),
      };
    },
    async setPreferences(prefs) {
      await step('setPreferences');
      const me = requireMe();
      if (prefs.invisible === false && me.forceInvisible) throw new ApiError('parent_locked');
      s.me = {
        ...me,
        invisible: prefs.invisible ?? me.invisible,
        reactionsEnabled: prefs.reactionsEnabled ?? me.reactionsEnabled,
      };
    },
    async createGroup(name) {
      await step('createGroup');
      const me = requireMe();
      if (me.groupsDisabled) throw new ApiError('parent_locked');
      const g: FakeGroup = {
        id: next('group'),
        name,
        code: 'ABCDEFGH',
        members: [{ userId: ME_ID, nickname: me.nickname, role: 'owner' }],
        requests: [],
      };
      s.groups.push(g);
      return { groupId: g.id, inviteCode: g.code ?? '', inviteExpiresAt: new Date(Date.now() + 72 * 3_600_000).toISOString() };
    },
    async rotateInvite(groupId) {
      await step('rotateInvite');
      const g = owned(groupId);
      g.code = 'KLMNPQRS';
      return { inviteCode: g.code, inviteExpiresAt: new Date(Date.now() + 72 * 3_600_000).toISOString() };
    },
    async revokeInvite(groupId) {
      await step('revokeInvite');
      owned(groupId).code = null;
    },
    async requestJoin(code) {
      await step('requestJoin');
      const me = requireMe();
      const g = s.groups.find((x) => x.code !== null && x.code === code);
      if (!g) return 'invalid_code';
      if (g.members.some((m) => m.userId === ME_ID)) return 'already_member';
      if (g.requests.some((r) => r.requestId === `req-${ME_ID}`)) return 'already_pending';
      g.requests.push({ requestId: `req-${ME_ID}`, nickname: me.nickname, createdAt: new Date().toISOString() });
      return 'requested';
    },
    async listJoinRequests(groupId) {
      await step('listJoinRequests');
      return [...owned(groupId).requests];
    },
    async decideJoinRequest(requestId, approve) {
      await step('decideJoinRequest');
      const g = s.groups.find((x) => x.requests.some((r) => r.requestId === requestId));
      if (!g || !g.members.some((m) => m.userId === ME_ID && m.role === 'owner')) throw new ApiError('not_owner');
      const request = g.requests.find((r) => r.requestId === requestId)!;
      g.requests = g.requests.filter((r) => r.requestId !== requestId);
      if (!approve) return 'rejected';
      g.members.push({ userId: `user-${request.nickname}`, nickname: request.nickname, role: 'member' });
      return 'approved';
    },
    async leaveGroup(groupId) {
      await step('leaveGroup');
      const g = group(groupId);
      g.members = g.members.filter((m) => m.userId !== ME_ID);
    },
    async removeMember(groupId, userId) {
      await step('removeMember');
      const g = owned(groupId);
      g.members = g.members.filter((m) => m.userId !== userId);
    },
    async myGroups(): Promise<GroupSummary[]> {
      await step('myGroups');
      requireMe();
      return s.groups.flatMap((g): GroupSummary[] => {
        const mine = g.members.find((m) => m.userId === ME_ID);
        if (mine) {
          return [{
            groupId: g.id,
            name: g.name,
            role: mine.role,
            memberCount: g.members.length,
            inviteCode: mine.role === 'owner' ? g.code : null,
            inviteExpiresAt: mine.role === 'owner' && g.code ? new Date(Date.now() + 72 * 3_600_000).toISOString() : null,
          }];
        }
        if (g.requests.some((r) => r.requestId === `req-${ME_ID}`)) {
          return [{ groupId: g.id, name: g.name, role: 'pending' as const, memberCount: g.members.length, inviteCode: null, inviteExpiresAt: null }];
        }
        return [];
      });
    },
    async groupBoard(groupId): Promise<BoardMember[]> {
      await step('groupBoard');
      if (requireMe().groupsDisabled) throw new ApiError('parent_locked');
      return group(groupId).members.map((m) => {
        const live = s.studying[m.userId];
        return {
          userId: m.userId,
          nickname: m.nickname,
          isMe: m.userId === ME_ID,
          role: m.role,
          studying: live !== undefined,
          paused: live ? false : null,
          subjectId: live?.subjectId ?? null,
          startedAt: live?.startedAt ?? null,
        };
      });
    },
    async groupLeaderboard(groupId): Promise<LeaderRow[]> {
      await step('groupLeaderboard');
      const rows = group(groupId)
        .members.map((m) => ({ m, seconds: s.seconds[m.userId] ?? 0 }))
        .sort((a, b) => b.seconds - a.seconds);
      return rows.map(({ m, seconds }, i) => ({
        rank: i + 1,
        userId: m.userId,
        nickname: m.nickname,
        isMe: m.userId === ME_ID,
        seconds,
        manualSeconds: 0,
        unverifiedSeconds: 0,
        computedAt: new Date().toISOString(),
      }));
    },
    async beat(sessionId, subjectId, paused) {
      await step('beat');
      s.beats.push({ sessionId, subjectId, paused });
    },
    async endPresence() {
      await step('endPresence');
    },
    async submitSession(payload): Promise<SubmitStatus> {
      await step('submitSession');
      if (s.submitted.some((p) => p.clientId === payload.clientId)) return 'duplicate';
      if (payload.durationS > 36000) return 'too_long';
      s.submitted.push(payload);
      return 'accepted';
    },
    async deleteSession(clientId) {
      await step('deleteSession');
      const before = s.submitted.length;
      s.submitted = s.submitted.filter((p) => p.clientId !== clientId);
      s.deleted.push(clientId);
      return s.submitted.length < before ? 'deleted' : 'not_found';
    },
    async sendReaction(groupId, toUserId, _kind: ReactionKind) {
      await step('sendReaction');
      const g = group(groupId);
      if (!g.members.some((m) => m.userId === toUserId)) return 'not_allowed';
      const count = (s.reactionsSent[toUserId] ?? 0) + 1;
      if (count > 3) return 'limit';
      s.reactionsSent[toUserId] = count;
      return 'sent';
    },
    async takeReactions() {
      await step('takeReactions');
      return [];
    },
    async report() {
      await step('report');
      return 'reported';
    },
    async blockUser() {
      await step('blockUser');
    },
    async unblockUser() {
      await step('unblockUser');
    },
    async myBlocks() {
      await step('myBlocks');
      return [];
    },
    async createParentCode() {
      await step('createParentCode');
      const me = requireMe();
      if (me.ageBand !== '15_17') throw new ApiError('not_allowed');
      return { code: 'PARENT23', expiresAt: new Date(Date.now() + 10 * 60_000).toISOString() };
    },
    async claimParentCode(code) {
      await step('claimParentCode');
      const child = s.parentCodes[code];
      if (!child) return { status: 'invalid_code', childNickname: null };
      delete s.parentCodes[code];
      s.children.push({
        childId: child.childId,
        nickname: child.nickname,
        groupsDisabled: false,
        forceInvisible: false,
        dailyLimitMinutes: null,
        linkedAt: new Date().toISOString(),
        otherParents: 0,
      });
      return { status: 'linked', childNickname: child.nickname };
    },
    async parentChildren() {
      await step('parentChildren');
      return s.children.map((c) => ({ ...c, ...(s.controls[c.childId] ?? {}) }));
    },
    async parentSetControls(childId, controls) {
      await step('parentSetControls');
      if (!s.children.some((c) => c.childId === childId)) throw new ApiError('not_parent');
      s.controls[childId] = { ...controls };
    },
    async parentWeeklySummary(childId) {
      await step('parentWeeklySummary');
      if (!s.children.some((c) => c.childId === childId)) throw new ApiError('not_parent');
      return Array.from({ length: 7 }, (_, i) => ({ day: `2026-10-0${i + 1}`, seconds: i * 600, manualSeconds: 0 }));
    },
    async parentUnlink(childId) {
      await step('parentUnlink');
      s.children = s.children.filter((c) => c.childId !== childId);
      delete s.controls[childId];
    },
    async deleteMyAccount() {
      await step('deleteMyAccount');
      s.me = null;
      s.signedIn = false;
      for (const g of s.groups) g.members = g.members.filter((m) => m.userId !== ME_ID);
    },
  };
  return s;
}
