## ACH-1 — Race-safe achievement unlock

### Schema reality vs spec

The spec assumes a `user_achievements` table and `(userId, achievementId, metadata)` signature. The actual codebase uses:

- **Table:** `achievement_unlocks` (not `user_achievements`)
- **UNIQUE constraint:** already exists — `achievement_unlocks_user_id_achievement_id_key UNIQUE (user_id, achievement_id)`. **No migration needed.**
- **Threshold column:** `achievements.requirement_value` (not `threshold`)
- **Function signature:** `unlockAchievement(achievementId, metadata)` — pulls `userId` from `supabase.auth.getUser()` internally. **6+ callers** depend on this signature and on the `{success, alreadyUnlocked, error}` return shape (lines 211, 272, 299, 329, 359, 365, 376, 386, 402, 413).

Adopting the spec's signature verbatim would break every caller. Adopting its return shape would break the retroactive-unlock callers that read `result.success`.

### Plan — keep signature, fix the race

Apply the spec's **intent** (atomic upsert, no check-then-insert race) while preserving the existing API.

**1. `src/services/achievementsAPI.ts` — `unlockAchievement` (lines 127-168)**

Replace the check-then-insert block (lines 137-163) with a single atomic upsert:

```ts
const { data: { user } } = await supabase.auth.getUser();
if (!user) return { success: false, error: 'Not authenticated' };

const { data, error } = await supabase
  .from('achievement_unlocks')
  .upsert(
    {
      user_id: user.id,
      achievement_id: achievementId,
      metadata: metadata || {},
    },
    { onConflict: 'user_id,achievement_id', ignoreDuplicates: true }
  )
  .select('id')
  .maybeSingle();

if (error) {
  console.error('[Achievements] Unlock error:', error);
  return { success: false, error: error.message };
}

// data === null when the row already existed (ignored by ignoreDuplicates)
return { success: true, alreadyUnlocked: data === null };
```

Behavior preserved: same signature, same return shape, `alreadyUnlocked` still set correctly. The race is now resolved by the existing UNIQUE constraint instead of a TOCTOU check.

**2. `updateAchievementProgress` (lines 173-216) — unchanged**

The spec's threshold-crossing tweak assumes progress rows can exist independently of unlocks. In this schema, `achievement_unlocks` is the single row holding both `progress` and the unlock — so "row exists" already means "unlocked". Current logic at line 210 already calls `unlockAchievement` on threshold cross when no row exists. No change needed; modifying it would create double-unlock attempts (harmless thanks to the new upsert, but pointless).

**3. Migration — skipped**

UNIQUE `(user_id, achievement_id)` already enforced. Verified via `pg_constraint`.

### Verification

- `grep -c "ignoreDuplicates: true" src/services/achievementsAPI.ts` ≥ 1 ✓
- All 10 existing call sites continue to work (signature/return unchanged)
- Concurrent unlock calls: first wins, second returns `alreadyUnlocked: true` instead of throwing or double-inserting
