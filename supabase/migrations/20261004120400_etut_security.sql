-- Etüt backend, step 4: row level security, grants.
--
-- Defence in depth:
--   1. The `app` schema is not exposed by the Data API at all (config.toml [api].schemas).
--   2. Even so, RLS is enabled on every table. The client roles get no INSERT/UPDATE/DELETE on
--      any table; writes happen only inside the SECURITY DEFINER functions of step 3.
--   3. SELECT is granted only where a policy limits rows to what the caller may see, and only
--      on columns that may be shown (no age band, no invite code, no IP). The pgTAP tests use
--      these policies directly (supabase/tests).
--   4. EXECUTE on functions is revoked from PUBLIC and anon; the app's RPCs are granted to
--      `authenticated` only (anonymous sign-in users are `authenticated` too).

alter table app.profiles enable row level security;
alter table app.groups enable row level security;
alter table app.memberships enable row level security;
alter table app.join_requests enable row level security;
alter table app.presence enable row level security;
alter table app.study_sessions enable row level security;
alter table app.daily_totals enable row level security;
alter table app.leaderboard_cache enable row level security;
alter table app.reactions enable row level security;
alter table app.reports enable row level security;
alter table app.blocks enable row level security;
alter table app.parent_link_codes enable row level security;
alter table app.parent_links enable row level security;
alter table app.parent_controls enable row level security;
alter table app.rate_events enable row level security;
alter table app.banned_terms enable row level security;
alter table app.reserved_names enable row level security;
alter table audit.events enable row level security;
alter table audit.ip_events enable row level security;
alter table audit.destruction_log enable row level security;

revoke all on all tables in schema app from public, anon, authenticated;
revoke all on all tables in schema audit from public, anon, authenticated;
revoke all on all sequences in schema app from public, anon, authenticated;
revoke all on all sequences in schema audit from public, anon, authenticated;
revoke all on all functions in schema app from public, anon, authenticated;
revoke all on all functions in schema audit from public, anon, authenticated;
alter default privileges in schema app revoke all on tables from public, anon, authenticated;
alter default privileges in schema app revoke all on functions from public, anon, authenticated;
alter default privileges in schema audit revoke all on tables from public, anon, authenticated;

grant usage on schema app to authenticated;

-- Policy helpers must be callable by the role the policy is evaluated for.
grant execute on function app.is_member(uuid) to authenticated;
grant execute on function app.is_owner(uuid) to authenticated;
grant execute on function app.shares_group(uuid) to authenticated;
grant execute on function app.is_parent_of(uuid) to authenticated;

-- profiles: own row and members of the caller's groups; nickname only for others (K-20: the age
-- band is never readable directly, the own band comes from get_me()).
grant select (user_id, nickname) on app.profiles to authenticated;
create policy profiles_select on app.profiles for select to authenticated
  using (user_id = (select auth.uid()) or app.shares_group(user_id));

-- groups: only groups the caller belongs to (K-04: no listing, no search). No invite code column.
grant select (id, name, member_count, created_at) on app.groups to authenticated;
create policy groups_select on app.groups for select to authenticated
  using (app.is_member(id));

grant select (group_id, user_id, role, joined_at) on app.memberships to authenticated;
create policy memberships_select on app.memberships for select to authenticated
  using (app.is_member(group_id));

-- join requests: the requester and the founder of the group.
grant select (id, group_id, user_id, status, created_at, decided_at) on app.join_requests to authenticated;
create policy join_requests_select on app.join_requests for select to authenticated
  using (user_id = (select auth.uid()) or app.is_owner(group_id));

-- presence, sessions and daily totals: own rows only (others see them through group_board /
-- group_leaderboard, which apply "görünmez çalış" and the parent locks).
grant select (user_id, session_client_id, subject_id, started_at, last_beat_at, paused) on app.presence to authenticated;
create policy presence_select on app.presence for select to authenticated
  using (user_id = (select auth.uid()));

grant select (id, user_id, client_id, subject_id, topic_id, started_at, ended_at, duration_s, source, verified, received_at)
  on app.study_sessions to authenticated;
create policy study_sessions_select on app.study_sessions for select to authenticated
  using (user_id = (select auth.uid()));

grant select (user_id, day, seconds, verified_seconds, manual_seconds) on app.daily_totals to authenticated;
create policy daily_totals_select on app.daily_totals for select to authenticated
  using (user_id = (select auth.uid()));

-- leaderboard cache: rows of the caller's groups, and only about current members.
grant select (group_id, period, period_start, user_id, rank, seconds, manual_seconds, computed_at)
  on app.leaderboard_cache to authenticated;
create policy leaderboard_cache_select on app.leaderboard_cache for select to authenticated
  using (
    app.is_member(group_id)
    and exists (select 1 from app.memberships m where m.group_id = leaderboard_cache.group_id
                                                and m.user_id = leaderboard_cache.user_id));

-- reactions: the recipient only (K-07). The sender cannot read them back.
grant select (id, group_id, from_user, to_user, kind, created_at, delivered_at) on app.reactions to authenticated;
create policy reactions_select on app.reactions for select to authenticated
  using (to_user = (select auth.uid()));

-- reports and blocks: the person who made them.
grant select (id, reporter_id, target_user_id, group_id, reason, status, created_at) on app.reports to authenticated;
create policy reports_select on app.reports for select to authenticated
  using (reporter_id = (select auth.uid()));

grant select (blocker_id, blocked_id, created_at) on app.blocks to authenticated;
create policy blocks_select on app.blocks for select to authenticated
  using (blocker_id = (select auth.uid()));

-- parent link: both sides see the link; controls: the student and the linked parents.
grant select (child_id, code, expires_at) on app.parent_link_codes to authenticated;
create policy parent_link_codes_select on app.parent_link_codes for select to authenticated
  using (child_id = (select auth.uid()));

grant select (child_id, parent_id, created_at) on app.parent_links to authenticated;
create policy parent_links_select on app.parent_links for select to authenticated
  using (child_id = (select auth.uid()) or parent_id = (select auth.uid()));

grant select (child_id, groups_disabled, force_invisible, daily_limit_minutes, updated_at) on app.parent_controls to authenticated;
create policy parent_controls_select on app.parent_controls for select to authenticated
  using (child_id = (select auth.uid()) or app.is_parent_of(child_id));

-- rate_events, banned_terms, reserved_names, audit.*: RLS on, no policy, no grant = no access.

-- ---------------------------------------------------------------------------------------------
-- RPC grants
-- ---------------------------------------------------------------------------------------------

revoke all on all functions in schema public from public, anon;
alter default privileges in schema public revoke execute on functions from public, anon;

grant execute on function public.save_profile(text, text, text, text) to authenticated;
grant execute on function public.get_me() to authenticated;
grant execute on function public.set_preferences(boolean, boolean) to authenticated;
grant execute on function public.create_group(text) to authenticated;
grant execute on function public.rotate_invite(uuid) to authenticated;
grant execute on function public.revoke_invite(uuid) to authenticated;
grant execute on function public.request_join(text) to authenticated;
grant execute on function public.list_join_requests(uuid) to authenticated;
grant execute on function public.decide_join_request(uuid, boolean) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
grant execute on function public.remove_member(uuid, uuid) to authenticated;
grant execute on function public.my_groups() to authenticated;
grant execute on function public.group_board(uuid) to authenticated;
grant execute on function public.group_leaderboard(uuid, text) to authenticated;
grant execute on function public.beat(uuid, text, boolean) to authenticated;
grant execute on function public.end_presence(uuid) to authenticated;
grant execute on function public.submit_session(uuid, text, text, timestamptz, timestamptz, integer, text) to authenticated;
grant execute on function public.send_reaction(uuid, uuid, text) to authenticated;
grant execute on function public.take_reactions() to authenticated;
grant execute on function public.report(uuid, uuid, text) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.unblock_user(uuid) to authenticated;
grant execute on function public.my_blocks() to authenticated;
grant execute on function public.create_parent_code() to authenticated;
grant execute on function public.claim_parent_code(text) to authenticated;
grant execute on function public.parent_children() to authenticated;
grant execute on function public.parent_set_controls(uuid, boolean, boolean, integer) to authenticated;
grant execute on function public.parent_weekly_summary(uuid) to authenticated;
grant execute on function public.parent_unlink(uuid) to authenticated;
grant execute on function public.delete_my_account() to authenticated;
