/**
 * Shared archetype re-derivation boundary.
 *
 * MUST be called after every write to travel_dna_profiles.trait_scores
 * (both quiz path saveTravelDNA and conversation path save_onboarding_dna RPC).
 *
 * The DB-side merge in save_onboarding_dna() preserves quiz-only traits when
 * the conversation path runs second, but the caller-passed primary_archetype_name
 * is computed against only the caller's keyset and goes stale on merge.
 * This function reads the merged trait_scores back, re-runs the canonical TS
 * matcher, and writes the resulting archetype labels.
 *
 * Single source of truth for archetype derivation: matchArchetypes() in
 * archetype-matcher.ts. Do NOT duplicate matching logic in SQL.
 */

import { supabase } from "@/integrations/supabase/client";
import { matchArchetypes, type TraitScores } from "./archetype-matcher";

export type RecalculateResult =
  | { success: true; primary: string; secondary: string | null; confidence: number }
  | { success: false; error: string };

export async function recalculateArchetype(userId: string): Promise<RecalculateResult> {
  if (!userId) {
    return { success: false, error: "missing_user_id" };
  }

  const { data, error } = await supabase
    .from("travel_dna_profiles")
    .select("trait_scores")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[recalculateArchetype] read failed", error);
    return { success: false, error: error.message };
  }
  if (!data?.trait_scores) {
    return { success: false, error: "no_trait_scores" };
  }

  const traits = data.trait_scores as Record<string, unknown>;
  const lifeStage = typeof traits.life_stage === "string" ? (traits.life_stage as string) : null;

  let result;
  try {
    result = matchArchetypes(traits as unknown as TraitScores, lifeStage);
  } catch (matchErr) {
    console.error("[recalculateArchetype] match failed", matchErr);
    return { success: false, error: "match_failed" };
  }

  const primary = result.primary?.id ?? null;
  const secondary = result.secondary?.id ?? null;
  const confidenceLabel = result.primary?.confidence ?? "low";
  const confidenceScore =
    confidenceLabel === "high" ? 90 : confidenceLabel === "medium" ? 70 : 50;

  if (!primary) {
    return { success: false, error: "no_primary_match" };
  }

  const { error: updateErr } = await supabase
    .from("travel_dna_profiles")
    .update({
      primary_archetype_name: primary,
      secondary_archetype_name: secondary,
      dna_confidence_score: confidenceScore,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (updateErr) {
    console.error("[recalculateArchetype] update failed", updateErr);
    return { success: false, error: updateErr.message };
  }

  console.log(
    `[recalculateArchetype] user=${userId} primary=${primary} secondary=${secondary ?? "—"} conf=${confidenceLabel}(${confidenceScore})`,
  );

  return { success: true, primary, secondary, confidence: confidenceScore };
}

/**
 * One-shot recalc: if the user's profile is flagged with a non-null
 * `dna_recalc_needed_at`, re-runs the canonical matcher and clears the flag.
 * Used by app-entry to converge existing profiles after matcher gate changes
 * without porting the matcher to the server.
 *
 * Returns `{ success: true, skipped: true }` if no recalc was needed,
 * `{ success: true, shifted: boolean, primary, ... }` if recalc ran, or a
 * `{ success: false }` failure (flag is left in place so we retry next visit).
 */
export type RecalculateIfNeededResult =
  | { success: true; skipped: true }
  | { success: true; skipped?: false; shifted: boolean; primary: string; secondary: string | null; confidence: number; previousPrimary: string | null }
  | { success: false; error: string };

export async function recalculateIfNeeded(userId: string): Promise<RecalculateIfNeededResult> {
  if (!userId) return { success: false, error: "missing_user_id" };

  const { data, error } = await supabase
    .from("travel_dna_profiles")
    .select("dna_recalc_needed_at, primary_archetype_name")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    // Soft-fail: don't spam errors for transient/RLS issues
    console.warn("[recalculateIfNeeded] read failed", error.message);
    return { success: false, error: error.message };
  }
  if (!data?.dna_recalc_needed_at) return { success: true, skipped: true };

  const previousPrimary = (data.primary_archetype_name as string | null) ?? null;
  const result = await recalculateArchetype(userId);

  if (!result.success) {
    // Leave flag in place so we retry on next visit.
    return { success: false, error: (result as { success: false; error: string }).error };
  }

  // Clear the flag (best-effort; if it fails the next visit will recalc again — idempotent).
  await supabase
    .from("travel_dna_profiles")
    .update({ dna_recalc_needed_at: null })
    .eq("user_id", userId);

  const shifted = result.primary !== previousPrimary;
  if (shifted) {
    console.log(
      `[recalculateIfNeeded] shift user=${userId} ${previousPrimary ?? "—"} → ${result.primary}`,
    );
  }
  return {
    success: true,
    shifted,
    primary: result.primary,
    secondary: result.secondary,
    confidence: result.confidence,
    previousPrimary,
  };
}
