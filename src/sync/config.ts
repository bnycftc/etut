/**
 * Server address and public (anon / publishable) key. They come from the build environment:
 * `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY` (see `.env.example`; local values go
 * to `.env.local`, which git ignores). The public key only identifies the project; access is
 * decided by RLS and the RPC functions on the server.
 */

export interface ServerConfig {
  url: string;
  key: string;
}

export function serverConfig(): ServerConfig | null {
  // Expo inlines EXPO_PUBLIC_* at build time; the property access must stay literal.
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;
  if (!url || !key) return null;
  return { url, key };
}
