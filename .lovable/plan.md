# Fix duplicate day titles ("Culinary Day in Rome" x3)

## Root cause

Both the server pass (`supabase/functions/generate-itinerary/pipeline/coherence-day-title.ts`) and its client mirror (`src/utils/dayTitleCoherence.ts`) share the same logic:

1. `categoryVibe()` returns `'food'` whenever `dining >= 3`. Every full day has breakfast + lunch + dinner → **every full day votes "food"**.
2. `deriveTitle()` only uses the headline activity name when a top neighborhood appears ≥2 times. Activities on this trip have **no `neighborhood` field populated** (confirmed in DB: every row `neighborhood = null`). So the topHood branch never fires.
3. `isCoherent()` checks title tokens vs. venue/neighborhood tokens. Day 2's stored title `Vatican Masterpieces & Kinetic Roman Streets` shares no tokens with venue names like `Pasticceria 5 Lune`, `Da Enzo al 29`, etc., so it's judged incoherent and replaced **at render time** with the food-vibe label.
4. Result: Days 1, 2, 3 all collapse to `Culinary Day in Rome`. Day 1's good content (Colosseum, Trastevere) and Day 3's Prati lunch are ignored.

## Fix

### 1. Reorder `deriveTitle` priority (server + client mirror)

When no neighborhood signal exists, prefer the **headline non-dining activity** before the generic vibe label.

New order:
1. If top neighborhood ≥ 2 → `"{Hood} & {Headline}"` or `"{Hood} in {City}"` (unchanged)
2. **NEW:** If a non-dining headline exists (sightseeing / cultural / shopping / wellness) → `"{Headline} in {City}"` (e.g. `Colosseum in Rome`, `Vatican in Rome`)
3. Only then fall back to vibe label (`Culinary Day…`, `Museum & Culture…`)
4. Drop pure vibe label when there's any non-dining anchor

### 2. Tighten `isCoherent` for low-signal days

If activities lack neighborhood metadata AND the stored title is non-empty / non-generic / contains ≥ 2 meaningful tokens, **trust the stored title** instead of overriding. Rationale: the AI-written theme is almost always richer than a derived label when signal is thin.

### 3. Cross-day uniqueness guard (server)

In the post-generation pipeline that calls `enforceDayTitleCoherence` per day, track titles already assigned in the same trip. If a derived title duplicates an earlier day, append the headline venue or fall through to the next-best label:

- Day 1: `Colosseum & Trastevere in Rome`
- Day 2: `Vatican Masterpieces` (kept — stored is fine)
- Day 3: `Prati Tastings in Rome` or `Pizzarium Bonci in Rome`

### 4. Backfill Rome trip

One-off `safeUpdateItineraryData('self-heal-day-title-rederive')` path: re-run coherence on `d18b2e8a-310e-42c8-a7aa-aac61076a234` with the new rules so the user sees correct titles without regenerating.

### 5. Tests

Extend `coherence-day-title.test.ts` and `dayTitleCoherence.test.ts`:
- Day with 3 meals + Colosseum + no neighborhoods → title contains "Colosseum", not "Culinary"
- Three full days of meals + different headline activities → three distinct titles
- Stored multi-token theme + no neighborhood metadata → keep stored

## Files

- `supabase/functions/generate-itinerary/pipeline/coherence-day-title.ts`
- `supabase/functions/generate-itinerary/pipeline/coherence-day-title.test.ts`
- `src/utils/dayTitleCoherence.ts`
- `src/utils/__tests__/dayTitleCoherence.test.ts`
- caller of `enforceDayTitleCoherence` in the generation pipeline (add cross-day dedup pass)
- one-shot self-heal trigger in `TripDetail.tsx` (re-derive titles when `metadata.day_titles_rederived_at` missing and any two days share a title)

## Out of scope

- Backfilling `neighborhood` on activities — separate issue; fix here is to render correctly even when it's missing.
- The Day 1 over-pack (15 cards) and Day 4 partial-status issues — already covered by prior plan.
