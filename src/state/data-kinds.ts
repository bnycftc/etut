/**
 * The kinds of stored data a change can touch (`notifyDataChanged` in app-state.tsx). Each kind
 * has its own version number, and a screen keys its storage reads on the versions of the kinds it
 * reads only, so a change to anything else reloads nothing there: a topic mark or a mock exam does
 * not read 400 days of sessions again.
 *
 * - `sessions`: saved study sessions (timer, manual entries, question counts).
 * - `exams`: mock exams with their scores and topic analysis.
 * - `topics`: the "bitti / tekrar lazım" topic marks.
 * - `settings`: the kv-store values (goal, pomodoro, exam date, reminders, targets, backup records).
 *
 * The profile is not a kind: it is React state, so a read that depends on it keys on it.
 */

export const DATA_KINDS = ['sessions', 'exams', 'topics', 'settings'] as const;
export type DataKind = (typeof DATA_KINDS)[number];
export type DataVersions = Readonly<Record<DataKind, number>>;

/** What a change names: at least one kind; `...DATA_KINDS` after a restore or "delete all". */
export type ChangedKinds = [DataKind, ...DataKind[]];

export const NO_CHANGES: DataVersions = { sessions: 0, exams: 0, topics: 0, settings: 0 };

/** The versions after a change to `kinds`: each named kind moves on once, the others stay. */
export function bumpVersions(versions: DataVersions, kinds: readonly DataKind[]): DataVersions {
  const next = { ...versions };
  for (const kind of new Set(kinds)) next[kind] += 1;
  return next;
}
