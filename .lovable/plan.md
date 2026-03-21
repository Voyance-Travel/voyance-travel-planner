

## Fix: "Check-in at Hotel" Appears on Days After Day 1

### Problem
The AI generates "Check-in at ONE@Tokyo" as a mid-day accommodation activity on Day 2+. These should be titled "Return to ONE@Tokyo" or "Freshen up at ONE@Tokyo" — "check-in" only makes sense on Day 1 (or the first day at a new hotel in split stays).

### Root cause

Two issues:

1. **No prompt guardrail for non-first days**: The prompt instructs "HOTEL RETURN — Freshen up" (line 8512) and "RETURN TO HOTEL" (line 8515) generically, but doesn't explicitly tell the AI **not** to use "Check-in" on days after Day 1. The Day 1 rule (line 1569) says to begin with "Hotel Check-in & Refresh" — the AI sometimes reuses this phrasing on subsequent days.

2. **No post-processing title correction**: The hotel address correction pass (lines 2402-2434) fixes addresses but doesn't rename "Check-in at X" to "Return to X" on non-first days.

### Fix

**File: `supabase/functions/generate-itinerary/index.ts`**

1. **Add prompt rule** (~line 1571, after the hotel fidelity rule): Add a new rule explicitly forbidding "check-in" titles on non-first days:
   ```
   !isFirstDay ? '15. **NO CHECK-IN ON NON-ARRIVAL DAYS**: On days after Day 1 (or after the first day at a new hotel), 
   do NOT title accommodation activities as "Check-in at [Hotel]". Use "Return to [Hotel]" or 
   "Freshen up at [Hotel]" instead. "Check-in" implies arrival — use it only on the day the 
   traveler first arrives at that hotel.' : ''
   ```

2. **Add post-processing title rename** (~after line 2434, after the hotel address correction block): For non-first days, rename any "Check-in at X" accommodation activities to "Return to X":
   ```typescript
   if (!isFirstDay) {
     for (const act of generatedDay.activities) {
       const title = (act.title || '').toLowerCase();
       const cat = (act.category || '').toLowerCase();
       if ((cat === 'accommodation' || title.includes('check-in') || title.includes('check in')) 
           && !title.includes('checkout') && !title.includes('check-out') && !title.includes('check out')) {
         const checkInMatch = act.title?.match(/check[- ]?in\s+(at|to|—|–|-|@)\s+/i);
         if (checkInMatch) {
           const hotelPart = act.title!.slice(checkInMatch.index! + checkInMatch[0].length);
           act.title = `Return to ${hotelPart}`;
         }
       }
     }
   }
   ```

### Scope
Single file: `supabase/functions/generate-itinerary/index.ts` — ~15 lines added (prompt rule + post-processing). For multi-city split stays, `isFirstDayInCity` is already tracked and should be used instead of `isFirstDay` in that code path.

