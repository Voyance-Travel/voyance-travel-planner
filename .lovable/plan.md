

## Fix: Null-safety crashes in itinerary-chat edge function

Two targeted fixes in `supabase/functions/itinerary-chat/index.ts`:

### Fix 1: Null guard on `days` and `activities` (line 474-479)
The crash occurs because `day.activities` can be undefined when itinerary days haven't been fully populated yet.

**Line 474**: `itineraryContext.days.map(` → `(itineraryContext.days || []).map(`  
**Line 475**: `day.activities.map(` → `(day.activities || []).map(`  
**Line 490**: `itineraryContext.days.length` → `(itineraryContext.days || []).length`

### Fix 2: Type narrowing on travelerProfiles (line 452-454)
Optional chaining in the condition doesn't narrow the type properly, and `owner` can be undefined if no profile has `isOwner`.

**Line 452**: Remove optional chain, use explicit null check: `blendedDnaFromTrip.travelerProfiles && blendedDnaFromTrip.travelerProfiles.length > 1`  
**Line 454**: Add fallback: `profiles.find(p => p.isOwner) || profiles[0]`

### Deployment
Redeploy the `itinerary-chat` edge function after changes.

