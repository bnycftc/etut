import { readFileSync } from 'fs';
import { join } from 'path';

import { LICENSES, NATIVE_LICENSES } from '../licenses';

const ROOT = join(__dirname, '..', '..', '..');
const LOCK = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8')) as {
  packages: Record<string, { version?: string }>;
};

/** Installed versions of an npm package: node_modules/<name>, then any nested copy. */
function installedVersions(name: string): string[] {
  const nested = Object.entries(LOCK.packages)
    .filter(([key]) => key.endsWith(`/node_modules/${name}`))
    .map(([, entry]) => entry.version ?? '');
  try {
    const top = JSON.parse(readFileSync(join(ROOT, 'node_modules', name, 'package.json'), 'utf8')) as { version: string };
    return [top.version, ...nested];
  } catch {
    return nested;
  }
}

describe('open-source licenses', () => {
  it('ships the license text of every package and native library (MIT, BSD and Apache require it)', () => {
    const missing = [...LICENSES, ...NATIVE_LICENSES].filter((l) => l.text === null).map((l) => l.name);
    expect(missing).toEqual([]);
  });

  it('native BSD and Apache texts are the real license, not a placeholder', () => {
    const text = (name: string) => NATIVE_LICENSES.find((l) => l.name.startsWith(name))?.text ?? '';
    expect(text('folly')).toContain('Apache License');
    for (const name of ['glog', 'double-conversion', 'SocketRocket']) {
      expect(text(name)).toContain('Redistributions in binary form must reproduce');
    }
  });

  // A dependency update without `npm run gen:licenses` leaves Hakkında → Lisanslar showing
  // versions that are not the code in the app.
  it('lists every npm package at an installed version (otherwise run npm run gen:licenses)', () => {
    const stale = LICENSES.filter((l) => !installedVersions(l.name).includes(l.version)).map(
      (l) => `${l.name} ${l.version}, installed ${installedVersions(l.name).join(' / ') || 'nothing'}`,
    );
    expect(stale).toEqual([]);
  });
});
