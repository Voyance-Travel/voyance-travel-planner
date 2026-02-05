

# Full System Audit - Voyance Travel Planner

## Executive Summary

After comprehensive codebase analysis, I've identified **19 potential issues** across authentication, edge functions, legacy code, database, and security. These range from critical (stale token handling) to low priority (legacy code cleanup).

---

## Critical Issues (High Priority)

### 1. Edge Functions Missing Auth Header Pattern

**Problem**: Multiple edge functions create the Supabase client WITHOUT passing the Authorization header, causing `getUser(token)` to fail silently or return unauthorized.

**Affected Functions** (need the auth header fix):
- `itinerary-chat/index.ts` (lines 243-246)
- `get-activity-alternatives/index.ts` (lines 61-64)
- `hotels/index.ts` (lines 1002-1005)
- `golden-persona-tests/index.ts`
- `explain-recommendation/index.ts`
- `aggregate-personalization-stats/index.ts`
- `verify-payment/index.ts`

**Fix Pattern**:
```typescript
// BEFORE (broken)
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_ANON_KEY") ?? ""
);

// AFTER (correct)
const authHeader = req.headers.get("Authorization");
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  { global: { headers: { Authorization: authHeader || '' } } }
);
```

---

### 2. Stale Token Problem - Auth Logs Show Persistent 403s

**Problem**: Users have stale JWTs in localStorage pointing to deleted/non-existent users. The AuthContext fix (lines 266-279) handles this on initialization, but several services still fallback to legacy localStorage tokens.

**Evidence** from auth logs:
```
"403: User from sub claim in JWT does not exist"
path: /user, /logout
```

**Root Cause**: Legacy services reading `voyance_token` or `voyance_access_token` from localStorage, which are stale tokens from a previous auth system.

---

### 3. Legacy Token Fallbacks in Services (29 files affected)

**Problem**: Multiple API services have this pattern that uses stale tokens:

```typescript
async function getAuthHeader() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return { Authorization: `Bearer ${session.access_token}` };
  }
  // DANGEROUS: Falls back to stale legacy token!
  const token = localStorage.getItem('voyance_token');
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
}
```

**Affected Files** (partial list):
- `tripBudgetCompanionsAPI.ts`
- `bookingAPI.ts`
- `tripSaveResumeAPI.ts`
- `featureFlagsAPI.ts`
- `connectionsAssessmentAPI.ts`
- `saveTripAPI.ts`
- `venuesAPI.ts`
- `savedTripsAPI.ts`
- `tripContextAPI.ts`
- Plus ~20 more in `src/services/`

**Fix**: Remove all `localStorage.getItem('voyance_token')` and `localStorage.getItem('voyance_access_token')` fallbacks - only use Supabase session tokens.

---

## Medium Priority Issues

### 4. Quiz Session/Response Tables Not Populating

**Problem**: Per the audit doc, `quiz_sessions` and `quiz_responses` tables have 0 rows despite 13 active users.

**Analysis**: 
- RLS policies are correct (checked: INSERT with `auth.uid() = user_id`)
- Code in `src/utils/quizMapping.ts` calls `saveQuizResponse()` and `createQuizSession()` correctly
- The `Quiz.tsx` component properly awaits these functions

**Likely Cause**: The quiz session creation happens AFTER `hasStarted` is set, but before `user` is loaded, causing a race condition where `user` is null when `createQuizSession` runs.

**Fix**: Add a guard to ensure user is authenticated before creating quiz session:
```typescript
useEffect(() => {
  const initSession = async () => {
    if (user?.id && !sessionId && hasStarted) {  // Add user?.id check
      // ...
    }
  };
  initSession();
}, [user?.id, sessionId, hasStarted]);  // Use user?.id not user
```

---

### 5. RLS Policies with `USING (true)` - Security Warnings

**Problem**: Database linter found 3 tables with overly permissive INSERT/UPDATE policies.

**Tables affected**:
- `customer_reviews` - INSERT with `WITH CHECK (true)` (allows anyone to submit)
- `rate_limits` - ALL with `USING (true)` for public role
- `search_cache` - ALL with `USING (true)` for service_role (this is intentional)

**Recommendation**: Review `customer_reviews` table - should require authentication or captcha for spam prevention.

---

### 6. get-entitlements Uses Admin Client for Auth

**Problem**: In `supabase/functions/get-entitlements/index.ts`, the function uses `supabaseAdmin.auth.getUser(token)` instead of a properly configured auth client.

**Current code (line 95)**:
```typescript
const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
```

**Issue**: While this works because service role can read all users, it's inconsistent with the pattern used elsewhere and may cause issues if the token is invalid.

**Fix**: Create a separate auth client with the auth header like `generate-itinerary` does.

---

## Low Priority Issues

### 7. Deprecated Backend References

**Problem**: `quizAPI.ts` still references `https://voyance-backend.railway.app` (line 15), a legacy Railway backend that may no longer exist.

```typescript
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';
```

**Impact**: If `VITE_BACKEND_URL` is not set, quiz API calls would fail.

---

### 8. localStorage Keys Cleanup Needed

**Problem**: Multiple stale localStorage keys are scattered throughout the codebase:
- `voyance_token`
- `voyance_access_token`
- `voyance_demo_trips` (migrated on login, but needs cleanup)
- `voyance_local_trips`
- `voyance_anonymous_session`
- `voyance_quiz_*` keys

**Recommendation**: Create a cleanup function that runs after successful auth to remove legacy keys.

---

### 9. Duplicate Route Definition

**Problem**: In `App.tsx`, line 198-199:
```tsx
<Route path="/trips/:tripId/confirmation" element={<TripConfirmation />} />
<Route path="/trips/:tripId/confirmation" element={<TripConfirmation />} />
```

This is harmless but indicates copy-paste error.

---

### 10. Missing config.toml Entry

All 79 edge functions now have `verify_jwt = false` entries, so this is resolved.

---

## Technical Details: What Was Already Fixed

The previous conversation fixed:
1. ✅ `grant-monthly-credits` - Added to config.toml and fixed auth pattern
2. ✅ `spend-credits` - Fixed auth header pattern
3. ✅ `grant-bonus-credits` - Fixed auth header pattern
4. ✅ `viator-book` - Fixed auth header pattern
5. ✅ `book-activity` - Fixed auth header pattern
6. ✅ `stripe-connect-onboard` - Fixed auth header pattern
7. ✅ `stripe-connect-payouts` - Fixed auth header pattern
8. ✅ All 79 edge functions added to `config.toml`
9. ✅ Stale JWT detection in AuthContext (lines 266-279)
10. ✅ SocialLoginButtons migrated to Lovable OAuth
11. ✅ Legacy `@/lib/auth` removed

---

## What's Working Well

1. **AuthContext** - Core auth flow is solid with proper session handling
2. **RLS Security** - 77+ tables have RLS enabled with proper policies
3. **generate-itinerary** - Correctly implements auth pattern with separate auth client
4. **delete-my-account** - Proper security with auth header pattern
5. **Profile auto-creation** - `handle_new_user()` trigger works correctly
6. **Credit system** - `spend-credits` and `grant-monthly-credits` now work

---

## Recommended Fix Order

1. **Immediate**: Fix remaining edge functions with broken auth pattern (7 functions)
2. **High**: Remove legacy token fallbacks from 29 service files
3. **Medium**: Fix quiz session race condition
4. **Low**: Clean up legacy localStorage keys
5. **Low**: Remove duplicate route, update Railway backend reference

---

## Summary of Changes Needed

| Category | Files Affected | Estimated Effort |
|----------|---------------|------------------|
| Edge function auth fixes | 7 functions | 30 minutes |
| Legacy token cleanup | 29 service files | 1 hour |
| Quiz race condition | 1 file | 15 minutes |
| Misc cleanup | 3 files | 15 minutes |

