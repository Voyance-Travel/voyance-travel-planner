/**
 * Booking Engine - Multi-Supplier Abstraction Layer
 * 
 * Provides a unified interface for:
 * 1. Offers - Search results from suppliers (cached, expires quickly)
 * 2. Quotes - Locked prices with exact policies (expires in 15-30 min)
 * 3. Bookings - Actual reservations with confirmation codes
 * 
 * Supports: Viator (activities), Rapid Hotels, Amadeus (flights), etc.
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// =============================================================================
// TYPES
// =============================================================================

export type BookingSupplier = 'viator' | 'rapid_hotels' | 'amadeus' | 'direct' | 'manual';
export type BookingProductType = 'activity' | 'hotel' | 'flight' | 'transfer' | 'package';
export type BookingStatus = 'pending' | 'confirmed' | 'ticketed' | 'cancelled' | 'refunded' | 'no_show' | 'completed';

export interface PriceBreakdown {
  base: number;
  taxes: number;
  fees: number;
  discount?: number;
}

export interface AvailabilitySlot {
  date: string;
  times?: string[];
  capacity?: number;
}

export interface Location {
  city?: string;
  country?: string;
  address?: string;
  lat?: number;
  lng?: number;
}

export interface CancellationPolicy {
  deadline: string; // ISO datetime
  refundPercentage: number;
  feesCents?: number;
  description: string;
}

export interface ModificationPolicy {
  allowed: boolean;
  deadline?: string;
  feesCents?: number;
  description?: string;
}

export interface TravelerData {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  passportNumber?: string;
  passportExpiry?: string;
  specialRequests?: string;
}

export interface VoucherData {
  code?: string;
  qrCode?: string;
  url?: string;
  instructions?: string;
  validFrom?: string;
  validUntil?: string;
}

// =============================================================================
// 1. OFFER - What search returns
// =============================================================================

export interface Offer {
  id: string;
  tripId?: string;
  userId: string;
  productType: BookingProductType;
  
  // Supplier reference
  supplier: BookingSupplier;
  supplierOfferId: string;
  supplierProductCode?: string;
  
  // Product info
  title: string;
  description?: string;
  location?: Location;
  
  // Pricing
  priceCents: number;
  currency: string;
  priceBreakdown?: PriceBreakdown;
  
  // Availability
  availableDates?: AvailabilitySlot[];
  availabilitySummary?: string;
  minParticipants: number;
  maxParticipants?: number;
  
  // Policies
  cancellationSummary?: string;
  inclusions?: string[];
  exclusions?: string[];
  
  // Fallback
  deepLink?: string;
  
  // Media
  imageUrl?: string;
  imageUrls?: string[];
  
  // Metadata
  rating?: number;
  reviewCount?: number;
  durationMinutes?: number;
  supplierMetadata?: Record<string, unknown>;
  
  // Lifecycle
  fetchedAt: string;
  expiresAt: string;
  createdAt: string;
}

export interface CreateOfferInput {
  tripId?: string;
  productType: BookingProductType;
  supplier: BookingSupplier;
  supplierOfferId: string;
  supplierProductCode?: string;
  title: string;
  description?: string;
  location?: Location;
  priceCents: number;
  currency?: string;
  priceBreakdown?: PriceBreakdown;
  availableDates?: AvailabilitySlot[];
  availabilitySummary?: string;
  minParticipants?: number;
  maxParticipants?: number;
  cancellationSummary?: string;
  inclusions?: string[];
  exclusions?: string[];
  deepLink?: string;
  imageUrl?: string;
  imageUrls?: string[];
  rating?: number;
  reviewCount?: number;
  durationMinutes?: number;
  supplierMetadata?: Record<string, unknown>;
  expiresInMinutes?: number;
}

// =============================================================================
// 2. QUOTE - Locked price + availability
// =============================================================================

export interface Quote {
  id: string;
  offerId?: string;
  tripId?: string;
  tripActivityId?: string;
  userId: string;
  
  // Supplier reference
  supplier: BookingSupplier;
  supplierQuoteId?: string;
  supplierOfferId: string;
  
  // Product
  productType: BookingProductType;
  title: string;
  
  // Locked pricing
  priceCents: number;
  currency: string;
  priceBreakdown?: PriceBreakdown;
  
  // Booking details
  selectedDate?: string;
  selectedTime?: string;
  participantCount: number;
  
  // Exact policies
  cancellationPolicy: CancellationPolicy;
  modificationPolicy?: ModificationPolicy;
  inclusions?: string[];
  exclusions?: string[];
  
  // Validity
  isLocked: boolean;
  expiresAt: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface CreateQuoteInput {
  offerId?: string;
  tripId?: string;
  tripActivityId?: string;
  supplier: BookingSupplier;
  supplierQuoteId?: string;
  supplierOfferId: string;
  productType: BookingProductType;
  title: string;
  priceCents: number;
  currency?: string;
  priceBreakdown?: PriceBreakdown;
  selectedDate?: string;
  selectedTime?: string;
  participantCount?: number;
  cancellationPolicy: CancellationPolicy;
  modificationPolicy?: ModificationPolicy;
  inclusions?: string[];
  exclusions?: string[];
  expiresInMinutes?: number;
}

// =============================================================================
// 3. BOOKING - The actual reservation
// =============================================================================

export interface Booking {
  id: string;
  quoteId?: string;
  offerId?: string;
  tripId?: string;
  tripActivityId?: string;
  userId: string;
  
  // Reference
  bookingReference: string; // VOY-XXXXXXXX
  
  // Supplier confirmation
  supplier: BookingSupplier;
  supplierBookingId?: string;
  supplierStatus?: string;
  
  // Product
  productType: BookingProductType;
  title: string;
  
  // Booking details
  bookedDate: string;
  bookedTime?: string;
  participantCount: number;
  
  // Pricing
  priceCents: number;
  currency: string;
  priceBreakdown?: PriceBreakdown;
  
  // Status
  status: BookingStatus;
  
  // Travelers
  travelerData: TravelerData[];
  leadTravelerName?: string;
  leadTravelerEmail?: string;
  
  // Voucher
  voucherUrl?: string;
  voucherData?: VoucherData;
  tickets?: string[];
  
  // Policies
  cancellationPolicy: CancellationPolicy;
  modificationPolicy?: ModificationPolicy;
  
  // Payment
  paymentMethod?: string;
  stripePaymentIntentId?: string;
  stripeChargeId?: string;
  paidAt?: string;
  
  // Cancellation
  cancelledAt?: string;
  cancellationReason?: string;
  refundAmountCents?: number;
  refundStatus?: string;
  refundedAt?: string;
  
  createdAt: string;
  updatedAt: string;
}

export interface CreateBookingInput {
  quoteId?: string;
  offerId?: string;
  tripId?: string;
  tripActivityId?: string;
  supplier: BookingSupplier;
  supplierBookingId?: string;
  productType: BookingProductType;
  title: string;
  bookedDate: string;
  bookedTime?: string;
  participantCount?: number;
  priceCents: number;
  currency?: string;
  priceBreakdown?: PriceBreakdown;
  travelerData: TravelerData[];
  cancellationPolicy: CancellationPolicy;
  modificationPolicy?: ModificationPolicy;
  paymentMethod?: string;
  stripePaymentIntentId?: string;
}

// =============================================================================
// DATABASE OPERATIONS
// =============================================================================

// Helper to map DB row to Offer type
function mapOffer(row: Record<string, unknown>): Offer {
  return {
    id: row.id as string,
    tripId: row.trip_id as string | undefined,
    userId: row.user_id as string,
    productType: row.product_type as BookingProductType,
    supplier: row.supplier as BookingSupplier,
    supplierOfferId: row.supplier_offer_id as string,
    supplierProductCode: row.supplier_product_code as string | undefined,
    title: row.title as string,
    description: row.description as string | undefined,
    location: row.location as Location | undefined,
    priceCents: row.price_cents as number,
    currency: row.currency as string,
    priceBreakdown: row.price_breakdown as PriceBreakdown | undefined,
    availableDates: row.available_dates as AvailabilitySlot[] | undefined,
    availabilitySummary: row.availability_summary as string | undefined,
    minParticipants: (row.min_participants as number) || 1,
    maxParticipants: row.max_participants as number | undefined,
    cancellationSummary: row.cancellation_summary as string | undefined,
    inclusions: row.inclusions as string[] | undefined,
    exclusions: row.exclusions as string[] | undefined,
    deepLink: row.deep_link as string | undefined,
    imageUrl: row.image_url as string | undefined,
    imageUrls: row.image_urls as string[] | undefined,
    rating: row.rating as number | undefined,
    reviewCount: row.review_count as number | undefined,
    durationMinutes: row.duration_minutes as number | undefined,
    supplierMetadata: row.supplier_metadata as Record<string, unknown> | undefined,
    fetchedAt: row.fetched_at as string,
    expiresAt: row.expires_at as string,
    createdAt: row.created_at as string,
  };
}

function mapQuote(row: Record<string, unknown>): Quote {
  return {
    id: row.id as string,
    offerId: row.offer_id as string | undefined,
    tripId: row.trip_id as string | undefined,
    tripActivityId: row.trip_activity_id as string | undefined,
    userId: row.user_id as string,
    supplier: row.supplier as BookingSupplier,
    supplierQuoteId: row.supplier_quote_id as string | undefined,
    supplierOfferId: row.supplier_offer_id as string,
    productType: row.product_type as BookingProductType,
    title: row.title as string,
    priceCents: row.price_cents as number,
    currency: row.currency as string,
    priceBreakdown: row.price_breakdown as PriceBreakdown | undefined,
    selectedDate: row.selected_date as string | undefined,
    selectedTime: row.selected_time as string | undefined,
    participantCount: (row.participant_count as number) || 1,
    cancellationPolicy: row.cancellation_policy as CancellationPolicy,
    modificationPolicy: row.modification_policy as ModificationPolicy | undefined,
    inclusions: row.inclusions as string[] | undefined,
    exclusions: row.exclusions as string[] | undefined,
    isLocked: row.is_locked as boolean,
    expiresAt: row.expires_at as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

function mapBooking(row: Record<string, unknown>): Booking {
  return {
    id: row.id as string,
    quoteId: row.quote_id as string | undefined,
    offerId: row.offer_id as string | undefined,
    tripId: row.trip_id as string | undefined,
    tripActivityId: row.trip_activity_id as string | undefined,
    userId: row.user_id as string,
    bookingReference: row.booking_reference as string,
    supplier: row.supplier as BookingSupplier,
    supplierBookingId: row.supplier_booking_id as string | undefined,
    supplierStatus: row.supplier_status as string | undefined,
    productType: row.product_type as BookingProductType,
    title: row.title as string,
    bookedDate: row.booked_date as string,
    bookedTime: row.booked_time as string | undefined,
    participantCount: (row.participant_count as number) || 1,
    priceCents: row.price_cents as number,
    currency: row.currency as string,
    priceBreakdown: row.price_breakdown as PriceBreakdown | undefined,
    status: row.status as BookingStatus,
    travelerData: row.traveler_data as TravelerData[],
    leadTravelerName: row.lead_traveler_name as string | undefined,
    leadTravelerEmail: row.lead_traveler_email as string | undefined,
    voucherUrl: row.voucher_url as string | undefined,
    voucherData: row.voucher_data as VoucherData | undefined,
    tickets: row.tickets as string[] | undefined,
    cancellationPolicy: row.cancellation_policy as CancellationPolicy,
    modificationPolicy: row.modification_policy as ModificationPolicy | undefined,
    paymentMethod: row.payment_method as string | undefined,
    stripePaymentIntentId: row.stripe_payment_intent_id as string | undefined,
    stripeChargeId: row.stripe_charge_id as string | undefined,
    paidAt: row.paid_at as string | undefined,
    cancelledAt: row.cancelled_at as string | undefined,
    cancellationReason: row.cancellation_reason as string | undefined,
    refundAmountCents: row.refund_amount_cents as number | undefined,
    refundStatus: row.refund_status as string | undefined,
    refundedAt: row.refunded_at as string | undefined,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// =============================================================================
// OFFER OPERATIONS
// =============================================================================

export async function createOffer(input: CreateOfferInput): Promise<Offer> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const expiresAt = new Date(Date.now() + (input.expiresInMinutes || 60) * 60 * 1000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('booking_offers')
    .insert({
      user_id: user.user.id,
      trip_id: input.tripId,
      product_type: input.productType,
      supplier: input.supplier,
      supplier_offer_id: input.supplierOfferId,
      supplier_product_code: input.supplierProductCode,
      title: input.title,
      description: input.description,
      location: input.location,
      price_cents: input.priceCents,
      currency: input.currency || 'USD',
      price_breakdown: input.priceBreakdown,
      available_dates: input.availableDates,
      availability_summary: input.availabilitySummary,
      min_participants: input.minParticipants || 1,
      max_participants: input.maxParticipants,
      cancellation_summary: input.cancellationSummary,
      inclusions: input.inclusions,
      exclusions: input.exclusions,
      deep_link: input.deepLink,
      image_url: input.imageUrl,
      image_urls: input.imageUrls,
      rating: input.rating,
      review_count: input.reviewCount,
      duration_minutes: input.durationMinutes,
      supplier_metadata: input.supplierMetadata,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) throw error;
  return mapOffer(data);
}

export async function getOffers(tripId: string): Promise<Offer[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('booking_offers')
    .select('*')
    .eq('trip_id', tripId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapOffer);
}

export async function getOfferById(offerId: string): Promise<Offer | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('booking_offers')
    .select('*')
    .eq('id', offerId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapOffer(data) : null;
}

// =============================================================================
// QUOTE OPERATIONS
// =============================================================================

export async function createQuote(input: CreateQuoteInput): Promise<Quote> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const expiresAt = new Date(Date.now() + (input.expiresInMinutes || 15) * 60 * 1000).toISOString();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('booking_quotes')
    .insert({
      user_id: user.user.id,
      offer_id: input.offerId,
      trip_id: input.tripId,
      trip_activity_id: input.tripActivityId,
      supplier: input.supplier,
      supplier_quote_id: input.supplierQuoteId,
      supplier_offer_id: input.supplierOfferId,
      product_type: input.productType,
      title: input.title,
      price_cents: input.priceCents,
      currency: input.currency || 'USD',
      price_breakdown: input.priceBreakdown,
      selected_date: input.selectedDate,
      selected_time: input.selectedTime,
      participant_count: input.participantCount || 1,
      cancellation_policy: input.cancellationPolicy,
      modification_policy: input.modificationPolicy,
      inclusions: input.inclusions,
      exclusions: input.exclusions,
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) throw error;
  return mapQuote(data);
}

export async function getQuotes(tripId: string): Promise<Quote[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('booking_quotes')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapQuote);
}

export async function getActiveQuotes(tripId: string): Promise<Quote[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('booking_quotes')
    .select('*')
    .eq('trip_id', tripId)
    .eq('is_locked', true)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapQuote);
}

export async function getQuoteById(quoteId: string): Promise<Quote | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('booking_quotes')
    .select('*')
    .eq('id', quoteId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapQuote(data) : null;
}

export function isQuoteValid(quote: Quote): boolean {
  return quote.isLocked && new Date(quote.expiresAt) > new Date();
}

export function getQuoteTimeRemaining(expiresAt: string): string {
  const remaining = new Date(expiresAt).getTime() - Date.now();
  if (remaining <= 0) return 'Expired';
  
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }
  return `${minutes}m ${seconds}s`;
}

// =============================================================================
// BOOKING OPERATIONS
// =============================================================================

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const leadTraveler = input.travelerData[0];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('bookings')
    .insert({
      user_id: user.user.id,
      quote_id: input.quoteId,
      offer_id: input.offerId,
      trip_id: input.tripId,
      trip_activity_id: input.tripActivityId,
      supplier: input.supplier,
      supplier_booking_id: input.supplierBookingId,
      product_type: input.productType,
      title: input.title,
      booked_date: input.bookedDate,
      booked_time: input.bookedTime,
      participant_count: input.participantCount || 1,
      price_cents: input.priceCents,
      currency: input.currency || 'USD',
      price_breakdown: input.priceBreakdown,
      status: 'pending',
      traveler_data: input.travelerData,
      lead_traveler_name: leadTraveler ? `${leadTraveler.firstName} ${leadTraveler.lastName}` : undefined,
      lead_traveler_email: leadTraveler?.email,
      cancellation_policy: input.cancellationPolicy,
      modification_policy: input.modificationPolicy,
      payment_method: input.paymentMethod,
      stripe_payment_intent_id: input.stripePaymentIntentId,
    })
    .select()
    .single();

  if (error) throw error;
  return mapBooking(data);
}

export async function getBookings(tripId: string): Promise<Booking[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('bookings')
    .select('*')
    .eq('trip_id', tripId)
    .order('booked_date', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapBooking);
}

export async function getBookingById(bookingId: string): Promise<Booking | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('bookings')
    .select('*')
    .eq('id', bookingId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapBooking(data) : null;
}

export async function getBookingByReference(reference: string): Promise<Booking | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('bookings')
    .select('*')
    .eq('booking_reference', reference)
    .maybeSingle();

  if (error) throw error;
  return data ? mapBooking(data) : null;
}

export async function updateBookingStatus(
  bookingId: string, 
  status: BookingStatus,
  additionalData?: Partial<{
    supplierBookingId: string;
    supplierStatus: string;
    voucherUrl: string;
    voucherData: VoucherData;
    paidAt: string;
    cancelledAt: string;
    cancellationReason: string;
    refundAmountCents: number;
    refundStatus: string;
    refundedAt: string;
  }>
): Promise<Booking> {
  const updateData: Record<string, unknown> = { status };
  
  if (additionalData?.supplierBookingId) updateData.supplier_booking_id = additionalData.supplierBookingId;
  if (additionalData?.supplierStatus) updateData.supplier_status = additionalData.supplierStatus;
  if (additionalData?.voucherUrl) updateData.voucher_url = additionalData.voucherUrl;
  if (additionalData?.voucherData) updateData.voucher_data = additionalData.voucherData;
  if (additionalData?.paidAt) updateData.paid_at = additionalData.paidAt;
  if (additionalData?.cancelledAt) updateData.cancelled_at = additionalData.cancelledAt;
  if (additionalData?.cancellationReason) updateData.cancellation_reason = additionalData.cancellationReason;
  if (additionalData?.refundAmountCents !== undefined) updateData.refund_amount_cents = additionalData.refundAmountCents;
  if (additionalData?.refundStatus) updateData.refund_status = additionalData.refundStatus;
  if (additionalData?.refundedAt) updateData.refunded_at = additionalData.refundedAt;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('bookings')
    .update(updateData)
    .eq('id', bookingId)
    .select()
    .single();

  if (error) throw error;
  return mapBooking(data);
}

export async function confirmBooking(
  bookingId: string, 
  supplierBookingId: string,
  voucherData?: VoucherData
): Promise<Booking> {
  return updateBookingStatus(bookingId, 'confirmed', {
    supplierBookingId,
    voucherData,
    paidAt: new Date().toISOString(),
  });
}

export async function cancelBooking(
  bookingId: string, 
  reason: string,
  refundAmountCents?: number
): Promise<Booking> {
  return updateBookingStatus(bookingId, 'cancelled', {
    cancelledAt: new Date().toISOString(),
    cancellationReason: reason,
    refundAmountCents,
    refundStatus: refundAmountCents ? 'pending' : undefined,
  });
}

// =============================================================================
// REACT QUERY HOOKS
// =============================================================================

export function useOffers(tripId: string) {
  return useQuery({
    queryKey: ['booking-offers', tripId],
    queryFn: () => getOffers(tripId),
    enabled: !!tripId,
    staleTime: 1000 * 60, // 1 minute
  });
}

export function useQuotes(tripId: string) {
  return useQuery({
    queryKey: ['booking-quotes', tripId],
    queryFn: () => getQuotes(tripId),
    enabled: !!tripId,
  });
}

export function useActiveQuotes(tripId: string) {
  return useQuery({
    queryKey: ['booking-quotes', tripId, 'active'],
    queryFn: () => getActiveQuotes(tripId),
    enabled: !!tripId,
    refetchInterval: 30000, // Refresh every 30s to check expiry
  });
}

export function useBookings(tripId: string) {
  return useQuery({
    queryKey: ['bookings', tripId],
    queryFn: () => getBookings(tripId),
    enabled: !!tripId,
  });
}

export function useBooking(bookingId: string | null) {
  return useQuery({
    queryKey: ['booking', bookingId],
    queryFn: () => bookingId ? getBookingById(bookingId) : null,
    enabled: !!bookingId,
  });
}

export function useCreateOffer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createOffer,
    onSuccess: (offer) => {
      if (offer.tripId) {
        queryClient.invalidateQueries({ queryKey: ['booking-offers', offer.tripId] });
      }
    },
  });
}

export function useCreateQuote() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createQuote,
    onSuccess: (quote) => {
      if (quote.tripId) {
        queryClient.invalidateQueries({ queryKey: ['booking-quotes', quote.tripId] });
      }
    },
  });
}

export function useCreateBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createBooking,
    onSuccess: (booking) => {
      if (booking.tripId) {
        queryClient.invalidateQueries({ queryKey: ['bookings', booking.tripId] });
      }
    },
  });
}

export function useConfirmBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, supplierBookingId, voucherData }: { 
      bookingId: string; 
      supplierBookingId: string; 
      voucherData?: VoucherData;
    }) => confirmBooking(bookingId, supplierBookingId, voucherData),
    onSuccess: (booking) => {
      queryClient.invalidateQueries({ queryKey: ['booking', booking.id] });
      if (booking.tripId) {
        queryClient.invalidateQueries({ queryKey: ['bookings', booking.tripId] });
      }
    },
  });
}

export function useCancelBooking() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, reason, refundAmountCents }: { 
      bookingId: string; 
      reason: string; 
      refundAmountCents?: number;
    }) => cancelBooking(bookingId, reason, refundAmountCents),
    onSuccess: (booking) => {
      queryClient.invalidateQueries({ queryKey: ['booking', booking.id] });
      if (booking.tripId) {
        queryClient.invalidateQueries({ queryKey: ['bookings', booking.tripId] });
      }
    },
  });
}

// =============================================================================
// UTILITIES
// =============================================================================

export function formatPrice(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

export function getStatusColor(status: BookingStatus): string {
  switch (status) {
    case 'confirmed':
    case 'ticketed':
    case 'completed':
      return 'bg-green-500/10 text-green-600 border-green-500/20';
    case 'pending':
      return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
    case 'cancelled':
    case 'no_show':
      return 'bg-red-500/10 text-red-600 border-red-500/20';
    case 'refunded':
      return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

export function getStatusLabel(status: BookingStatus): string {
  switch (status) {
    case 'pending': return 'Pending';
    case 'confirmed': return 'Confirmed';
    case 'ticketed': return 'Ticketed';
    case 'cancelled': return 'Cancelled';
    case 'refunded': return 'Refunded';
    case 'no_show': return 'No Show';
    case 'completed': return 'Completed';
    default: return status;
  }
}
