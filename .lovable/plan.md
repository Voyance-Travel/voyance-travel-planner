

## Fix: Make transport recommendations contextual instead of generic

### Problem

The `airport-transfers` edge function returns the same `aiRecommendation` text for all city transit segments using just 3 hardcoded templates (lines 483-497). It never considers:
- Walking distance/duration (walk options are added client-side, not server-side)
- The actual origin/destination names
- The specific mode the user is likely to use

So a 13-minute walk between nearby restaurants still gets "The metro/train is a great option here — affordable and avoids traffic."

### Fix

**File: `supabase/functions/airport-transfers/index.ts` (lines 476-498)**

Replace the 3-template city-route recommendation logic with context-aware recommendations:

1. **Add walk detection**: Check if the taxi duration is ≤20 minutes (city routes have scaled durations). If taxi is ≤5 min, recommend walking with the actual origin→destination names.
2. **Use location names**: Interpolate `origin` and `destination` into the recommendation text so it reads as specific advice, not a template.
3. **Expand the decision tree**:
   - Taxi ≤5 min → "It's a short walk from {origin} to {destination} — no transport needed."
   - Taxi ≤10 min → "A quick taxi ride, or walk it in about {walkEstimate} minutes."
   - Train available and competitive → "The {trainLine or metro} is a solid option between {origin} and {destination} — affordable and avoids traffic."
   - Default taxi → "A taxi or rideshare is the easiest way from {origin} to {destination}."

### Scope
Single file: `supabase/functions/airport-transfers/index.ts`. Redeploy edge function.

