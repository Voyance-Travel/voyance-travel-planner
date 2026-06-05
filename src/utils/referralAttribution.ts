/**
 * Referral attribution (C-REFERRAL-1, client side).
 *
 * Flow: a visitor lands via `?ref=<code>` → we stash the code → once they sign
 * up AND verify their email, we call the `claim-referral` edge function, which
 * securely grants 150 credits to both sides. The grant, dedup, and anti-abuse
 * all live server-side; this file only captures the code and triggers the claim.
 */
import { supabase } from '@/integrations/supabase/client';

const PENDING_REF_KEY = 'voyance_pending_ref';

/**
 * Capture a `?ref=<code>` from the current URL and persist it until signup
 * completes. Ignores the anonymous `share` sentinel and never overwrites an
 * already-captured code (first link wins).
 */
export function captureReferralCode(): void {
  try {
    if (typeof window === 'undefined') return;
    const code = new URLSearchParams(window.location.search).get('ref');
    if (!code || code === 'share') return;
    if (localStorage.getItem(PENDING_REF_KEY)) return;
    localStorage.setItem(PENDING_REF_KEY, code);
  } catch {
    /* storage unavailable — ignore */
  }
}

/**
 * If a pending referral code exists and the user's email is verified, claim it.
 * Clears the code on any DEFINITIVE outcome (granted, or a permanent rejection
 * like self/invalid/already-referred) and keeps it on transient/network errors
 * so a later sign-in can retry. No-op until the email is confirmed.
 */
export async function claimPendingReferral(
  user: { email_confirmed_at?: string | null } | null | undefined,
): Promise<void> {
  try {
    if (typeof window === 'undefined') return;
    const code = localStorage.getItem(PENDING_REF_KEY);
    if (!code) return;
    if (!user?.email_confirmed_at) return; // wait until the referee verifies

    const { data, error } = await supabase.functions.invoke('claim-referral', { body: { code } });
    if (error) return; // transient — keep the code for a later retry

    const granted = Boolean((data as { granted?: boolean } | null)?.granted);
    const reason = (data as { reason?: string } | null)?.reason;
    const terminal =
      granted || ['SELF_REFERRAL', 'INVALID_CODE', 'ALREADY_REFERRED', 'NO_CODE'].includes(reason ?? '');

    if (terminal) localStorage.removeItem(PENDING_REF_KEY);

    if (granted) {
      try {
        const { toast } = await import('sonner');
        toast.success((data as { message?: string } | null)?.message || 'Referral bonus credited!');
      } catch {
        /* toast optional */
      }
    }
  } catch {
    /* keep the code for retry */
  }
}
