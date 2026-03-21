

## Root Cause: "Departure Transfer to Airport" on a Multi-City Train Day

### What the screenshot shows
Rome → Florence trip. Last day in Rome shows "Departure Transfer to Airport · 45 minutes" even though the user selected **Train** to Florence in Step 2. The "UP NEXT" card below correctly says "🚅 Train to Florence."

---

### The logic gap — two code paths, one blind spot

The engine has **two generation paths**. The bug behavior differs depending on which path ran:

#### Path A: Full generation (`generate-trip`, lines 1503-7200)
- **Lines 1953-1963**: When `dayCity.isLastDayInCity`, it builds a `multiCityPrompt` saying "tomorrow the traveler takes a TRAIN to Florence" and "DO NOT mention airports." This is correct.
- **Lines 2678-2700**: Post-processing strips airport activities when `isLastDayInCity && nextLegTransport !== 'flight'`. Also correct.
- **BUT** the departure day constraint block at **line 8148** (`else if (isLastDay)`) only fires when `dayNumber === totalDays` — i.e., the absolute last day of the entire trip. For a mid-trip city departure (last day in Rome, but not last day of the trip), this block is **skipped entirely**. The farewell prompts at lines 8417-8532 never fire for mid-trip departures.
- Instead, it falls through to a **standard day** with the `multiCityPrompt` appended. The multi-city boundary constraint at **line 8548** (`paramIsLastDayInCity && !isLastDay`) does add checkout/farewell/transport instructions, but **only as an append** — the base `dayConstraints` was set for a standard day, not a departure day. The AI gets conflicting signals.

#### Path B: Single-day generation (`generate-day`, lines 7202-11000)
- **Line 7837**: `isLastDay = dayNumber === totalDays`. For mid-trip city departures, `isLastDay = false`.
- **Line 8148**: The departure day block is gated on `isLastDay`. So **mid-trip city departures get zero departure-day constraints** — no checkout timeline, no farewell meal, no departure transfer.
- The only departure guidance comes from the multi-city boundary append at **line 8548**, which adds checkout + transport instructions. But the core prompt template treats this as a normal sightseeing day with a checkout note tacked on.
- **Lines 10911-10928**: Post-processing strips airport references, but the AI's generated "Departure Transfer to Airport" uses the exact title. The strip filter at line 10915-10921 checks for `airport` in the title — so **this should catch it**. If it didn't, the strip filter isn't running (meaning `paramIsLastDayInCity` or `resolvedNextLegTransport` isn't set correctly from the frontend call).

### The actual root cause (most likely)

**The frontend calling `generate-day` doesn't pass `isLastDayInCity: true` or passes it but doesn't pass the transport type.** Let me check:

The `itineraryAPI.ts` `buildDayCityMap` at line 201-251 correctly computes `isDepartureDay` and `departureTransportType`. But the question is: **does the frontend pass these as `isLastDayInCity` and the transport type to the edge function?**

Looking at `resolvedNextLegTransport` initialization at line 7353: it starts as `''`. It's only populated if `tripId && !resolvedIsTransitionDay` (line 7360) — meaning the DB query runs and finds the next city. **This should work** if the trip_cities table has the correct `transport_type`.

So the real gap is: **even when all the data flows correctly, mid-trip departure days don't get the departure-day prompt template** (lines 8148-8532). They get a standard day template with a multi-city checkout append. The AI sees "plan a full day" as the primary instruction and "also do checkout and train transfer" as a footnote — and the AI prioritizes the primary instruction, sometimes hallucinating airport transfers because "departure day = airport" is deeply baked into LLM training data.

### Summary of root causes

| # | Issue | Severity |
|---|-------|----------|
| 1 | The departure-day prompt block (line 8148) is gated on `isLastDay` (absolute last day of trip) — mid-trip city departures never enter it | HIGH |
| 2 | Mid-trip departures rely on a multi-city append (line 8548) that adds checkout/transport as a footnote to a standard-day template — weak signal to the AI | HIGH |
| 3 | The no-flight farewell enrichment (lines 8417-8532) with train/bus/ferry-aware departure labels only fires for `isLastDay` — never for mid-trip transitions | MEDIUM |
| 4 | Post-processing airport strip (lines 10911-10928) is a safety net but depends on `paramIsLastDayInCity` being set — if the frontend doesn't pass it, the strip doesn't run | MEDIUM |
| 5 | The `day-validation.ts` at line 491-520 looks for "airport" or "departure transfer" — it doesn't validate that the departure mode matches the user's selected transport | LOW |

### What needs fixing (for the follow-up plan)
The departure-day prompt block needs to fire for **any** last-day-in-city, not just the absolute last day of the trip. When `isLastDayInCity && !isLastDay`, it should use the train/bus/ferry/car-specific departure template instead of defaulting to airport. The multi-city append should become the **primary** constraint, not a footnote.

