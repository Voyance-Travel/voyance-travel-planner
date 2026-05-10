## RS.M14 — Filter blocked users from search results

**File:** `src/services/usersSearchAPI.ts` (`searchUsers`, lines 35–61)

No `user_blocks` table exists. Blocking is modeled via `friendships` with `status = 'blocked'`. Either side of the friendship row may be the blocker, so we hide the user on either direction (mutual hiding).

### Change

Inside `searchUsers`, after the existing profile query succeeds and before the `return`:

```ts
// Mutual hide: drop any user who is in a 'blocked' friendship with the
// current user (regardless of which side initiated the block).
const { data: { user: currentUser } } = await supabase.auth.getUser();
let blockedUserIds = new Set<string>();
if (currentUser) {
  const { data: blocks } = await supabase
    .from('friendships')
    .select('requester_id, addressee_id')
    .eq('status', 'blocked')
    .or(`requester_id.eq.${currentUser.id},addressee_id.eq.${currentUser.id}`);

  for (const b of blocks || []) {
    if (b.requester_id !== currentUser.id) blockedUserIds.add(b.requester_id);
    if (b.addressee_id !== currentUser.id) blockedUserIds.add(b.addressee_id);
  }
}

const filtered = (data || []).filter(p => !blockedUserIds.has(p.id));
return filtered.map(profile => ({ /* existing mapping */ }));
```

Also exclude `currentUser.id` itself from the result (existing search returns yourself — a small adjacent fix; keep it scoped to one extra `.has` check). If you'd rather not, drop that line — the user's task only requires blocked filtering.

### Verification

- `grep -c "blockedUserIds\|friendships" src/services/usersSearchAPI.ts` ≥ 2
- Manual: a profile with a `friendships` row to the current user where `status='blocked'` (in either direction) should not appear in search results.

### Out of scope

- Creating a dedicated `user_blocks` table
- Filtering blocks elsewhere (friend lists, notifications, trip sharing)
- RLS changes — existing `friendships` SELECT policy already permits both sides to read the row
