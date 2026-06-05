// Auth-less Supabase client for PUBLIC, anonymously-readable endpoints
// (e.g. the shared-trip recipient view at /trip-share/:token).
//
// Why this exists:
// The default `supabase` client (./client.ts) attaches an auth token to EVERY
// PostgREST request by calling auth.getSession(), which acquires a navigator.locks
// lock. On a public page with no user session that lock can abort with
// "AbortError: signal is aborted without reason", which makes getSession() throw —
// so even an anonymous public RPC (get_consumer_shared_trip, GRANTed to anon) fails
// and the recipient sees a false "Trip Not Found". A public page must never depend
// on the auth subsystem.
//
// This client never persists or refreshes a session and never parses the URL for
// auth, so it never touches the lock. It calls public RPCs with the anon key alone.
// Use it ONLY for endpoints that are safe for anonymous callers.
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

export const supabasePublic = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    // Distinct storage key so this client does NOT share the default client's
    // GoTrueClient storage/lock — avoids the "Multiple GoTrueClient instances
    // detected ... same storage key" warning and any navigator.locks contention.
    storageKey: 'sb-voyance-public-noauth',
  },
});
