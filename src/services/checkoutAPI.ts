/**
 * Checkout API - Uses Supabase Edge Functions
 */
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation } from '@tanstack/react-query';

export interface CreateCheckoutInput { tripId: string; customerId?: string; }
export interface CheckoutSessionResponse { success: boolean; url: string; sessionId: string; expiresAt: string; amount: number; currency: string; }
export interface CheckoutStatusResponse { success: boolean; status: 'complete' | 'expired' | 'open'; paymentStatus: 'paid' | 'unpaid' | 'no_payment_required'; tripId: string; amount: number; currency: string; }

export function generateIdempotencyKey(tripId: string): string { return `checkout_${tripId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`; }

export async function createCheckoutSession(input: CreateCheckoutInput, idempotencyKey?: string): Promise<CheckoutSessionResponse> {
  const { data, error } = await supabase.functions.invoke('create-booking-checkout', { body: { ...input, idempotencyKey: idempotencyKey || generateIdempotencyKey(input.tripId) } });
  if (error) throw new Error(error.message);
  return data;
}

export async function getCheckoutStatus(sessionId: string): Promise<CheckoutStatusResponse> {
  // Would need dedicated edge function - stub for now
  return { success: true, status: 'open', paymentStatus: 'unpaid', tripId: '', amount: 0, currency: 'USD' };
}

export async function checkoutAndRedirect(input: CreateCheckoutInput): Promise<void> {
  const session = await createCheckoutSession(input);
  window.location.href = session.url;
}

export function calculateNights(startDate: string | Date, endDate: string | Date): number { return Math.ceil(Math.abs(new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)); }
export function formatCheckoutAmount(amount: number, currency = 'USD'): string { return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount); }
export function isSessionValid(expiresAt: string): boolean { return new Date(expiresAt) > new Date(); }
export function getSessionTimeRemaining(expiresAt: string): number { return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)); }

export function useCheckoutStatus(sessionId: string | null) { return useQuery({ queryKey: ['checkout', 'session', sessionId], queryFn: () => sessionId ? getCheckoutStatus(sessionId) : Promise.reject(), enabled: !!sessionId }); }
export function useCreateCheckoutSession() { return useMutation({ mutationFn: (input: CreateCheckoutInput) => createCheckoutSession(input) }); }
export function useCheckoutAndRedirect() { return useMutation({ mutationFn: checkoutAndRedirect }); }

export default { createCheckoutSession, getCheckoutStatus, checkoutAndRedirect, generateIdempotencyKey, calculateNights, formatCheckoutAmount, isSessionValid, getSessionTimeRemaining };
