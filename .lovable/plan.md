## Reality check

The €2,272 trip was generated **before** the last batch of fixes deployed (Reservation Urgency title leak, Quadri nightcap drinks bypass, Da Ivo vibe-clash strip, repair-cost JSONB parity). Three of the six "confirmed live" bugs are already resolved in code — they're frozen into that trip's `itinerary_data` and `activity_costs` snapshot. **No new code is needed for those three; they need a one-shot repair pass over the existing trip.**

That leaves four genuine workstreams.

## Step 1 — One-shot repair pass for the stale €2,272 trip (no new code)

Run the existing pipeline against the current trip so the new sanitizers/floors apply:

1. Call `action-save-itinerary` with the trip's existing `itinerary_data` (re-save path) — this triggers `scrubTitleLeaks`, `scrubBodyPromptLeaks`, vibe-clash downgrade with full identity strip, and meal-suffix scrub.
2. Call `action-repair-costs` for the trip — applies `EXPLICIT_DRINKS_RE` skip + `MAX_BAR_PRICE` cap with JSONB writeback (Quadri €206 → €35 cap).
3. Verify in UI: `reservationUrgency: .` gone from descriptions, "Casual neighborhood dinner" no longer attached to Da Ivo, Quadri nightcap snapshot ≤ €35.

If any survives, that becomes a real bug and we patch it; otherwise close those three.

## Step 2 — "spot for together" sentence-fragment guard

### Diagnosis
Originates in `trip-type-modifiers.ts` archetype-blending strings — e.g. `"… discovering spots together."` is a complete clause, but the blender concatenates two archetype phrases mid-sentence (`urban_nomad: "… discovering spots together."` joined with another snippet) and a downstream truncation strips the prefix. The visible artifact "spot for together" is the tail of `"romantic spot for two — sunset together"` after a join+truncate. No existing guard catches sentence integrity; only label leaks are scrubbed.

### Fix
1. Add `assertSentenceIntegrity(text)` to `_shared/prompt-leak-scrub.ts`:
   - Detect patterns: `\bfor\s+(together|two|both)\b` without a preceding noun, dangling prepositions at end of sentence (`for\.|with\.|to\.`), and `< 4 words` "sentences" delimited by periods.
   - When detected, drop just the broken sentence (split on `. `, filter, rejoin) — never the whole field.
2. Wire it into the same four call sites the existing scrubbers use: `validate-day` post-AI, `repair-day` step 10b, `action-save-itinerary` final scrub, UI `sanitizeActivityText`.
3. Add tests in `_shared/__tests__/prompt-leak-scrub.test.ts` covering "spot for together", "perfect for two together.", "ideal with for both.", and a clean control.

## Step 3 — Day 3 post-checkout sequencing collapse

### Diagnosis
The `Departure Day Graceful Finish` guard (§8b drop + §14b POST-CHECKOUT COHERENCE PRUNE in `repair-day.ts`) exists but only fires inside `repair-day`. The Rome trip slipped past because: (a) the trip has `flightOut` data on a different field key than the guard reads, OR (b) the post-checkout prune runs *before* a later step re-introduces leisure cards. Need to trace which.

### Fix
1. Read the actual `flightOut`/`departureFlight` shape persisted on the €2,272 trip and confirm `repairDepartureSequence` is reading the right field (audit `repair-day.ts` §8b key access).
2. Add a **save-time** post-checkout coherence sweep in `action-save-itinerary` (mirroring the §14b logic) — single source of truth, runs even when repair-day was skipped or partial.
3. Add sentinel log `[POST_CHECKOUT_PRUNE]` with before/after card titles + the trigger path (repair-day vs save-time).
4. Test: feed a fixture with `[breakfast → checkout 11:00 → spa 12:00 → flight 16:00]` through save-itinerary; assert spa is dropped, sequence is `breakfast → checkout → transfer → flight`.

## Step 4 — Health score 97→100 ghost reading on expand

### Diagnosis
Last turn shipped `stableIssues` soak (600ms) + raised badge threshold (`< 95`). The 97→100 jump means the **collapsed** computation differs from the **expanded** computation. Likely cause: collapsed view computes `healthScore` from `rawHealthIssues` (pre-soak), expanded view triggers a rerender that commits the soak. Both should read the same `stableIssues`.

### Fix
1. Audit `TripHealthPanel.tsx` — confirm `healthScore` is derived from `stableIssues`, not `rawHealthIssues`. (Last turn pointed `healthIssues` at `stableIssues` but didn't necessarily redirect score derivation.)
2. Single source of truth: derive `{ healthScore, healthIssues }` from a single `useMemo(stableIssues)` so collapsed/expanded see identical values.
3. Visual stability: don't recompute on `isExpanded` toggle — confirm no `useEffect` keys on `isExpanded`.
4. Test: existing `TripHealthPanel.analyzeHealth.test.ts` extended with a soak fixture asserting score+issues are identical between collapsed and expanded states.

## Step 5 — Cross-city + prompt-artifact telemetry (no rewrite)

User confirmed these aren't reproduced on recent generations. Don't blindly rewrite the prompt. Instead, add telemetry so we'll know if/when they fire again:

1. In `action-save-itinerary` final scrub, increment counters in `metadata.quality`:
   - `cross_city_strip_count` (already in some paths — make it universal)
   - `prompt_artifact_strip_count` (new — count regex-matched scrubs)
   - `sentence_integrity_drop_count` (new — from Step 2)
2. Surface these in the existing repair-log sentinel block so we can grep edge logs after each generation.
3. Add a lightweight admin view (or just a query snippet in memory) to track these counts across the next 10 generations.
4. Only if telemetry shows >0 hits in fresh generations → open a separate plan to harden the specific surviving leak path.

## Out of scope

- Rewriting the generation prompt template (no evidence it's broken on current runs).
- Adding more cross-city / artifact guards before telemetry confirms a real leak.
- Touching the 3 already-fixed bugs unless Step 1 repair pass fails to clear them.

## Files touched

- `supabase/functions/_shared/prompt-leak-scrub.ts` (sentence integrity)
- `supabase/functions/_shared/__tests__/prompt-leak-scrub.test.ts` (new fixtures)
- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` (audit §8b key access)
- `supabase/functions/generate-itinerary/action-save-itinerary.ts` (post-checkout sweep + telemetry counters + sentence-integrity scrub call)
- `src/components/trip/TripHealthPanel.tsx` (single-source healthScore derivation)
- `src/components/trip/__tests__/TripHealthPanel.analyzeHealth.test.ts` (collapsed=expanded test)
- `mem://constraints/itinerary/sentence-integrity-guard.md` (new)
- `mem://constraints/itinerary/post-checkout-save-time-sweep.md` (new)
- `mem://index.md` (two new entries + telemetry counter list)

## Operational note

Step 1 is a **runtime action**, not a code change. After Steps 2–4 ship, I'll re-run Step 1 on the €2,272 trip so the new sanitizers also apply to it.
