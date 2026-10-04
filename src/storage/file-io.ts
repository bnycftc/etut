/**
 * Files that leave the app only through the system share sheet (backup, CSV, study card) and
 * files the student picks (backup import). No network: nothing is uploaded anywhere.
 * Web preview: `file-io.web.ts` (downloads instead of the share sheet).
 */

import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export type ShareResult = 'shared' | 'unavailable';

export interface ShareFileOptions {
  mimeType: string;
  /** iOS Uniform Type Identifier, e.g. `public.json`. */
  uti: string;
  dialogTitle: string;
}

/** Writes `content` to a temporary file, opens the share sheet, then deletes the file. */
export async function shareTextFile(
  name: string,
  content: string,
  options: ShareFileOptions,
): Promise<ShareResult> {
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(content);
  try {
    await Sharing.shareAsync(file.uri, { mimeType: options.mimeType, UTI: options.uti, dialogTitle: options.dialogTitle });
  } finally {
    try {
      file.delete();
    } catch {
      // The cache directory is cleaned by the system anyway.
    }
  }
  return 'shared';
}

/** Shares a captured image (`react-native-view-shot` temporary file). */
export async function shareImage(uri: string, dialogTitle: string): Promise<ShareResult> {
  if (!(await Sharing.isAvailableAsync())) return 'unavailable';
  const fileUri = uri.startsWith('file://') ? uri : `file://${uri}`;
  await Sharing.shareAsync(fileUri, { mimeType: 'image/png', UTI: 'public.png', dialogTitle });
  return 'shared';
}

export type PickResult = { kind: 'picked'; text: string } | { kind: 'canceled' } | { kind: 'too_large' };

/** Lets the student pick a JSON file and returns its text (the cache copy is deleted). */
export async function pickTextFile(maxBytes: number): Promise<PickResult> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  const asset = result.canceled ? undefined : result.assets[0];
  if (asset === undefined) return { kind: 'canceled' };
  const file = new File(asset.uri);
  try {
    if ((asset.size ?? file.size ?? 0) > maxBytes) return { kind: 'too_large' };
    return { kind: 'picked', text: await file.text() };
  } finally {
    try {
      file.delete();
    } catch {
      // Not our copy or already gone.
    }
  }
}
