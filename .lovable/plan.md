# Fix: "Just Tell Us" chat ignores user-specified transport mode (defaults to flight)

## The Bug

When a user chats in "Just Tell Us" and says e.g. "we'll take the train between cities", the resulting multi-city trip still shows **Flight** between every leg.

Root cause is a structural gap in the chat-trip-planner extraction tool — the inter-city transport mode is never captured, so it can never be saved.

## What I Verified in Code

1. `supabase/functions/chat-trip-planner/index.ts` exposes a structured `cities[]` tool schema (`name`, `country`, `nights`, `hotelName`) but has **no field** for the transport mode between cities, and no top-level field like `cityTransports[]`. The word "train" only ever lands in free-text `additionalNotes` / `mustDoActivities`, which the multi-city builder ignores.

2. `src/pages/Start.tsx` (line 3017) inserts `trip_cities.transport_type` from `details.cityTransports?.[idx - 1]` — but `details.cityTransports` is **never populated** by the chat function, so every row gets `transport_type: null`.

3. With `transport_type` null, downstream defaults take over:
   - `src/services/cascadeTransportToItinerary.ts:474` → `'flight'`
   - `supabase/functions/generate-itinerary/generation-core.ts:419, 465` → `'flight'` for cross-country, `'train'` only for same-country
   - `pipeline/compile-day-facts.ts:160` → same fallback
   
   That's why every leg renders as a flight.

## The Fix

### 1. `supabase/functions/chat-trip-planner/index.ts`
Add a `transportFromPrevious` field to each item in the `cities[]` tool schema:

```ts
transportFromPrevious: {
  type: "string",
  enum: ["flight", "train", "bus", "car", "ferry"],
  description: "How the traveler gets to THIS city from the previous city in the route. Omit for the first city. Infer from user statements like 'we'll take the train', 'driving between', 'flying to', 'ferry to'. If not stated, omit (system will pick a sensible default)."
}
```

Add explicit prompt rules in the system instructions (around lines 113–137 where multi-city rules live):
- "If the user mentions ANY mode of transport between cities (train, flight, drive, bus, ferry), set `transportFromPrevious` on each downstream city accordingly."
- "If the user says 'train through Europe' or 'we'll train between cities', apply `train` to every city after the first."
- "Never silently drop a stated transport mode — capture it on every applicable leg."

### 2. `src/pages/Start.tsx` (chat → trip_cities insert, ~line 3017)
Replace the `details.cityTransports?.[idx - 1]` lookup with the per-city value coming from the new schema:

```ts
transport_type: idx > 0
  ? (chatCities[idx]?.transportFromPrevious
     || details.cityTransports?.[idx - 1]   // keep old fallback for safety
     || null)
  : null,
```

Also widen the `chatCities` typing so `transportFromPrevious?: 'flight'|'train'|'bus'|'car'|'ferry'` flows through. Search for where `chatCities` state is set from the tool-call result and pass the field through.

### 3. (Optional safety net) `supabase/functions/chat-trip-planner/index.ts`
After the tool call returns, if `cities[i].transportFromPrevious` is missing, do a lightweight regex sniff over the original conversation text for `\b(train|flight|fly|drive|bus|ferry|car)\b` between mentions of `cities[i-1].name` and `cities[i].name`, and back-fill. This protects against models that ignore the new field.

### 4. Redeploy `chat-trip-planner` edge function.

## Files Changed

- `supabase/functions/chat-trip-planner/index.ts` — add `transportFromPrevious` to cities schema + prompt rules + (optional) regex back-fill
- `src/pages/Start.tsx` — read `transportFromPrevious` per city when inserting `trip_cities`, plus state typing where chat result is stored

No DB migration needed — `trip_cities.transport_type` already supports `'train' | 'flight' | 'bus' | 'car' | 'ferry'`. Existing downstream pipeline (generation-core, compile-day-facts, cascadeTransportToItinerary) already honors `transport_type` when it's set; we're just making sure it actually gets set from the chat flow.
