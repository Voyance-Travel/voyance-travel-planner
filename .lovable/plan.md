# Late-night strenuous-activity guard (10:50 PM Kayak → 38m walk to JW Marriott)

## What the user sees

Day shows:
- Dinner ends ~22:00
- **Kayak 22:50 → 23:35**
- **Walk to JW Marriott 23:50 (38 min)**

Two problems stacked:
1. A physically demanding outdoor activity scheduled after dinner, ending at 23:35.
2. The hotel return is a 38-minute walk starting 23:50 — finishing well past midnight after exertion. For Venice + a JW Marriott (Isola delle Rose) guest, this is implausible (no bridge from the Lido / no late vaporetto path that fits) and clashes with the luxury tier.

## Root cause

There is **no pacing rule** in the pipeline that prevents strenuous physical activities (kayak, SUP, cycling, hiking, running, climbing, surf, jet-ski) from being scheduled after dinner or late at night:

- `pipeline/repair-day.ts` has a `NIGHTCAP_SWAP` (lines 1236–1267) that only handles bars/cocktails/digestif — no concept of physical activities.
- `universal-quality-pass.ts:runStep8` only injects the hotel-return card; it doesn't validate the previous activity's category/intensity, so a 22:50 kayak just slides through and the system happily appends "walk back to hotel."
- The transit estimator picks "walk" because the haversine is under the 1200 m threshold or the calling site never asked for a transit upgrade for late-night legs (Venice JW Marriott specifically requires a hotel shuttle boat).
- The generator prompt has no "no strenuous activities after 21:00" line, so the model freely schedules sunset/night kayak sessions.

## Fix — three small, focused layers

### Layer 1 — Repair-day: late-night strenuous swap

In `supabase/functions/generate-itinerary/pipeline/repair-day.ts`, add a new step after the existing `NIGHTCAP_SWAP` (~line 1267):

```text
5a-post-2. STRENUOUS_NIGHT_SWAP
  - Detect activity matching STRENUOUS_RE
    (kayak|paddle ?board|SUP|canoe|cycling|bike (?:tour|ride)|hike|hiking|trek|run(?:ning)?|jog|climb(?:ing)?|surf|jet ?ski|wakeboard|windsurf|kitesurf|rafting)
  - Trigger when startMins >= 21:00 (or after dinner end, whichever is earlier)
    AND the activity is not user/manual/locked/extracted/pinned
  - Action priority:
      a. If a free daytime slot 14:00–18:30 exists with ≥ duration available: move it there.
      b. Else: tag for replacement by terminal-pass with a non-strenuous evening alternative
         (sunset cruise, gondola serenade, rooftop bar, opera, jazz lounge — drawn from
         existing fallback pool used for nightcap / aperitivo).
      c. Drop entirely if the trip's archetype is not "Adrenaline Architect" AND no
         alternative is available; let the meal-guard / hotel-return path resume.
  - Log `[Repair] STRENUOUS_NIGHT_SWAP` and push a `repairs.push({ action: 'strenuous_moved_or_replaced', ... })`.
```

### Layer 2 — Hotel-return injection sanity check

In `universal-quality-pass.ts:runStep8` (line 81), before injecting the return card:

- If `lastActivity.endTime > 22:30` AND the hotel is on an island/water-access location
  (detect via known luxury-Venice hotel allowlist: JW Marriott Venice Resort & Spa,
  Cipriani, San Clemente, Kempinski Isola delle Rose) OR the haversine to hotel
  exceeds the existing walk threshold → set the return card's `transport_mode` to
  `taxi` / `water_taxi` (Venice) / `taxi` (default) and label it
  `"Private water taxi to {hotel}"` instead of `"Walk to {hotel}"`.
- Use the existing transit estimator's "force motorized" path so duration recomputes (15–25 min for Venice water taxi vs 38-min walk).
- Sentinel log: `[QUALITY] Late-night return upgraded to {mode} for {hotel}`.

### Layer 3 — Prompt rule

In `supabase/functions/generate-itinerary/believable-human-day.ts` (or wherever pacing rules live — the same file that holds the "midday freshen up" rule):

- Add: `EVENING PACING: After dinner (post-21:00), only low-intensity activities are allowed — bars, lounges, opera, gondola/cruise, walking promenade. NEVER schedule kayak, SUP, cycling tours, hiking, running, climbing, or other strenuous outdoor activities after 21:00.`
- For luxury / luminary tiers (`budgetTier in {luxury, luminary}`), tighten to 20:00 and add: `Late-night returns must use private/water taxi when applicable (Venice, lakeside resorts, island hotels) — never schedule a 30+ minute walk after 22:00.`

### Files to edit

- `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — add `STRENUOUS_NIGHT_SWAP` after `NIGHTCAP_SWAP`. Define `STRENUOUS_RE`. Reuse existing `lockedIds` set + repairs sink.
- `supabase/functions/generate-itinerary/universal-quality-pass.ts` — extend `runStep8` to choose transport mode based on hotel location + last-activity end time. Small allowlist of Venice island resorts + a generic "long walk after late activity" upgrade rule.
- `supabase/functions/generate-itinerary/believable-human-day.ts` (or the pacing-prompt builder) — add the post-21:00 / luxury post-20:00 evening pacing line; add the late-walk transit rule.
- New test: `supabase/functions/generate-itinerary/pipeline/__tests__/repair-day.strenuous-night.test.ts`
  - 22:50 kayak with 14:00–17:00 free slot → moved to 14:00.
  - 22:50 kayak with no daytime slot, archetype = Romance Curator → replaced by sunset/lounge fallback.
  - 22:50 kayak that is `locked: true` / `manualEdit: true` → untouched (universal-locking).
- New test: `supabase/functions/generate-itinerary/__tests__/runStep8.late-night-walk.test.ts`
  - Last activity ends 23:35 + JW Marriott → return card uses `transport_mode: water_taxi`.
  - Last activity ends 18:30 → unchanged (current walk path keeps working).

### Memory

Add `mem://constraints/itinerary/no-strenuous-after-dinner`:
- `STRENUOUS_RE` (kayak / SUP / cycling tour / hike / run / climb / surf / jet-ski / windsurf / kitesurf / wakeboard / rafting) MUST NOT start after 21:00 (general) or 20:00 (luxury/luminary).
- Repair-day `STRENUOUS_NIGHT_SWAP` moves to 14:00–18:30 daytime slot, else replaces with low-intensity evening alternative, else drops.
- Universal-quality-pass `runStep8` upgrades >22:30 hotel-return to taxi / water-taxi for island resorts (Venice JW Marriott, Cipriani, San Clemente, Kempinski Isola).
- Sentinel: `repair.action='strenuous_moved_or_replaced'`, log `[QUALITY] Late-night return upgraded`.

Update `mem://index.md` Core with one-liner:
"Evening Pacing: No strenuous outdoor (kayak/SUP/hike/cycling/run/climb/surf/jet-ski) after 21:00 (20:00 luxury). Late-night returns from island/water hotels upgrade to taxi/water-taxi via runStep8."

## Out of scope (intentionally not changing)

- The transit estimator's overall walk/transit thresholds — only the late-night + island-hotel branch gets upgraded; daytime walks remain as-is.
- The kayak fallback pool composition — we reuse the existing nightcap/aperitivo/sunset-cruise pool already wired into the meal-guard.
- User-locked / manual / extracted / pinned activities — universal-locking exemption applies (existing pattern).
