

## Fix: Mystery Trip — Safety Filtering + Better Personalization

### Single file change: `supabase/functions/suggest-mystery-trips/index.ts`

**1. Add home_airport fetch to the existing Promise.all (line 69)**
Add a 7th parallel query for `profiles.home_airport` to infer user origin. There's no `nationality` column, but `home_airport` exists (e.g., "JFK" → US, "LHR" → UK). We'll map common airport codes to country, defaulting to `'US'`.

**2. Add hardcoded unsafe destinations blocklist (after line 155)**
Insert `UNSAFE_DESTINATIONS` map covering ~15 conflict/sanction countries (Russia, Yemen, Syria, Afghanistan, North Korea, Iran, Somalia, South Sudan, Libya, Iraq, Myanmar, Venezuela, Haiti, Sudan, Ukraine). Filter `availableDestinations` through it before passing to AI. Log exclusions.

**3. Rewrite system prompt (line 178-188)**
- Add `TRAVELER ORIGIN: {origin}` 
- Add CRITICAL SAFETY RULES section (never suggest conflict zones, sanctions, travel bans for origin country)
- Add SELECTION RULES: must only pick from provided list
- Keep existing personalization instructions

**4. Enhance user prompt (line 190-206)**
- Add origin context: "The traveler is from {origin}"
- Add preferred_regions emphasis: "At least 1 of 3 should be in/near preferred regions"
- Add explicit instruction: "All 3 must be safe and practical for a {origin} traveler"
- Add "you MUST pick from this list ONLY" reinforcement

**5. Lower temperature from 1.2 to 0.9 (line 216)**
1.2 is too high — causes bizarre/unsafe picks. 0.9 still provides variety but stays grounded.

**6. Post-AI safety validation (after line 294)**
After parsing AI response, filter suggestions through the same `UNSAFE_DESTINATIONS` blocklist. If AI hallucinated an unsafe destination despite instructions, catch it. Log warnings for any filtered results. User gets partial results (1-2) rather than a failure.

### Helper: Airport-to-country mapping
Small utility mapping ~20 common airport prefixes to country codes (JFK/LAX/ORD→US, LHR/LGW→UK, CDG→FR, etc.), with fallback to 'US'.

### What stays the same
- All enrichment/suppression/decline tracking
- Credit costs (15cr suggestions, 5cr logistics)  
- `mystery-trip-logistics` function
- `MysteryGetawayModal.tsx` UI
- Image enrichment from destinations table
- Cost tracking

