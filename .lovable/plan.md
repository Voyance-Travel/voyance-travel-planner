
# Fix: Sent Friend Requests Not Showing

## Root Cause

The `getOutgoingRequests` function in `src/services/supabase/friends.ts` queries the `profiles_friends` view to get addressee info. However, this view is defined as:

```sql
SELECT id, handle, display_name, avatar_url, bio
FROM profiles
WHERE handle IS NOT NULL
```

The `WHERE handle IS NOT NULL` filter **excludes users who haven't set a handle**. In the current database, the user you sent a request to (Clinton Brooks) has no handle set, so the join returns no matching row, and the entire outgoing request row is silently dropped from results.

## Fix

**File: `src/services/supabase/friends.ts` (line 348-354)**

Change the `getOutgoingRequests` query to use the `profiles` table directly instead of the `profiles_friends` view. The RLS SELECT policy on `friendships` already allows the requester to see their own rows, and the profiles table allows reading basic public info (display_name, avatar_url) for any user.

```typescript
const { data, error } = await supabase
  .from('friendships')
  .select(`
    id,
    created_at,
    addressee:profiles!friendships_addressee_id_fkey(id, handle, display_name, avatar_url)
  `)
  .eq('requester_id', currentUserId)
  .eq('status', 'pending');
```

This removes the dependency on `profiles_friends` and ensures all pending outgoing requests appear regardless of whether the addressee has set a handle.

## Additional Check

If the `profiles` table RLS blocks this join (which previously caused the issue that led to using `profiles_friends`), we will instead modify the `profiles_friends` view to remove the `WHERE handle IS NOT NULL` filter, since that filter is the actual bug. The view would become:

```sql
CREATE OR REPLACE VIEW public.profiles_friends AS
SELECT id, handle, display_name, avatar_url, bio
FROM profiles;
```

This is a one-line SQL migration and is the safer fix if `profiles` table RLS is restrictive.

## Technical Details

- **File changed**: `src/services/supabase/friends.ts` -- update `getOutgoingRequests` query
- **Possible migration**: Update `profiles_friends` view to remove `WHERE handle IS NOT NULL`
- No other files need changes; the UI in `FriendsSection.tsx` already handles nullable handles gracefully
