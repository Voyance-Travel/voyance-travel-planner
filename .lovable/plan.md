

## Universal Quality Pass — DNA-Aware Upgrade

### Current State

The `universalQualityPass` in `universal-quality-pass.ts` accepts `tripType` and `budgetTier` but:
- Never computes `diningConfig` from DNA info — it's an optional param that neither call site passes
- The `tripType` field (e.g. "vacation", "Explorer") doesn't map cleanly to archetype tiers
- Placeholder fixing runs without DNA-aware dining config, falling back to generic pricing

### Changes

#### 1. `supabase/functions/generate-itinerary/universal-quality-pass.ts`

**Update `UniversalQualityOptions` interface:**
- Replace `tripType: string` with `dnaTier?: string` (Explorer/Connector/Achiever/Restorer/Curator) and `dnaArchetype?: string` (e.g. "The Luxury Luminary")
- Keep `budgetTier` for backward compat but make DNA fields primary
- Remove `diningConfig` from options — compute it internally from DNA fields

**Update `universalQualityPass` function:**
- Import `getDiningConfig` from `dining-config.ts`
- At the top, compute: `const diningConfig = getDiningConfig(dnaTier || 'Explorer', dnaArchetype || '')`
- Update the log line to show archetype info: `${dnaArchetype} (${dnaTier})`
- Pass computed `diningConfig` to `fixPlaceholdersForDay` (already accepts it)
- Move cross-day venue dedup (Step 7) to Step 3 (before placeholder fixing, matching the user's spec order — dedup first, then fill gaps)

#### 2. `supabase/functions/generate-itinerary/action-generate-trip-day.ts` (lines 1016-1030)

Update the `universalQualityPass` call to pass DNA fields instead of `tripType`:
- Add `dnaTier: tripType || 'Explorer'` (current `tripType` already contains tier-like values)
- Add `dnaArchetype: ''` (not available at this level — prompt compilation resolves it in the inner `generate-day` call)
- Remove `tripType` from the options object

#### 3. `supabase/functions/generate-itinerary/action-generate-day.ts` (lines 345-359)

Same update: replace `tripType` with `dnaTier` and `dnaArchetype` in the quality pass call.

### Step Reordering (matches user spec)

Current order: Arrival → Departure → Placeholders → Free pricing → Market cap → Price caps → Dedup → Hotel return → Track venues

New order: Arrival → Departure → **Dedup** → Placeholders → Free pricing → Market cap → Price caps → Hotel return → Track venues

This is better because dedup runs before placeholder fixing — no point fixing a meal that will be removed as a duplicate.

### What Stays Unchanged
- All sanitization functions — unchanged
- `getDiningConfig` and `dining-config.ts` — unchanged
- `fix-placeholders.ts` — unchanged (already accepts `diningConfig`)
- Hotel return injection logic — unchanged
- Fuzzy dedup logic — unchanged (superior to exact match)

### Deployment
Redeploy `generate-itinerary` edge function.

