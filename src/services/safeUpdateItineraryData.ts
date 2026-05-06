import { supabase } from '@/integrations/supabase/client';
import { preserveLedgerCosts } from '@/utils/preserveLedgerCosts';

/**
 * Direct trips.itinerary_data writes from React state can silently downgrade
 * server-repaired Michelin/ticketed/reference floor prices when the in-memory
 * copy was serialized before the repair landed. This wrapper fetches the
 * currently-persisted itinerary, runs preserveLedgerCosts to keep protected
 * cost fields, then writes — so the JSONB cost chips stay in sync with the
 * activity_costs ledger across all autosave funnels.
 */
export async function safeUpdateItineraryData(
  tripId: string,
  nextItinerary: { days?: any[] } & Record<string, any>,
  extraFields: Record<string, any> = {}
): Promise<{ error: any } | undefined> {
  try {
    const { data: current } = await supabase
      .from('trips')
      .select('itinerary_data')
      .eq('id', tripId)
      .maybeSingle();

    const prevDays = (current?.itinerary_data as any)?.days ?? [];
    const nextDays = nextItinerary?.days ?? [];
    const preservedDays = preserveLedgerCosts(prevDays, nextDays);
    const merged = { ...nextItinerary, days: preservedDays };

    return await supabase
      .from('trips')
      .update({
        itinerary_data: merged as any,
        updated_at: new Date().toISOString(),
        ...extraFields,
      })
      .eq('id', tripId);
  } catch (err) {
    console.error('[safeUpdateItineraryData] failed, falling back to raw write:', err);
    return await supabase
      .from('trips')
      .update({
        itinerary_data: nextItinerary as any,
        updated_at: new Date().toISOString(),
        ...extraFields,
      })
      .eq('id', tripId);
  }
}
