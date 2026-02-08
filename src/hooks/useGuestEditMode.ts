/**
 * Hook for managing the guest edit mode setting on a trip.
 * Owner can toggle between 'free_edit' and 'propose_approve'.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type GuestEditMode = 'free_edit' | 'propose_approve';

export function useGuestEditMode(tripId: string) {
  const queryClient = useQueryClient();

  const { data: guestEditMode = 'propose_approve' as GuestEditMode, isLoading } = useQuery({
    queryKey: ['guest-edit-mode', tripId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('trips')
        .select('guest_edit_mode')
        .eq('id', tripId)
        .single();

      if (error) throw error;
      return (data?.guest_edit_mode || 'propose_approve') as GuestEditMode;
    },
    enabled: !!tripId,
    staleTime: 60000,
  });

  const updateMode = useMutation({
    mutationFn: async (mode: GuestEditMode) => {
      const { error } = await supabase
        .from('trips')
        .update({ guest_edit_mode: mode })
        .eq('id', tripId);

      if (error) throw error;
    },
    onSuccess: (_, mode) => {
      queryClient.setQueryData(['guest-edit-mode', tripId], mode);
      toast.success(
        mode === 'free_edit'
          ? 'Guests can now edit freely'
          : 'Guests must propose changes for approval'
      );
    },
    onError: () => {
      toast.error('Failed to update guest permissions');
    },
  });

  return {
    guestEditMode,
    isLoading,
    isPropose: guestEditMode === 'propose_approve',
    isFreeEdit: guestEditMode === 'free_edit',
    setGuestEditMode: (mode: GuestEditMode) => updateMode.mutate(mode),
    isUpdating: updateMode.isPending,
  };
}
