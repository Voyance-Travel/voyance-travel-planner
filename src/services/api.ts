/**
 * API Configuration and Base Service
 * Centralized API configuration for Voyance
 */

// Environment configuration
export const API_CONFIG = {
  baseUrl: import.meta.env.VITE_API_URL || '',
  timeout: 30000,
  useMockData: import.meta.env.DEV || import.meta.env.VITE_USE_MOCK_DATA === 'true',
} as const;

// API Response types
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  status: number;
}

export interface ApiError {
  message: string;
  code?: string;
  status?: number;
}

// Request options
export interface ApiRequestOptions {
  headers?: Record<string, string>;
  params?: Record<string, string | number | boolean | undefined>;
  timeout?: number;
}

/**
 * Build URL with query parameters
 */
function buildUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(endpoint, API_CONFIG.baseUrl || window.location.origin);
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }
  
  return url.toString();
}

/**
 * Get auth token from storage
 */
function getAuthToken(): string | null {
  try {
    return localStorage.getItem('authToken');
  } catch {
    return null;
  }
}

/**
 * Base API service for making HTTP requests
 */
export const apiService = {
  /**
   * GET request
   */
  async get<T>(endpoint: string, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    const url = buildUrl(endpoint, options?.params);
    const token = getAuthToken();

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...options?.headers,
        },
        signal: AbortSignal.timeout(options?.timeout || API_CONFIG.timeout),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { data, success: true, status: response.status };
    } catch (error) {
      console.error(`API GET ${endpoint} failed:`, error);
      throw error;
    }
  },

  /**
   * POST request
   */
  async post<T>(endpoint: string, body?: unknown, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    const url = buildUrl(endpoint, options?.params);
    const token = getAuthToken();

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...options?.headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(options?.timeout || API_CONFIG.timeout),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { data, success: true, status: response.status };
    } catch (error) {
      console.error(`API POST ${endpoint} failed:`, error);
      throw error;
    }
  },

  /**
   * PUT request
   */
  async put<T>(endpoint: string, body?: unknown, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    const url = buildUrl(endpoint, options?.params);
    const token = getAuthToken();

    try {
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...options?.headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(options?.timeout || API_CONFIG.timeout),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { data, success: true, status: response.status };
    } catch (error) {
      console.error(`API PUT ${endpoint} failed:`, error);
      throw error;
    }
  },

  /**
   * DELETE request
   */
  async delete<T>(endpoint: string, options?: ApiRequestOptions): Promise<ApiResponse<T>> {
    const url = buildUrl(endpoint, options?.params);
    const token = getAuthToken();

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...options?.headers,
        },
        signal: AbortSignal.timeout(options?.timeout || API_CONFIG.timeout),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { data, success: true, status: response.status };
    } catch (error) {
      console.error(`API DELETE ${endpoint} failed:`, error);
      throw error;
    }
  },
};

export default apiService;
