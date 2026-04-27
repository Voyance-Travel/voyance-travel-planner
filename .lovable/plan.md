## Diagnosis

User did "Just Tell Us" for Hong Kong → Chengdu → Beijing trip. Got 15 issues, traceable to 6 root causes:

### Root cause 1: Hong Kong silently dropped from cities[]
`src/utils/cityNormalization.ts` line 29 lists `'hong kong'` in `COUNTRY_HINTS`. The filter at line 180 drops any city where `isRegionNotCity(name)` is true — so "Hong Kong" is filtered out as a country even when the AI correctly puts it in `cities[]`. The user's typo "Hing Kong" likely also failed AI extraction.

### Root cause 2: Hotel address shows "Chengdu" on Beijing days
In `action-generate-trip-day.ts` the `dayCityMap` is built from `trip_cities`, and `cityInfo.hotelName` / `cityInfo.hotelAddress` are passed as `hotelOverride`. Need to verify `dayCityMap` build (lines ~296-328) actually populates `hotelName`/`hotelAddress` per row from `trip_cities.hotel_selection`. If the second-city hotel wasn't entered in the chat, `hotelOverride` falls back to the trip-level hotel (Chengdu), and "Return to Hotel" inherits that address.

### Root cause 3: Panda visit at 10:45 PM
No operating-hours guard for `nature` / wildlife / zoo categories. The repair pipeline only enforces operating hours for museums and dining. Need a category-aware late-time guard for nature/wildlife/outdoor activities (cap end time ≤ 18:00 or move to morning).

### Root cause 4: Train 7:30 PM + dinner 7:00 PM same evening
The "departure buffer cleanup" (`action-generate-day.ts` line 1456) only fires when `isLastDay && _departureTime24` (final flight). For inter-city train/flight on `isLastDayInCity`, the same cleanup doesn't run. Need to extend the post-guard cleanup to inter-city departures using `nextLegTransport` + `transport_details.departureTime`.

### Root cause 5: Mid-day "Checkout from Hotel" on Day 4 in Beijing
Beijing has 4 nights (Days 3–6). Day 4 is purely intra-city, yet a checkout appears. Possible causes: (a) `dayCityMap` mis-aligns Beijing days because of Hong Kong drop earlier, OR (b) the repair-day "CHECKOUT GUARANTEE" block (`repair-day.ts` line 1562) is firing when `isLastDayInCity` is true but the next city in the map is actually the same city (off-by-one in `dayCityMap![dayNumber]` boundary check). After fixing root cause 1, re-verify the boundary math.

### Root cause 6: TRB Hutong / Bottega repeated across days
The `usedRestaurants` deduplication chain works within a city but the lunch-at-Bottega-three-times pattern suggests sanitizer's repeat detection is matching only on EXACT name (not substring/normalized). Also, the AI re-emits the same venue when prompt context lists it as "previously used" but doesn't have enough Beijing alternatives in `restaurantPool`. Tighten repeat detection + add a hard rule in compile-prompt that no restaurant may appear more than once per city.

### Root cause 7: Text quality — "Forbidden", "Yu's Family Kitchen ()", "Hing Kong"
- Empty parentheses: sanitizer should strip `\s*\(\s*\)` from titles/locations.
- Truncated proper nouns: add a known-name completer for landmark words ("Forbidden" → "Forbidden City", "Tiananmen" → "Tiananmen Square", etc.) — or detect a one-word title that's a known partial and reject/fix.
- "Hing Kong" → "Hong Kong" autocorrect in the chat-trip-planner system prompt's spell-check section, plus add a small typo map in city normalization.

---

## Plan

### 1. `src/utils/cityNormalization.ts`
- Remove `'hong kong'` from `COUNTRY_HINTS`. It's a city, not a country, in this context. (Singapore is already absent and works.) If needed, keep a separate "city-states" set that is allowed.
- Add typo map: `'hing kong' → 'Hong Kong'`, `'being' → 'Beijing'`, applied in `cleanCandidate`.

### 2. `supabase/functions/chat-trip-planner/index.ts`
- Strengthen system prompt: "If the user obviously misspells a major city (e.g. 'Hing Kong', 'Being', 'Tokio'), silently correct to the standard English name in destination, cities[].name, and hotelName."
- Reinforce: "Hong Kong, Singapore, Monaco, Vatican City are CITIES — always include them in cities[] with nights, never treat as 'country only'."

### 3. `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
- In the `dayCityMap` builder (~lines 296-328), confirm `hotelName` and `hotelAddress` are read from `trip_cities.hotel_selection` (jsonb) per row and never fall back to the previous row's hotel. Log when missing.
- For days where `cityInfo.hotelName` is missing, do NOT fall back to `tripHotelName`/`tripHotelAddress` — instead pass `hotelOverride` as undefined so the prompt instructs the AI to use neutral wording (no hard-coded Chengdu address bleeding into Beijing days).

### 4. `supabase/functions/generate-itinerary/action-generate-day.ts` — departure buffer cleanup
- Extend the existing post-guard cleanup at line 1456 to also fire when `isLastDayInCity && nextLegTransport` is set and a `transport_details.departureTime` is known. Remove any meal/activity scheduled within the buffer window before train/flight departure.

### 5. `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — wildlife/nature guard
- Add new rule: activities with `category` in `{nature, wildlife, outdoor, zoo, animal}` OR title containing `panda|zoo|safari|aquarium|botanical garden` must end by 18:00. If scheduled later, move to next morning slot (08:30–11:00). Mirror the museum guard pattern.

### 6. `supabase/functions/generate-itinerary/pipeline/repair-day.ts` — checkout guarantee scope
- Tighten line 1563 condition: `needsCheckout = !isHotelChange && (isLastDay || (isLastDayInCity && !isTransitionDay && nextCityName !== currentCityName))`. Add explicit same-city compare to prevent false positive on intra-city days.

### 7. `supabase/functions/generate-itinerary/sanitization.ts` — name/text quality
- Strip empty parentheses: `.replace(/\s*\(\s*\)/g, '')`.
- Add landmark name completer for common truncations: `Forbidden` → `Forbidden City`, `Great Wall` → `Great Wall of China` (only when standalone title), `Temple of Heaven` etc. Drive from a small known-landmarks map.
- Tighten cross-day repeat detection: normalize venue names (lowercase, strip punctuation, drop generic words like "restaurant"/"cafe") before comparing against `usedRestaurants`. If a duplicate is detected and a `restaurantPool` alternative exists, swap it during sanitize.

### 8. `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` — anti-repeat rule
- Add a hard rule in the per-day prompt: "Do NOT use any restaurant listed in PREVIOUSLY USED RESTAURANTS. Each Beijing/Chengdu/Hong Kong restaurant may appear AT MOST ONCE in the entire trip." Surface `usedRestaurants` already passed to the function more prominently.

---

## Files to be edited
1. `src/utils/cityNormalization.ts`
2. `supabase/functions/chat-trip-planner/index.ts`
3. `supabase/functions/generate-itinerary/action-generate-trip-day.ts`
4. `supabase/functions/generate-itinerary/action-generate-day.ts`
5. `supabase/functions/generate-itinerary/pipeline/repair-day.ts`
6. `supabase/functions/generate-itinerary/sanitization.ts`
7. `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts`

No DB migrations. Edge functions auto-deploy.

## Out of scope
- Spa-on-Beijing-days (#15) — falls under interest-distribution; better addressed in a later pass on personalization spread across multi-city. Will note in code but not block fix shipment.
- Trip length mismatch (5 vs 6 days) — that's user-typed description vs computed dates; not a bug.
