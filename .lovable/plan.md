

## Fix: "Trips Built" Counter Shows 0 on Homepage

**Root Cause**: The homepage queries `supabase.from('trips').select('id', { count: 'exact', head: true })` to get a live trip count. However, homepage visitors are typically **not authenticated**, and RLS policies on the `trips` table restrict visibility to trip owners/collaborators. This returns `count: 0` (not `null`), so the fallback `?? 114` never triggers — `0` is a valid non-null number.

**Fix**: Replace the live Supabase query with a **security-definer database function** that counts all trips regardless of RLS, then call it from the frontend. This is safe because we're only exposing an aggregate count, not row data.

### Changes

| File | Change |
|------|--------|
| **Database migration** | Create a `get_platform_trip_count()` function (`SECURITY DEFINER`) that returns `SELECT COUNT(*)::int FROM trips` — bypasses RLS safely for aggregate only |
| **Database migration** | Create a `get_platform_destination_count()` function (`SECURITY DEFINER`) that returns `SELECT COUNT(*)::int FROM destinations` |
| `src/components/home/SocialProofSection.tsx` | Update `usePlatformMetrics` to call these RPC functions instead of direct table queries. Also add a guard: if the returned count is `0` or query errors, use `FALLBACK_METRICS` |

### Detail

The two DB functions are read-only aggregates with no user data exposure — just integer counts. The frontend hook becomes:

```typescript
const [tripsRes, destRes] = await Promise.all([
  supabase.rpc('get_platform_trip_count'),
  supabase.rpc('get_platform_destination_count'),
]);
return {
  tripsBuilt: tripsRes.data || FALLBACK_METRICS.tripsBuilt,
  destinations: destRes.data || FALLBACK_METRICS.destinations,
};
```

The `|| fallback` (instead of `??`) ensures that both `null` and `0` trigger the fallback, so even if the function returns 0 unexpectedly, users see a reasonable number.

