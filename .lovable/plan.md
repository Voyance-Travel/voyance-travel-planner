
# Universal Fake Address Patterns

## Change
Replace `FAKE_ADDRESS_PATTERNS` in both files with a city-agnostic version.

### Files & Lines

**`supabase/functions/generate-itinerary/action-generate-trip-day.ts`** (lines 836-840)
**`supabase/functions/generate-itinerary/action-generate-day.ts`** (lines 350-354)

Both get the same replacement:

```typescript
const FAKE_ADDRESS_PATTERNS = [
  /the destination/i, /your destination/i, /the city/i,
  /the restaurant/i, /the venue/i, /city center/i, /downtown/i,
  /^[a-z\s'-]+,?\s*[a-z\s'-]*$/i,
];
```

**What changed:**
- Removed 5 hardcoded city regexes (redundant — caught by the universal catch-all)
- Added placeholder phrases: "the restaurant", "the venue", "city center", "downtown"
- Simplified catch-all to match ANY letters-only address (no numbers = fake). Works for every city worldwide.

No other code touched.
