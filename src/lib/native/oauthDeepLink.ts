import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

/**
 * Bridge OAuth deep links from voyance://auth/callback?... into Supabase auth.
 * On native, the OS routes the callback to App.addListener('appUrlOpen').
 * Supabase needs to ingest the URL fragment/query to finalize the session.
 */
export function registerOAuthDeepLinkHandler() {
  if (!Capacitor.isNativePlatform()) return;

  App.addListener('appUrlOpen', async (event: { url: string }) => {
    if (!event?.url?.startsWith('voyance://auth')) return;

    // Supabase JS exposes the OAuth response via the URL fragment/query.
    // Convert the custom-scheme URL into a parseable URL for Supabase.
    try {
      const url = new URL(event.url);
      const hash = url.hash;       // includes access_token, refresh_token
      const search = url.search;   // includes ?code= for PKCE flow

      if (hash) {
        // Implicit flow: tokens in fragment
        const params = new URLSearchParams(hash.replace(/^#/, ''));
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
        }
      } else if (search) {
        // PKCE flow: exchange the code
        const params = new URLSearchParams(search);
        const code = params.get('code');
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        }
      }
    } catch (err) {
      console.error('[OAuthDeepLink] Failed to ingest callback URL:', err);
    }
  });
}
