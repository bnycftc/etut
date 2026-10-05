import { LICENSES, NATIVE_LICENSES } from '../licenses';

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
});
