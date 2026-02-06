

# Root Cause Analysis: Why Things Keep Breaking

## The Pattern

Your project has grown to a significant scale with **77+ database tables**, **75+ edge functions**, and complex interconnected features. The "whack-a-mole" problem you're experiencing is caused by **5 systemic issues** that need architectural fixes, not just spot patches.

---

## Root Cause 1: Inconsistent Error Handling

**Problem**: When database operations fail silently (e.g., `.update()` returns 0 rows instead of throwing), the UI shows spinners forever or breaks without explanation.

**Evidence found**:
- `AuthContext.tsx` line 406-411: Uses `.update().eq()` without checking if rows were affected
- Multiple places use `.update()` without handling the "0 rows updated" case
- The OnboardConversation fix I made earlier was exactly this pattern

**Fix needed**: 
- Create a shared utility for "safe upsert" operations that always succeed or throw
- Add database triggers to ensure profile/preferences rows exist on signup
- Audit all `.update()` calls and convert to `.upsert()` where appropriate

---

## Root Cause 2: CORS Header Drift (Partially Fixed)

**Problem**: Edge functions were created at different times with different CORS headers. Modern Supabase clients send `x-supabase-client-*` headers that old functions reject.

**Current status**: 
- Fixed 58+ functions in last session
- 2-3 functions still have inconsistent headers (`delete-users`, `trip-notifications` have `Access-Control-Allow-Methods` while others don't, but headers are correct)
- Need to ensure NEW functions use the shared `_shared/cors.ts` helper

**Fix needed**:
- Create ESLint/lint rule or README documentation requiring use of shared CORS helper
- Audit remaining functions for any stragglers

---

## Root Cause 3: Missing Database Rows on First Use

**Problem**: Code assumes rows exist in `profiles`, `user_preferences`, `travel_dna_profiles` etc. but they may not be created until first use.

**Evidence found**:
- `profiles` table row is created by a trigger on signup, but...
- `user_preferences` row is only created when preferences are saved
- `travel_dna_profiles` row is only created after quiz completion
- Code that tries to `.update()` these before they exist fails silently

**Fix needed**:
- Add database triggers to create placeholder rows in `user_preferences` and `travel_dna_profiles` when a user signs up
- Convert all profile-related operations to use `.upsert()` with `onConflict`

---

## Root Cause 4: Race Conditions in State Updates

**Problem**: Multiple rapid user actions can trigger duplicate database operations.

**Evidence found**:
- `TripPlannerContext.tsx` has a `savingInProgressRef` guard (lines 188-191) specifically to prevent this
- The comment says this was added to fix "1,000 duplicate trip records"
- Similar guards are missing elsewhere

**Fix needed**:
- Add similar guards to other critical save operations
- Use React Query's mutation deduplication consistently

---

## Root Cause 5: No Integration Tests

**Problem**: Features work in isolation but break when combined. There's no automated way to catch regressions.

**Evidence found**:
- No end-to-end test files visible
- Breaking changes to shared types cascade through the codebase
- Schema changes can break frontend code silently

---

## Implementation Plan

### Phase 1: Database Robustness (Immediate)

1. **Add database trigger for user initialization**
   ```sql
   -- Create placeholder rows in user_preferences and travel_dna_profiles on signup
   CREATE OR REPLACE FUNCTION public.initialize_user_data()
   RETURNS trigger AS $$
   BEGIN
     INSERT INTO public.user_preferences (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
     INSERT INTO public.travel_dna_profiles (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
     RETURN NEW;
   END;
   $$ LANGUAGE plpgsql;
   ```

2. **Create safe database operation utilities**
   - `safeUpsert()` function that handles errors gracefully
   - `ensureRowExists()` helper for tables that should have user rows

### Phase 2: Frontend Hardening

3. **Audit and fix all `.update()` calls**
   - Convert to `.upsert()` where appropriate
   - Add proper error handling with user feedback

4. **Add loading/error boundaries**
   - Wrap critical sections with better error boundaries
   - Add timeout handling for long operations

### Phase 3: CORS Standardization

5. **Complete edge function audit**
   - Verify all 77 functions use standardized headers
   - Document the pattern for future development

### Phase 4: Documentation and Prevention

6. **Create development guidelines**
   - Document database patterns that must be followed
   - Create template for new edge functions
   - Add comments to critical code explaining why guards exist

---

## Technical Details

### Files to modify

| File | Change |
|------|--------|
| New migration file | Add trigger to initialize user data on signup |
| `src/utils/safeDbOperations.ts` | New shared utility for safe database operations |
| `src/contexts/AuthContext.tsx` | Use upsert for profile updates |
| `src/pages/OnboardConversation.tsx` | Already fixed, verify stable |
| Multiple service files | Audit `.update()` usage |

### Database changes

- Add trigger on `auth.users` INSERT to pre-create user data rows
- Ensure RLS policies work with upsert operations

### Why this fixes "whack-a-mole"

Instead of fixing individual symptoms, this addresses the underlying patterns:
- Silent failures become explicit errors
- Missing data is prevented at the source
- Race conditions are blocked systematically
- CORS is standardized globally

---

## Summary

The app isn't fundamentally broken - it's suffering from technical debt accumulated during rapid feature development. The fixes above will create a more stable foundation and prevent the same categories of bugs from recurring.

