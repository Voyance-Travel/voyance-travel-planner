import { supabase } from '@/integrations/supabase/client';

export interface ManualEntry {
  id: string;
  trip_id: string;
  user_id: string;
  name: string;
  category: string;
  description: string | null;
  external_url: string | null;
  day_number: number;
  sort_order: number;
  created_at: string;
}

export interface ManualEntryInput {
  trip_id: string;
  user_id: string;
  name: string;
  category: string;
  description?: string | null;
  external_url?: string | null;
  day_number: number;
  sort_order?: number;
}

/** Fetch manual entries for a trip */
export async function fetchManualEntries(tripId: string): Promise<ManualEntry[]> {
  const { data, error } = await supabase
    .from('guide_manual_entries')
    .select('*')
    .eq('trip_id', tripId)
    .order('day_number', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []) as ManualEntry[];
}

/** Create a manual entry */
export async function createManualEntry(input: ManualEntryInput): Promise<ManualEntry> {
  const { data, error } = await supabase
    .from('guide_manual_entries')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as ManualEntry;
}

/** Delete a manual entry */
export async function deleteManualEntry(id: string): Promise<void> {
  const { error } = await supabase
    .from('guide_manual_entries')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

/** Delete a guide favorite */
export async function deleteGuideFavorite(id: string): Promise<void> {
  const { error } = await supabase
    .from('guide_favorites')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

/** Update a guide favorite's note */
export async function updateFavoriteNote(id: string, note: string | null): Promise<void> {
  const { error } = await supabase
    .from('guide_favorites')
    .update({ note })
    .eq('id', id);
  if (error) throw error;
}

/** Validate external URL */
export function validateExternalUrl(raw: string): { url?: string; error?: string } {
  let url = raw.trim();
  if (!url) return { url: '' };

  const lower = url.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('ftp:')) {
    return { error: 'Invalid URL protocol. Only HTTPS URLs are allowed.' };
  }

  if (lower.startsWith('http://')) {
    return { error: 'Please use HTTPS (not HTTP) for security.' };
  }

  if (!url.startsWith('https://')) {
    url = 'https://' + url;
  }

  try {
    new URL(url);
  } catch {
    return { error: 'Please enter a valid URL' };
  }

  return { url };
}
