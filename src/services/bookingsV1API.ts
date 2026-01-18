/**
 * Bookings V1 API - Uses Supabase Edge Functions
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CheckoutSessionParams { tripId: string; customerId?: string; }
export interface CheckoutSessionResponse { success: boolean; sessionId: string; url: string; expiresAt: string; totalAmount: number; currency: string; }
export interface BookingStatusResponse { success: boolean; tripId: string; status: 'pending' | 'confirmed' | 'cancelled' | 'expired'; paymentStatus: 'unpaid' | 'paid' | 'refunded'; confirmationCode?: string; }
export interface ConfirmBookingParams { tripId: string; sessionId: string; }
export interface ConfirmBookingResponse { success: boolean; tripId: string; status: 'confirmed'; confirmationCode: string; confirmedAt: string; }

export async function createCheckoutSession(params: CheckoutSessionParams, idempotencyKey: string): Promise<CheckoutSessionResponse> {
  const { data, error } = await supabase.functions.invoke('create-booking-checkout', { body: { ...params, idempotencyKey } });
  if (error) throw new Error(error.message);
  return data;
}

export async function getBookingStatus(tripId: string): Promise<BookingStatusResponse> {
  const { data: trip } = await supabase.from('trips').select('id, status, metadata').eq('id', tripId).single();
  const meta = trip?.metadata as Record<string, unknown> | null;
  return { success: true, tripId, status: trip?.status === 'booked' ? 'confirmed' : 'pending', paymentStatus: meta?.paymentStatus as 'unpaid' | 'paid' || 'unpaid', confirmationCode: meta?.confirmationCode as string };
}

export async function confirmBooking(params: ConfirmBookingParams): Promise<ConfirmBookingResponse> {
  const { data, error } = await supabase.functions.invoke('verify-booking-payment', { body: params });
  if (error) throw new Error(error.message);
  return data;
}

export async function cancelBooking(tripId: string): Promise<{ success: boolean }> {
  const { error } = await supabase.from('trips').update({ status: 'cancelled' }).eq('id', tripId);
  if (error) throw new Error(error.message);
  return { success: true };
}

export function generateIdempotencyKey(tripId: string): string { return `checkout_${tripId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`; }

export function useCreateCheckoutSession() { return useMutation({ mutationFn: ({ params, idempotencyKey }: { params: CheckoutSessionParams; idempotencyKey: string }) => createCheckoutSession(params, idempotencyKey), onSuccess: (data) => { if (data.url) window.location.href = data.url; }, onError: (e: Error) => toast.error(e.message) }); }
export function useBookingStatus(tripId: string | undefined) { return useQuery({ queryKey: ['booking-status', tripId], queryFn: () => getBookingStatus(tripId!), enabled: !!tripId }); }
export function useConfirmBooking() { const qc = useQueryClient(); return useMutation({ mutationFn: confirmBooking, onSuccess: (d) => { toast.success('Booking confirmed!'); qc.invalidateQueries({ queryKey: ['booking-status', d.tripId] }); }, onError: (e: Error) => toast.error(e.message) }); }
export function useCancelBooking() { const qc = useQueryClient(); return useMutation({ mutationFn: cancelBooking, onSuccess: (_, id) => { toast.success('Booking cancelled'); qc.invalidateQueries({ queryKey: ['booking-status', id] }); }, onError: (e: Error) => toast.error(e.message) }); }

export default { createCheckoutSession, getBookingStatus, confirmBooking, cancelBooking, generateIdempotencyKey };
