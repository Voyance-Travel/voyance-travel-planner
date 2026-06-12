/**
 * places-alternatives.ts — wires the recommend-restaurants edge function (Google
 * Places New API) as the live venue source for the cross-day de-dup, so cities
 * NOT in the inline catalog (Seoul, Cairo, …) still get a real alternative when
 * a duplicate restaurant needs swapping.
 *
 * Returns a FetchAlternatives callback for crossDayDedup. The de-dup calls it
 * lazily (at most once per trip, only when an inline-catalog swap misses), so a
 * catalog city or a trip with no duplicates never triggers a Places call.
 */
import type { FetchAlternatives } from './cross-day-dedup.ts';

export function makePlacesAlternatives(supabase: any, userId?: string): FetchAlternatives {
  return async (city: string, count: number) => {
    try {
      // userId switches on recommend-restaurants' personalization: it loads
      // user_preferences (dietary_restrictions, food likes/dislikes, taste
      // graph) and scores dietaryFit. Without it every swap replacement was
      // dietary-BLIND — a vegan profile's duplicate lunch could be swapped to
      // any well-rated tapas bar (DNA depth probe, bug 15). The machinery
      // already existed; the swap path just never identified the traveler.
      const { data, error } = await supabase.functions.invoke('recommend-restaurants', {
        body: { destination: city, mealType: 'any', maxResults: Math.max(8, count), minRating: 4.0, ...(userId ? { userId } : {}) },
      });
      if (error) { console.warn('[places-alt] recommend-restaurants error:', error?.message || error); return []; }
      const recs: any[] = (data?.recommendations || data?.restaurants || []);
      const out = recs
        .map((r) => ({
          name: String(r?.name || '').trim(),
          address: r?.address ? String(r.address) : undefined,
          description: Array.isArray(r?.cuisine) && r.cuisine[0] ? `A well-rated ${String(r.cuisine[0]).toLowerCase()} spot in ${city}.` : undefined,
        }))
        .filter((r) => r.name.length >= 2);
      console.log(`[places-alt] fetched ${out.length} alternative venues for ${city}`);
      return out;
    } catch (e) {
      console.warn('[places-alt] fetch failed (non-blocking):', (e as any)?.message || e);
      return [];
    }
  };
}
