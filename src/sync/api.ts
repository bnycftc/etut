/**
 * Typed API of the group server. Every call is an RPC (supabase/migrations/*_etut_rpc.sql); the
 * app never reads or writes tables directly. `GroupApi` is an interface so screens and the
 * outbox can be tested against a fake (src/sync/__tests__, src/__tests__/groups-screens).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { AgeBand, ParentNoticeKind, ReactionKind, ReportReason } from '../domain/groups';
import { type DeleteStatus, isSubmitStatus, type SessionPayload, type SubmitStatus } from '../domain/outbox';
import type { YksArea } from '../domain/net';
import type { ExamType } from '../domain/profile';
import { getSupabase } from './client';

export type ApiErrorCode =
  | 'not_authenticated'
  | 'no_profile'
  | 'under_15'
  | 'invalid_input'
  | 'name_length'
  | 'name_chars'
  | 'name_personal'
  | 'name_banned'
  | 'rate_limited'
  | 'not_owner'
  | 'not_member'
  | 'not_pending'
  | 'not_allowed'
  | 'not_parent'
  | 'parent_locked'
  | 'parent_limit'
  | 'network'
  | 'unknown';

const KNOWN_CODES: readonly ApiErrorCode[] = [
  'not_authenticated',
  'no_profile',
  'under_15',
  'invalid_input',
  'name_length',
  'name_chars',
  'name_personal',
  'name_banned',
  'rate_limited',
  'not_owner',
  'not_member',
  'not_pending',
  'not_allowed',
  'not_parent',
  'parent_locked',
  'parent_limit',
];

export class ApiError extends Error {
  constructor(readonly code: ApiErrorCode) {
    super(code);
    this.name = 'ApiError';
  }
}

/**
 * Server error message → code. Anything unexpected is 'unknown', a failed fetch 'network'.
 * Without a valid session the request runs as `anon`, which may execute no function at all
 * (42501), or PostgREST rejects the token (PGRST30x): both mean "not signed in" — e.g. the
 * server account was deleted or purged and the refresh token no longer works.
 */
export function toApiError(error: { message?: string; code?: string } | null | undefined): ApiError {
  const message = error?.message ?? '';
  const code = error?.code ?? '';
  if ((KNOWN_CODES as readonly string[]).includes(message)) return new ApiError(message as ApiErrorCode);
  if (code === '42501' || /^PGRST30\d$/.test(code) || /\bJWT\b|refresh token/i.test(message)) {
    return new ApiError('not_authenticated');
  }
  if (/fetch|network|timeout|Failed to/i.test(message)) return new ApiError('network');
  return new ApiError('unknown');
}

/** The server account cannot be reached any more (deleted, purged, tokens gone). */
export function isAccountGone(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'not_authenticated';
}

/** The own account as the server holds it. The exam type is checked there but not stored. */
export interface Me {
  nickname: string;
  ageBand: AgeBand;
  /** Effective: own choice or forced by a parent. */
  invisible: boolean;
  reactionsEnabled: boolean;
  groupsDisabled: boolean;
  forceInvisible: boolean;
  dailyLimitMinutes: number | null;
  parentCount: number;
}

export interface ProfileInput {
  nickname: string;
  examType: ExamType;
  yksArea: YksArea | null;
  ageBand: AgeBand;
}

export interface GroupSummary {
  groupId: string;
  name: string;
  role: 'owner' | 'member' | 'pending';
  memberCount: number;
  inviteCode: string | null;
  inviteExpiresAt: string | null;
}

export interface Invite {
  inviteCode: string;
  inviteExpiresAt: string;
}

export interface CreatedGroup extends Invite {
  groupId: string;
}

export type JoinStatus =
  | 'requested'
  | 'already_member'
  | 'already_pending'
  | 'invalid_code'
  | 'group_full'
  | 'rate_limited';

export type DecideStatus = 'approved' | 'rejected' | 'group_full' | 'not_allowed';

export interface JoinRequest {
  requestId: string;
  nickname: string;
  createdAt: string;
}

export interface BoardMember {
  userId: string;
  nickname: string;
  isMe: boolean;
  role: 'owner' | 'member';
  studying: boolean;
  paused: boolean | null;
  subjectId: string | null;
  startedAt: string | null;
}

export type Period = 'day' | 'week';

export interface LeaderRow {
  rank: number;
  userId: string;
  nickname: string;
  isMe: boolean;
  seconds: number;
  manualSeconds: number;
  /** Timer time the server did not see live (offline, invisible); labelled like "elle". */
  unverifiedSeconds: number;
  computedAt: string | null;
}

export type ReactionStatus = 'sent' | 'limit' | 'not_allowed' | 'invalid';
export type ReportStatus = 'reported' | 'rate_limited' | 'invalid';

export interface IncomingReaction {
  id: string;
  kind: ReactionKind;
  fromNickname: string;
  groupName: string;
  createdAt: string;
}

export interface BlockedUser {
  userId: string;
  nickname: string;
}

export type ClaimStatus = 'linked' | 'invalid_code' | 'rate_limited' | 'not_allowed' | 'parent_limit';

export interface ChildSummary {
  childId: string;
  nickname: string;
  groupsDisabled: boolean;
  forceInvisible: boolean;
  dailyLimitMinutes: number | null;
  linkedAt: string;
  /** Other parent accounts linked to the same student (the strictest setting of all applies). */
  otherParents: number;
}

export interface ParentControls {
  groupsDisabled: boolean;
  forceInvisible: boolean;
  dailyLimitMinutes: number | null;
}

export interface DayTotal {
  day: string;
  seconds: number;
  manualSeconds: number;
}

/**
 * A link that ended on the student's side (kept 90 days). Only the kind and the time: the
 * student's data went with the link.
 */
export interface ParentNotice {
  kind: ParentNoticeKind;
  createdAt: string;
}

export interface GroupApi {
  /** Anonymous sign-in on first use; later Apple/Google can be linked (linkIdToken). */
  ensureSignedIn(): Promise<void>;
  hasSession(): Promise<boolean>;
  linkIdToken(provider: 'apple' | 'google', token: string, nonce?: string): Promise<void>;
  getMe(): Promise<Me | null>;
  saveProfile(input: ProfileInput): Promise<void>;
  setPreferences(prefs: { invisible?: boolean; reactionsEnabled?: boolean }): Promise<void>;
  createGroup(name: string): Promise<CreatedGroup>;
  rotateInvite(groupId: string): Promise<Invite>;
  revokeInvite(groupId: string): Promise<void>;
  requestJoin(code: string): Promise<JoinStatus>;
  listJoinRequests(groupId: string): Promise<JoinRequest[]>;
  decideJoinRequest(requestId: string, approve: boolean): Promise<DecideStatus>;
  /** Founder: blocks the person behind a request (their account id is never shown). */
  blockJoinRequest(requestId: string): Promise<void>;
  /** Founder: reports the nickname (or behaviour) of the person behind a request. */
  reportJoinRequest(requestId: string, reason: Exclude<ReportReason, 'group_name'>): Promise<ReportStatus>;
  leaveGroup(groupId: string): Promise<void>;
  removeMember(groupId: string, userId: string): Promise<void>;
  myGroups(): Promise<GroupSummary[]>;
  groupBoard(groupId: string): Promise<BoardMember[]>;
  groupLeaderboard(groupId: string, period: Period): Promise<LeaderRow[]>;
  beat(sessionId: string, subjectId: string, paused: boolean): Promise<void>;
  endPresence(sessionId: string | null): Promise<void>;
  submitSession(payload: SessionPayload): Promise<SubmitStatus>;
  /** A session deleted on the device is deleted on the server too ('not_found' = was never there). */
  deleteSession(clientId: string): Promise<DeleteStatus>;
  sendReaction(groupId: string, toUserId: string, kind: ReactionKind): Promise<ReactionStatus>;
  takeReactions(): Promise<IncomingReaction[]>;
  report(targetUserId: string | null, groupId: string | null, reason: ReportReason): Promise<ReportStatus>;
  blockUser(userId: string): Promise<void>;
  unblockUser(userId: string): Promise<void>;
  myBlocks(): Promise<BlockedUser[]>;
  createParentCode(): Promise<{ code: string; expiresAt: string }>;
  claimParentCode(code: string): Promise<{ status: ClaimStatus; childNickname: string | null }>;
  parentChildren(): Promise<ChildSummary[]>;
  parentSetControls(childId: string, controls: ParentControls): Promise<void>;
  parentWeeklySummary(childId: string): Promise<DayTotal[]>;
  parentUnlink(childId: string): Promise<void>;
  parentNotices(): Promise<ParentNotice[]>;
  /** Student: removes every parent link; the parents get a notice (K-22). */
  childUnlinkParents(): Promise<void>;
  /** Deletes every personal record on the server, then signs out locally. */
  deleteMyAccount(): Promise<void>;
}

type Row = Record<string, unknown>;

const str = (v: unknown): string => (typeof v === 'string' ? v : String(v ?? ''));
const strOrNull = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v ?? 0));
const numOrNull = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const bool = (v: unknown): boolean => v === true;

export function createSupabaseApi(getClient: () => SupabaseClient = getSupabase): GroupApi {
  async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
    let result: { data: unknown; error: { message?: string; code?: string } | null };
    try {
      result = await getClient().rpc(fn, args);
    } catch (e) {
      throw toApiError({ message: e instanceof Error ? e.message : 'network' });
    }
    if (result.error) throw toApiError(result.error);
    return result.data as T;
  }
  const rows = async (fn: string, args?: Record<string, unknown>) => (await call<Row[] | null>(fn, args)) ?? [];

  return {
    async ensureSignedIn() {
      const auth = getClient().auth;
      const { data } = await auth.getSession();
      if (data.session) return;
      const { error } = await auth.signInAnonymously();
      if (error) throw toApiError(error);
    },
    async hasSession() {
      const { data } = await getClient().auth.getSession();
      return data.session !== null;
    },
    async linkIdToken(provider, token, nonce) {
      const { error } = await getClient().auth.linkIdentity({ provider, token, nonce });
      if (error) throw toApiError(error);
    },
    async getMe() {
      const [r] = await rows('get_me');
      if (!r) return null;
      return {
        nickname: str(r.nickname),
        ageBand: str(r.age_band) as AgeBand,
        invisible: bool(r.invisible),
        reactionsEnabled: bool(r.reactions_enabled),
        groupsDisabled: bool(r.groups_disabled),
        forceInvisible: bool(r.force_invisible),
        dailyLimitMinutes: numOrNull(r.daily_limit_minutes),
        parentCount: num(r.parent_count),
      };
    },
    async saveProfile(input) {
      await call('save_profile', {
        p_nickname: input.nickname,
        p_exam_type: input.examType,
        p_yks_area: input.yksArea,
        p_age_band: input.ageBand,
      });
    },
    async setPreferences(prefs) {
      await call('set_preferences', {
        p_invisible: prefs.invisible ?? null,
        p_reactions_enabled: prefs.reactionsEnabled ?? null,
      });
    },
    async createGroup(name) {
      const [r] = await rows('create_group', { p_name: name });
      return { groupId: str(r?.group_id), inviteCode: str(r?.invite_code), inviteExpiresAt: str(r?.invite_expires_at) };
    },
    async rotateInvite(groupId) {
      const [r] = await rows('rotate_invite', { p_group: groupId });
      return { inviteCode: str(r?.invite_code), inviteExpiresAt: str(r?.invite_expires_at) };
    },
    async revokeInvite(groupId) {
      await call('revoke_invite', { p_group: groupId });
    },
    async requestJoin(code) {
      return (await call<JoinStatus>('request_join', { p_code: code }));
    },
    async listJoinRequests(groupId) {
      return (await rows('list_join_requests', { p_group: groupId })).map((r) => ({
        requestId: str(r.request_id),
        nickname: str(r.nickname),
        createdAt: str(r.created_at),
      }));
    },
    async decideJoinRequest(requestId, approve) {
      return await call<DecideStatus>('decide_join_request', { p_request: requestId, p_approve: approve });
    },
    async blockJoinRequest(requestId) {
      await call('block_join_request', { p_request: requestId });
    },
    async reportJoinRequest(requestId, reason) {
      return await call<ReportStatus>('report_join_request', { p_request: requestId, p_reason: reason });
    },
    async leaveGroup(groupId) {
      await call('leave_group', { p_group: groupId });
    },
    async removeMember(groupId, userId) {
      await call('remove_member', { p_group: groupId, p_user: userId });
    },
    async myGroups() {
      return (await rows('my_groups')).map((r) => ({
        groupId: str(r.group_id),
        name: str(r.name),
        role: str(r.role) as GroupSummary['role'],
        memberCount: num(r.member_count),
        inviteCode: strOrNull(r.invite_code),
        inviteExpiresAt: strOrNull(r.invite_expires_at),
      }));
    },
    async groupBoard(groupId) {
      return (await rows('group_board', { p_group: groupId })).map((r) => ({
        userId: str(r.user_id),
        nickname: str(r.nickname),
        isMe: bool(r.is_me),
        role: str(r.role) as BoardMember['role'],
        studying: bool(r.studying),
        paused: r.paused === null || r.paused === undefined ? null : bool(r.paused),
        subjectId: strOrNull(r.subject_id),
        startedAt: strOrNull(r.started_at),
      }));
    },
    async groupLeaderboard(groupId, period) {
      return (await rows('group_leaderboard', { p_group: groupId, p_period: period })).map((r) => ({
        rank: num(r.rank),
        userId: str(r.user_id),
        nickname: str(r.nickname),
        isMe: bool(r.is_me),
        seconds: num(r.seconds),
        manualSeconds: num(r.manual_seconds),
        unverifiedSeconds: num(r.unverified_seconds),
        computedAt: strOrNull(r.computed_at),
      }));
    },
    async beat(sessionId, subjectId, paused) {
      await call('beat', { p_session: sessionId, p_subject: subjectId, p_paused: paused });
    },
    async endPresence(sessionId) {
      await call('end_presence', { p_session: sessionId });
    },
    async submitSession(p) {
      const status = await call<unknown>('submit_session', {
        p_client_id: p.clientId,
        // Not sent (KVKK m.4/2-ç); the parameters stay for the RPC's shape.
        p_subject: null,
        p_topic: null,
        p_started_at: p.startedAt,
        p_ended_at: p.endedAt,
        p_duration_s: p.durationS,
        p_source: p.source,
      });
      if (!isSubmitStatus(status)) throw new ApiError('unknown');
      return status;
    },
    async deleteSession(clientId) {
      const status = await call<unknown>('delete_session', { p_client_id: clientId });
      if (status !== 'deleted' && status !== 'not_found') throw new ApiError('unknown');
      return status;
    },
    async sendReaction(groupId, toUserId, kind) {
      return await call<ReactionStatus>('send_reaction', { p_group: groupId, p_to: toUserId, p_kind: kind });
    },
    async takeReactions() {
      return (await rows('take_reactions')).map((r) => ({
        id: str(r.id),
        kind: str(r.kind) as ReactionKind,
        fromNickname: str(r.from_nickname),
        groupName: str(r.group_name),
        createdAt: str(r.created_at),
      }));
    },
    async report(targetUserId, groupId, reason) {
      return await call<ReportStatus>('report', { p_target: targetUserId, p_group: groupId, p_reason: reason });
    },
    async blockUser(userId) {
      await call('block_user', { p_user: userId });
    },
    async unblockUser(userId) {
      await call('unblock_user', { p_user: userId });
    },
    async myBlocks() {
      return (await rows('my_blocks')).map((r) => ({ userId: str(r.user_id), nickname: str(r.nickname) }));
    },
    async createParentCode() {
      const [r] = await rows('create_parent_code');
      return { code: str(r?.code), expiresAt: str(r?.expires_at) };
    },
    async claimParentCode(code) {
      const [r] = await rows('claim_parent_code', { p_code: code });
      return { status: str(r?.status) as ClaimStatus, childNickname: strOrNull(r?.child_nickname) };
    },
    async parentChildren() {
      return (await rows('parent_children')).map((r) => ({
        childId: str(r.child_id),
        nickname: str(r.nickname),
        groupsDisabled: bool(r.groups_disabled),
        forceInvisible: bool(r.force_invisible),
        dailyLimitMinutes: numOrNull(r.daily_limit_minutes),
        linkedAt: str(r.linked_at),
        otherParents: num(r.other_parents),
      }));
    },
    async parentSetControls(childId, c) {
      await call('parent_set_controls', {
        p_child: childId,
        p_groups_disabled: c.groupsDisabled,
        p_force_invisible: c.forceInvisible,
        p_daily_limit_minutes: c.dailyLimitMinutes,
      });
    },
    async parentWeeklySummary(childId) {
      return (await rows('parent_weekly_summary', { p_child: childId })).map((r) => ({
        day: str(r.day),
        seconds: num(r.seconds),
        manualSeconds: num(r.manual_seconds),
      }));
    },
    async parentUnlink(childId) {
      await call('parent_unlink', { p_child: childId });
    },
    async parentNotices() {
      return (await rows('parent_notices')).map((r) => ({
        kind: str(r.kind) as ParentNoticeKind,
        createdAt: str(r.created_at),
      }));
    },
    async childUnlinkParents() {
      await call('child_unlink_parents');
    },
    async deleteMyAccount() {
      await call('delete_my_account');
      // The server account is gone; drop the local tokens too.
      await getClient().auth.signOut({ scope: 'local' });
    },
  };
}

let shared: GroupApi | null = null;
let override: GroupApi | null = null;

/** The app-wide API (supabase). Only reachable while GROUPS_ENABLED (getSupabase checks it). */
export function groupApi(): GroupApi {
  if (override !== null) return override;
  if (shared === null) shared = createSupabaseApi();
  return shared;
}

/** Tests replace the server with a fake. */
export function setGroupApiForTests(api: GroupApi | null): void {
  override = api;
}
