

## Fix: Duplicate Check-in on Day 1

### Root Cause
The AI generates two activities that both say "check-in" — the real check-in early in the day, and a later "Hotel Check-in & Midday Refresh" (which is really just returning to freshen up). The second one escapes dedup because:
- It has category `relaxation`, not `accommodation`
- The accommodation dedup (Step 9c) only targets `accommodation` category
- The check-in guarantee (Step 7) only checks if a check-in *exists*, not if there are duplicates

### Fix
Add a **post-check-in dedup pass** after Step 7 (check-in guarantee). On any day where a check-in exists, scan all *subsequent* activities for titles containing "check-in" / "check in" / "checkin" regardless of category. Relabel them to "Freshen Up at {Hotel}" and set their category to `accommodation` so they flow through the normal dedup pipeline.

### File Changed
**`supabase/functions/generate-itinerary/pipeline/repair-day.ts`** — after the Step 7 block (~line 902):
- Find the first real check-in activity (by title match)
- Scan all activities *after* it for any that also contain "check-in" / "check in" / "checkin" in their title
- Relabel those to "Freshen Up at {hotelName}" and set category to `accommodation`
- Log a repair action for each relabel

This is ~15 lines of code, no other files need changes.

