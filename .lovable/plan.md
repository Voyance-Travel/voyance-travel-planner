## Fix 8.1 — Atomic UPDATE for re-sending after decline

`src/services/supabase/friends.ts` has two delete+insert blocks (lines ~120-138 and ~191-209) for the "previously declined → resend" path. Both are non-atomic: a delete success followed by insert failure permanently loses the row.

### Change

In **both** blocks, replace the `delete()` + `insert()` pair with a single `update()` on the existing row id:

```ts
if (existing.status === 'declined') {
  const { error: updateError } = await supabase
    .from('friendships')
    .update({
      requester_id: currentUserId,
      addressee_id: <targetProfile.id | targetUserId>,
      status: 'pending',
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id);

  if (updateError) throw updateError;
  return { success: true, status: 'pending' };
}
```

- Block 1 (handle-based, ~line 120): uses `targetProfile.id`
- Block 2 (id-based, ~line 191): uses `targetUserId`

UPDATE rewrites both `requester_id` and `addressee_id` in one statement, so direction-flip (current user was previously the addressee) is handled atomically. UNIQUE constraint on the pair is preserved (in-place update).

### Verify

```
grep -n "previously declined\|status === 'declined'" src/services/supabase/friends.ts
grep -B1 -A12 "status === 'declined'" src/services/supabase/friends.ts | head -40
```
Expected: no `.delete()` + `.insert()` pair in either declined branch; only a single `.update({...}).eq('id', existing.id)`.

### Notes

- No DB migration, no RLS change. Existing UPDATE policy on `friendships` already covers requester/addressee.
- Comment updated to explain atomicity + direction-flip.
