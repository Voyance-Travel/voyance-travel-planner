/**
 * frozen-guard — single source of truth for "is this itinerary locked".
 *
 * Once a trip stamps `metadata.itinerary_frozen_at` (or its status is `ready`
 * or `generated`), no background / refresh-time write may touch
 * `trips.itinerary_data`. Only explicit user-initiated edits (chat actions,
 * regeneration, lock toggles, drag/reorder, undo/redo, smart-finish, …) may
 * pass through, and they must opt in via `allowFrozenWrite: true` or carry a
 * whitelisted `saveReason`.
 *
 * Wired at:
 *   - `_shared/persist-itinerary.ts` (THE chokepoint) — blocks JSONB writes.
 *   - `generate-itinerary/action-save-itinerary.ts` — blocks at the edge fn
 *     entry so non-whitelisted save reasons no-op even before persist.
 *   - `generate-itinerary/action-repair-costs.ts` — skips JSONB writeback.
 *   - `sync-trip-cost-table/index.ts` — flips to insert-only mode.
 *
 * See mem://constraints/itinerary/frozen-after-ready.
 */

export interface FrozenStatus {
  frozen: boolean;
  frozenAt: string | null;
  status: string;
}

/** Read trip's frozen status. Returns `{ frozen: false, ... }` on any read
 *  failure so transient DB errors never silently lock callers out. */
export async function isTripFrozen(supabase: any, tripId: string): Promise<FrozenStatus> {
  try {
    const { data, error } = await supabase
      .from('trips')
      .select('itinerary_status, metadata')
      .eq('id', tripId)
      .maybeSingle();
    if (error || !data) return { frozen: false, frozenAt: null, status: '' };
    const meta = (data.metadata as Record<string, any>) || {};
    const frozenAt: string | null = meta?.itinerary_frozen_at || null;
    const status = String(data.itinerary_status || '');
    const frozen = !!frozenAt || status === 'ready' || status === 'generated';
    return { frozen, frozenAt, status };
  } catch {
    return { frozen: false, frozenAt: null, status: '' };
  }
}

/**
 * Whitelist for legitimate user-initiated save reasons. Any save fired by a
 * background loop (auto-repair, optimistic resync, page-load self-heal,
 * cost-table backfill, …) MUST NOT match this list.
 *
 * Matched as a leading prefix on the `saveReason` string.
 */
export const USER_SAVE_REASON_PREFIXES: ReadonlyArray<string> = [
  'user-',
  'chat-',
  'lock-',
  'unlock-',
  'regenerate-',
  'undo-',
  'redo-',
  'smart-finish-',
  'fill-gap-',
  'swap-',
  'optimistic-',
  'edit-',
  'delete-',
  'add-',
  'drag-',
  'reorder-',
  'date-change-',
  'force-save',
  'restore-frozen-snapshot',
  'apply-action',
  'apply-recommendation',
];

/**
 * Integrity-heal save reasons. Deterministic, idempotent passes that only
 * mutate provably-bad data flagged by `persist_validation`. Always allowed
 * through the freeze gate so a known-broken Day-1 pre-dawn cascade or
 * post-checkout leisure leak can be repaired on the next page-load without
 * a user edit. Keep this list TINY — every entry must correspond to a
 * narrow, append-only normalizer with a regression test.
 *
 * See mem://constraints/itinerary/frozen-after-ready.
 */
export const INTEGRITY_HEAL_SAVE_REASONS: ReadonlyArray<string> = [
  'self-heal-predawn-cascade',
  'self-heal-departure-logistics',
  'self-heal-post-checkout-prune',
  'self-heal-seed-intents',
];

export function isIntegrityHealSaveReason(saveReason: string | undefined | null): boolean {
  if (!saveReason || typeof saveReason !== 'string') return false;
  const r = saveReason.trim();
  return INTEGRITY_HEAL_SAVE_REASONS.some((p) => r === p || r.startsWith(p));
}

export function isUserSaveReason(saveReason: string | undefined | null): boolean {
  if (!saveReason || typeof saveReason !== 'string') return false;
  const r = saveReason.trim();
  if (!r) return false;
  if (USER_SAVE_REASON_PREFIXES.some((p) => r === p || r.startsWith(p))) return true;
  // Integrity-heal reasons piggyback on the user gate so callers don't need
  // to thread `allowFrozenWrite: true` through every layer.
  if (isIntegrityHealSaveReason(r)) return true;
  return false;
}

export interface AssertWriteAllowedArgs {
  frozen: boolean;
  allowFrozenWrite?: boolean;
  saveReason?: string;
  label?: string;
}

export interface WriteAllowedResult {
  allowed: boolean;
  blocked: boolean;
  reason?: string;
}

/**
 * Decide whether a write to `trips.itinerary_data` is allowed.
 *
 * - Not frozen → always allowed.
 * - Frozen + explicit `allowFrozenWrite:true` → allowed.
 * - Frozen + whitelisted `saveReason` → allowed.
 * - Frozen + anything else → blocked.
 */
export function assertWriteAllowed(args: AssertWriteAllowedArgs): WriteAllowedResult {
  if (!args.frozen) return { allowed: true, blocked: false };
  if (args.allowFrozenWrite === true) return { allowed: true, blocked: false };
  if (isUserSaveReason(args.saveReason)) return { allowed: true, blocked: false };
  return {
    allowed: false,
    blocked: true,
    reason: `frozen:${args.saveReason || 'unspecified'}`,
  };
}
