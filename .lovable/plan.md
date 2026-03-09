

## Fix: Itinerary Generation Quality — Arrival Sequence, User Preferences, Empty Days, Fake Flights

### Summary
Four post-generation validators and one prompt enhancement in 2 edge function files to fix critical quality bugs.

---

### Bug 1: Arrival Sequence Inverted (Hotel Check-in Before Airport)

**File:** `supabase/functions/generate-itinerary/index.ts`  
**Location:** After the departure day sequence fix block (after line ~5941), add an **arrival day sequence fix** block.

- On Day 1 when `context.flightData?.hasOutboundFlight`, find arrival/transfer/checkin activities by keyword matching
- If checkin index < arrival index, extract all three, remove from array, recalculate times based on flight arrival time, re-insert in correct order (arrival → transfer → checkin) at the beginning
- Use `context.flightData.arrivalTimeMins` or parse from `flightHotelContext` for time anchoring, default to 540 (9:00 AM)
- This mirrors the existing departure day fix pattern (lines 5871-5941) but for Day 1

### Bug 2: User Preferences Ignored (Skiing, Light Dinner)

**File:** `supabase/functions/generate-itinerary/index.ts`

Two changes:

**A. Strengthen preference injection in system prompt (line 5178-5179)**  
Wrap `preferenceContext` with explicit enforcement language:
```
🚨 USER'S EXPLICIT REQUESTS (MUST BE HONORED) 🚨
${preferenceContext}
⚠️ If the user asked for a specific activity, you MUST include it.
⚠️ If the user specified dietary preferences, respect them.
```

**B. Post-generation validation logging (after line ~5941, alongside Bug 1 fix)**  
- Extract user notes from `context.tripMetadata` or `preferenceContext`
- Check generated activities against a keyword map (skiing→ski/slopes, etc.)
- Log warnings for missing requested activities — these feed into the existing retry system via `validation.errors` or `validation.warnings`
- For dining preferences like "light dinner", warn when expensive dining ($50+) is generated

This is logging/warning only for now (not auto-retry) to avoid generation cost increases. The stronger prompt language is the primary fix.

### Bug 3: Empty Days (Only Logistics, No Real Activities)

**File:** `supabase/functions/generate-itinerary/index.ts`  
**Location:** In the validation block (around line 5974, where `validateGeneratedDay` is called)

After `validateGeneratedDay`, add a minimum **real activity** count check:
- Filter out transport, accommodation, downtime, "head to airport", transfers
- Require ≥2 real activities for non-departure days, ≥1 for departure day
- If below minimum, push an error to `validation.errors` — this triggers the existing retry loop (line 6044) which already rebuilds the prompt with error feedback

This leverages the existing retry infrastructure rather than adding a new retry mechanism.

### Bug 4: Nonsensical Inter-City Flights

**File:** `supabase/functions/generate-itinerary/prompt-library.ts`  
**Location:** In `buildTransitionDayPrompt` (line 1866), after extracting `transitionFrom`/`transitionTo`

- Add a `SAME_METRO_PAIRS` lookup (NYC↔East Rutherford/Newark/Jersey City, SF↔Oakland, LA↔Santa Monica, etc.)
- Check if origin and destination are in the same metro area
- If `tooCloseForFlight`, append to prompt: `⚠️ NEVER suggest flights between ${fromLabel} and ${toLabel} — they are in the same metro area. Only suggest ground transport.`
- Also set `defaultMode` to `'rideshare'` instead of `'flight'` when `tooCloseForFlight` is true

---

### Files Changed
| File | Changes |
|------|---------|
| `supabase/functions/generate-itinerary/index.ts` | Arrival sequence fix, preference prompt strengthening, preference validation logging, empty day validation |
| `supabase/functions/generate-itinerary/prompt-library.ts` | Same-metro flight suppression in `buildTransitionDayPrompt` |

### No Changes To
- Frontend code
- Other edge functions
- Database schema

