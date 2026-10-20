/**
 * The group module may only move past 'off' once the legal and store requirements of that phase
 * exist (docs/hukuk/03, kvkk/12). 'beta18' (closed adult beta) needs every 'beta18' blocker done;
 * 'public' needs all of them done; any phase but 'off' needs the published privacy notice.
 */

import { readFileSync } from 'fs';
import { join } from 'path';

import {
  blockersFor,
  GROUPS_ENABLED,
  GROUPS_LAUNCH_BLOCKERS,
  GROUPS_PHASE,
  type GroupsPhase,
  type LaunchBlocker,
} from '../features';
import { PRIVACY_NOTICE_URL } from '../legal';

const PHASES: readonly GroupsPhase[] = ['off', 'beta18', 'public'];

describe('group module launch gate', () => {
  it('has no open blocker of the current phase or an earlier one', () => {
    expect(blockersFor(GROUPS_PHASE).map((b) => b.text)).toEqual([]);
  });

  it('is not switched on without the published privacy notice', () => {
    expect(GROUPS_PHASE !== 'off' && PRIVACY_NOTICE_URL === null).toBe(false);
  });

  it('derives GROUPS_ENABLED from the phase', () => {
    expect(GROUPS_ENABLED).toBe(GROUPS_PHASE !== 'off');
  });

  it('declares the phase in the form testflight.yml reads', () => {
    // Same pattern as the "Group module phase" step of .github/workflows/testflight.yml.
    const source = readFileSync(join(__dirname, '..', 'features.ts'), 'utf8');
    const values = [...source.matchAll(/^export const GROUPS_PHASE(?:: *[A-Za-z]+)? *= *'([a-z0-9]+)' *;/gm)].map((m) => m[1]);
    expect(values).toEqual([GROUPS_PHASE]);
  });
});

describe('launch blockers', () => {
  it('have unique ids, a text and a launch phase', () => {
    const ids = GROUPS_LAUNCH_BLOCKERS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const b of GROUPS_LAUNCH_BLOCKERS) {
      expect(b.id).toMatch(/\S/);
      expect(b.text).toMatch(/\S/);
      expect(['beta18', 'public']).toContain(b.phase);
    }
  });

  it('keep the beta items and the public-only items of the launch plan apart', () => {
    // docs: groups launch plan, "Kapı (KABUL)". Every item stays until done; only its phase matters here.
    const phaseOf = Object.fromEntries(GROUPS_LAUNCH_BLOCKERS.map((b) => [b.id, b.phase]));
    const planned: Record<string, LaunchBlocker['phase']> = {
      'K-17': 'beta18',
      'K-25/K-42': 'beta18',
      'K-28/K-29': 'beta18',
      'K-31/K-38': 'beta18',
      'hesap-kaybi': 'beta18',
      'K-23': 'public',
      'K-37': 'public',
      'K-44': 'public',
    };
    for (const [id, phase] of Object.entries(phaseOf)) {
      if (id in planned) expect([id, phase]).toEqual([id, planned[id]]);
    }
  });
});

describe('blockersFor', () => {
  const beta: LaunchBlocker = { id: 'b', text: 'beta item', phase: 'beta18' };
  const pub: LaunchBlocker = { id: 'p', text: 'public item', phase: 'public' };

  it("lets 'off' ship with anything open", () => {
    expect(blockersFor('off', [beta, pub])).toEqual([]);
  });

  it("holds 'beta18' only on beta items", () => {
    expect(blockersFor('beta18', [beta, pub])).toEqual([beta]);
    expect(blockersFor('beta18', [pub])).toEqual([]);
  });

  it("holds 'public' on every item", () => {
    expect(blockersFor('public', [beta, pub])).toEqual([beta, pub]);
    expect(blockersFor('public', [])).toEqual([]);
  });

  it('only ever grows from one phase to the next', () => {
    for (let i = 1; i < PHASES.length; i++) {
      const earlier = blockersFor(PHASES[i - 1]);
      const later = blockersFor(PHASES[i]);
      expect(later).toEqual(expect.arrayContaining(earlier));
    }
  });
});
