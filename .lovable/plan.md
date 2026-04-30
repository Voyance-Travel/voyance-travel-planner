# Audit: Structured Day Intents — what's solid, what's broken

## ✅ What's secure & correctly mapped

**`trip_day_intents` table is locked down properly.**
- RLS is enabled.
- Four scoped policies, no `USING (true)`:
  - **SELECT** — owner OR accepted collaborator (any permission tier)
  - **INSERT / UPDATE** — owner OR collaborator with `edit / admin / editor / contributor`
  - **DELETE** — owner only
- No linter findings reference this table.
- Unique index on `(trip_id, day_number, source, kind, title, locked_source)` — dedupes across re-saves.

**The four entry points all populate the table correctly when their flows run:**

```text
Entry point             →  Writer                                    →  trip_day_intents
─────────────────────────────────────────────────────────────────────────────────────────
1. Chat Planner         →  generation-core.prepareContext (seeds)    →  ✅ rows
2. Fine-Tune notes      →  generation-core.prepareContext (seeds)    →  ✅ rows
3. Manual paste/anchor  →  generation-core.prepareContext (seeds)    →  ✅ rows
4. Assistant chat       →  itinerary-chat record_user_intent         →  ✅ rows (direct)
```

**Readers downstream all consume the table:**
- `compile-prompt.ts` — primary source for Day Brief (with metadata fallback)
- `action-save-itinerary.ts` — builds the post-gen ledger from rows
- `reconcileFulfillment` — marks rows as fulfilled after save

## 🔴 Three real gaps found

### Gap 1 (highest impact) — Day-regen path skips the seeder

`action-generate-day.ts` (used by Smart Finish, regenerate-day, and assistant `rewrite_day`) **never calls `prepareContext`**. It loads the trip directly. If the table is empty for a trip — e.g. a brand-new trip that goes straight into Smart Finish, or a trip created before this migration — the day-regen reads no structured intents and silently falls back to re-parsing metadata blobs.

Result: Smart Finish and single-day regens are still partly blob-driven.

**Fix:** Extract the seeding block into a tiny shared helper `seedDayIntentsFromMetadata(supabase, trip)` in `_shared/day-intents-store.ts`, and call it at the top of:
- `prepareContext` (already there)
- `handleGenerateDay` in `action-generate-day.ts` (NEW — right after the trip is loaded)
- `enrich-manual-trip/index.ts` after it builds `userAnchors` (NEW — so manual paste flows seed before any generation runs)

Idempotent — the unique index dedupes.

### Gap 2 — `enrich-manual-trip` writes `userAnchors` but not intents

`enrich-manual-trip` (the Smart Finish entry point for pasted itineraries) builds `derivedAnchors` and writes them to `metadata.userAnchors` — but it does NOT call `intentsFromUserAnchors` + `upsertDayIntents`. So pasted itinerary anchors only become intent rows on the *next* full-trip generation, not on the immediate Smart Finish that follows the paste.

**Fix:** in `enrich-manual-trip/index.ts`, right after `derivedAnchors` is built (line ~570), add an `upsertDayIntents` call using `intentsFromUserAnchors(derivedAnchors)`.

### Gap 3 — Post-gen checker (`ledger-check.ts`) doesn't read the table

`ledger-check.ts` checks the in-memory `DayLedger` built by `compile-prompt`, which is correct for the same generation pass. But it does NOT independently re-fetch from `trip_day_intents` to verify nothing was lost between compile and save. So if compile-prompt's fetch fails (logged as non-blocking), the checker has no fallback — it'll happily pass a day that's missing a "must" intent.

**Fix:** small hardening — when `ledger.userIntent` is empty AND a tripId is available, the checker should fetch active intents directly from the table and verify any `priority='must'` row appears in the day. This is the "checker map" the user is asking for: structured rows → checker → smart-finish/regeneration all using the same source.

## 🟡 Smaller observations (not breaking, worth noting)

- **No client-side reads.** `trip_day_intents` is never queried from `src/`. That's fine for now (the AI pipeline owns it) but means there's no UI surface yet for users to *see* the captured intents per day. Out of scope for this fix.
- **No `userIntent` priority drift.** The save-itinerary path correctly preserves `must` vs `should` vs `avoid`. The compile-prompt path preserves them. Round-trip is intact.
- **`metadata.userIntents`** (legacy blob written by old assistant chat code) is still read in compile-prompt's fallback branch — kept for back-compat with trips generated before today.

## Implementation plan (after approval)

1. **Add shared helper** `seedDayIntentsFromMetadata(supabase, trip, userId)` in `supabase/functions/_shared/day-intents-store.ts`. Move the 50 lines currently inline in `generation-core.ts` into it.
2. **Update `generation-core.ts`** to call the helper instead of the inline block.
3. **Update `action-generate-day.ts`** — call the helper right after the trip is loaded, before `compilePrompt`.
4. **Update `enrich-manual-trip/index.ts`** — call `intentsFromUserAnchors(derivedAnchors)` + `upsertDayIntents` after deriving anchors.
5. **Harden `ledger-check.ts`** — accept an optional `(supabase, tripId)` and fetch active intents as a verification fallback when `ledger.userIntent` is empty for a day with `priority='must'` rows in the DB.
6. **No DB migration needed** — table, indexes, and RLS are all in place.

## Risk
Low. All changes are additive, all writes are idempotent via the unique index, all reads are non-blocking.