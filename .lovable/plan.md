## Issue 5 — Departure Day "Floating Dining Card" Bug

### Root cause (Casablanca trip `fce9c4ba…`, Day 4, dep 15:05)

Confirmed in production data:
- Departure flight = **15:05 (3:05 PM)** → policy should be `afternoon_departure` → **breakfast only** (per Core memory).
- Cached `metadata.quality.meal_policy_at_generation` says `dayMode: midday_departure`, `requiredMeals: [breakfast, lunch]`. This was generated when the system did **not** yet know `departureTime24`, so `deriveMealPolicy` fell into the "No departure time → midday_departure + [breakfast, lunch]" branch (`meal-policy.ts:211`).
- `action-save-itinerary.ts:710` and `:710` (Step 2 + Step 2.6 invariant) both **prefer the cached policy** over a fresh re-derive whenever `cached.requiredMeals` is an array. So even though save-itinerary now knows the real flight time, it injects a `Lunch — find a local spot in Casablanca` sentinel (12:30–13:30) per the stale policy. The card is the "floating Basmane-style" placeholder the user is seeing.
- `enforceDepartureDayLogistics` (`repair-day.ts §15z`) — the function that drops untimed dining and any non-logistics card past the airport-transfer cutoff — is **only called from `repair-day.ts`**. It is **never invoked from `action-save-itinerary.ts`**. So save-time meal-guard injections are not policed by §15z.

The two failures combine to persist a dining card on departure day even when the flight time clearly forbids it.

### Fix

Three small, surgical changes in the save path. No prompt or generator changes.

#### 1. Re-derive meal policy on save when cache is stale (`action-save-itinerary.ts`)

In **STEP 2** (~line 710-720) and **STEP 2.6 invariant** (~line 710-720), stop blindly preferring `cachedPolicy`. New rule:

- Always compute `freshPolicy = deriveMealPolicy({...isLastDay, departureTime24: savedDepartureTime24, isFirstDay, arrivalTime24: savedArrivalTime24})`.
- If `cachedPolicy.requiredMeals` and `freshPolicy.requiredMeals` disagree on a departure day **and** `savedDepartureTime24` is known, **trust fresh**, log `[MEAL_POLICY_REDERIVE] day=N reason=stale_cache cached=[…] fresh=[…] depTime=hh:mm`, and stamp the new policy back onto `metadata.quality.meal_policy_at_generation` so subsequent reads are consistent.
- Same logic for arrival days when `savedArrivalTime24` is known and conflicts with cached.

Result: Casablanca Day 4 re-derives to `afternoon_departure` / `[breakfast]`, lunch is no longer "missing", no sentinel injected.

#### 2. Run §15z as a save-time safety net (`action-save-itinerary.ts`)

After STEP 2.6 (meal-persist invariant) and before STEP 2.9 (timing-conflict sweep), add **STEP 2.65: DEPARTURE-DAY LOGISTICS NET**:

- For each `isLastDay` (or `isFirstDay` for arrival mirror — out of scope here, last day only), call `enforceDepartureDayLogistics({activities: day.activities, dayNumber, hotelName, hotelAddress, returnDepartureTime24: savedDepartureTime24, isLastDay: true, airportTransferMinutes: <derived>, lockedIds})`.
- Replace `day.activities` with the result; merge `repairs` into `metadata.quality.save_time_departure_repairs`.
- Sentinel: `[SAVE_DEPARTURE_NET] day=N dropped=K retimed_checkout=… retimed_transfer=…`.

This is the **catch-all**: even if a future code path (manual edit, undo/redo, chat-action, optimistic patch, or a meal-guard regression) adds an untimed or post-cutoff dining card, it gets pruned at the persist boundary.

#### 3. Test coverage

New test file `supabase/functions/generate-itinerary/__tests__/save-itinerary-departure-day.test.ts`:
- **Case A — stale cache on afternoon departure**: cached policy `[breakfast, lunch]` + `depTime=15:05` → meal-guard does NOT inject lunch (re-derive wins).
- **Case B — §15z save-time net**: feed a day with a manually-added untimed `Lunch: Bistro X` card + flight 15:00 → after save-itinerary normalizeDays, the card is gone; `repairs` records `final_enforce_dropped_untimed_dining`.
- **Case C — early-departure day**: dep 09:00, cached `midday_departure` → re-derive flips to `early_departure` + `[]`; existing breakfast preserved, no sentinels injected.

#### 4. Memory

Add `mem://constraints/itinerary/departure-day-save-time-enforcement`:
> On save, departure-day meal policy is re-derived from `savedDepartureTime24` and overrides any stale cached `meal_policy_at_generation`. `enforceDepartureDayLogistics` (§15z) runs as a final safety net at `action-save-itinerary` STEP 2.65 — drops untimed dining + post-cutoff non-logistics cards regardless of which upstream code added them.

Add to Core index: bullet under existing "Believable Human Day" or as a new `**Departure Day Save-Time Net:**` entry.

### Out of scope

- Why `itinerary_activities` table for this trip has 8 duplicate "Travel to Marriott" rows + 2 duplicate Checkouts (separate write-path audit; orthogonal to the floating-dining bug).
- Sparse-resync rebuild from tables (already covered in prior round).
- Any prompt/generation-time changes — the save-time net subsumes them for this class of bug.

### Files touched

- `supabase/functions/generate-itinerary/action-save-itinerary.ts` (STEP 2 + 2.6 re-derive logic; new STEP 2.65)
- `supabase/functions/generate-itinerary/__tests__/save-itinerary-departure-day.test.ts` (new)
- `mem://constraints/itinerary/departure-day-save-time-enforcement` (new)
- `mem://index.md` (one Core line + one reference line)
