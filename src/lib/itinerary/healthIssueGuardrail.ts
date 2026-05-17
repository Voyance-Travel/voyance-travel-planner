import { canonicalStart, canonicalEnd, parseHM } from './timingTruth';

interface HealthIssue {
  id: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  fixLabel?: string;
  fixAction?: string;
  dayNumber?: number;
  [k: string]: any;
}

function dayHasMealCard(activities: any[], meal: 'breakfast' | 'lunch' | 'dinner'): boolean {
  const DINING_CATS = ['dining', 'restaurant', 'food', 'cafe', 'bar'];
  const titleRe =
    meal === 'breakfast'
      ? /\b(breakfast|brunch)\b/i
      : meal === 'lunch'
        ? /\blunch\b/i
        : /\b(dinner|supper)\b/i;
  for (const a of activities || []) {
    const cat = String(a?.category || a?.type || '').toLowerCase();
    const isDining = DINING_CATS.some((c) => cat.includes(c));
    const title = String(a?.title || a?.name || '');
    if (isDining && titleRe.test(title)) return true;
    if (!isDining) continue;
    // Also accept dining cards in the canonical time window for the meal type.
    const start = parseHM(canonicalStart(a));
    if (start === null) continue;
    if (meal === 'breakfast' && start >= 6 * 60 && start < 11 * 60) return true;
    if (meal === 'lunch' && start >= 11 * 60 && start < 15 * 60) return true;
    if (meal === 'dinner' && start >= 17 * 60 && start <= 22 * 60) return true;
  }
  return false;
}

function overlapStillExists(activities: any[], aId: string, bId: string): boolean {
  const a = activities.find((x) => x?.id === aId);
  const b = activities.find((x) => x?.id === bId);
  if (!a || !b) return false;
  const aStart = parseHM(canonicalStart(a));
  const aEnd = parseHM(canonicalEnd(a));
  const bStart = parseHM(canonicalStart(b));
  const bEnd = parseHM(canonicalEnd(b));
  if (aStart === null || aEnd === null || bStart === null || bEnd === null) return false;
  return aStart < bEnd && bStart < aEnd;
}

export function guardrailHealthIssues(issues: HealthIssue[], days: any[]): HealthIssue[] {
  if (!Array.isArray(issues) || issues.length === 0) return issues;
  const filtered: HealthIssue[] = [];
  for (const issue of issues) {
    // Filter false-positive "Day N missing X" when the meal IS in render state.
    const missingMatch = /Day\s+(\d+)\s+missing\s+([^.]+)/i.exec(issue.message || '');
    if (missingMatch) {
      const dn = parseInt(missingMatch[1], 10);
      const missingList = missingMatch[2].toLowerCase();
      const day = (days || []).find((d: any) => d?.dayNumber === dn);
      if (day?.activities) {
        const stillMissing: string[] = [];
        for (const m of ['breakfast', 'lunch', 'dinner'] as const) {
          if (missingList.includes(m) && !dayHasMealCard(day.activities, m)) {
            stillMissing.push(m);
          }
        }
        if (stillMissing.length === 0) {
          console.log(
            `[HealthGuardrail] Suppressed false-positive: "${issue.message}" - all meals present on Day ${dn}`,
          );
          continue;
        }
        // Rewrite the message to only mention truly-missing meals.
        issue.message = `Day ${dn} missing ${stillMissing.join(', ')}`;
      }
    }
    // Filter false-positive timing-conflict issues whose pair no longer overlaps.
    if (issue.id && /^conflict-|^overlap-|^timing-/.test(issue.id)) {
      const idParts = String(issue.id).split('|');
      const aId = idParts[1];
      const bId = idParts[2];
      if (aId && bId && issue.dayNumber != null) {
        const day = (days || []).find((d: any) => d?.dayNumber === issue.dayNumber);
        if (day?.activities && !overlapStillExists(day.activities, aId, bId)) {
          console.log(`[HealthGuardrail] Suppressed false-positive overlap: ${issue.id}`);
          continue;
        }
      }
    }
    filtered.push(issue);
  }
  return filtered;
}
