/**
 * The server accepts only known subject ids and curriculum-shaped topic ids (the live status must
 * not carry free text, K-09). These lists live in SQL; this keeps them in step with the app.
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { KPSS_TOPICS } from '../../domain/curriculum/kpss';
import { LGS_TOPICS } from '../../domain/curriculum/lgs';
import { AYT_TOPICS } from '../../domain/curriculum/yks-ayt';
import { TYT_TOPICS } from '../../domain/curriculum/yks-tyt';
import { SUBJECTS_BY_EXAM } from '../../domain/subjects';

const MIGRATIONS = join(__dirname, '..', '..', '..', 'supabase', 'migrations');

function serverSubjects(): string[] {
  const sql = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .map((f) => readFileSync(join(MIGRATIONS, f), 'utf8'))
    .join('\n');
  const block = /insert into app\.subjects \(id\) values([\s\S]*?);/.exec(sql);
  if (block === null) throw new Error('app.subjects insert not found');
  return [...block[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
}

describe('server lists', () => {
  it('the server knows exactly the subjects the timer offers', () => {
    const app = [...new Set(Object.values(SUBJECTS_BY_EXAM).flat())].sort();
    expect(serverSubjects()).toEqual(app);
  });

  it('every curriculum topic id has the shape the server accepts', () => {
    const ids = [TYT_TOPICS, AYT_TOPICS, LGS_TOPICS, KPSS_TOPICS].flatMap((source) =>
      Object.values(source).flatMap((topics) => (topics ?? []).map((t) => t.id)),
    );
    expect(ids.length).toBeGreaterThan(100);
    expect(ids.filter((id) => !/^[a-z0-9._-]{1,80}$/.test(id))).toEqual([]);
  });
});
