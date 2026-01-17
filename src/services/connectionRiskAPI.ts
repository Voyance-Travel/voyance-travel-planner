/**
 * Voyance Connection Risk API
 * 
 * Transfer Risk Modeling for flight connections:
 * - POST /api/v1/connections/risk - Assess transfer risk for a connection
 * - GET /api/v1/connections/risky - Find risky connections for an airport
 * - GET /api/v1/connections/stats/:airport - Get connection statistics
 */

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export interface FlightInfo {
  flightNumber: string;
  airline: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTime: string;
  arrivalTime: string;
  terminal?: string;
  gate?: string;
  isInternational: boolean;
  isCodeshare?: boolean;
}

export interface ConnectionInfo {
  arrivalFlight: FlightInfo;
  departureFlight: FlightInfo;
  layoverMinutes: number;
  airport: string;
  sameTerminal: boolean;
  requiresCustoms: boolean;
  requiresSecurity: boolean;
}

export interface RiskAssessmentInput {
  connection: ConnectionInfo;
  passengerType?: 'domestic' | 'international';
  hasCheckedBags?: boolean;
  isFirstTime?: boolean;
  userId?: string;
}

export type RiskLevel = 'SAFE' | 'TIGHT' | 'RISKY' | 'IMPOSSIBLE';

export interface RiskAssessmentResult {
  riskLevel: RiskLevel;
  confidence: number;
  layoverMinutes: number;
  minimumConnectionTime: number;
  riskFactors: string[];
  mitigationSuggestions: string[];
  color: string;
}

export interface RiskAssessmentResponse {
  success: boolean;
  risk?: RiskAssessmentResult;
  error?: string;
}

export interface RiskyConnectionsResponse {
  success: boolean;
  connections?: Array<Record<string, unknown>>;
  error?: string;
}

export interface ConnectionStatsResponse {
  success: boolean;
  stats?: {
    airport: string;
    averageLayover: number;
    minConnectionTime: number;
    terminalCount: number;
    customsRequired: boolean;
    [key: string]: unknown;
  };
  error?: string;
}

// ============================================================================
// Connection Risk API
// ============================================================================

/**
 * Assess transfer risk for a flight connection
 */
export async function assessConnectionRisk(
  input: RiskAssessmentInput
): Promise<RiskAssessmentResponse> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/connections/risk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    
    return response.json();
  } catch (error) {
    console.error('[ConnectionRiskAPI] Risk assessment error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Risk assessment failed',
    };
  }
}

/**
 * Find risky connections for an airport
 */
export async function findRiskyConnections(
  airport: string,
  timeWindow?: number
): Promise<RiskyConnectionsResponse> {
  try {
    const params = new URLSearchParams({ airport: airport.toUpperCase() });
    if (timeWindow) {
      params.append('timeWindow', String(timeWindow));
    }
    
    const response = await fetch(`${BACKEND_URL}/api/v1/connections/risky?${params}`, {
      method: 'GET',
    });
    
    return response.json();
  } catch (error) {
    console.error('[ConnectionRiskAPI] Find risky connections error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to find risky connections',
    };
  }
}

/**
 * Get connection statistics for an airport
 */
export async function getConnectionStats(
  airport: string
): Promise<ConnectionStatsResponse> {
  try {
    const response = await fetch(
      `${BACKEND_URL}/api/v1/connections/stats/${airport.toUpperCase()}`,
      { method: 'GET' }
    );
    
    return response.json();
  } catch (error) {
    console.error('[ConnectionRiskAPI] Get stats error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get connection stats',
    };
  }
}

// ============================================================================
// React Query Hooks
// ============================================================================

import { useQuery, useMutation } from '@tanstack/react-query';

export function useConnectionStats(airport: string | null) {
  return useQuery({
    queryKey: ['connection-stats', airport],
    queryFn: () => airport ? getConnectionStats(airport) : Promise.resolve({ success: false }),
    enabled: !!airport,
    staleTime: 5 * 60_000, // 5 minutes
  });
}

export function useRiskyConnections(airport: string | null, timeWindow?: number) {
  return useQuery({
    queryKey: ['risky-connections', airport, timeWindow],
    queryFn: () => airport ? findRiskyConnections(airport, timeWindow) : Promise.resolve({ success: false }),
    enabled: !!airport,
    staleTime: 60_000, // 1 minute
  });
}

export function useAssessConnectionRisk() {
  return useMutation({
    mutationFn: (input: RiskAssessmentInput) => assessConnectionRisk(input),
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get risk level color
 */
export function getRiskLevelColor(level: RiskLevel): string {
  switch (level) {
    case 'SAFE':
      return '#22c55e'; // green
    case 'TIGHT':
      return '#eab308'; // yellow
    case 'RISKY':
      return '#f97316'; // orange
    case 'IMPOSSIBLE':
      return '#ef4444'; // red
    default:
      return '#6b7280'; // gray
  }
}

/**
 * Get risk level label
 */
export function getRiskLevelLabel(level: RiskLevel): string {
  switch (level) {
    case 'SAFE':
      return 'Safe Connection';
    case 'TIGHT':
      return 'Tight Connection';
    case 'RISKY':
      return 'Risky Connection';
    case 'IMPOSSIBLE':
      return 'Not Recommended';
    default:
      return 'Unknown';
  }
}

// ============================================================================
// Export
// ============================================================================

const connectionRiskAPI = {
  assessConnectionRisk,
  findRiskyConnections,
  getConnectionStats,
  getRiskLevelColor,
  getRiskLevelLabel,
};

export default connectionRiskAPI;
