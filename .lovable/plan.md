

## Fix Restaurant Reuse Across Trip Days

### Root Cause

There are three compounding failures:

1. **Duplicate dining is deliberately kept** — Lines 10624-10634 in `index.ts` say "CRITICAL: NEVER strip dining activities — a repeated real restaurant is infinitely better than a generic placeholder." So even when validation detects `MEAL REPEAT`, the duplicate restaurant stays.

2. **Pool prompt doesn't show a blocklist** — The pool injection (line 9635) filters out `paramUsedRestaurants` from the *options shown*, but doesn't tell the AI "these restaurants were already used on previous days — do NOT pick them." The AI only sees available options but has no negative constraint.

3. **No post-generation swap** — When a duplicate dining activity survives, there's no logic to replace it with an unused restaurant from the pool. The meal guard only fires for *missing* meals, not for *duplicate* meals.

### Changes

**1. Add "ALREADY USED" blocklist to restaurant pool prompt — `index.ts` line ~9666**

After the pool options, inject an explicit negative list:

```
⛔ ALREADY USED ON PREVIOUS DAYS (DO NOT PICK THESE):
  • Tim Ho Wan
  • Mak's Noodle
  • ...
Pick DIFFERENT restaurants — variety is essential.
```

This is the strongest fix because it prevents duplicates at generation time.

**2. Strip duplicate dining + replace from pool — `index.ts` lines 10620-10670**

Remove the "NEVER strip dining" exception. Instead:
- When a `MEAL REPEAT` error is found, strip the duplicate dining activity
- Immediately inject a replacement from the unused pool (same meal type)
- If no pool restaurant is available, *then* keep the duplicate (better than a placeholder)

Logic:
```
for each MEAL REPEAT error:
  find the duplicate activity
  find an unused pool restaurant for that meal type
  if replacement found → swap name/location, mark source as 'pool-dedup-swap'
  if no replacement → keep duplicate (last resort)
```

**3. Also inject used restaurants into the prompt's "DO NOT" list even without a pool — `index.ts` line ~9670**

After the pool section, always inject a used-restaurants blocklist from `paramUsedRestaurants`, even if the pool is empty. This prevents the AI from reusing restaurants when it's generating freely (no pool).

### Files changed

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/index.ts` (line ~9666) | Add explicit "ALREADY USED — DO NOT PICK" blocklist to pool prompt |
| `supabase/functions/generate-itinerary/index.ts` (line ~9670) | Always inject used-restaurants blocklist, even without pool |
| `supabase/functions/generate-itinerary/index.ts` (lines 10620-10670) | Strip duplicate dining + replace from pool instead of keeping |

