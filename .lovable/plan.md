## Loosen "incomplete itinerary" threshold to allow one bare day

**Problem:** The completeness gate flags any trip where even one day lacks a meaningful (non-logistics) activity. Day 1 with a late arrival (hotel check-in, customs, taxi only) reliably trips this, so trips that are actually complete get a red "missing activities" banner.

**Fix:** Change the threshold from `meaningfulCount < Math.max(2, dayCount)` to `meaningfulCount < Math.max(2, dayCount - 1)` in both the frontend classifier and its backend mirror. Allows exactly one bare day (the arrival/departure logistics-only day) without false-positiving; still requires ≥2 meaningful days overall.

### Changes

1. **`src/utils/itineraryCompleteness.ts`** (line 98) — update condition + update the comment so the rationale (one logistics-only day tolerated) is captured.
2. **`supabase/functions/generate-itinerary/day-validation.ts`** (line 1401) — same change so the backend `incomplete_itinerary` stamp stays in lockstep with the frontend banner. Without this the backend would still mark trips failed.

No DB migration. No behavioral change for trips that genuinely have multiple empty days.
