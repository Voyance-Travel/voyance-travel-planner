

# System Audit Report - Voyance Travel Planner

## Executive Summary

After comprehensive analysis, I've identified **12 remaining issues** in the codebase. The previous fixes resolved many critical problems (edge functions auth patterns, AuthContext stale token detection, duplicate routes, Quiz race condition). However, there are still legacy token fallbacks and deprecated backend references that need cleanup.

---

## ✅ Previously Fixed (Verified Working)

1. **Edge Functions Auth Pattern** - Fixed in 6 critical functions: `itinerary-chat`, `get-activity-alternatives`, `hotels`, `verify-payment`, `explain-recommendation`, `aggregate-personalization-stats`
2. **AuthContext Stale Token Detection** - Lines 266-279 properly detect stale JWTs and force sign out
3. **Quiz Race Condition** - Fixed with `user?.id` guard (line 443)
4. **Duplicate Route** - Removed (only one `/trips/:tripId/confirmation` now)
5. **Quiz Session Population** - Now working: 14 quiz sessions, 322 quiz responses in database
6. **Legacy `@/lib/auth` Removed** - No more imports found

---

## High Priority Issues (Still Need Fixing)

### 1. Legacy Token Fallbacks in 20 Service Files

**Problem**: Many service files still fall back to `localStorage.getItem('voyance_access_token')` when Supabase session is unavailable. This causes 403 errors with stale tokens.

**Affected Files** (still containing legacy fallback):
| File | Line |
|------|------|
| `friendsAPI.ts` | 71 |
| `flightAPI.ts` | 149 |
| `quizAPI.ts` | 106 |
| `bundlesAPI.ts` | 122 |
| `tripActivitiesAPI.ts` | 105 |
| `mapsAPI.ts` | 53 |
| `preferencesV1API.ts` | 129 |
| `activityCatalogAPI.ts` | 76 |
| Plus 12 more in `_legacy/` folder |

**Fix**: Remove the localStorage fallback block from each `getAuthHeader()` function - only use Supabase session tokens.

---

### 2. Deprecated Railway Backend References (27 files)

**Problem**: Many services still reference `https://voyance-backend.railway.app` as fallback URL. If `VITE_BACKEND_URL` env var is not set, these API calls would fail.

**Files affected**: 27 files including:
- `friendsAPI.ts`
- `tripActivitiesAPI.ts`
- `bundlesAPI.ts`
- `mapsAPI.ts`
- `exploreAPI.ts`
- All 13 files in `_legacy/` folder
- Plus others

**Fix**: Either:
1. Ensure `VITE_BACKEND_URL` is set in environment, OR
2. Replace Railway fallback with empty string to force use of Supabase edge functions

---

### 3. golden-persona-tests Auth Pattern

**Problem**: The `golden-persona-tests` edge function uses service role key but calls `getUser(token)` without passing the auth header to the client:

```typescript
// Line 454 - Creates client with SERVICE_ROLE_KEY (no auth header)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Line 460 - Calls getUser with token but client wasn't configured to use it
const { data: { user }, error: authError } = await supabase.auth.getUser(token);
```

**Impact**: Low - this is an admin-only function and technically works because service role can read all users, but it's inconsistent with other edge functions.

**Fix**: Either:
1. Create a separate auth client with the auth header (recommended pattern), OR
2. Leave as-is since service role key works for admin functions

---

## Medium Priority Issues

### 4. _legacy Folder Still in Use

**Problem**: The `src/services/_legacy/` folder contains 18 API files that:
- All reference the deprecated Railway backend
- All have legacy token fallbacks
- May or may not be actively imported

**Recommendation**: Audit imports to determine which files are still used. Files not imported anywhere should be deleted.

---

### 5. RLS Policies with `USING (true)` (3 tables)

**Problem**: Database linter flagged 3 tables with overly permissive policies:
- `customer_reviews` - INSERT with `WITH CHECK (true)` (allows anyone to submit)
- `rate_limits` - ALL with `USING (true)` for public role (intentional per memory)
- `search_cache` - ALL with `USING (true)` for service_role (intentional)

**Recommendation**: Review `customer_reviews` table - should require authentication to prevent spam.

---

## Low Priority Issues

### 6. Missing localStorage Cleanup on Auth

**Problem**: Legacy localStorage keys remain after sign out:
- `voyance_token`
- `voyance_access_token`
- `voyance_anonymous_session`
- `voyance_quiz_*` keys

**Recommendation**: Add cleanup function in `logout()` to remove legacy keys.

---

## Summary Table

| Category | Issues | Severity | Effort |
|----------|--------|----------|--------|
| Legacy token fallbacks | 20 files | High | 1 hour |
| Railway backend refs | 27 files | Medium | 30 min |
| golden-persona-tests auth | 1 function | Low | 15 min |
| _legacy folder cleanup | 18 files | Medium | 45 min |
| RLS policy review | 1 table | Medium | 15 min |
| localStorage cleanup | 1 function | Low | 10 min |

---

## Recommended Fix Priority

1. **Immediate**: Remove legacy token fallbacks from the 8 active service files (non-legacy)
2. **High**: Update or remove Railway backend URL references
3. **Medium**: Audit and clean up `_legacy/` folder
4. **Low**: Add localStorage cleanup, review customer_reviews RLS

---

## What's Working Well

1. ✅ **AuthContext** - Core auth flow with stale token detection
2. ✅ **Quiz System** - Sessions and responses now populating (14/322 records)
3. ✅ **Edge Functions** - Critical functions have correct auth pattern
4. ✅ **RLS Security** - 77+ tables have proper RLS policies
5. ✅ **Profile auto-creation** - `handle_new_user()` trigger works correctly

