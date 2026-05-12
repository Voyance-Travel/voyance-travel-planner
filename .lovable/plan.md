# Why the itinerary keeps changing after a hard refresh

The recent edge-function logs for trip `fad3f87f-…` show two distinct, independent bugs in the **save-itinerary** path. Both fire on every save, including the silent self-heal save the UI triggers after a hard refresh, so what you see after refresh is **not** what was on screen before refresh.

## Bug A — Every save is rolling back with a Postgres enum error (P0)

```
[save-itinerary] trips.update failed: invalid input value for enum
itinerary_status: "needs_regeneration"
[save-itinerary] Failed: …  (returns 500)
```

`action-save-itinerary.ts` (line 1068) writes:
```ts
itinerary_status: emptyItineraryDetected ? 'failed'
                : (persistVerdict.ok ? 'ready' : 'needs_regeneration')
```

But the DB enum only contains: `not_started, queued, generating, partial, ready, failed`. There is no `needs_regeneration` value, so **the entire trip update is rejected by Postgres**.

Because the update rolls back but earlier side-effects in the same handler (activity_costs sync, normalized-table sync, ledger writes) can already have landed, the on-disk state diverges from what the UI just rendered. On the next read (refresh) the UI rebuilds from a partially-mutated database — prices change, activities disappear.

**Fix:** map the not-ok branch to the existing enum value `'partial'` (semantically correct: persist gate didn't pass, plan still usable). One-line change in `action-save-itinerary.ts`.

## Bug B — `needsVenuePick` meal sentinels are dropped by the persist-day contract (P1)

Same logs, same save:
```
[MEAL_PERSIST_FAIL] day=1 missing=[breakfast,lunch,dinner] dest="Aruba"
  — injecting preserveAsManualPick sentinels
[CONTRACT_VIOLATION] day=1 reason=placeholder-name
  title="Lunch — find a local spot in Aruba"   (× 15 rows)
[CONTRACT_VIOLATION] persist-day contract dropped 17 row(s)
```

Flow:
1. Meal guard can't find a vetted Aruba breakfast/lunch/dinner venue, so it intentionally emits `preserveAsManualPick` "find a local spot" sentinels — these are user-visible "tap to pick a place" cards by design.
2. `ledger-check` correctly exempts them (`meal-recurrence exempted`).
3. Then `enforcePersistDayContract` matches their title against `PLACEHOLDER_NAME_RE` and drops them as `placeholder-name`, with no allowlist for the sentinel flag.

Net effect: the trip is saved with **3 fewer meal cards per day than the UI just rendered**. After refresh those slots are gone. Combined with Bug A, sometimes those drops persist (when the cost-sync side-effects landed before the trips.update rollback) and sometimes they don't, which is why this looks random.

**Fix:** in `enforcePersistDayContract` (`supabase/functions/_shared/persist-day-contract.ts`), allowlist rows where `preserveAsManualPick === true` OR `needsVenuePick === true` OR `source === 'needs_venue_pick'` — same idea as the existing `late_nightlife_bookend` allowlist 10 lines above. These are deliberate, user-actionable placeholders, not leaked prompt prose.

## Plan

1. **`action-save-itinerary.ts`** — change `'needs_regeneration'` → `'partial'`. Add a brief comment so this doesn't regress.
2. **`persist-day-contract.ts`** — in the `placeholder-name` branch (line 156), `continue;` past the drop when the row is a `preserveAsManualPick` / `needsVenuePick` sentinel. Mirror it in the cross-city sweep below so we don't drop them there either.
3. **Sentinel logging** — keep `[MEAL_PERSIST_FAIL]` and add a one-line `[SENTINEL_KEPT]` info log so we can see in future logs that the sentinels actually survived to disk.
4. **Regression coverage** — add two cases to `persist-day-contract.test.ts`:
   - `preserveAsManualPick: true` row with placeholder title → kept (not dropped)
   - same row without the flag → dropped (existing behavior preserved)
5. **Verify** — run `bunx vitest run supabase/functions/_shared/persist-day-contract.test.ts`, then ask you to redo the action that triggered today's logs and re-check edge logs for: no `22P02` enum error, no `placeholder-name` drops on the meal sentinels, and `BOOKEND_VERIFY_SUMMARY missing=0` (currently `missing=1` because Day 1's bookend gets injected only at persist time after the save 500's).

## Out of scope (intentionally not touching this round)

- Parser / read-time bookend / EditorialItinerary cleanup we just shipped — not implicated by these logs.
- The DESC_FILL day=2 abort (separate Gemini timeout; only blanks descriptions, doesn't move/remove cards).
- Meal-guard fallback DB coverage for Aruba (the reason there are no vetted venues to begin with) — separate, follow-up task.
