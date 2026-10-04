/**
 * Web preview version of `file-io.ts` (web is a test target only). expo-file-system has no web
 * implementation and the Web Share API can not share local files, so files are downloaded.
 */

import * as DocumentPicker from 'expo-document-picker';

export type ShareResult = 'shared' | 'unavailable';

export interface ShareFileOptions {
  mimeType: string;
  uti: string;
  dialogTitle: string;
}

function download(href: string, name: string): void {
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function shareTextFile(
  name: string,
  content: string,
  options: ShareFileOptions,
): Promise<ShareResult> {
  const url = URL.createObjectURL(new Blob([content], { type: options.mimeType }));
  download(url, name);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'shared';
}

/** `uri` is the data URI that `react-native-view-shot` returns on web. */
export async function shareImage(uri: string, _dialogTitle: string): Promise<ShareResult> {
  download(uri, 'etut-kart.png');
  return 'shared';
}

export type PickResult = { kind: 'picked'; text: string } | { kind: 'canceled' } | { kind: 'too_large' };

export async function pickTextFile(maxBytes: number): Promise<PickResult> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain'],
    multiple: false,
    base64: false,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (asset === undefined || asset.file === undefined) return { kind: 'canceled' };
  if (asset.file.size > maxBytes) return { kind: 'too_large' };
  return { kind: 'picked', text: await asset.file.text() };
}
