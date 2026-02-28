/**
 * Onboarding State Persistence
 * 
 * Reads/writes onboarding completion flags to the profiles.onboarding_state
 * JSONB column so they survive logout, browser clears, and device switches.
 * localStorage is used as a fast cache; DB is the source of truth.
 */

import { supabase } from '@/integrations/supabase/client';

export interface OnboardingState {
  site_tour_completed?: boolean;
  site_tour_completed_at?: string;
  itinerary_tour_completed?: boolean;
  itinerary_tour_completed_at?: string;
  welcome_shown?: boolean;
  welcome_shown_at?: string;
  onboarding_nudge_shown?: boolean;
  onboarding_nudge_shown_at?: string;
  // Tier 3: Contextual first-use hints
  share_hint_shown?: boolean;
  budget_hint_shown?: boolean;
  payments_hint_shown?: boolean;
  swap_hint_shown?: boolean;
  lock_hint_shown?: boolean;
  optimize_nudge_shown?: boolean;
  sections_nudge_shown?: boolean;
}

/**
 * Fetch onboarding_state from the user's profile row.
 * Returns {} if the row doesn't exist yet.
 */
export async function fetchOnboardingState(userId: string): Promise<OnboardingState> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('onboarding_state')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('[OnboardingState] fetch error:', error);
      return {};
    }

    return (data?.onboarding_state as OnboardingState) ?? {};
  } catch {
    return {};
  }
}

/**
 * Merge new flags into the existing onboarding_state JSONB.
 */
export async function mergeOnboardingState(
  userId: string,
  patch: Partial<OnboardingState>
): Promise<void> {
  try {
    const existing = await fetchOnboardingState(userId);
    const merged = { ...existing, ...patch };

    const { error } = await supabase
      .from('profiles')
      .update({ onboarding_state: merged as any })
      .eq('id', userId);

    if (error) {
      console.error('[OnboardingState] merge error:', error);
    }
  } catch (err) {
    console.error('[OnboardingState] merge exception:', err);
  }
}
