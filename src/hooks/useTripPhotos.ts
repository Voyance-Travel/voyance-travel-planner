import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface TripPhoto {
  id: string;
  tripId: string;
  userId: string;
  storagePath: string;
  fileName: string;
  fileSizeBytes?: number;
  mimeType?: string;
  caption?: string;
  takenAt?: string;
  dayNumber?: number;
  activityId?: string;
  location?: {
    name?: string;
    lat?: number;
    lng?: number;
  };
  isFavorite: boolean;
  isCover: boolean;
  createdAt: string;
  publicUrl: string;
}

interface UseTripPhotosReturn {
  photos: TripPhoto[];
  isLoading: boolean;
  error: string | null;
  uploadPhoto: (file: File, options?: UploadOptions) => Promise<TripPhoto | null>;
  deletePhoto: (photoId: string) => Promise<boolean>;
  updatePhoto: (photoId: string, updates: Partial<TripPhoto>) => Promise<boolean>;
  toggleFavorite: (photoId: string) => Promise<boolean>;
  setCoverPhoto: (photoId: string) => Promise<boolean>;
  refetch: () => Promise<void>;
}

interface UploadOptions {
  caption?: string;
  dayNumber?: number;
  activityId?: string;
  takenAt?: string;
}

export function useTripPhotos(tripId: string | null): UseTripPhotosReturn {
  const [photos, setPhotos] = useState<TripPhoto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const getSignedUrl = async (storagePath: string): Promise<string> => {
    const { data, error } = await supabase.storage
      .from('trip-photos')
      .createSignedUrl(storagePath, 3600);
    if (error || !data?.signedUrl) {
      console.error('Failed to create signed URL:', error);
      return '';
    }
    return data.signedUrl;
  };

  const fetchPhotos = useCallback(async () => {
    if (!tripId) {
      setPhotos([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('trip_photos')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const mappedPhotos: TripPhoto[] = await Promise.all(
        (data || []).map(async (row) => ({
          id: row.id,
          tripId: row.trip_id,
          userId: row.user_id,
          storagePath: row.storage_path,
          fileName: row.file_name,
          fileSizeBytes: row.file_size_bytes,
          mimeType: row.mime_type,
          caption: row.caption,
          takenAt: row.taken_at,
          dayNumber: row.day_number,
          activityId: row.activity_id,
          location: row.location as TripPhoto['location'],
          isFavorite: row.is_favorite || false,
          isCover: row.is_cover || false,
          createdAt: row.created_at,
          publicUrl: await getSignedUrl(row.storage_path),
        }))
      );

      setPhotos(mappedPhotos);
    } catch (err: any) {
      console.error('Failed to fetch trip photos:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  const uploadPhoto = async (file: File, options?: UploadOptions): Promise<TripPhoto | null> => {
    if (!tripId || !user?.id) {
      toast.error('Please sign in to upload photos');
      return null;
    }

    try {
      // Create unique file path: userId/tripId/timestamp_filename
      const timestamp = Date.now();
      const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const storagePath = `${user.id}/${tripId}/${timestamp}_${safeFileName}`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('trip-photos')
        .upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) throw uploadError;

      // Insert record into trip_photos table
      const { data: photoData, error: insertError } = await supabase
        .from('trip_photos')
        .insert({
          trip_id: tripId,
          user_id: user.id,
          storage_path: storagePath,
          file_name: file.name,
          file_size_bytes: file.size,
          mime_type: file.type,
          caption: options?.caption,
          day_number: options?.dayNumber,
          activity_id: options?.activityId,
          taken_at: options?.takenAt,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const newPhoto: TripPhoto = {
        id: photoData.id,
        tripId: photoData.trip_id,
        userId: photoData.user_id,
        storagePath: photoData.storage_path,
        fileName: photoData.file_name,
        fileSizeBytes: photoData.file_size_bytes,
        mimeType: photoData.mime_type,
        caption: photoData.caption,
        takenAt: photoData.taken_at,
        dayNumber: photoData.day_number,
        activityId: photoData.activity_id,
        location: photoData.location as TripPhoto['location'],
        isFavorite: photoData.is_favorite || false,
        isCover: photoData.is_cover || false,
        createdAt: photoData.created_at,
        publicUrl: await getSignedUrl(photoData.storage_path),
      };

      setPhotos(prev => [newPhoto, ...prev]);
      toast.success('Photo uploaded!');
      return newPhoto;
    } catch (err: any) {
      console.error('Failed to upload photo:', err);
      toast.error(err.message || 'Failed to upload photo');
      return null;
    }
  };

  const deletePhoto = async (photoId: string): Promise<boolean> => {
    const photo = photos.find(p => p.id === photoId);
    if (!photo) return false;

    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('trip-photos')
        .remove([photo.storagePath]);

      if (storageError) throw storageError;

      // Delete from database
      const { error: dbError } = await supabase
        .from('trip_photos')
        .delete()
        .eq('id', photoId);

      if (dbError) throw dbError;

      setPhotos(prev => prev.filter(p => p.id !== photoId));
      toast.success('Photo deleted');
      return true;
    } catch (err: any) {
      console.error('Failed to delete photo:', err);
      toast.error(err.message || 'Failed to delete photo');
      return false;
    }
  };

  const updatePhoto = async (photoId: string, updates: Partial<TripPhoto>): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('trip_photos')
        .update({
          caption: updates.caption,
          day_number: updates.dayNumber,
          activity_id: updates.activityId,
          is_favorite: updates.isFavorite,
          is_cover: updates.isCover,
        })
        .eq('id', photoId);

      if (error) throw error;

      setPhotos(prev => prev.map(p => 
        p.id === photoId ? { ...p, ...updates } : p
      ));
      return true;
    } catch (err: any) {
      console.error('Failed to update photo:', err);
      toast.error(err.message || 'Failed to update photo');
      return false;
    }
  };

  const toggleFavorite = async (photoId: string): Promise<boolean> => {
    const photo = photos.find(p => p.id === photoId);
    if (!photo) return false;
    return updatePhoto(photoId, { isFavorite: !photo.isFavorite });
  };

  const setCoverPhoto = async (photoId: string): Promise<boolean> => {
    try {
      // First, unset any existing cover photos for this trip
      await supabase
        .from('trip_photos')
        .update({ is_cover: false })
        .eq('trip_id', tripId);

      // Set the new cover photo
      const { error } = await supabase
        .from('trip_photos')
        .update({ is_cover: true })
        .eq('id', photoId);

      if (error) throw error;

      setPhotos(prev => prev.map(p => ({
        ...p,
        isCover: p.id === photoId,
      })));
      
      toast.success('Cover photo updated');
      return true;
    } catch (err: any) {
      console.error('Failed to set cover photo:', err);
      toast.error(err.message || 'Failed to set cover photo');
      return false;
    }
  };

  return {
    photos,
    isLoading,
    error,
    uploadPhoto,
    deletePhoto,
    updatePhoto,
    toggleFavorite,
    setCoverPhoto,
    refetch: fetchPhotos,
  };
}
