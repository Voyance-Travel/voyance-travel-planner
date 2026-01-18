/**
 * Voyance Backend API Client
 * Base URL: https://voyance-backend.railway.app
 * Contract Version: v1 (schemaVersion: "v1")
 * 
 * Related services:
 * - voyanceAuth.ts - Authentication (signup, login, Google OAuth)
 * - quizAPI.ts - Quiz flow and Travel DNA
 */

// Re-export auth and quiz APIs for convenience
export { default as voyanceAuth } from './voyanceAuth';
export { default as quizAPI } from './quizAPI';

import { supabase } from '@/integrations/supabase/client';

// =============================================================================
// CONFIGURATION
// =============================================================================

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL || 'https://voyance-backend.railway.app';

// =============================================================================
// TYPES - Backend Contract Types
// =============================================================================

// Preference Enums (5 core preferences implemented)
export type BudgetPreference = 'tight' | 'moderate' | 'flexible' | 'luxury';
export type PacePreference = 'relaxed' | 'balanced' | 'packed';
export type StylePreference = 'local' | 'tourist' | 'mixed';
export type ComfortPreference = 'basic' | 'standard' | 'premium';
export type PlanningPreference = 'structured' | 'flexible' | 'spontaneous';

// Trip Status Enum
export type TripStatus = 'draft' | 'planned' | 'booked' | 'confirmed' | 'upcoming' | 'completed' | 'cancelled';

// User Preferences
export interface UserPreferences {
  userId: string;
  budget: BudgetPreference;
  pace: PacePreference;
  style: StylePreference;
  comfort: ComfortPreference;
  planning: PlanningPreference;
  tripsCompleted?: number;
  lastTripFeedback?: {
    rating: number;
    likes: string[];
    dislikes: string[];
  };
  createdAt?: string;
  updatedAt?: string;
}

// Trip Types
export interface BackendTrip {
  id: string;
  userId: string;
  name: string;
  title?: string;
  description?: string;
  status: TripStatus;
  tripType?: string;
  
  // Destination
  destinationId?: string;
  destination: string;
  departureCity?: string;
  
  // Dates
  startDate?: string;
  endDate?: string;
  totalDays?: number;
  
  // Travelers
  travelers?: number;
  travelerType?: string;
  
  // Budget
  budgetRange?: BudgetPreference;
  estimatedCost?: number;
  currency?: string;
  
  // Characteristics
  emotionalTags?: string[];
  primaryGoal?: string;
  
  // User content
  notes?: string;
  specialRequests?: string;
  
  // Booking
  bookingReference?: string;
  
  // Sharing
  sharedWith?: string[];
  isPublic?: boolean;
  
  // Metadata
  metadata?: Record<string, unknown>;
  
  // References
  itineraryId?: string;
  source?: string;
  quizSessionId?: string;
  
  // Timestamps
  createdAt: string;
  updatedAt: string;
  bookedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
}

export interface CreateTripRequest {
  name: string;
  destination: string;
  startDate?: string;
  endDate?: string;
  totalDays?: number;
  travelers?: number;
  budgetRange?: BudgetPreference;
  emotionalTags?: string[];
  tripType?: string;
  departureCity?: string;
  description?: string;
  notes?: string;
  specialRequests?: string;
  metadata?: Record<string, unknown>;
}

export interface UpdateTripRequest {
  name?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  totalDays?: number;
  travelers?: number;
  budgetRange?: BudgetPreference;
  emotionalTags?: string[];
  tripType?: string;
  departureCity?: string;
  description?: string;
  notes?: string;
  specialRequests?: string;
  status?: TripStatus;
  metadata?: Record<string, unknown>;
}

export interface ListTripsParams {
  status?: TripStatus;
  limit?: number;
  offset?: number;
  sortBy?: 'startDate' | 'createdAt' | 'updatedAt' | 'name';
  sortOrder?: 'asc' | 'desc';
}

// Itinerary Types
export type ItineraryStatus = 'not_started' | 'queued' | 'running' | 'ready' | 'failed' | 'empty';

export interface ItineraryActivity {
  id: string;
  name: string;
  description?: string;
  category?: string;
  duration?: string;
  durationMinutes?: number;
  startTime?: string;
  endTime?: string;
  location?: {
    name?: string;
    address?: string;
    lat?: number;
    lng?: number;
  };
  cost?: {
    amount?: number;
    currency?: string;
  };
  imageUrl?: string;
  bookingUrl?: string;
  tips?: string[];
  isBooked?: boolean;
  isLocked?: boolean;
}

export interface ItineraryDay {
  dayNumber: number;
  date: string;
  title?: string;
  theme?: string;
  description?: string;
  activities: ItineraryActivity[];
  totalEstimatedCost?: number;
  mealsIncluded?: number;
  pacingLevel?: PacePreference;
}

export interface ItineraryOverview {
  budgetBreakdown?: {
    accommodation?: number;
    food?: number;
    activities?: number;
    transportation?: number;
    total?: number;
    currency?: string;
  };
  highlights?: string[];
  localTips?: string[];
  transportationTips?: string[];
}

export interface ItineraryResponse {
  success: boolean;
  status: ItineraryStatus;
  schemaVersion: string;
  tripId: string;
  destination: string;
  title: string;
  totalDays: number;
  itineraryId?: string;
  
  // Days array at ROOT level (not nested!)
  days?: ItineraryDay[];
  
  // Generation progress
  progress?: number;
  percentComplete?: number;
  message?: string;
  
  // Metadata
  generatedAt?: string;
  lastModified?: string;
  preferences?: Partial<UserPreferences>;
  metadata?: {
    correlationId?: string;
    jobId?: string;
    aiModel?: string;
    version?: string;
  };
  overview?: ItineraryOverview;
  
  // Flags
  preventedRegeneration?: boolean;
  hasItinerary?: boolean;
  
  // Error info
  error?: string;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

// =============================================================================
// API CLIENT
// =============================================================================

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();
  
  if (!token) {
    throw new Error('Authentication required. Please sign in.');
  }
  
  const url = `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  
  const result = await response.json();
  
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Session expired. Please sign in again.');
    }
    if (response.status === 404) {
      throw new Error('Resource not found.');
    }
    throw new Error(result.error || result.message || `Request failed: ${response.status}`);
  }
  
  return result;
}

// =============================================================================
// TRIPS API
// =============================================================================

export const tripsAPI = {
  /**
   * Create a new trip
   */
  async create(trip: CreateTripRequest): Promise<BackendTrip> {
    const response = await apiRequest<ApiResponse<BackendTrip>>('/api/v1/trips', {
      method: 'POST',
      body: JSON.stringify(trip),
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to create trip');
    }
    
    return response.data;
  },
  
  /**
   * List all trips for current user
   */
  async list(params: ListTripsParams = {}): Promise<{ trips: BackendTrip[]; pagination: { total: number; limit: number; offset: number } }> {
    const queryParams = new URLSearchParams();
    if (params.status) queryParams.set('status', params.status);
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.offset) queryParams.set('offset', params.offset.toString());
    if (params.sortBy) queryParams.set('sortBy', params.sortBy);
    if (params.sortOrder) queryParams.set('sortOrder', params.sortOrder);
    
    const queryString = queryParams.toString();
    const endpoint = `/api/v1/trips${queryString ? `?${queryString}` : ''}`;
    
    const response = await apiRequest<PaginatedResponse<BackendTrip>>(endpoint);
    
    return {
      trips: response.data,
      pagination: response.pagination,
    };
  },
  
  /**
   * Get a single trip by ID
   */
  async get(tripId: string): Promise<BackendTrip> {
    const response = await apiRequest<ApiResponse<BackendTrip>>(`/api/v1/trips/${tripId}`);
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Trip not found');
    }
    
    return response.data;
  },
  
  /**
   * Update an existing trip
   */
  async update(tripId: string, updates: UpdateTripRequest): Promise<BackendTrip> {
    const response = await apiRequest<ApiResponse<BackendTrip>>(`/api/v1/trips/${tripId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to update trip');
    }
    
    return response.data;
  },
  
  /**
   * Delete a trip
   */
  async delete(tripId: string): Promise<void> {
    const response = await apiRequest<ApiResponse<null>>(`/api/v1/trips/${tripId}`, {
      method: 'DELETE',
    });
    
    if (!response.success) {
      throw new Error(response.error || 'Failed to delete trip');
    }
  },
};

// =============================================================================
// ITINERARY API
// =============================================================================

export const itineraryAPI = {
  /**
   * Generate itinerary or return existing one
   * Returns 200 if exists, 202 if queued for generation
   */
  async generateNow(tripId: string, force = false): Promise<ItineraryResponse> {
    const endpoint = `/api/v1/trips/${tripId}/itinerary/generate-now${force ? '?force=true' : ''}`;
    
    const response = await apiRequest<ItineraryResponse>(endpoint, {
      method: 'POST',
    });
    
    // Validate schemaVersion
    if (response.schemaVersion !== 'v1') {
      console.warn(`Unexpected schemaVersion: ${response.schemaVersion}`);
    }
    
    return response;
  },
  
  /**
   * Get current itinerary or generation status
   * Poll this endpoint every 3-5 seconds when status is 'queued' or 'running'
   */
  async get(tripId: string): Promise<ItineraryResponse> {
    const response = await apiRequest<ItineraryResponse>(`/api/v1/trips/${tripId}/itinerary`);
    
    // Validate schemaVersion
    if (response.schemaVersion !== 'v1') {
      console.warn(`Unexpected schemaVersion: ${response.schemaVersion}`);
    }
    
    return response;
  },
  
  /**
   * Poll for itinerary generation completion
   * Returns when status is 'ready' or 'failed'
   */
  async pollUntilReady(
    tripId: string,
    options: {
      pollIntervalMs?: number;
      timeoutMs?: number;
      onProgress?: (response: ItineraryResponse) => void;
    } = {}
  ): Promise<ItineraryResponse> {
    // Increase default polling interval to 5 seconds (was 3)
    const { pollIntervalMs = 5000, timeoutMs = 300000, onProgress } = options;
    
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let currentInterval = pollIntervalMs;
      let consecutiveErrors = 0;
      
      const poll = async () => {
        try {
          const response = await this.get(tripId);
          
          // Reset on success
          consecutiveErrors = 0;
          currentInterval = pollIntervalMs;
          
          if (onProgress) {
            onProgress(response);
          }
          
          if (response.status === 'ready') {
            resolve(response);
            return;
          }
          
          if (response.status === 'failed') {
            reject(new Error(response.error || 'Itinerary generation failed'));
            return;
          }
          
          if (Date.now() - startTime > timeoutMs) {
            reject(new Error('Itinerary generation timed out'));
            return;
          }
          
          // Continue polling for 'queued', 'running', 'not_started'
          setTimeout(poll, currentInterval);
        } catch (error) {
          // Exponential backoff on errors
          consecutiveErrors++;
          currentInterval = Math.min(pollIntervalMs * Math.pow(2, consecutiveErrors), 60000);
          console.log(`[VoyanceAPI] Poll error, backoff to ${currentInterval}ms (attempt ${consecutiveErrors})`);
          
          // Give up after too many errors
          if (consecutiveErrors > 10) {
            reject(error);
            return;
          }
          
          setTimeout(poll, currentInterval);
        }
      };
      
      poll();
    });
  },
};

// =============================================================================
// USER PREFERENCES API
// =============================================================================

export const preferencesAPI = {
  /**
   * Get user preferences
   */
  async get(): Promise<UserPreferences> {
    try {
      const response = await apiRequest<ApiResponse<UserPreferences>>('/api/v1/user/preferences');
      
      if (response.success && response.data) {
        return response.data;
      }
      
      // Return defaults if not set
      return getDefaultPreferences();
    } catch (error) {
      console.warn('Failed to fetch preferences, using defaults:', error);
      return getDefaultPreferences();
    }
  },
  
  /**
   * Create or update user preferences
   */
  async save(preferences: Partial<Omit<UserPreferences, 'userId' | 'createdAt' | 'updatedAt'>>): Promise<UserPreferences> {
    const response = await apiRequest<ApiResponse<UserPreferences>>('/api/v1/user/preferences', {
      method: 'POST',
      body: JSON.stringify(preferences),
    });
    
    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to save preferences');
    }
    
    return response.data;
  },
};

// =============================================================================
// HELPERS
// =============================================================================

export function getDefaultPreferences(): UserPreferences {
  return {
    userId: '',
    budget: 'moderate',
    pace: 'balanced',
    style: 'mixed',
    comfort: 'standard',
    planning: 'flexible',
  };
}

/**
 * Check if user is authenticated with backend
 */
export async function isAuthenticated(): Promise<boolean> {
  const token = await getAuthToken();
  return !!token;
}

/**
 * Health check for backend
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}

// =============================================================================
// EXPORT ALL
// =============================================================================

export const voyanceAPI = {
  trips: tripsAPI,
  itinerary: itineraryAPI,
  preferences: preferencesAPI,
  isAuthenticated,
  healthCheck,
  getDefaultPreferences,
};

export default voyanceAPI;
