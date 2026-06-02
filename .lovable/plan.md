## Root cause

Not a hardcoded `'luxury'` default. In `src/pages/Start.tsx` (lines 2494 + 2927), when the user doesn't pick a budget in the builder, the trip insert falls back to `dnaBudgetTier || 'moderate'`, where `dnaBudgetTier` is read from `user_preferences.budget_tier` (line 2258).

Any user whose DNA / onboarding quiz set their preference to `luxury` will therefore have every new "no-budget" trip silently written as `budget_tier='luxury'`, even though they made no budget selection in the trip-builder. This poisons downstream pricing (luxury floors, premium dinners, transit-mode tier, prompt directives) and explains the DB row the user is staring at.

## Fix

Treat "no budget selected" as truly unset — don't inherit DNA.

**`src/pages/Start.tsx`**

1. Line 2494 (main itinerary insert) — change:
   ```
   budget_tier: budgetAmount ? (…tier-from-amount…) : (dnaBudgetTier || 'moderate'),
   ```
   to:
   ```
   budget_tier: budgetAmount ? (…tier-from-amount…) : null,
   ```

2. Line 2927 (chat-planner insert) — same change, with `chatBudget` instead of `budgetAmount`.

3. Lines 2249–2260 — remove the now-unused `dnaBudgetTier` state + `user_preferences` fetch (`grep` confirms only the two write sites consume it).

## Why this is safe

- DB column is already `string | null` (`src/integrations/supabase/types.ts:9734` etc.), so `null` is a first-class value.
- All downstream consumers already coalesce to `'moderate'` at read-time when `budget_tier` is null:
  - `useLovableItinerary.ts:282`, `TripDetail.tsx:958/1165/1255`, `EditorialItinerary.tsx`, `enrich-manual-trip`, `sync-trip-cost-table`, `useTripFinancialSnapshot`, `useDNAHotelRecommendations`, etc. all use `|| 'moderate'`.
  - `profile-loader.ts::normalizeBudgetTier` returns `'moderate'` in its `default` branch.
- So a no-budget trip now renders/generates as `moderate` (the intended neutral baseline) instead of the user's DNA tier.

## What is intentionally NOT changed

- The amount→tier mapping when the user DOES pick a budget stays identical.
- `dnaBudgetTier` is still used elsewhere in the app for hotel ranking, DNA scoring, etc. — only the trip-creation fallback is dropped.
- Backend defaults (`'moderate'` fallback in profile-loader, generation context, etc.) stay as-is.
- No DB migration; existing rows already stamped `'luxury'` are not retro-fixed here. (If the user wants a backfill — e.g. for trips < N days old with `budget_total_cents IS NULL AND budget_tier='luxury'` reset to `NULL` — that's a separate one-shot we can layer on.)

## Files

- `src/pages/Start.tsx` — 3 edits (2 write-sites + remove dead state/effect).

No tests touch this exact fallback; existing budget-tier tests assert the amount→tier mapping which is unchanged.
