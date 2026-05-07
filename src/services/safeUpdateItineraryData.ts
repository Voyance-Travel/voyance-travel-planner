import { supabase } from '@/integrations/supabase/client';
import { preserveLedgerCosts } from '@/utils/preserveLedgerCosts';

/**
 * Direct trips.itinerary_data writes from React state can silently downgrade
 * server-repaired Michelin/ticketed/reference floor prices when the in-memory
 * copy was serialized before the repair landed. This wrapper fetches the
 * currently-persisted itinerary, runs preserveLedgerCosts to keep protected
 * cost fields, then writes through the backend `save-itinerary` action so the
 * persist-day contract (ghost rows, placeholder names, prompt artifacts,
 * cross-city venues) runs on every client write path.
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

    const { error } = await supabase.functions.invoke('generate-itinerary', {
      body: {
        action: 'save-itinerary',
        tripId,
        itinerary: merged,
        extraUpdate: { ...extraFields, updated_at: new Date().toISOString() },
      },
    });
    if (!error) return { error: null };
    console.warn('[safeUpdateItineraryData] backend save failed, falling back:', error);

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
      })
      .eq('id', tripId);
  }
}
