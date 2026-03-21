

## Fix: Departure Day Ends Abruptly — No Farewell Activity or Departure Transport

### Problem
On the final trip day without flight details, the prompt (line 8416-8449) caps activities at 10:30 AM and produces only "Checkout & Departure Preparation." No farewell meal, no departure transport card, no closure. The traveler's last day just stops mid-morning.

The "no flight but hotel" path (line 8366) is similarly bare — it adds a "Transfer to Airport" but no post-checkout activity and assumes airport departure even for cities like Venice where train/ferry is more likely.

### Root Cause
The two no-flight prompt branches were designed ultra-conservatively ("better to under-schedule"). But the result is a departure day with zero emotional closure and no practical transport guidance. The prompt literally says "DO NOT schedule activities after 10:00 AM" and "1 maximum."

### Fix (1 file, ~30 lines)

**File: `supabase/functions/generate-itinerary/index.ts`**

**1. "No flight but hotel" path (line 8378-8414):** 
- Replace "Transfer to Airport" with a generic "Departure Transfer" that uses destination context (Venice → "Vaporetto to Santa Lucia Station", etc.)
- Add a post-checkout farewell slot: a light farewell meal or stroll (11:15-12:00) between checkout and departure transfer
- Change `latestActivity` calculation to allow one post-checkout activity (currently it's `checkout - 60`, which kills the whole morning)
- Bump "DEPARTURE DAY ACTIVITIES: 1 maximum" → "2-3 activities"

**2. "No flight and no hotel" path (line 8419-8449):**
- Push checkout to 11:00 (from 10:30) to match standard checkout times
- Add a farewell activity slot after checkout: "Farewell [meal/stroll] near hotel" (11:15-12:00)
- Add a generic "Departure Transfer" slot at 12:30
- Change "DO NOT schedule activities after 10:00 AM" → allow activities through 12:30 PM
- Bump from "1 maximum (breakfast)" to "2-3 activities"

**3. Multi-city context (line 8497-8501):** The `paramIsLastDayInCity` block for the FINAL city already has transport-specific departure instructions but they only append to `dayConstraints` — they don't override the ultra-conservative "no flight" base constraint. Add a check: if `isLastDay && paramIsLastDayInCity`, the base departure prompt should use the multi-city transport mode (train/ferry/bus) instead of defaulting to "airport."

### Key Changes
```
// Current (no flight, no hotel):
"DO NOT schedule activities after 10:30 AM"
"1 maximum (breakfast)"

// Fixed:
"Plan a light farewell morning with 2-3 activities"
"Include a farewell meal after checkout"  
"Include a Departure Transfer to [station/airport/terminal]"
"Last activity ends by 12:30 PM"
```

### Files
- `supabase/functions/generate-itinerary/index.ts` — enrich both no-flight departure day prompts with farewell content and departure transport

