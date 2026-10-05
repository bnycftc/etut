/**
 * The native (iOS) file path of backup import/export, with the Expo modules mocked: document
 * picker → cache copy → size check → text → the cache copy is deleted. The app smoke test mocks
 * this whole module and the web preview uses `file-io.web.ts`, so this is the only test of it.
 */

const mockPicker = { result: null as unknown };
const mockFiles = new Map<string, { text: string; size: number | null; deleted: boolean; failRead: boolean }>();
const mockShared: { uri: string; options: unknown }[] = [];
const mockSharing = { available: true };

jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(async () => mockPicker.result),
}));

jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(async () => mockSharing.available),
  shareAsync: jest.fn(async (uri: string, options: unknown) => {
    mockShared.push({ uri, options });
  }),
}));

jest.mock('expo-file-system', () => {
  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('/');
    }
    private get entry() {
      const e = mockFiles.get(this.uri);
      if (e === undefined) throw new Error(`no file ${this.uri}`);
      return e;
    }
    get size() {
      return this.entry.size;
    }
    async text() {
      if (this.entry.failRead) throw new Error('read failed');
      return this.entry.text;
    }
    create() {
      mockFiles.set(this.uri, { text: '', size: 0, deleted: false, failRead: false });
    }
    write(content: string) {
      this.entry.text = content;
      this.entry.size = content.length;
    }
    delete() {
      this.entry.deleted = true;
    }
  }
  return { File, Paths: { cache: { uri: 'file:///cache' } } };
});

import { pickTextFile, shareTextFile } from '../file-io';

const URI = 'file:///cache/DocumentPicker/etut-yedek.json';

function picked(size: number | undefined) {
  mockPicker.result = { canceled: false, assets: [{ uri: URI, name: 'etut-yedek.json', size, mimeType: 'application/json' }] };
}

beforeEach(() => {
  mockFiles.clear();
  mockShared.length = 0;
  mockSharing.available = true;
});

describe('pickTextFile (native)', () => {
  it('reads the picked file and deletes the cache copy', async () => {
    mockFiles.set(URI, { text: '{"format":"etut-yedek"}', size: 23, deleted: false, failRead: false });
    picked(23);
    await expect(pickTextFile(1000)).resolves.toEqual({ kind: 'picked', text: '{"format":"etut-yedek"}' });
    expect(mockFiles.get(URI)?.deleted).toBe(true);
  });

  it('cancel touches no file', async () => {
    mockPicker.result = { canceled: true, assets: null };
    await expect(pickTextFile(1000)).resolves.toEqual({ kind: 'canceled' });
  });

  it('a file above the limit is not read (size from the picker, or from the file when missing)', async () => {
    mockFiles.set(URI, { text: 'x'.repeat(50), size: 50, deleted: false, failRead: true });
    picked(5000);
    await expect(pickTextFile(1000)).resolves.toEqual({ kind: 'too_large' });
    expect(mockFiles.get(URI)?.deleted).toBe(true);

    mockFiles.set(URI, { text: 'x', size: 5000, deleted: false, failRead: true });
    picked(undefined);
    await expect(pickTextFile(1000)).resolves.toEqual({ kind: 'too_large' });
  });

  it('a read error still deletes the cache copy', async () => {
    mockFiles.set(URI, { text: '', size: 10, deleted: false, failRead: true });
    picked(10);
    await expect(pickTextFile(1000)).rejects.toThrow('read failed');
    expect(mockFiles.get(URI)?.deleted).toBe(true);
  });
});

describe('shareTextFile (native)', () => {
  const options = { mimeType: 'application/json', uti: 'public.json', dialogTitle: 'Yedek' };

  it('writes a temporary file, shares it with its type and deletes it', async () => {
    await expect(shareTextFile('etut-yedek-2026-10-05.json', '{}', options)).resolves.toBe('shared');
    expect(mockShared).toEqual([
      {
        uri: 'file:///cache/etut-yedek-2026-10-05.json',
        options: { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Yedek' },
      },
    ]);
    expect(mockFiles.get('file:///cache/etut-yedek-2026-10-05.json')).toMatchObject({ text: '{}', deleted: true });
  });

  it('without a share sheet nothing is written', async () => {
    mockSharing.available = false;
    await expect(shareTextFile('a.json', '{}', options)).resolves.toBe('unavailable');
    expect(mockFiles.size).toBe(0);
  });
});
