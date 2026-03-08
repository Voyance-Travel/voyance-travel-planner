import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { fetchManualEntries, type ManualEntry } from '@/services/communityGuidesAPI';

export interface GuideFavorite {
  id: string;
  activity_id: string;
  note: string | null;
  sort_order: number | null;
  trip_id: string;
  user_id: string;
  activity?: {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    image_url: string | null;
    location: Record<string, any> | null;
    day_number?: number | null;
    start_time?: string | null;
  };
}

export function useGuideFavorites(tripId: string | undefined) {
  return useQuery({
    queryKey: ['guide-favorites-full', tripId],
    queryFn: async () => {
      if (!tripId) return [];
      // @ts-ignore - joined select
      const { data, error } = await supabase
        .from('guide_favorites')
        .select('id, activity_id, note, sort_order, trip_id, user_id, activity:trip_activities(id, name, description, category, image_url, location, day_number, start_time)')
        .eq('trip_id', tripId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as GuideFavorite[];
    },
    enabled: !!tripId,
  });
}

export function useManualEntries(tripId: string | undefined) {
  return useQuery({
    queryKey: ['guide-manual-entries', tripId],
    queryFn: async () => {
      if (!tripId) return [];
      return fetchManualEntries(tripId);
    },
    enabled: !!tripId,
  });
}

export function useTripForGuide(tripId: string | undefined) {
  return useQuery({
    queryKey: ['trip-basics-guide', tripId],
    queryFn: async () => {
      if (!tripId) return null;
      const { data } = await supabase
        .from('trips')
        .select('id, name, destination, destination_country, start_date, end_date, travelers')
        .eq('id', tripId)
        .maybeSingle();
      return data;
    },
    enabled: !!tripId,
  });
}

export function useExistingGuide(tripId: string | undefined) {
  return useQuery({
    queryKey: ['community-guide-trip', tripId],
    queryFn: async () => {
      if (!tripId) return null;
      const { data } = await supabase
        .from('community_guides')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!tripId,
  });
}

/** Unified item type for the guide builder */
export interface GuideItem {
  id: string;
  type: 'favorite' | 'manual';
  name: string;
  description: string | null;
  category: string | null;
  note: string | null;
  image_url: string | null;
  external_url: string | null;
  day_number: number;
  start_time: string | null;
  sort_order: number;
}

export function mergeGuideItems(favorites: GuideFavorite[], manualEntries: ManualEntry[]): GuideItem[] {
  const favItems: GuideItem[] = favorites.map(f => ({
    id: f.id,
    type: 'favorite',
    name: f.activity?.name || 'Activity',
    description: f.activity?.description || null,
    category: f.activity?.category || null,
    note: f.note,
    image_url: f.activity?.image_url || null,
    external_url: null,
    day_number: f.activity?.day_number || 0,
    start_time: f.activity?.start_time || null,
    sort_order: f.sort_order || 0,
  }));

  const manualItems: GuideItem[] = manualEntries.map(m => ({
    id: m.id,
    type: 'manual',
    name: m.name,
    description: m.description,
    category: m.category,
    note: null,
    image_url: null,
    external_url: m.external_url,
    day_number: m.day_number,
    start_time: null,
    sort_order: m.sort_order,
  }));

  return [...favItems, ...manualItems].sort((a, b) => {
    if (a.day_number !== b.day_number) return a.day_number - b.day_number;
    return a.sort_order - b.sort_order;
  });
}

export function groupByDay(items: GuideItem[]): Map<number, GuideItem[]> {
  const groups = new Map<number, GuideItem[]>();
  for (const item of items) {
    const day = item.day_number || 0;
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(item);
  }
  return new Map([...groups.entries()].sort((a, b) => a[0] - b[0]));
}
