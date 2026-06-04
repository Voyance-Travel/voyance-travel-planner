/**
 * preserve-ledger-costs (Deno / edge runtime)
 *
 * Mirrors src/utils/preserveLedgerCosts.ts. When the cost-repair pipeline
 * stamps an activity in JSONB with cost.basis = 'repair_floor', a later
 * `save-itinerary` round-trip from in-memory client state would otherwise
 * silently downgrade the price back to the AI's original guess. This helper
 * walks the incoming itinerary against the previously-persisted itinerary
 * and force-keeps cost/estimatedCost on protected activities when the
 * incoming amount is materially lower.
 */

type AnyActivity = Record<string, unknown> & { id?: string };
type AnyDay = { activities?: AnyActivity[] } & Record<string, unknown>;

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
  const cost = a.cost as Record<string, unknown> | undefined;
  const basis = (cost?.basis as string | undefined) ?? (a.costBasis as string | undefined);
  if (basis && PROTECTED_BASIS.has(basis)) return true;
  const source = (cost?.source as string | undefined) ?? (a.costSource as string | undefined);
  if (source && PROTECTED_SOURCES.has(source)) return true;
  return false;
};

const amount = (a: AnyActivity | undefined): number => {
  const cost = a?.cost as Record<string, unknown> | undefined;
  const v = cost?.amount;
  return typeof v === 'number' && !isNaN(v) ? v : 0;
};

export function preserveLedgerCosts<T extends AnyDay>(
  prevDays: T[] | null | undefined,
  nextDays: T[] | null | undefined
): { days: T[]; preserved: number } {
  if (!Array.isArray(nextDays)) return { days: [], preserved: 0 };
  if (!Array.isArray(prevDays) || prevDays.length === 0) {
    return { days: nextDays, preserved: 0 };
  }
  const prevById = new Map<string, AnyActivity>();
  for (const d of prevDays) {
    for (const a of d?.activities ?? []) {
      if (a?.id) prevById.set(String(a.id), a);
    }
  }
  let preserved = 0;
  const days = nextDays.map((day) => ({
    ...day,
    activities: (day.activities ?? []).map((a) => {
      const prev = a?.id ? prevById.get(String(a.id)) : undefined;
      if (!isProtected(prev)) return a;
      if (amount(a) >= amount(prev)) return a;
      preserved++;
      return {
        ...a,
        cost: prev!.cost ?? a.cost,
        estimatedCost: prev!.estimatedCost ?? a.estimatedCost,
        costBasis: prev!.costBasis ?? a.costBasis,
        costSource: prev!.costSource ?? a.costSource,
      };
    }),
  }));
  return { days: days as T[], preserved };
}
