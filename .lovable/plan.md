

## "Build It Myself" Itinerary — Full End-to-End Audit

### Pipeline Traced

```text
UnlockBanner "I'll build it myself" / UpgradePrompt "I'll build it myself"
→ enableManualBuilder(tripId) in localStorage
→ OR: Start.tsx "Just Tell Us" → parse-travel-story → createTripFromParsed()
  → trip insert (creation_source: 'manual_paste', unlocked_day_count: N)
  → enableManualBuilder(tripId) in localStorage
→ TripDetail detects isManualMode
→ EditorialItinerary receives creationSource='manual_paste'
  → isManualMode = true (localStorage OR creation_source check)
  → effectiveIsPreview = false (manual overrides preview)
  → aiLocked = true (until Smart Finish purchased)
→ User edits: Add/Remove/Reorder/Edit activities freely
→ SmartFinishBanner: gap analysis → purchase → enrich-manual-trip
  → generate-itinerary with user research context
  → Quality gate → aiLocked = false, all features unlocked
```

### Working Well

| Area | Status |
|------|--------|
| Manual builder store (localStorage persistence with Set serialization) | ✅ |
| `createTripFromParsed` — parsed trip creation with correct schema | ✅ |
| `isManualMode` dual check (localStorage + `creation_source` DB field) | ✅ |
| `effectiveIsPreview = false` for manual trips (full editing access) | ✅ |
| All days unlocked (`unlocked_day_count = N`) on manual trips | ✅ |
| AI features gated (`aiLocked`) — Regenerate, Swap, Reviews hidden | ✅ |
| Chat assistant hidden in manual mode until Smart Finish | ✅ |
| SmartFinishBanner — gap analysis, purchase, enrichment with polling | ✅ |
| Guaranteed refund on Smart Finish failure | ✅ |
| Smart Finish retry flow with re-charge | ✅ |
| DNA recalculation before enrichment (if traits missing) | ✅ |
| Quality gate post-enrichment (activity count, coverage) | ✅ |
| Activity removal — no credit charge (correct) | ✅ |
| Activity reorder/drag — no credit charge (correct) | ✅ |
| Time editing — no credit charge (correct) | ✅ |
| Cost sync ($0 fix from prior round in place) | ✅ |
| PDF export enabled in manual mode | ✅ |
| Share/Collaboration works in manual mode | ✅ |
| Currency inference from destination | ✅ |
| Option group collapsing (first option only) | ✅ |
| `trip_cities` row created for manual trips | ✅ |
| Budget display and command center visible | ✅ |
| Edge functions (`analyze-trip-gaps`, `enrich-manual-trip`) operational | ✅ |

### Gaps Found

#### **GAP 1: `handleAddActivity` Charges Credits in Manual Mode (MEDIUM)**

In `EditorialItinerary.tsx` line 3912-3930, `handleAddActivity` always calls `spendCredits.mutateAsync({ action: 'ADD_ACTIVITY' })` before inserting the activity. If the credit call fails (e.g., user has 0 credits), the function returns early and the activity is **not added**. There is no `isManualMode` bypass.

For manual-paste trips, the user is supposed to have full editing freedom — they're building their own itinerary from scratch. Charging credits to add activities to your own pasted research makes no product sense and blocks zero-credit users from using the manual builder.

The server-side `spend-credits` function does have free caps (2 adds for free tier), so the first 2 adds would succeed. But after that, manual builder users would be blocked unless they buy credits — defeating the purpose of "I'll build it myself."

**Fix**: Skip the `spendCredits` call when `isManualMode && !smartFinishPurchased` (i.e., the user hasn't upgraded to AI features). After Smart Finish is purchased, credit charging for adds is appropriate since the trip is now AI-enhanced.

**Files**: `src/components/itinerary/EditorialItinerary.tsx` (line 3912-3930)

---

#### **GAP 2: Discover Drawer Available in Manual Mode But Triggers Credit Charge (LOW)**

The Discover button (`onDiscover`) is not gated by `aiLocked`. A manual builder user can open the Discover drawer, browse AI-generated suggestions, and click to add one — which triggers `handleAddActivity` with its credit charge. The Discover drawer itself calls an AI endpoint to generate suggestions, which works correctly but is inconsistent with the "build it myself" philosophy.

This isn't blocking (Discover results still render), but adding from Discover hits the credit wall from GAP 1. After fixing GAP 1, this becomes a non-issue since adds would be free in manual mode.

**Fix**: After GAP 1 is fixed, this resolves itself. Optionally, hide the Discover button when `aiLocked` for a cleaner UX (manual builders are curating their own research, not discovering AI picks).

**Files**: `src/components/itinerary/EditorialItinerary.tsx` (DayCard toolbar)

---

#### **GAP 3: `handleDayRegenerate` Not Gated by `aiLocked` in Callback (LOW — UI Already Hides It)**

The Regenerate Day button is correctly hidden by `{!aiLocked && (...)}` in both desktop and mobile menus. However, the `handleDayRegenerate` callback itself has no `aiLocked` guard. If a code path or keyboard shortcut were to invoke it directly, it would attempt AI regeneration on a manual trip with no AI context, likely producing poor results.

This is defense-in-depth only — the UI already prevents access. No user-facing impact.

**Fix**: Add early return `if (aiLocked) return;` at the top of `handleDayRegenerate`.

**Files**: `src/components/itinerary/EditorialItinerary.tsx`

---

### Verified Working (No Gaps)

- **Flight/Hotel before generation**: Manual trips set `unlocked_day_count = N`, so `AddBookingInline` works normally. Flight cascade (from prior fix round) fires correctly post-save.
- **Flight/Hotel after Smart Finish**: Once `smart_finish_purchased = true`, `aiLocked = false`, all AI features unlock, cascades work.
- **Time handling**: Manual activities use `startTime`/`endTime` from parsed input. After Smart Finish, the edge function applies full schema compilation with slot-based timing.
- **Budget/Payments tabs**: Fully functional in manual mode. Cost sync runs on every edit. Budget command center visible.
- **Chat editing**: Correctly hidden when `isManualMode && !smart_finish_purchased`. Appears after Smart Finish.
- **Import Activities modal**: Works in manual mode (no AI dependency).
- **Edge functions**: `analyze-trip-gaps` and `enrich-manual-trip` both operational with proper error handling and refund logic.
- **No regressions** from prior fix rounds (cost sync $0, booking-changed event, optimistic saves, metadata merge all intact).

### Recommendations — Priority Order

1. **Skip credit charge for `handleAddActivity` in manual mode** — Core manual builder UX fix
2. **Add `aiLocked` guard to `handleDayRegenerate`** — Defense-in-depth
3. **(Optional) Hide Discover button when `aiLocked`** — Cleaner UX

### Files Involved

| Fix | Files |
|-----|-------|
| GAP 1 (credit bypass) | `src/components/itinerary/EditorialItinerary.tsx` (line 3912-3930) |
| GAP 3 (regen guard) | `src/components/itinerary/EditorialItinerary.tsx` (handleDayRegenerate) |

