
## ✅ COMPLETED - Fix Itinerary Customization (User Auth Source of Truth)

**Completed**: 2025-02-01

### What was fixed

The core issue was that `generate-day` and `regenerate-day` handlers extracted `userId` from the request body (`params.userId`), but the frontend often omitted this parameter. This caused `userId` to be `undefined`, silently falling back to generic (non-personalized) itineraries.

### Changes made to `supabase/functions/generate-itinerary/index.ts`:

1. **Added `verifyTripAccess()` helper** (lines 5192-5248)
   - Verifies user is trip owner OR accepted collaborator with edit permission
   - Returns structured result with `allowed`, `isOwner`, and `reason`

2. **Fixed `generate-full` handler** (lines 5251-5298)
   - Now uses `authResult.userId` (from auth token) instead of `params.userId`
   - Added userId mismatch guard (returns 403 if body contains different userId)
   - Added trip access verification before generation

3. **Fixed `generate-day`/`regenerate-day` handler** (lines 6319-6351)
   - Removed `userId` from params destructuring
   - Now uses `authResult.userId` as canonical source
   - Added userId mismatch guard
   - Added trip access verification
   - Enhanced logging shows auth source

### Expected behavior now

- All generation paths use authenticated user from JWT token
- `loadTravelerProfile(supabase, userId, ...)` always receives valid userId
- Archetype, traits, avoid list, and preferences load correctly for day-by-day generation
- Security hardened against userId spoofing

### Verification steps

1. **Backend logs should show**:
   - `[generate-day] ✓ Using authenticated userId: <id> (trip owner: true/false)`
   - `[generate-day] ✓ Profile loaded via unified loader: archetype=flexible_wanderer (source: canonical)`

2. **UI verification**:
   - Generate a full itinerary → should reflect Travel DNA
   - Regenerate a single day → should maintain same persona style

3. **Security test**:
   - Attempt generation with mismatched `userId` in body → should get 403
