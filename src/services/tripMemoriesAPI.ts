/**
 * Trip Memories API
 * CRUD operations for trip photo memories with Supabase storage
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export interface TripMemory {
  id: string;
  user_id: string;
  trip_id: string;
  activity_id: string | null;
  activity_name: string | null;
  image_url: string;
  caption: string | null;
  location_name: string | null;
  taken_at: string;
  created_at: string;
  day_number: number | null;
}

interface UploadMemoryInput {
  tripId: string;
  file: File;
  activityId?: string;
  activityName?: string;
  caption?: string;
  locationName?: string;
  dayNumber?: number;
}

const memoriesKeys = {
  all: ['trip-memories'] as const,
  byTrip: (tripId: string) => [...memoriesKeys.all, tripId] as const,
};

async function uploadMemory(input: UploadMemoryInput): Promise<TripMemory> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Upload file to storage
  const fileExt = input.file.name.split('.').pop();
  const fileName = `${user.id}/${input.tripId}/${Date.now()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('trip-memories')
    .upload(fileName, input.file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  // Generate signed URL (valid for 1 hour)
  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from('trip-memories')
    .createSignedUrl(fileName, 3600);

  if (signedUrlError || !signedUrlData?.signedUrl) throw signedUrlError || new Error('Failed to create signed URL');

  // Insert metadata record — store the storage path, not the URL
  const { data, error } = await supabase
    .from('trip_memories')
    .insert({
      user_id: user.id,
      trip_id: input.tripId,
      activity_id: input.activityId || null,
      activity_name: input.activityName || null,
      image_url: fileName,  // Store storage path, not public URL
      caption: input.caption || null,
      location_name: input.locationName || null,
      day_number: input.dayNumber || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as TripMemory;
}

async function fetchTripMemories(tripId: string): Promise<TripMemory[]> {
  const { data, error } = await supabase
    .from('trip_memories')
    .select('*')
    .eq('trip_id', tripId)
    .order('taken_at', { ascending: false });

  if (error) throw error;

  // Resolve signed URLs for each memory
  const memories = (data || []) as TripMemory[];
  const resolved = await Promise.all(
    memories.map(async (memory) => {
      // If image_url is a storage path (not a full URL), generate a signed URL
      if (memory.image_url && !memory.image_url.startsWith('http')) {
        const { data: signedData } = await supabase.storage
          .from('trip-memories')
          .createSignedUrl(memory.image_url, 3600);
        return { ...memory, image_url: signedData?.signedUrl || memory.image_url };
      }
      // Legacy: if it's already a full URL (old public URL), generate signed URL from path
      if (memory.image_url && memory.image_url.includes('/storage/v1/object/public/trip-memories/')) {
        const pathParts = memory.image_url.split('/storage/v1/object/public/trip-memories/');
        if (pathParts[1]) {
          const { data: signedData } = await supabase.storage
            .from('trip-memories')
            .createSignedUrl(decodeURIComponent(pathParts[1]), 3600);
          return { ...memory, image_url: signedData?.signedUrl || memory.image_url };
        }
      }
      return memory;
    })
  );
  return resolved;
}

async function deleteMemory(memoryId: string): Promise<void> {
  // Get the memory to find the image path
  const { data: memory, error: fetchError } = await supabase
    .from('trip_memories')
    .select('image_url')
    .eq('id', memoryId)
    .single();

  if (fetchError) throw fetchError;

  // Delete from storage — image_url may be a path or a legacy full URL
  if (memory?.image_url) {
    let storagePath = memory.image_url;
    if (storagePath.startsWith('http')) {
      // Legacy: extract path from full URL
      const pathParts = storagePath.split('/storage/v1/object/public/trip-memories/');
      storagePath = pathParts[1] ? decodeURIComponent(pathParts[1]) : '';
    }
    if (storagePath) {
      await supabase.storage.from('trip-memories').remove([storagePath]);
    }
  }

  const { error } = await supabase
    .from('trip_memories')
    .delete()
    .eq('id', memoryId);

  if (error) throw error;
}

async function updateMemoryCaption(memoryId: string, caption: string): Promise<void> {
  const { error } = await supabase
    .from('trip_memories')
    .update({ caption })
    .eq('id', memoryId);

  if (error) throw error;
}

// React Query hooks

export function useTripMemories(tripId: string | null) {
  return useQuery({
    queryKey: memoriesKeys.byTrip(tripId || ''),
    queryFn: () => fetchTripMemories(tripId!),
    enabled: !!tripId,
  });
}

export function useUploadMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: uploadMemory,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: memoriesKeys.byTrip(data.trip_id) });
      toast.success('Memory saved! 📸');
    },
    onError: () => {
      toast.error('Failed to save memory');
    },
  });
}

export function useDeleteMemory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMemory,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memoriesKeys.all });
      toast.success('Memory removed');
    },
    onError: () => {
      toast.error('Failed to delete memory');
    },
  });
}

export function useUpdateCaption() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ memoryId, caption }: { memoryId: string; caption: string }) =>
      updateMemoryCaption(memoryId, caption),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memoriesKeys.all });
    },
  });
}
