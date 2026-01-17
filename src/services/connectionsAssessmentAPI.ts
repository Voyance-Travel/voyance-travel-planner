/**
 * Connection Risk Assessment API Service
 * 
 * Handles transfer/connection risk assessment for multi-segment trips.
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation } from '@tanstack/react-query';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.voyance.travel';

// ============================================================================
// TYPES
// ============================================================================

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type TicketType = 'SINGLE_TICKET' | 'SEPARATE_TICKETS' | 'PROTECTED';
export type TimeOfDay = 'EARLY_AM' | 'MORNING' | 'AFTERNOON' | 'EVENING' | 'LATE_NIGHT';
export type Season = 'PEAK' | 'SHOULDER' | 'OFF_PEAK';
export type DayOfWeek = 'SUNDAY' | 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY';
export type ConnectionOutcome = 'MADE_CONNECTION' | 'MISSED_CONNECTION' | 'FLIGHT_DELAYED';

export interface TravelSegment {
  id?: string;
  origin: string;
  destination: string;
  departure: string;
  arrival: string;
  carrier?: string;
  flightNumber?: string;
  aircraft?: string;
}

export interface BookingStructure {
  ticketType: TicketType;
  isProtected: boolean;
  airline?: string;
}

export interface TravelerProfile {
  mobilityLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  hasCheckedBags: boolean;
  frequentFlyer: boolean;
  premiumStatus?: boolean;
}

export interface RiskFactor {
  type: string;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
  weight: number;
}

export interface RiskDetails {
  availableTime: number;
  minimumRequired: number;
  factors: RiskFactor[];
}

export interface TransferRiskAssessment {
  risk: {
    level: RiskLevel;
    successProbability: number;
  };
  riskDetails: RiskDetails;
  recommendations?: string[];
}

export interface AssessConnectionRequest {
  segments: TravelSegment[];
  bookingStructure: BookingStructure;
  travelerProfile: TravelerProfile;
}

export interface AssessConnectionResponse extends TransferRiskAssessment {
  requestId: string;
}

export interface ConnectionHistoryData {
  found: boolean;
  data?: {
    successRate: number;
    totalConnections: number;
    avgConnectionTime: number;
    minSuccessfulTime: number;
  };
}

export interface ConnectionOutcomeInput {
  connectionId: string;
  outcome: ConnectionOutcome;
  actualTimeUsed?: number;
  userFeedback?: string;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return { Authorization: `Bearer ${session.access_token}` };
  }
  const token = localStorage.getItem('voyance_token');
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

/**
 * Assess connection risk for a trip
 */
export async function assessConnectionRisk(
  tripId: string,
  request: AssessConnectionRequest
): Promise<AssessConnectionResponse> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/trips/${tripId}/connections/assess`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Assessment failed' }));
    throw new Error(error.error || 'Failed to assess connection risk');
  }

  return response.json();
}

/**
 * Get historical connection data for a route
 */
export async function getConnectionHistory(
  origin: string,
  connection: string,
  destination: string
): Promise<ConnectionHistoryData> {
  const queryParams = new URLSearchParams({
    origin,
    connection,
    destination,
  });

  const response = await fetch(`${API_BASE_URL}/api/connections/history?${queryParams}`);

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Fetch failed' }));
    throw new Error(error.error || 'Failed to fetch connection history');
  }

  return response.json();
}

/**
 * Record connection outcome (post-trip)
 */
export async function recordConnectionOutcome(
  tripId: string,
  input: ConnectionOutcomeInput
): Promise<{ success: boolean }> {
  const headers = await getAuthHeader();

  const response = await fetch(`${API_BASE_URL}/api/trips/${tripId}/connections/outcome`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Record failed' }));
    throw new Error(error.error || 'Failed to record connection outcome');
  }

  return response.json();
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export function useAssessConnectionRisk() {
  return useMutation({
    mutationFn: ({ tripId, request }: { tripId: string; request: AssessConnectionRequest }) =>
      assessConnectionRisk(tripId, request),
  });
}

export function useConnectionHistory(
  origin: string | null,
  connection: string | null,
  destination: string | null
) {
  return useQuery({
    queryKey: ['connection-history', origin, connection, destination],
    queryFn: () => getConnectionHistory(origin!, connection!, destination!),
    enabled: !!origin && !!connection && !!destination,
    staleTime: 600000, // 10 minutes
  });
}

export function useRecordConnectionOutcome() {
  return useMutation({
    mutationFn: ({ tripId, input }: { tripId: string; input: ConnectionOutcomeInput }) =>
      recordConnectionOutcome(tripId, input),
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export function getRiskLevelColor(level: RiskLevel): string {
  const colors: Record<RiskLevel, string> = {
    LOW: 'text-green-600',
    MEDIUM: 'text-yellow-600',
    HIGH: 'text-orange-600',
    CRITICAL: 'text-red-600',
  };
  return colors[level];
}

export function getRiskLevelBg(level: RiskLevel): string {
  const colors: Record<RiskLevel, string> = {
    LOW: 'bg-green-100',
    MEDIUM: 'bg-yellow-100',
    HIGH: 'bg-orange-100',
    CRITICAL: 'bg-red-100',
  };
  return colors[level];
}

export function getRiskLevelLabel(level: RiskLevel): string {
  const labels: Record<RiskLevel, string> = {
    LOW: 'Low Risk',
    MEDIUM: 'Moderate Risk',
    HIGH: 'High Risk',
    CRITICAL: 'Critical Risk',
  };
  return labels[level];
}

export function formatSuccessProbability(probability: number): string {
  return `${Math.round(probability * 100)}%`;
}

export function getMinimumConnectionTime(ticketType: TicketType): number {
  // Returns minimum connection time in minutes
  const times: Record<TicketType, number> = {
    SINGLE_TICKET: 45,
    SEPARATE_TICKETS: 90,
    PROTECTED: 60,
  };
  return times[ticketType];
}
