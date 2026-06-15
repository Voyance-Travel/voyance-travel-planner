/**
 * day-density — enforce a relaxed day's stop count deterministically. The
 * relaxed-pacing PROMPT asks for 3–5 stops but the model over-delivers (a live
 * Atlanta "walk around" day came back with 7 stops ending 22:10). This trims a
 * relaxed day to ~5 by keeping the earliest activities + the 3 canonical meals
 * and dropping the latest extras (a 4th "nightcap" dining, a 3rd+ activity).
 * Protected items (locked / user-authored / curated host-city events / must-dos)
 * and transit are always kept. Only removes; never reorders.
 */
const MEAL_RE = /\b(breakfast|brunch|lunch|dinner)\b/i;
const TRANSIT_RE = /\b(transit|transport|logistics|flight|transfer)\b/i;

function isDining(a: any): boolean {
  return /dining/i.test(String(a?.category ?? '')) || MEAL_RE.test(String(a?.title ?? a?.name ?? ''));
}
function isTransit(a: any): boolean {
  return TRANSIT_RE.test(String(a?.category ?? '')) || TRANSIT_RE.test(String(a?.title ?? a?.name ?? ''));
}
function isProtected(a: any): boolean {
  return !!(a?.locked || a?.isLocked || a?.isUserAuthored
    || a?.source === 'host-city-event' || a?.source === 'must-do-injection' || a?.anchorSource === 'must_do');
}
const startMin = (a: any): number => {
  const m = String(a?.startTime ?? a?.time ?? '').match(/(\d{1,2}):(\d{2})/);
  return m ? (+m[1]) * 60 + (+m[2]) : 9999;
};

/**
 * Trim a relaxed day: ≤3 meals + ≤maxActivities non-meal stops (earliest kept),
 * plus all transit + protected items. Returns the kept activities (original
 * relative order preserved) and a drop log.
 */
export function trimRelaxedDay(activities: any[], opts: { maxActivities?: number } = {}): { activities: any[]; dropped: string[] } {
  if (!Array.isArray(activities)) return { activities: activities ?? [], dropped: [] };
  const maxAct = opts.maxActivities ?? 2;
  const order = new Map<any, number>(activities.map((a, i) => [a, i]));
  const byTime = [...activities].sort((a, b) => startMin(a) - startMin(b));
  const dropSet = new Set<any>();
  // Protected stops (host-city events like the Fan Fest + watch party, must-dos,
  // locked) are kept AND consume the budget — so a World-Cup day of 3 meals + a
  // fan fest + a watch party = 5 stops, not 5+2. Transit is always kept (orphan
  // transit is cleaned separately).
  let mealBudget = 3, actBudget = maxAct;
  for (const a of byTime) {
    if (isTransit(a)) continue;
    if (isProtected(a)) { if (isDining(a)) mealBudget = Math.max(0, mealBudget - 1); else actBudget = Math.max(0, actBudget - 1); }
  }
  for (const a of byTime) {
    if (isTransit(a) || isProtected(a)) continue;
    if (isDining(a)) { if (mealBudget > 0) mealBudget--; else dropSet.add(a); }
    else if (actBudget > 0) actBudget--; else dropSet.add(a);
  }
  const kept = activities.filter((a) => !dropSet.has(a));
  const dropped = [...dropSet].sort((a, b) => (order.get(a)! - order.get(b)!)).map((a) => String(a.title ?? a.name ?? '?'));
  return { activities: kept, dropped };
}
