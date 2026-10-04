/**
 * Web entry (development preview only; web is not a release target).
 *
 * The app reads storage synchronously during the first render (profile, running timer). On web
 * expo-sqlite answers synchronous calls from a worker through SharedArrayBuffer + Atomics and gives
 * up after a short busy-wait ("Sync operation timeout"), which is far shorter than the worker needs
 * to load wa-sqlite.wasm and open the origin private file system. So the worker is started with one
 * asynchronous call first and the app is rendered only after that; every later synchronous call is
 * answered within milliseconds. Same database files, schema and migrations as on iOS.
 */
import { openDatabaseAsync } from 'expo-sqlite';

async function warmUpSQLiteWorker(): Promise<void> {
  const db = await openDatabaseAsync(':memory:');
  await db.closeAsync();
}

warmUpSQLiteWorker()
  .catch((error: unknown) => {
    console.error('[etut] SQLite web worker failed to start', error);
  })
  .finally(() => {
    require('expo-router/entry');
  });
