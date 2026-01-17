/**
 * Voyance System Health API Service
 * 
 * Integrates with Railway backend health check endpoints:
 * - GET /api/health - Basic health check
 * - GET /api/health/system - Comprehensive system health
 * - GET /api/health/user-flow - User flow health check
 * - GET /api/routes - List registered routes
 */

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export interface BasicHealthResponse {
  status: 'OK' | 'ERROR';
  timestamp: string;
  environment: string;
}

export interface DatabaseHealth {
  healthy: boolean;
  error?: string | null;
  responseTime?: number;
}

export interface AuthenticationHealth {
  healthy: boolean;
  error?: string | null;
  expiresAt?: string | null;
}

export interface EnvironmentHealth {
  healthy: boolean;
  missing: string[] | null;
}

export interface SystemHealthResponse {
  status: 'HEALTHY' | 'DEGRADED' | 'ERROR';
  timestamp: string;
  responseTime: string;
  environment: string;
  checks: {
    database: DatabaseHealth;
    authentication: AuthenticationHealth;
    environment: EnvironmentHealth;
  };
  version: string;
}

export interface UserFlowHealthResponse {
  status: 'PARTIAL' | 'ERROR' | 'DISABLED';
  message: string;
  timestamp: string;
  checks?: {
    database: DatabaseHealth;
  };
  nextStep?: string;
}

export interface RouteInfo {
  method: string;
  url: string;
}

export interface RoutesResponse {
  routes: RouteInfo[];
  timestamp: string;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Basic health check - no auth required
 */
export async function getBasicHealth(): Promise<BasicHealthResponse> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/health`, {
      method: 'GET',
    });
    
    if (!response.ok) {
      return {
        status: 'ERROR',
        timestamp: new Date().toISOString(),
        environment: 'unknown',
      };
    }
    
    return response.json();
  } catch (error) {
    return {
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      environment: 'unknown',
    };
  }
}

/**
 * Comprehensive system health check - no auth required
 */
export async function getSystemHealth(): Promise<SystemHealthResponse> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/health/system`, {
      method: 'GET',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    return {
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      responseTime: '0ms',
      environment: 'unknown',
      checks: {
        database: { healthy: false, error: error instanceof Error ? error.message : 'Connection failed' },
        authentication: { healthy: false, error: 'Unable to check' },
        environment: { healthy: false, missing: null },
      },
      version: 'unknown',
    };
  }
}

/**
 * User flow health check
 */
export async function getUserFlowHealth(): Promise<UserFlowHealthResponse> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/health/user-flow`, {
      method: 'GET',
    });
    
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      return {
        status: data.status || 'ERROR',
        message: data.message || `HTTP ${response.status}`,
        timestamp: new Date().toISOString(),
      };
    }
    
    return response.json();
  } catch (error) {
    return {
      status: 'ERROR',
      message: error instanceof Error ? error.message : 'Connection failed',
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Get list of registered API routes
 */
export async function getRegisteredRoutes(): Promise<RoutesResponse> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/routes`, {
      method: 'GET',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    return {
      routes: [],
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Check if backend is reachable
 */
export async function isBackendReachable(): Promise<boolean> {
  try {
    const health = await getBasicHealth();
    return health.status === 'OK';
  } catch {
    return false;
  }
}

/**
 * Get backend status summary
 */
export async function getBackendStatus(): Promise<{
  reachable: boolean;
  healthy: boolean;
  status: 'online' | 'degraded' | 'offline';
  details?: SystemHealthResponse;
}> {
  try {
    const systemHealth = await getSystemHealth();
    
    return {
      reachable: true,
      healthy: systemHealth.status === 'HEALTHY',
      status: systemHealth.status === 'HEALTHY' ? 'online' : 
              systemHealth.status === 'DEGRADED' ? 'degraded' : 'offline',
      details: systemHealth,
    };
  } catch {
    return {
      reachable: false,
      healthy: false,
      status: 'offline',
    };
  }
}

// ============================================================================
// React Query Hooks
// ============================================================================

import { useQuery } from '@tanstack/react-query';

export function useBasicHealth(options?: { enabled?: boolean; refetchInterval?: number }) {
  return useQuery({
    queryKey: ['backend-health-basic'],
    queryFn: getBasicHealth,
    staleTime: 30_000, // 30 seconds
    refetchInterval: options?.refetchInterval,
    enabled: options?.enabled !== false,
  });
}

export function useSystemHealth(options?: { enabled?: boolean; refetchInterval?: number }) {
  return useQuery({
    queryKey: ['backend-health-system'],
    queryFn: getSystemHealth,
    staleTime: 30_000, // 30 seconds
    refetchInterval: options?.refetchInterval,
    enabled: options?.enabled !== false,
  });
}

export function useBackendStatus(options?: { enabled?: boolean; refetchInterval?: number }) {
  return useQuery({
    queryKey: ['backend-status'],
    queryFn: getBackendStatus,
    staleTime: 30_000,
    refetchInterval: options?.refetchInterval || 60_000, // Check every minute by default
    enabled: options?.enabled !== false,
  });
}

export function useRegisteredRoutes() {
  return useQuery({
    queryKey: ['backend-routes'],
    queryFn: getRegisteredRoutes,
    staleTime: Infinity, // Routes don't change during runtime
  });
}

// ============================================================================
// Export
// ============================================================================

const systemHealthAPI = {
  getBasicHealth,
  getSystemHealth,
  getUserFlowHealth,
  getRegisteredRoutes,
  isBackendReachable,
  getBackendStatus,
};

export default systemHealthAPI;
