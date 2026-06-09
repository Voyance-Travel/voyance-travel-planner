/**
 * cross-day-dedup.ts — the final cross-day content cleanup, shared by BOTH the
 * generate-trip chain (v2/generate-trip-day-v2.ts) and the regenerate-day path
 * (action-generate-day.ts) so regenerated trips get the same treatment as
 * freshly-generated ones.
 *
 * On the full set of days it:
 *  - relabels a meal whose clock time contradicts its label (09:55 "Lunch" → Breakfast),
 *  - drops a same-day duplicate meal TYPE (a 2nd dinner) — even if AUTO-locked by
 *    the meal guard, but never a genuine user must-do,
 *  - swaps a cross-day duplicate restaurant to a city-matched alternative,
 *  - drops a cross-day duplicate non-meal venue (keep the first).
 *
 * Pure + idempotent (mutates the passed day objects in place). Logistics +
 * locked items are kept (locked meals register their venue so later days avoid
 * it, but are never swapped or dropped — except an auto-locked same-day dup).
 */
import { getRandomFallbackRestaurant } from '../fix-placeholders.ts';

/**
 * fetchAlternatives — optional async venue source for cities NOT in the inline
 * catalog (e.g. Seoul, Cairo). Called lazily, at most once, only when a
 * cross-day duplicate restaurant needs swapping and the inline catalog has no
 * match. Returns a pool of real venues (e.g. from Google Places via the
 * recommend-restaurants function). The caller wires it; this module stays
 * decoupled from Supabase/HTTP.
 */
export type FetchAlternatives = (city: string, count: number) => Promise<Array<{ name: string; address?: string; description?: string }>>;

export async function crossDayDedup(days: any[], city: string, fetchAlternatives?: FetchAlternatives): Promise<{ swaps: number; drops: number; relabels: number }> {
  if (!Array.isArray(days)) return { swaps: 0, drops: 0, relabels: 0 };
  let swaps = 0, drops = 0, relabels = 0;
  let pool: Array<{ name: string; address?: string; description?: string }> | null = null; // lazy non-catalog venue pool
  const lc = (s: any) => String(s || '').toLowerCase()
    .replace(/^\s*[a-z' ]*\b(breakfast|brunch|lunch|dinner|nightcap|drinks?|coffee|cocktails?|tea|supper|aperitivo|aperitif)\b\s+(at|in|with|@|by)\s+/i, '')
    .replace(/\s+/g, ' ').trim();
  const isLog = (a: any) => ['transport', 'transportation', 'transit', 'flight', 'accommodation', 'logistics'].includes(String(a?.category || '').toLowerCase());
  const isLk = (a: any) => !!(a?.locked || a?.isLocked || a?.lock_state === 'locked');
  // A genuine user must-do (never auto-dropped). Auto-locks from the meal guard
  // carry no lockedSource, so they're NOT protected here.
  const isUserMustDo = (a: any) => a?.lockedSource === 'must_do' || a?.lockedSource === 'user' || /must[_-]?do|user[_-]?anchor/i.test(String(a?.source || ''));
  const mealTypeOf = (a: any): 'breakfast' | 'lunch' | 'dinner' | null => {
    const tt = String(a?.title || a?.name || '').toLowerCase();
    if (/\bbreakfast\b/.test(tt)) return 'breakfast';
    if (/\blunch\b/.test(tt)) return 'lunch';
    if (/\bdinner\b/.test(tt)) return 'dinner';
    const c = String(a?.category || '').toLowerCase();
    return (c === 'dining' || c === 'restaurant') ? 'lunch' : null;
  };
  const prefixSame = (a: string, b: string) => { if (a === b) return true; const [s, l] = a.length < b.length ? [a, b] : [b, a]; return l.startsWith(s + ' '); };
  const pMin = (s: any) => { const m = String(s || '').match(/(\d{1,2}):(\d{2})/); return m ? (+m[1]) * 60 + (+m[2]) : null; };
  // Contiguous windows (no gap) so an in-between meal (e.g. 16:30) is relabeled
  // to the nearest meal: breakfast 05:00–11:30, lunch 11:00–16:30, dinner 16:30–23:30.
  const windowType = (m: number | null) => m == null ? null : (m >= 300 && m <= 690 ? 'breakfast' : m >= 660 && m <= 990 ? 'lunch' : m >= 990 && m <= 1410 ? 'dinner' : null);

  const c3City = city || '';
  const seenNonMeal: string[] = [];
  const usedMealNames = new Set<string>();
  for (const d of days) {
    if (!Array.isArray(d?.activities)) continue;
    const kept: any[] = [];
    const seenTypeToday = new Set<string>();
    for (const a of d.activities) {
      if (isLog(a)) { kept.push(a); continue; }

      // 1) meal-time relabel (text fix, applies even to locked) + same-day dup
      const ttX = String(a?.title || a?.name || '').toLowerCase();
      let mtExplicit = /\bbreakfast\b/.test(ttX) ? 'breakfast' : /\blunch\b/.test(ttX) ? 'lunch' : /\bdinner\b/.test(ttX) ? 'dinner' : null;
      if (mtExplicit) {
        const wt = windowType(pMin(a.startTime || a.time));
        if (wt && wt !== mtExplicit) {
          const lbl = wt[0].toUpperCase() + wt.slice(1);
          a.title = String(a.title || a.name || '').replace(/\b(breakfast|brunch|lunch|dinner)\b/i, lbl);
          a.name = a.title;
          mtExplicit = wt;
          relabels++;
        }
      }
      if (mtExplicit) {
        if (seenTypeToday.has(mtExplicit)) {
          // 2nd meal of this type today → drop unless it's a real user must-do.
          if (!isUserMustDo(a)) { drops++; continue; }
        } else {
          seenTypeToday.add(mtExplicit);
        }
      }

      // 2) cross-day venue passes
      const key = lc(a?.location?.name || a?.venue_name || a?.venueName || a?.title || a?.name);
      const keyOk = !!key && key.length >= 6;
      const mt = keyOk ? mealTypeOf(a) : null;
      if (mt) {
        if (usedMealNames.has(key)) {
          // duplicate restaurant across days → swap (auto-locks ok; not user must-dos)
          if (!isUserMustDo(a)) {
            const label = mt[0].toUpperCase() + mt.slice(1);
            const fb = getRandomFallbackRestaurant(c3City, mt, usedMealNames);
            if (fb?.name && !usedMealNames.has(lc(fb.name))) {
              a.title = `${label} at ${fb.name}`;
              a.name = a.title;
              a.location = a.location || {};
              a.location.name = fb.name;
              if (fb.address) a.location.address = fb.address;
              if (fb.description) a.description = fb.description;
              a.source = 'c3-restaurant-swap';
              usedMealNames.add(lc(fb.name));
              swaps++;
            } else if (fetchAlternatives) {
              // no inline catalog match (non-catalog city) → live venue source
              if (pool === null) { try { pool = (await fetchAlternatives(c3City, 15)) || []; } catch { pool = []; } }
              const alt = pool.find((p) => p?.name && !usedMealNames.has(lc(p.name)));
              if (alt) {
                a.title = `${label} at ${alt.name}`;
                a.name = a.title;
                a.location = a.location || {};
                a.location.name = alt.name;
                if (alt.address) a.location.address = alt.address;
                a.description = alt.description || `A well-regarded spot in ${c3City}.`;
                a.source = 'c3-places-swap';
                usedMealNames.add(lc(alt.name));
                swaps++;
              }
            }
          }
        } else {
          usedMealNames.add(key); // register (even locked) so later days avoid it
        }
        kept.push(a);
      } else if (keyOk && !isUserMustDo(a)) {
        // non-meal duplicate venue across days → drop (keep first)
        if (seenNonMeal.some((k) => prefixSame(k, key))) { drops++; continue; }
        seenNonMeal.push(key);
        kept.push(a);
      } else {
        kept.push(a); // locked non-meal or short key → keep
      }
    }
    d.activities = kept;
  }
  return { swaps, drops, relabels };
}
