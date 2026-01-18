/**
 * Trip Intelligence API - Stub for future feature
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export type InsightType = 'budget_intelligence' | 'preference_weights' | 'disruption_monitoring' | 'airport_options' | 'all';
export interface BudgetInsight { totalBudget: number; spent: number; remaining: number; projectedSpend: number; budgetZone: 'under' | 'on-track' | 'over'; }
export interface TripIntelligence { tripId: string; insights: { budget?: BudgetInsight }; metadata: { generatedAt: string; dataFreshness: string }; }
export interface TripIntelligenceResponse { success: boolean; data?: TripIntelligence; timestamp: string; error?: string; }

export async function getTripIntelligence(tripId: string): Promise<TripIntelligenceResponse> {
  return { success: true, data: { tripId, insights: {}, metadata: { generatedAt: new Date().toISOString(), dataFreshness: 'cached' } }, timestamp: new Date().toISOString() };
}
export async function refreshTripIntelligence(tripId: string): Promise<TripIntelligenceResponse> { return getTripIntelligence(tripId); }
export async function getTripBudget(tripId: string): Promise<{ success: boolean; data?: { budget: BudgetInsight } }> { return { success: true }; }
export async function getTripDisruptions(tripId: string): Promise<{ success: boolean; data?: { disruptions: []; activeAlerts: number } }> { return { success: true, data: { disruptions: [], activeAlerts: 0 } }; }

export function useTripIntelligence(tripId: string | null) { return useQuery({ queryKey: ['trip-intelligence', tripId], queryFn: () => tripId ? getTripIntelligence(tripId) : Promise.reject(), enabled: !!tripId, staleTime: 60_000 }); }
export function useRefreshTripIntelligence() { const qc = useQueryClient(); return useMutation({ mutationFn: (v: { tripId: string }) => refreshTripIntelligence(v.tripId), onSuccess: (_, v) => qc.invalidateQueries({ queryKey: ['trip-intelligence', v.tripId] }) }); }
export function useTripBudget(tripId: string | null) { return useQuery({ queryKey: ['trip-budget', tripId], queryFn: () => tripId ? getTripBudget(tripId) : Promise.reject(), enabled: !!tripId }); }
export function useTripDisruptions(tripId: string | null) { return useQuery({ queryKey: ['trip-disruptions', tripId], queryFn: () => tripId ? getTripDisruptions(tripId) : Promise.reject(), enabled: !!tripId }); }

export default { getTripIntelligence, refreshTripIntelligence, getTripBudget, getTripDisruptions };
