/**
 * Enhanced Trips API Service
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const API_BASE_URL = 'https://voyance-backend.railway.app';

async function getAuthToken(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token || null;
}

async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = await getAuthToken();
  if (!token) throw new Error('Authentication required');
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers },
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result._error || result.error || `Request failed: ${response.status}`);
  return result;
}
  | 'draft' 
  | 'planned' 
  | 'booked' 
  | 'confirmed' 
  | 'upcoming' 
  | 'completed' 
  | 'cancelled';

export type DisplayStatus = 'draft' | 'upcoming' | 'completed' | 'canceled';

export type SortBy = 'startDate' | 'createdAt' | 'updatedAt' | 'name';
export type SortOrder = 'asc' | 'desc';

export interface TripMetadata {
  itinerary?: unknown;
  itineraryGenerationStatus?: 'pending' | 'generating' | 'completed' | 'failed';
  itineraryGeneratedAt?: string;
  itineraryGenerationError?: string;
  [key: string]: unknown;
}

export interface Trip {
  id: string;
  userId: string;
  destinationId?: string;
  destination: string;
  departureCity?: string;
  sessionId?: string;
  name: string | null;
  title?: string | null;
  startDate: string | null;
  endDate: string | null;
  totalDays?: number;
  timeline?: Record<string, unknown>;
  emotionalTags?: string[];
  status: TripStatus;
  displayStatus?: DisplayStatus;
  checkoutSessionId?: string;
  notes?: string;
  currency?: string;
  travelers?: unknown[];
  metadata?: TripMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTripInput {
  destination: string;
  name?: string;
  startDate?: string;
  endDate?: string;
  status?: TripStatus;
  notes?: string;
  emotionalTags?: string[];
  timeline?: Record<string, unknown>;
  generateItinerary?: boolean;
}

export interface UpdateTripInput {
  destination?: string;
  name?: string;
  startDate?: string;
  endDate?: string;
  status?: TripStatus;
  notes?: string;
  emotionalTags?: string[];
  timeline?: Record<string, unknown>;
}

export interface ListTripsParams {
  status?: TripStatus;
  limit?: number;
  offset?: number;
  sortBy?: SortBy;
  sortOrder?: SortOrder;
}

export interface TripsListResponse {
  success: boolean;
  data: Trip[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
  };
}

export interface CreateTripWithItineraryResponse {
  trip: Trip;
  itinerary?: unknown;
  itineraryError?: string;
  redirectUrl: string;
}

export interface ShareTripResponse {
  shareToken: string;
  shareUrl: string;
  expiresAt: string;
}

export interface SharedTripResponse {
  success: boolean;
  trip: Trip;
  isOwner: boolean;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

const API_BASE = '/api/v1/trips';

export async function getTrips(params: ListTripsParams = {}): Promise<TripsListResponse> {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set('status', params.status);
  if (params.limit) searchParams.set('limit', params.limit.toString());
  if (params.offset) searchParams.set('offset', params.offset.toString());
  if (params.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params.sortOrder) searchParams.set('sortOrder', params.sortOrder);
  const queryString = searchParams.toString();
  return apiRequest<TripsListResponse>(queryString ? `${API_BASE}?${queryString}` : API_BASE);
}

export async function getTrip(tripId: string): Promise<Trip> { return apiRequest<Trip>(`${API_BASE}/${tripId}`); }
export async function createTripWithItinerary(input: CreateTripInput): Promise<CreateTripWithItineraryResponse> {
  return apiRequest<CreateTripWithItineraryResponse>(`${API_BASE}/create-with-itinerary`, { method: 'POST', body: JSON.stringify(input) });
}
export async function createTrip(input: Omit<CreateTripInput, 'generateItinerary'>): Promise<Trip> {
  const response = await apiRequest<{ trip: Trip }>(API_BASE, { method: 'POST', body: JSON.stringify(input) });
  return response.trip;
}
export async function updateTrip(tripId: string, input: UpdateTripInput): Promise<Trip> {
  const response = await apiRequest<{ trip: Trip }>(`${API_BASE}/${tripId}`, { method: 'PATCH', body: JSON.stringify(input) });
  return response.trip;
}
export async function deleteTrip(tripId: string): Promise<void> { await apiRequest(`${API_BASE}/${tripId}`, { method: 'DELETE' }); }
export async function shareTrip(tripId: string, expiresIn: number = 24): Promise<ShareTripResponse> {
  return apiRequest<ShareTripResponse>(`${API_BASE}/${tripId}/share`, { method: 'POST', body: JSON.stringify({ expiresIn }) });
}
export async function getSharedTrip(shareToken: string): Promise<SharedTripResponse> {
  return apiRequest<SharedTripResponse>(`${API_BASE}/shared/${shareToken}`);
}

// React Query Hooks
export const tripsKeys = {
  all: ['trips'] as const, lists: () => [...tripsKeys.all, 'list'] as const,
  list: (params: ListTripsParams) => [...tripsKeys.lists(), params] as const,
  details: () => [...tripsKeys.all, 'detail'] as const, detail: (id: string) => [...tripsKeys.details(), id] as const,
  shared: (token: string) => [...tripsKeys.all, 'shared', token] as const,
};

export function useTrips(params: ListTripsParams = {}) { return useQuery({ queryKey: tripsKeys.list(params), queryFn: () => getTrips(params), staleTime: 2 * 60 * 1000 }); }
export function useTripDetail(tripId: string | null) { return useQuery({ queryKey: tripsKeys.detail(tripId || ''), queryFn: () => getTrip(tripId!), enabled: !!tripId, staleTime: 60 * 1000 }); }
export function useSharedTrip(shareToken: string | null) { return useQuery({ queryKey: tripsKeys.shared(shareToken || ''), queryFn: () => getSharedTrip(shareToken!), enabled: !!shareToken }); }

export function useCreateTripWithItinerary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTripWithItinerary,
    onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: tripsKeys.lists() }); toast.success(data.itineraryError ? 'Trip created (itinerary failed)' : 'Trip created!'); },
    onError: (error: Error) => { toast.error(error.message || 'Failed to create trip'); },
  });
}

export function useCreateTrip() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: createTrip, onSuccess: () => { queryClient.invalidateQueries({ queryKey: tripsKeys.lists() }); toast.success('Trip created!'); }, onError: (error: Error) => { toast.error(error.message); } });
}

export function useUpdateTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, input }: { tripId: string; input: UpdateTripInput }) => updateTrip(tripId, input),
    onSuccess: (_, { tripId }) => { queryClient.invalidateQueries({ queryKey: tripsKeys.detail(tripId) }); queryClient.invalidateQueries({ queryKey: tripsKeys.lists() }); toast.success('Trip updated!'); },
    onError: (error: Error) => { toast.error(error.message); },
  });
}

export function useDeleteTrip() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: deleteTrip, onSuccess: () => { queryClient.invalidateQueries({ queryKey: tripsKeys.lists() }); toast.success('Trip deleted'); }, onError: (error: Error) => { toast.error(error.message); } });
}

export function useShareTrip() {
  return useMutation({ mutationFn: ({ tripId, expiresIn }: { tripId: string; expiresIn?: number }) => shareTrip(tripId, expiresIn), onSuccess: () => { toast.success('Share link created!'); }, onError: (error: Error) => { toast.error(error.message); } });
}

// Helper Functions
export function mapToDisplayStatus(status: TripStatus): DisplayStatus {
  if (['confirmed', 'booked', 'planned'].includes(status)) return 'upcoming';
  if (status === 'completed') return 'completed';
  if (status === 'cancelled') return 'canceled';
  return 'draft';
}
export function getStatusColor(status: DisplayStatus): string {
  return { draft: 'bg-muted', upcoming: 'bg-green-100 text-green-800', completed: 'bg-blue-100 text-blue-800', canceled: 'bg-red-100 text-red-800' }[status];
}
export function hasItinerary(trip: Trip): boolean { return !!trip.metadata?.itinerary; }
export function formatTripDates(startDate: string | null, endDate: string | null): string {
  if (!startDate) return 'Dates not set';
  const start = new Date(startDate);
  if (!endDate) return start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}
    queryKey: tripsKeys.list(params),
    queryFn: () => getTrips(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}

/**
 * Hook to fetch a single trip
 */
export function useTripDetail(tripId: string | null) {
  return useQuery({
    queryKey: tripsKeys.detail(tripId || ''),
    queryFn: () => getTrip(tripId!),
    enabled: !!tripId,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}

/**
 * Hook to fetch a shared trip
 */
export function useSharedTrip(shareToken: string | null) {
  return useQuery({
    queryKey: tripsKeys.shared(shareToken || ''),
    queryFn: () => getSharedTrip(shareToken!),
    enabled: !!shareToken,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Hook to create a trip with itinerary
 */
export function useCreateTripWithItinerary() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createTripWithItinerary,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: tripsKeys.lists() });
      if (data.itineraryError) {
        toast.warning('Trip created, but itinerary generation failed. You can retry later.');
      } else {
        toast.success('Trip created with itinerary!');
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create trip');
    },
  });
}

/**
 * Hook to create a trip
 */
export function useCreateTrip() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createTrip,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripsKeys.lists() });
      toast.success('Trip created!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create trip');
    },
  });
}

/**
 * Hook to update a trip
 */
export function useUpdateTrip() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tripId, input }: { tripId: string; input: UpdateTripInput }) =>
      updateTrip(tripId, input),
    onSuccess: (_, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: tripsKeys.detail(tripId) });
      queryClient.invalidateQueries({ queryKey: tripsKeys.lists() });
      toast.success('Trip updated!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update trip');
    },
  });
}

/**
 * Hook to delete a trip
 */
export function useDeleteTrip() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: deleteTrip,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: tripsKeys.lists() });
      toast.success('Trip deleted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete trip');
    },
  });
}

/**
 * Hook to share a trip
 */
export function useShareTrip() {
  return useMutation({
    mutationFn: ({ tripId, expiresIn }: { tripId: string; expiresIn?: number }) =>
      shareTrip(tripId, expiresIn),
    onSuccess: () => {
      toast.success('Share link created!');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create share link');
    },
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Map raw status to display status
 */
export function mapToDisplayStatus(status: TripStatus): DisplayStatus {
  const upcomingStatuses: TripStatus[] = ['confirmed', 'booked', 'planned'];
  const completedStatuses: TripStatus[] = ['completed'];
  const cancelledStatuses: TripStatus[] = ['cancelled'];
  
  if (upcomingStatuses.includes(status)) return 'upcoming';
  if (completedStatuses.includes(status)) return 'completed';
  if (cancelledStatuses.includes(status)) return 'canceled';
  return 'draft';
}

/**
 * Get status badge color
 */
export function getStatusColor(status: DisplayStatus): string {
  const colors: Record<DisplayStatus, string> = {
    draft: 'bg-muted text-muted-foreground',
    upcoming: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    canceled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  };
  return colors[status] || colors.draft;
}

/**
 * Get status label
 */
export function getStatusLabel(status: DisplayStatus): string {
  const labels: Record<DisplayStatus, string> = {
    draft: 'Draft',
    upcoming: 'Upcoming',
    completed: 'Completed',
    canceled: 'Cancelled',
  };
  return labels[status] || status;
}

/**
 * Calculate trip duration in days
 */
export function calculateTripDuration(startDate: string | null, endDate: string | null): number | null {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = end.getTime() - start.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Format trip dates for display
 */
export function formatTripDates(startDate: string | null, endDate: string | null): string {
  if (!startDate) return 'Dates not set';
  
  const start = new Date(startDate);
  const formatOptions: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  
  if (!endDate) {
    return start.toLocaleDateString('en-US', { ...formatOptions, year: 'numeric' });
  }
  
  const end = new Date(endDate);
  const sameYear = start.getFullYear() === end.getFullYear();
  
  if (sameYear) {
    return `${start.toLocaleDateString('en-US', formatOptions)} - ${end.toLocaleDateString('en-US', { ...formatOptions, year: 'numeric' })}`;
  }
  
  return `${start.toLocaleDateString('en-US', { ...formatOptions, year: 'numeric' })} - ${end.toLocaleDateString('en-US', { ...formatOptions, year: 'numeric' })}`;
}

/**
 * Check if trip has an itinerary
 */
export function hasItinerary(trip: Trip): boolean {
  return !!trip.metadata?.itinerary;
}

/**
 * Check if itinerary generation failed
 */
export function hasItineraryError(trip: Trip): boolean {
  return trip.metadata?.itineraryGenerationStatus === 'failed';
}

/**
 * Check if itinerary is generating
 */
export function isItineraryGenerating(trip: Trip): boolean {
  return trip.metadata?.itineraryGenerationStatus === 'generating' || 
         trip.metadata?.itineraryGenerationStatus === 'pending';
}

/**
 * Get share URL expiry info
 */
export function getShareExpiryInfo(expiresAt: string): { expired: boolean; hoursRemaining: number } {
  const expiry = new Date(expiresAt);
  const now = new Date();
  const diffMs = expiry.getTime() - now.getTime();
  const hoursRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60)));
  return { 
    expired: diffMs <= 0, 
    hoursRemaining 
  };
}

/**
 * Generate a trip name if not provided
 */
export function generateTripName(destination: string, startDate?: string): string {
  if (startDate) {
    const date = new Date(startDate);
    const month = date.toLocaleDateString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `${destination} ${month} ${year}`;
  }
  return `Trip to ${destination}`;
}
