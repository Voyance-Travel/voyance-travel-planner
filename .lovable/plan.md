

# Enforce Minimum Activity Count Per Day

## Changes

### 1. Strengthen prompt instructions (`compile-prompt.ts`)

**Line 431** — Replace morning activities line:
```
3. MORNING ACTIVITIES — At least 1 paid + 1 free activity
```
→
```
3. MORNING ACTIVITIES (MANDATORY 9:00 AM - 12:30 PM) — You MUST schedule at least 2 activities between breakfast and lunch. This is the MOST IMPORTANT part of the day. Examples: museum visit, landmark tour, market walk, neighborhood exploration, gallery, viewpoint, garden, historic site. A day with NO morning activities is a FAILED itinerary.
```

**Line 433** — Replace afternoon activities line:
```
5. AFTERNOON ACTIVITIES — At least 1-2 paid + 1 free activity
```
→
```
5. AFTERNOON ACTIVITIES (MANDATORY 2:00 PM - 5:00 PM) — You MUST schedule at least 1-2 activities between lunch and the hotel return. Examples: museum, shopping street, park, boat ride, neighborhood walk, cultural site.
```

**Lines 448-452** — Replace ACTIVITY MIX block:
```
ACTIVITY MIX:
- Minimum 3 PAID activities ...
- Minimum 2 FREE activities ...
- Place free activities between paid ones to prevent fatigue
- Include at least 1 coffee/snack opportunity between long gaps
```
→
```
ACTIVITY MIX — NON-NEGOTIABLE MINIMUMS:
- A full day MUST have at least 5 non-dining, non-transport activities total
- At least 2 PAID activities (museums, tours, attractions with ticket prices)
- At least 2 FREE activities (parks, viewpoints, walks, markets, street art)
- At least 1 evening activity after dinner (bar, show, jazz, night walk)
- Place free activities between paid ones to prevent fatigue
- Include at least 1 coffee/snack opportunity between long gaps
- SELF-CHECK: Count your non-dining activities. If there are fewer than 4, you have NOT met the minimum. Add more before responding.
```

### 2. Post-generation warning log (`action-generate-trip-day.ts`)

After the cross-day venue dedup block (after line 987), add an activity count warning that logs when a non-first/non-last day has fewer than 2 real (non-dining/transport/accommodation) activities. Warning only — no removal or injection.

### Files modified
- `supabase/functions/generate-itinerary/pipeline/compile-prompt.ts` — 3 text replacements
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` — 1 insertion (warning log)

