

## Fix: "Transfer to Airport" on last day in city when next leg is train

**Problem**: When the last day in Rome is generated, the CITY DEPARTURE prompt (line 7764-7770 of `generate-itinerary/index.ts`) tells the AI "the traveler leaves this city tomorrow" but never specifies **how** (train, bus, car, etc.). The AI defaults to "Transfer to Airport" even when the user selected a train to Florence.

**Root cause**: Two locations generate the "checkout day" prompt — line 7764 and line 1915 — and neither includes the transport mode to the next city. The `multiCityDayMap` stores transport info on the **transition day entry** (the next day), but the current day's generation never looks ahead to find it.

### Changes in `supabase/functions/generate-itinerary/index.ts`

**1. Line ~7764 (CITY DEPARTURE prompt in generate-day handler)**

Look ahead in `multiCityDayMap` or `trip_cities` to find the next city's `transportType`. Inject it into the prompt:

```
🏨 CITY DEPARTURE — CHECKOUT DAY:
- This is the LAST DAY in Rome. Tomorrow the traveler takes a TRAIN to Florence.
- ⚠️ DO NOT mention airports or flights. The next leg is by TRAIN.
- REQUIRED: Include "Hotel Checkout" activity in the morning (typically by 11:00 AM).
- DO NOT include "Transfer to Airport" or any airport-related activities.
- Plan morning activities around checkout. Luggage storage may be needed.
```

To get the next city's transport, query `trip_cities` ordered by `city_order` and find the city after `destination`. The transport_type on that next city row tells us the mode.

**2. Line ~1915 (multi-city prompt in full generation)**

Same fix — look at the next entry in `context.multiCityDayMap` to get `transportType` and inject "departs by TRAIN/BUS/CAR" into the checkout day prompt. Add an explicit "DO NOT mention airports" when transport is not flight.

### Implementation detail

In the generate-day handler (~line 7764), the trip_cities data is already queried earlier (~line 6610). We need to pass the resolved next-city transport mode down. The simplest approach:

- When resolving the day's city context in the loop (line 6619-6656), also check if this day is `isLastDayInCity` and if so, capture the **next** city's `transport_type` into a variable like `resolvedNextLegTransport`.
- Use that variable at line 7764 to enrich the CITY DEPARTURE prompt with mode-specific language and an explicit prohibition against airport references when the mode isn't flight.

For the full-generation path (line 1915), iterate `context.multiCityDayMap` to find the next transition entry after the current day and extract its `transportType`.

**Files to edit**: `supabase/functions/generate-itinerary/index.ts` (two locations)

