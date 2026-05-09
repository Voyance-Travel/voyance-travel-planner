## Fix 5.2 — Invalidate invite tokens on collaborator removal

**File:** `src/services/tripCollaboratorsAPI.ts` (function `removeTripCollaborator`, around line 300–371)

**Problem:** When an owner removes a collaborator, the `trip_invites` row that the user accepted to join stays in the table. The removed user can re-open the original invite link and rejoin without owner intervention — auth bypass.

**Change:** After the `trip_members` delete (line 333) and before the journey-legs cascade (line 335), add a best-effort delete on `trip_invites` filtered by `trip_id` + `accepted_by`:

```ts
// Invalidate any pending invite tokens that this user accepted to join.
// Without this, the removed user could re-accept the same invite and rejoin.
try {
  const { error: inviteError } = await supabase
    .from('trip_invites')
    .delete()
    .eq('trip_id', collab.trip_id)
    .eq('accepted_by', collab.user_id);

  if (inviteError) {
    console.error('[TripCollaborators] Error invalidating invite tokens:', inviteError);
  }
} catch (e) {
  console.error('[TripCollaborators] Invite token cleanup exception:', e);
}
```

Confirmed `trip_invites` has both `trip_id` and `accepted_by` columns. Future invites issued by the owner have a fresh `id` with `accepted_by = NULL`, so they are unaffected.

**Scope kept minimal:** Only the current `trip_id` is cleaned, matching the spec. Sibling-leg invite cleanup is not in scope here (collaborator-row cascade across legs already exists; invites are per-trip and owner can re-issue).

**Verification:**
- `grep -n "from('trip_invites').delete" src/services/tripCollaboratorsAPI.ts` → 1 hit inside `removeTripCollaborator`.
- Smoke test: owner invites B → B accepts → owner removes B → B re-opens link → resolves to `invalid_token`.

No DB migration, no other files touched.
