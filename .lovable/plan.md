## Fix: AI Note Save Re-Freezes Trip, Strands Future Generation

### Root cause (confirmed in code)

`action-save-itinerary.ts` line 1658–1659 unconditionally computes `nextStatus = 'ready'` whenever `persistVerdict.ok` is true — regardless of whether the call is a user metadata edit (AI note save, drag-reorder, lock toggle, chat edit) on an already-frozen trip. Line 1708 then stamps `metadata.itinerary_frozen_at` on first transition to `ready`. Result: the first AI note save on a `partial` trip flips it to `ready` + freezes it, after which the next `generate-trip` leg hits the frozen gate and silently drops days (3 of 4).

### Fix — one conditional in `action-save-itinerary.ts`

Preserve existing status when a user-initiated save lands on an already-frozen trip. Status should only advance via the generation pipeline (or the commit gate downstream), never via metadata edits.

**Scope change:** `isFrozen` and `isUserSaveReason` currently live inside the block at lines 389–401 and go out of scope before line 1658. They need to be hoisted to function scope (declared with `let`/`const` outside the `{ }` block at 389) so the status computation at 1658 can read them. `isUserSaveReason` is already lazily `await import`ed — move that import up or duplicate it; preferred is hoisting the values computed at 391–394.

**Pseudocode at line 1658:**
```ts
const preserveFrozenStatus =
  isFrozen && isUserSaveReason(saveReason) &&
  (status === 'ready' || status === 'generated' || status === 'partial');

let nextStatus: 'ready' | 'generated' | 'partial' | 'failed' =
  preserveFrozenStatus
    ? (status as 'ready' | 'generated' | 'partial' | 'failed')
    : emptyItineraryDetected ? 'failed' : (persistVerdict.ok ? 'ready' : 'partial');
```

The downstream commit gate (lines 1668–1699) still runs and may demote `ready → partial` if integrity fails — that's correct and we want to keep it. The freeze-stamp branch at 1708 then no-ops when `nextStatus` was preserved as `partial`, and is idempotent when preserved as `ready` (uses `existingFrozenAt || new Date().toISOString()`).

### Files

- `supabase/functions/generate-itinerary/action-save-itinerary.ts`
  - Hoist `isFrozen` + `status` (and `isUserSaveReason` import) out of the frozen-gate block at 389–401 to function scope.
  - Wrap the `nextStatus` ternary at 1658–1659 with the `preserveFrozenStatus` guard.
  - Add a `[SAVE_STATUS_PRESERVED]` console log when the branch fires, for telemetry.

### Not changing

- `EditorialItinerary.tsx` — `skipContract: true` and `saveReason: 'user-ai-note-save'` stay (harmless, correct intent signal).
- `_shared/persist-itinerary.ts`, `_shared/frozen-guard.ts` — unchanged.
- Commit gate, freeze-stamp logic, no-shrink guard — unchanged.

### Why this is structural, not a patch

The frozen gate at line 395 already encodes "user edits may pass through frozen trips" via `isUserSaveReason`. That same intent must propagate to the status writer — otherwise a pass-through user edit silently re-freezes a partial trip. After this fix, every `user-*` / `chat-*` / `lock-*` / `drag-*` / etc. saveReason in `USER_SAVE_REASON_PREFIXES` is safe against this class of regression, not just AI notes.

### Verification

- Add a regression test alongside existing `action-save-itinerary` tests: given trip with `status='partial'`, save with `saveReason='user-ai-note-save'` + valid days → assert post-save `itinerary_status` is still `'partial'` and `metadata.itinerary_frozen_at` is unchanged (null).
- Manual: reproduce the original repro — partial trip, save AI note, trigger next generation leg, confirm all days persist.
