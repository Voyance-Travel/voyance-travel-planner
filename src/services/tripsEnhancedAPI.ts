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

// Types
export type TripStatus = 'draft' | 'planned' | 'booked' | 'confirmed' | 'upcoming' | 'completed' | 'cancelled';
export type DisplayStatus = 'draft' | 'upcoming' | 'completed' | 'canceled';
export type SortBy = 'startDate' | 'createdAt' | 'updatedAt' | 'name';
export type SortOrder = 'asc' | 'desc';

export interface TripMetadata {
  itinerary?: unknown;
  itineraryGenerationStatus?: 'pending' | 'generating' | 'completed' | 'failed';
  itineraryGeneratedAt?: string;
  [key: string]: unknown;
}

export interface Trip {
  id: string;
  userId: string;
  destinationId?: string;
  destination: string;
  departureCity?: string;
  name: string | null;
  title?: string | null;
  startDate: string | null;
  endDate: string | null;
  totalDays?: number;
  timeline?: Record<string, unknown>;
  emotionalTags?: string[];
  status: TripStatus;
  displayStatus?: DisplayStatus;
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
  pagination: { total: number; limit: number; offset: number; };
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

// API Functions
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
  all: ['trips'] as const,
  lists: () => [...tripsKeys.all, 'list'] as const,
  list: (params: ListTripsParams) => [...tripsKeys.lists(), params] as const,
  details: () => [...tripsKeys.all, 'detail'] as const,
  detail: (id: string) => [...tripsKeys.details(), id] as const,
  shared: (token: string) => [...tripsKeys.all, 'shared', token] as const,
};

export function useTrips(params: ListTripsParams = {}) { return useQuery({ queryKey: tripsKeys.list(params), queryFn: () => getTrips(params), staleTime: 2 * 60 * 1000 }); }
export function useTripDetail(tripId: string | null) { return useQuery({ queryKey: tripsKeys.detail(tripId || ''), queryFn: () => getTrip(tripId!), enabled: !!tripId, staleTime: 60 * 1000 }); }
export function useSharedTrip(shareToken: string | null) { return useQuery({ queryKey: tripsKeys.shared(shareToken || ''), queryFn: () => getSharedTrip(shareToken!), enabled: !!shareToken }); }

export function useCreateTripWithItinerary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createTripWithItinerary,
    onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: tripsKeys.lists() }); toast.success(data.itineraryError ? 'Trip created (itinerary pending)' : 'Trip created!'); },
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
  const colors: Record<DisplayStatus, string> = { draft: 'bg-muted', upcoming: 'bg-green-100 text-green-800', completed: 'bg-blue-100 text-blue-800', canceled: 'bg-red-100 text-red-800' };
  return colors[status] || 'bg-muted';
}

export function hasItinerary(trip: Trip): boolean { return !!trip.metadata?.itinerary; }

export function formatTripDates(startDate: string | null, endDate: string | null): string {
  if (!startDate) return 'Dates not set';
  const start = new Date(startDate);
  if (!endDate) return start.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
}
