// Agent Itinerary Library API Service
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { EditorialActivity, EditorialDay } from '@/components/itinerary/EditorialItinerary';

export type LibraryItemType = 'activity' | 'day' | 'trip_template';

export interface LibraryItem {
  id: string;
  agent_id: string;
  name: string;
  description?: string | null;
  item_type: LibraryItemType;
  tags?: string[] | null;
  destination_hint?: string | null;
  content: EditorialActivity | EditorialDay | TripTemplate;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

export interface TripTemplate {
  name: string;
  destination?: string;
  duration_days: number;
  days: EditorialDay[];
  notes?: string;
}

export interface CreateLibraryItemInput {
  name: string;
  description?: string;
  item_type: LibraryItemType;
  tags?: string[];
  destination_hint?: string;
  content: EditorialActivity | EditorialDay | TripTemplate;
}

// Helper to cast objects for Supabase inserts
const toJson = (obj: unknown): Json => obj as Json;

// ============ LIBRARY ITEMS ============

export async function getLibraryItems(filters?: { 
  itemType?: LibraryItemType; 
  search?: string;
  destinationHint?: string;
}): Promise<LibraryItem[]> {
  let query = supabase
    .from('agent_itinerary_library')
    .select('*')
    .order('usage_count', { ascending: false });
  
  if (filters?.itemType) {
    query = query.eq('item_type', filters.itemType);
  }
  
  if (filters?.destinationHint) {
    query = query.ilike('destination_hint', `%${filters.destinationHint}%`);
  }
  
  if (filters?.search) {
    query = query.or(`name.ilike.%${filters.search}%,description.ilike.%${filters.search}%`);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return (data || []) as unknown as LibraryItem[];
}

export async function getLibraryItem(id: string): Promise<LibraryItem | null> {
  const { data, error } = await supabase
    .from('agent_itinerary_library')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  
  if (error) throw error;
  return data as unknown as LibraryItem;
}

export async function createLibraryItem(item: CreateLibraryItemInput): Promise<LibraryItem> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const insertData = {
    agent_id: user.user.id,
    name: item.name,
    description: item.description,
    item_type: item.item_type,
    tags: item.tags,
    destination_hint: item.destination_hint,
    content: toJson(item.content),
  };

  const { data, error } = await supabase
    .from('agent_itinerary_library')
    .insert(insertData)
    .select()
    .single();
  
  if (error) throw error;
  return data as unknown as LibraryItem;
}

export async function updateLibraryItem(id: string, updates: Partial<CreateLibraryItemInput>): Promise<LibraryItem> {
  const updateData: Record<string, unknown> = {};
  
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.tags !== undefined) updateData.tags = updates.tags;
  if (updates.destination_hint !== undefined) updateData.destination_hint = updates.destination_hint;
  if (updates.content !== undefined) updateData.content = toJson(updates.content);

  const { data, error } = await supabase
    .from('agent_itinerary_library')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return data as unknown as LibraryItem;
}

export async function deleteLibraryItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('agent_itinerary_library')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

export async function incrementUsageCount(id: string): Promise<void> {
  // Fetch current count and increment
  const { data: item } = await supabase
    .from('agent_itinerary_library')
    .select('usage_count')
    .eq('id', id)
    .single();
  
  if (item) {
    await supabase
      .from('agent_itinerary_library')
      .update({ usage_count: (item.usage_count || 0) + 1 })
      .eq('id', id);
  }
}

// ============ TRIP CLONING ============

export async function cloneAgencyTrip(tripId: string, newName: string): Promise<string> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  // Fetch the original trip
  const { data: originalTrip, error: fetchError } = await supabase
    .from('agency_trips')
    .select('*')
    .eq('id', tripId)
    .single();
  
  if (fetchError || !originalTrip) throw new Error('Trip not found');

  // Create the cloned trip
  const { data: newTrip, error: insertError } = await supabase
    .from('agency_trips')
    .insert({
      agent_id: user.user.id,
      account_id: originalTrip.account_id,
      name: newName,
      description: originalTrip.description,
      destination: originalTrip.destination,
      destinations: originalTrip.destinations,
      start_date: null, // Clear dates for the clone
      end_date: null,
      status: 'inquiry',
      pipeline_stage: 1,
      trip_type: originalTrip.trip_type,
      traveler_count: originalTrip.traveler_count,
      notes: originalTrip.notes,
      internal_notes: `Cloned from: ${originalTrip.name}`,
      tags: originalTrip.tags,
      currency: originalTrip.currency,
      itinerary_data: originalTrip.itinerary_data, // Clone the itinerary
    })
    .select('id')
    .single();
  
  if (insertError || !newTrip) throw new Error('Failed to clone trip');

  // Optionally clone booking segments (as templates without confirmations)
  const { data: segments } = await supabase
    .from('agency_booking_segments')
    .select('*')
    .eq('trip_id', tripId);

  if (segments && segments.length > 0) {
    const clonedSegments = segments.map(seg => ({
      agent_id: user.user.id,
      trip_id: newTrip.id,
      segment_type: seg.segment_type,
      status: 'pending' as const,
      vendor_name: seg.vendor_name,
      vendor_code: seg.vendor_code,
      confirmation_number: null, // Clear confirmation
      origin: seg.origin,
      origin_code: seg.origin_code,
      destination: seg.destination,
      destination_code: seg.destination_code,
      cabin_class: seg.cabin_class,
      room_type: seg.room_type,
      room_count: seg.room_count,
      notes: seg.notes,
      currency: seg.currency,
    }));

    await supabase
      .from('agency_booking_segments')
      .insert(clonedSegments);
  }

  return newTrip.id;
}
