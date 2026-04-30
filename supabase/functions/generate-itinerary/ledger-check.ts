/**
 * ledger-check.ts — Post-generation validation of the Day Truth Ledger.
 *
 * Runs AFTER applyAnchorsWin. Catches the cases anchor-guard can't:
 *  - Fuzzy duplicates of "alreadyDone" titles on later days.
 *  - Activities that violate a known closure today.
 *
 * Returns a list of warnings + a (possibly mutated) days array with offending
 * activities removed. Does NOT regenerate; that's the caller's choice.
 */

import type { DayLedger } from './day-ledger.ts';

export interface LedgerCheckWarning {
  dayNumber: number;
  kind: 'missing_user_intent' | 'repeat_already_done' | 'closure_violation';
  detail: string;
}

export interface LedgerCheckResult {
  days: any[];
  warnings: LedgerCheckWarning[];
  removed: number;
}

function fuzzyMatch(a: string, b: string): boolean {
  const x = a.toLowerCase().trim();
  const y = b.toLowerCase().trim();
  if (!x || !y) return false;
  if (x === y) return true;
  if (x.includes(y) || y.includes(x)) return true;
  return false;
}

export function ledgerCheck(days: any[], ledgers: DayLedger[]): LedgerCheckResult {
  const warnings: LedgerCheckWarning[] = [];
  let removed = 0;
  if (!Array.isArray(days) || !Array.isArray(ledgers) || ledgers.length === 0) {
    return { days, warnings, removed };
  }

  const ledgerByDay = new Map<number, DayLedger>();
  for (const l of ledgers) ledgerByDay.set(l.dayNumber, l);

  const out = days.map((d) => ({
    ...d,
    activities: Array.isArray(d.activities) ? [...d.activities] : [],
  }));

  for (const day of out) {
    const dayNum = (day.dayNumber as number) || 0;
    const ledger = ledgerByDay.get(dayNum);
    if (!ledger) continue;

    // 1) Check missing userIntent
    for (const u of ledger.userIntent) {
      const present = day.activities.some((a: any) =>
        fuzzyMatch(a.title || a.name || '', u.title)
      );
      if (!present) {
        warnings.push({
          dayNumber: dayNum,
          kind: 'missing_user_intent',
          detail: `User-locked "${u.title}" missing on day ${dayNum} (anchor-guard should restore it).`,
        });
      }
    }

    // 2) Repeat-of-alreadyDone — drop offending activity (only if not user-locked)
    const doneSet = ledger.alreadyDone.map((p) => p.title.toLowerCase());
    day.activities = day.activities.filter((a: any) => {
      if (a.locked || a.isLocked || a.lockedSource) return true;
      const t = (a.title || a.name || '').toLowerCase().trim();
      if (!t) return true;
      const repeat = doneSet.some((d) => fuzzyMatch(t, d));
      if (repeat) {
        warnings.push({
          dayNumber: dayNum,
          kind: 'repeat_already_done',
          detail: `Removed "${a.title || a.name}" on day ${dayNum} — already scheduled on a prior day.`,
        });
        removed++;
        return false;
      }
      return true;
    });

    // 3) Closure violation — drop activity whose title matches a closure example
    for (const c of ledger.closures) {
      if (!c.examples || c.examples.length === 0) continue;
      day.activities = day.activities.filter((a: any) => {
        if (a.locked || a.isLocked || a.lockedSource) return true;
        const t = (a.title || a.name || '').toLowerCase().trim();
        const venue = (a.venue_name || a.location?.name || '').toLowerCase();
        const matchesClosed = c.examples!.some((ex) => {
          const exL = ex.toLowerCase();
          return t.includes(exL) || venue.includes(exL);
        });
        if (matchesClosed) {
          warnings.push({
            dayNumber: dayNum,
            kind: 'closure_violation',
            detail: `Removed "${a.title || a.name}" on day ${dayNum} — ${c.reason}.`,
          });
          removed++;
          return false;
        }
        return true;
      });
    }
  }

  return { days: out, warnings, removed };
}
