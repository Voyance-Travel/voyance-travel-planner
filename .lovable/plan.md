

# Fix Fake Address Regex Anchors

## Problem
`FAKE_ADDRESS_PATTERNS` uses `^...$` anchored regex on placeholder phrases, so addresses like `"Table du Quartier, the destination"` bypass the filter because the string doesn't exactly equal `"the destination"`.

## Change
In **both** files that contain this pattern, remove `^` and `$` anchors from the first three placeholder patterns only:

**Files:**
- `supabase/functions/generate-itinerary/action-generate-trip-day.ts` (line 791)
- `supabase/functions/generate-itinerary/action-generate-day.ts` (line 351)

**Before:**
```typescript
/^the destination$/i, /^your destination$/i, /^the city$/i,
```

**After:**
```typescript
/the destination/i, /your destination/i, /the city/i,
```

City-name patterns (`/^paris$/i`, etc.) keep their anchors — those need exact match.

No other changes. One line per file.

