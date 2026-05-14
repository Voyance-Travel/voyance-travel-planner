## No-Op: `isLastDay` guard already present around save-time `runStep8`

### Finding
The user's request assumes `runStep8(acts, dayNumber - 1, savedHotelName)` is called unconditionally at line 504 of `supabase/functions/generate-itinerary/action-save-itinerary.ts`. That is not the current state of the file.

The actual save-time call site is at **line 677**, and it is already wrapped in the exact guard the request is asking me to add:

```ts
// Line 668
if (!isLastDay && Array.isArray(itineraryDays[i].activities) && itineraryDays[i].activities.length > 0) {
  const acts = itineraryDays[i].activities;
  // ...comments about idempotency...
  try {
    const { runStep8 } = await import('./universal-quality-pass.ts');   // line 675
    const _beforeLen = acts.length;
    runStep8(acts, dayNumber - 1, savedHotelName);                      // line 677
    // ...
  }
}
```

`isLastDay` is bound at line 660 from the day-loop and is `true` exactly when `dayNumber === totalDays`, which is functionally equivalent to the requested `if (dayNumber < totalDays)` check. The comment at line 667 even spells out: *"Skip departure day; idempotent via runStep8's own guard."*

The only other reference to `runStep8` in this file is line 238 (a comment about it). There is no second, unguarded call site.

### Conclusion
No code change to make. Applying the requested edit would either:
- Fail (the literal "around 502-504" lines don't contain `runStep8`), or
- If forced near line 677, double-wrap an existing guard with a redundant condition and add a misleading comment claiming we just added the guard.

### What I recommend instead
If departure-day "wind down (overnight)" cards are still reproducing on Osaka / Amsterdam / Sapporo / Budapest, the leak is **not** at this save-time call. Likely candidates worth investigating before patching:

1. **`pruneOrphanLateNightlifeBookend`** at line 240 (just-shipped) — confirm it actually drops the stale 00:30 bookend on departure day, not just on Day 2 reload.
2. **`stripPreDawnHotelReturns`** + the `late_nightlife_bookend` source allowlist — a departure-day bookend tagged with that source would be exempt.
3. **`ensureHotelReturnBookend`** read-time injector (`src/lib/itinerary/`) — check that all 5 departure signals (flight / airport-transfer / transfer-to-airport / hotel-checkout / last-day-fallback) actually fire for the affected trips. Per-memory `[Departure-Day Hotel-Return Strip]`: parser Step 4b-pre + EditorialItinerary `__syntheticDeparture` + `__syntheticFinalDeparture` are the three layers that should kill it on display — verify their detector matches the persisted card shape.
4. **`generation-core.ts` Stage 6 / `action-generate-trip-day` chain final** — these also call `runStep8`; if either is missing the `isLastDay` guard, that's the real source for fresh-generated trips.

### Action
Awaiting your direction. Either:
- (a) Confirm "no change, the guard is already there" and we close this ticket; or
- (b) Point me at the actual reproducing trip ID / day so I can trace which of (1)–(4) is the real culprit.