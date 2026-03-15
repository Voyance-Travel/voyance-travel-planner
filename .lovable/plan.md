

## "Build It Myself" — Generation, Schema & Feature Gap Audit

### Verified Working (No Gaps)

| Area | Status |
|------|--------|
| Manual builder store (localStorage + DB `creation_source`) | ✅ |
| `createTripFromParsed` — trip creation, dates, budget tier | ✅ |
| `effectiveIsPreview = false` for manual trips | ✅ |
| All days unlocked (`unlocked_day_count = N`) | ✅ |
| AI features gated (`aiLocked`) — Regenerate, Swap, Reviews hidden | ✅ |
| Credit bypass for `handleAddActivity` in manual mode | ✅ (prior fix) |
| `requestDayRegenerate` has `aiLocked` guard | ✅ (prior fix) |
| Discover button hidden when `aiLocked` | ✅ (prior fix) |
| Chat assistant hidden until Smart Finish | ✅ |
| SmartFinishBanner — gap analysis, purchase, enrichment polling | ✅ |
| Refund on Smart Finish failure | ✅ |
| DNA recalculation before enrichment | ✅ |
| Quality gate post-enrichment (activity count, HH:MM times) | ✅ |
| `$0` cost row sync preserved | ✅ (prior fix) |
| `enrich-manual-trip` research context builder | ✅ |
| `generate-itinerary` reads `mustDoActivities`, `isSmartFinish` from metadata | ✅ |
| Budget/Payments tabs functional | ✅ |
| Import Activities modal — no credit charge | ✅ |
| PDF export in manual mode | ✅ |
| Flight/hotel cascade post-booking | ✅ |
| Edge functions operational | ✅ |
| No regressions from prior fix rounds | ✅ |

---

### Gaps Found

#### GAP 1: Parsed Preferences Not Stored — Lost Before Smart Finish (MEDIUM)

`createTripFromParsed` (line 219-223) writes only `{ source, currency, lastUpdated }` to `trip.metadata`. The user's parsed preferences — `dietary`, `avoid`, `focus`, `pace`, `budgetLevel`, `rawPreferenceText` — are never stored on the trip record or in `itinerary_data`.

When Smart Finish runs, `buildResearchContext` (enrich-manual-trip line 31) checks `itinerary.preferences` but finds `undefined`. The generation engine also reads `trip.metadata.generationRules`, `trip.metadata.userConstraints`, etc. — all absent for manual trips.

The preferences ARE saved to the user's global profile (`safeUpdatePreferences` in ManualTripPasteEntry line 154-164), but that only affects future trips' DNA, not the current manual trip's generation context.

**Impact**: Smart Finish generates without the user's dietary restrictions, avoidances, focus areas, and pace preference that were extracted from their pasted research.

**Fix**: In `convertParsedToItineraryData`, include `parsed.preferences` in the returned object so `buildResearchContext` can read it. Also write key preferences (`dietary`, `pace`, `avoid`, `focus`) into `trip.metadata` in `createTripFromParsed` so the generation engine can access them directly.

**Files**: `src/utils/createTripFromParsed.ts` (lines 108-127 and 219-223)

---

#### GAP 2: `trip_cities.nights` Set to Day Count Instead of Night Count (LOW)

In `createTripFromParsed` line 241, `nights: numDaysComputed` uses `parsed.days.length` (total days). But nights = days - 1 for hotel purposes (a 3-day trip has 2 nights). This could cause hotel cost miscalculations in budget views that multiply `pricePerNight × nights`.

**Fix**: Set `nights: Math.max(1, numDaysComputed - 1)`.

**Files**: `src/utils/createTripFromParsed.ts` (line 241)

---

#### GAP 3: `itinerary_data` Missing `preferences` Field for `buildResearchContext` (LOW — Related to GAP 1)

`convertParsedToItineraryData` returns `{ days, overview, metadata }` but never includes the `preferences` object from the parsed input. The `buildResearchContext` function in `enrich-manual-trip` explicitly checks for `itinerary.preferences` (line 31) to inject dietary, focus, and pace into the AI prompt. Since it's absent, the research context block for preferences is always empty.

**Fix**: Add `preferences: parsed.preferences || undefined` to the return object in `convertParsedToItineraryData`.

**Files**: `src/utils/createTripFromParsed.ts` (line 112-127)

---

### Recommendations — Priority Order

1. **Store parsed preferences in both `itinerary_data` and `trip.metadata`** — Ensures Smart Finish generation respects user's dietary, pace, and avoidance preferences
2. **Fix `trip_cities.nights` to use `days - 1`** — Correct hotel cost calculations
3. No other changes needed — all prior fixes verified intact

### Files Involved

| Fix | Files |
|-----|-------|
| GAP 1 + 3 (preferences) | `src/utils/createTripFromParsed.ts` |
| GAP 2 (nights) | `src/utils/createTripFromParsed.ts` |

