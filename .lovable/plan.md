

# Fix: Profiles HEAD 503 Error in Unit Economics Dashboard

## Problem
The dashboard fires a HEAD request to `profiles?select=id` with `count: 'exact'` (line 225), which intermittently returns a 503 error. This is redundant because line 226 already fetches `profiles` with `id, display_name` successfully.

## Root Cause
PostgREST HEAD requests with `count: 'exact'` can time out or fail under load, especially on tables with many policies. Since the dashboard already fetches all profile rows on line 226, the HEAD-only count query is unnecessary overhead.

## Fix (1 file)

**File:** `src/hooks/useUnitEconomicsData.ts`

1. Remove the HEAD count query on line 225 (`supabase.from('profiles').select('id', { count: 'exact', head: true })`)
2. Update the destructuring to remove `profileResult` from the Promise.all array
3. Change line 496 from `profileResult.count || 0` to `profileNamesResult.data?.length || 0`

This eliminates the 503-producing request entirely while preserving the same `totalUsers` metric from data already being fetched.

## Technical Detail

Current (8 parallel queries):
```text
profiles?select=id (HEAD, count:exact)   -- 503 error, redundant
profiles?select=id,display_name          -- works fine, returns all rows
```

After fix (7 parallel queries):
```text
profiles?select=id,display_name          -- kept, .length used for count
```
