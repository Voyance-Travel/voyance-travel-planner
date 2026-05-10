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
