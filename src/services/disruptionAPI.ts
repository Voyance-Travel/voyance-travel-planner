/**
 * Voyance Disruption API Service
 * Stub implementation for future disruption prediction feature.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type DisruptionSeverity = 'LOW' | 'MED' | 'HIGH';
export type DisruptionChannel = 'sse' | 'email' | 'sms';
export type DisruptionType = 'WEATHER' | 'CARRIER' | 'STRIKE' | 'CLOSURE' | 'OTHER';

export interface DisruptionPrediction {
  id: string;
  type: DisruptionType;
  severity: DisruptionSeverity;
  likelihood: number;
  description: string;
  affectedSegment?: string;
  estimatedImpact?: string;
  recommendations: string[];
  predictedAt: string;
}

export interface PredictDisruptionInput { bookingId: string; }
export interface PredictDisruptionResponse { success: boolean; predictions?: DisruptionPrediction[]; overallRisk?: DisruptionSeverity; error?: string; }
export interface SubscribeInput { bookingId: string; threshold?: DisruptionSeverity; channels?: DisruptionChannel[]; }
export interface SubscribeResponse { success: boolean; subscriptionId?: string; error?: string; }
export interface UnsubscribeResponse { success: boolean; error?: string; }
export interface DisruptionHistoryItem { id: string; type: DisruptionType; severity: DisruptionSeverity; description: string; occurredAt: string; resolved: boolean; }
export interface DisruptionHistoryResponse { success: boolean; history?: DisruptionHistoryItem[]; error?: string; }

// Stub implementations - future feature
export async function predictDisruptions(input: PredictDisruptionInput): Promise<PredictDisruptionResponse> {
  return { success: true, predictions: [], overallRisk: 'LOW' };
}

export async function subscribeToDisruptions(input: SubscribeInput): Promise<SubscribeResponse> {
  return { success: true, subscriptionId: `sub_${Date.now()}` };
}

export async function unsubscribeFromDisruptions(bookingId: string): Promise<UnsubscribeResponse> {
  return { success: true };
}

export async function getDisruptionHistory(bookingId: string): Promise<DisruptionHistoryResponse> {
  return { success: true, history: [] };
}

export function useDisruptionPredictions(bookingId: string | null) {
  return useQuery({ queryKey: ['disruption-predictions', bookingId], queryFn: () => bookingId ? predictDisruptions({ bookingId }) : Promise.reject(), enabled: !!bookingId, staleTime: 5 * 60_000 });
}

export function useDisruptionHistory(bookingId: string | null) {
  return useQuery({ queryKey: ['disruption-history', bookingId], queryFn: () => bookingId ? getDisruptionHistory(bookingId) : Promise.reject(), enabled: !!bookingId });
}

export function usePredictDisruptions() { return useMutation({ mutationFn: predictDisruptions }); }
export function useSubscribeToDisruptions() { const qc = useQueryClient(); return useMutation({ mutationFn: subscribeToDisruptions, onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['disruption-subscription', v.bookingId] }) }); }
export function useUnsubscribeFromDisruptions() { const qc = useQueryClient(); return useMutation({ mutationFn: unsubscribeFromDisruptions, onSuccess: (_, id) => qc.invalidateQueries({ queryKey: ['disruption-subscription', id] }) }); }

export function getSeverityColor(severity: DisruptionSeverity): string { return severity === 'LOW' ? 'text-green-600' : severity === 'MED' ? 'text-yellow-600' : 'text-red-600'; }
export function getSeverityLabel(severity: DisruptionSeverity): string { return severity === 'LOW' ? 'Low Risk' : severity === 'MED' ? 'Medium Risk' : 'High Risk'; }

export default { predictDisruptions, subscribeToDisruptions, unsubscribeFromDisruptions, getDisruptionHistory, getSeverityColor, getSeverityLabel };
