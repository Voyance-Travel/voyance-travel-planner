/**
 * Post-meal-guard description backstop.
 *
 * `enforceRequiredMealsFinalGuard` injects dining cards with empty descriptions
 * (sentinel) when a meal is missing. The pre-repair `fillMissingDescriptions`
 * pass at action-generate-{trip-,}day.ts ran BEFORE the meal guard, so it never
 * saw these new cards. This helper runs the same batched Gemini-flash refill
 * AFTER the guard fires, so the user never sees the empty / templated blurb.
 *
 * Memory: mem://constraints/itinerary/description-coverage
 */

export async function fillAfterMealGuard(
  activities: any[],
  destination: string | undefined,
  dayNumber: number,
  source: string,
): Promise<void> {
  try {
    const { fillMissingDescriptions } = await import('./description-fill.ts');
    const counters = await fillMissingDescriptions(
      activities || [],
      destination,
      Deno.env.get('LOVABLE_API_KEY') || undefined,
      dayNumber,
    );
    if (counters.flagged > 0) {
      console.log(
        `[DESC_FILL_POST_GUARD] day=${dayNumber} source=${source} flagged=${counters.flagged} filled=${counters.filled} skipped=${counters.skipped}`
      );
    }
  } catch (err) {
    console.warn(
      `[DESC_FILL_POST_GUARD] day=${dayNumber} source=${source} failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}
