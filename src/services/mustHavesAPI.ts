/**
 * Must-Haves API - Uses trip metadata in Supabase
 */
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Json } from '@/integrations/supabase/types';

export interface MustHave { id: string; tripId: string; label: string; notes?: string; aiGenerated: boolean; userModified: boolean; completed?: boolean; createdAt: string; updatedAt: string; }
export interface CreateMustHaveInput { tripId: string; label: string; notes?: string; }
export interface UpdateMustHaveInput { tripId: string; mustHaveId: string; label?: string; notes?: string; completed?: boolean; }
export interface DeleteMustHaveInput { tripId: string; mustHaveId: string; }

async function getTripMustHaves(tripId: string): Promise<MustHave[]> {
  const { data, error } = await supabase.from('trips').select('metadata').eq('id', tripId).single();
  if (error) throw new Error(error.message);
  const metadata = data?.metadata as Record<string, unknown> | null;
  return (metadata?.mustHaves as MustHave[]) || [];
}

async function saveTripMustHaves(tripId: string, mustHaves: MustHave[]): Promise<void> {
  const { data } = await supabase.from('trips').select('metadata').eq('id', tripId).single();
  const existing = (data?.metadata as Record<string, unknown>) || {};
  const updatedMetadata = { ...existing, mustHaves };
  const { error } = await supabase.from('trips').update({ metadata: updatedMetadata as unknown as Json }).eq('id', tripId);
  if (error) throw new Error(error.message);
}

export async function getMustHaves(tripId: string): Promise<MustHave[]> { return getTripMustHaves(tripId); }

export async function createMustHave(input: CreateMustHaveInput): Promise<MustHave> {
  const existing = await getTripMustHaves(input.tripId);
  const newItem: MustHave = { id: crypto.randomUUID(), tripId: input.tripId, label: input.label, notes: input.notes, aiGenerated: false, userModified: false, completed: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await saveTripMustHaves(input.tripId, [...existing, newItem]);
  return newItem;
}

export async function updateMustHave(input: UpdateMustHaveInput): Promise<MustHave> {
  const existing = await getTripMustHaves(input.tripId);
  const updated = existing.map(m => m.id === input.mustHaveId ? { ...m, ...input, userModified: true, updatedAt: new Date().toISOString() } : m);
  await saveTripMustHaves(input.tripId, updated);
  return updated.find(m => m.id === input.mustHaveId)!;
}

export async function deleteMustHave(input: DeleteMustHaveInput): Promise<{ success: boolean }> {
  const existing = await getTripMustHaves(input.tripId);
  await saveTripMustHaves(input.tripId, existing.filter(m => m.id !== input.mustHaveId));
  return { success: true };
}

export function useMustHaves(tripId: string | null) { return useQuery({ queryKey: ['must-haves', tripId], queryFn: () => tripId ? getMustHaves(tripId) : Promise.reject(), enabled: !!tripId }); }
export function useCreateMustHave() { const qc = useQueryClient(); return useMutation({ mutationFn: createMustHave, onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['must-haves', v.tripId] }) }); }
export function useUpdateMustHave() { const qc = useQueryClient(); return useMutation({ mutationFn: updateMustHave, onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['must-haves', v.tripId] }) }); }
export function useDeleteMustHave() { const qc = useQueryClient(); return useMutation({ mutationFn: deleteMustHave, onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['must-haves', v.tripId] }) }); }

export default { getMustHaves, createMustHave, updateMustHave, deleteMustHave };
