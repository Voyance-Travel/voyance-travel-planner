/**
 * preserveLedgerCosts
 *
 * Guards against autosave round-trips clobbering server-repaired prices in
 * `trips.itinerary_data`. When the cost-repair pipeline raises an activity to
 * a Michelin/ticketed/reference floor, it stamps the JSONB activity with
 * `cost.basis = 'repair_floor'` (and a `costSource`). Various React save
 * funnels later re-serialize the in-memory days array; if the in-memory copy
 * was loaded *before* the repair landed, those funnels would silently
 * downgrade the price back to the AI's original guess.
 *
 * This helper merges `nextDays` with `prevDays`: for every activity whose
 * previous JSONB carries a ledger-protected basis/source, we force-keep the
 * previous `cost` and `estimatedCost`. Everything else (manual edits, user
 * overrides, AI rewrites) is left alone.
 */

type AnyActivity = Record<string, any>;
type AnyDay = { activities?: AnyActivity[] } & Record<string, any>;

const PROTECTED_BASIS = new Set(['repair_floor']);
const PROTECTED_SOURCES = new Set([
  'michelin_floor',
  'ticketed_attraction_floor',
  'auto_corrected',
  'reference_fallback',
  'transit_cap_repair',
]);

const isProtected = (a: AnyActivity | undefined): boolean => {
  if (!a) return false;
  const basis = a.cost?.basis ?? a.costBasis;
  if (basis && PROTECTED_BASIS.has(String(basis))) return true;
  const source = a.cost?.source ?? a.costSource;
  if (source && PROTECTED_SOURCES.has(String(source))) return true;
  return false;
};

export function preserveLedgerCosts<T extends AnyDay>(
  prevDays: T[] | null | undefined,
  nextDays: T[] | null | undefined
): T[] {
  if (!Array.isArray(nextDays)) return (nextDays ?? []) as T[];
  if (!Array.isArray(prevDays) || prevDays.length === 0) return nextDays;

  const prevById = new Map<string, AnyActivity>();
  for (const d of prevDays) {
    for (const a of d?.activities ?? []) {
      if (a?.id) prevById.set(String(a.id), a);
    }
  }
  if (prevById.size === 0) return nextDays;

  return nextDays.map((day) => ({
    ...day,
    activities: (day.activities ?? []).map((a) => {
      const prev = a?.id ? prevById.get(String(a.id)) : undefined;
      if (!isProtected(prev)) return a;
      // Only override if the new copy is materially lower (or missing) — we
      // never want to clobber a legitimate user-driven raise.
      const prevAmt = Number(prev?.cost?.amount ?? 0);
      const nextAmt = Number(a?.cost?.amount ?? 0);
      if (nextAmt >= prevAmt) return a;
      return {
        ...a,
        cost: prev!.cost ?? a.cost,
        estimatedCost: prev!.estimatedCost ?? a.estimatedCost,
        costBasis: prev!.costBasis ?? a.costBasis,
        costSource: prev!.costSource ?? a.costSource,
      };
    }),
  }));
}
