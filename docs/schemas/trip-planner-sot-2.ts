/**
 * Trip Planner Source of Truth (SoT)
 * 
 * This file defines the canonical data structures for the Trip Planner MVP.
 * All endpoints, database mappings, and frontend contracts must align with these schemas.
 * 
 * Last Updated: 2025-08-12
 */

import { z } from "zod";

// ============================================================================
// CORE ENUMS
// ============================================================================

export const BudgetTierEnum = z.enum(['safe', 'stretch', 'splurge']);
export const TripPriorityEnum = z.enum(['flights_first', 'hotels_first']);
export const TripStatusEnum = z.enum(['draft', 'planning', 'booked', 'completed', 'cancelled']);
export const TripTypeEnum = z.enum(["round_trip", "one_way", "multi_city"]);

// ============================================================================
// DESTINATION SCHEMAS
// ============================================================================

export const DestinationRefSchema = z.object({
  id: z.string().uuid(),
  city: z.string(),
  country: z.string(),
  region: z.string().optional(),
  timezone: z.string().optional(),
  iata: z.array(z.string()).optional(),
  lat: z.number().optional(),
  lng: z.number().optional()
});

export const TripDestinationSchema = z.object({
  city: z.string(),
  country: z.string(),
  iata: z.array(z.string()).optional(),
  timezone: z.string().optional()
});

// ============================================================================
// PRICE LOCK SCHEMAS
// ============================================================================

export const PriceLockSchema = z.object({
  id: z.string(),
  expiresAt: z.string().datetime(),
  amount: z.number().positive()
});

// ============================================================================
// SELECTION SCHEMAS
// ============================================================================

export const FlightSelectionSchema = z.object({
  optionId: z.string(),
  total: z.number(),
  currency: z.string().length(3),
  lockedAt: z.string().datetime()
});

export const HotelSelectionSchema = z.object({
  optionId: z.string(),
  total: z.number(),
  currency: z.string().length(3),
  lockedAt: z.string().datetime()
});

// ============================================================================
// TRIP SCHEMAS
// ============================================================================

// Trip Creation Request
export const TripCreateSchema = z.object({
  originCity: z.string().min(1),
  destinations: z.array(TripDestinationSchema).min(1),
  startDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  endDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  tripType: TripTypeEnum.default("round_trip"),
  travelers: z.number().int().min(1).max(12).default(1),
  priority: TripPriorityEnum.default('flights_first'),
  budgetTier: BudgetTierEnum,
  styles: z.array(z.string()).default([]),
  companions: z.array(z.object({
    userId: z.string().uuid().optional(),
    name: z.string().optional(),
    username: z.string().optional(),
    email: z.string().email().optional()
  })).optional()
});

// Trip Update Request
export const TripUpdateSchema = TripCreateSchema.partial();

// Trip Response (Full SoT Format)
export const TripResponseSchema = z.object({
  id: z.string().uuid(),
  originCity: z.string(),
  destinations: z.array(TripDestinationSchema),
  startDate: z.string(),
  endDate: z.string(),
  tripType: TripTypeEnum,
  travelers: z.number().int(),
  priority: TripPriorityEnum,
  budgetTier: BudgetTierEnum,
  styles: z.array(z.string()),
  companions: z.array(z.object({
    userId: z.string().uuid().optional(),
    name: z.string().optional(),
    username: z.string().optional(),
    email: z.string().email().optional()
  })).optional(),
  selection: z.object({
    flight: FlightSelectionSchema.nullable(),
    hotel: HotelSelectionSchema.nullable()
  }),
  priceLock: z.object({
    id: z.string().nullable(),
    expiresAt: z.string().nullable(),
    amount: z.number().optional()
  })
});

// ============================================================================
// ITINERARY PREVIEW SCHEMAS
// ============================================================================

export const DayBlockSchema = z.object({
  day: z.number(),
  theme: z.string(),
  summary: z.string(),
  anchors: z.array(z.object({
    type: z.enum(['activity', 'meal', 'landmark']),
    name: z.string(),
    timeHint: z.string().optional(),
    priceTier: z.string().optional(),
    id: z.string().optional()
  }))
});

export const ItineraryPreviewRequestSchema = z.object({
  tripId: z.string().uuid().optional(),
  destinations: z.array(z.string()).min(1),
  dates: z.object({
    start: z.string(),
    end: z.string()
  }),
  budgetTier: BudgetTierEnum,
  styles: z.array(z.string()).optional()
});

export const ItineraryPreviewResponseSchema = z.object({
  preview: z.array(DayBlockSchema),
  estimatedCost: z.object({
    min: z.number(),
    max: z.number()
  }),
  source: z.enum(['db', 'mock'])
});

// ============================================================================
// HOLD SCHEMAS
// ============================================================================

export const FlightHoldSchema = z.object({
  tripId: z.string().uuid(),
  optionId: z.string(),
  total: z.number().positive(),
  currency: z.string().length(3)
});

export const HotelHoldSchema = z.object({
  tripId: z.string().uuid(),
  optionId: z.string(),
  total: z.number().positive(),
  currency: z.string().length(3)
});

export const HoldReleaseSchema = z.object({
  lockId: z.string()
});

export const HoldResponseSchema = z.object({
  priceLock: PriceLockSchema
});

// ============================================================================
// DATABASE MAPPING HELPERS
// ============================================================================

/**
 * Maps SoT trip format to database trip table format
 */
export function mapSoTToDbTrip(sotTrip: z.infer<typeof TripCreateSchema>, userId: string) {
  return {
    userId,
    sessionId: crypto.randomUUID(),
    destination: sotTrip.destinations[0].city,
    name: `Trip to ${sotTrip.destinations[0].city}`,
    status: 'draft' as const,
    departureCity: sotTrip.originCity,
    startDate: sotTrip.startDate ? new Date(sotTrip.startDate).toISOString().split('T')[0] : undefined,
    endDate: sotTrip.endDate ? new Date(sotTrip.endDate).toISOString().split('T')[0] : undefined,
    timezone: sotTrip.destinations[0].timezone || 'UTC',
    currency: 'USD',
    metadata: {
      destinations: sotTrip.destinations,
      budgetTier: sotTrip.budgetTier,
      priority: sotTrip.priority,
      styles: sotTrip.styles,
      createdFrom: 'planner'
    }
  };
}

/**
 * Maps database trip to SoT response format
 */
export function mapDbTripToSoT(dbTrip: Record<string, unknown>, priceLock?: Record<string, unknown>): z.infer<typeof TripResponseSchema> {
  const metadata = (dbTrip.metadata as Record<string, unknown>) || {};
  return {
    id: String(dbTrip.id),
    originCity: String(dbTrip.departureCity || ''),
    destinations: Array.isArray(metadata.destinations) ? metadata.destinations as z.infer<typeof TripDestinationSchema>[] : [
      { city: String(dbTrip.destination || ''), country: '', iata: [] }
    ],
    startDate: String(dbTrip.startDate || ''),
    endDate: String(dbTrip.endDate || ''),
    tripType: (metadata.tripType as z.infer<typeof TripTypeEnum>) || 'round_trip',
    travelers: Number(dbTrip.travelers) || 1,
    priority: (metadata.priority as z.infer<typeof TripPriorityEnum>) || 'flights_first',
    budgetTier: (metadata.budgetTier as z.infer<typeof BudgetTierEnum>) || 'stretch',
    styles: Array.isArray(metadata.styles) ? metadata.styles as string[] : [],
    selection: {
      flight: (metadata.selection as Record<string, unknown>)?.flight as z.infer<typeof FlightSelectionSchema> | null || null,
      hotel: (metadata.selection as Record<string, unknown>)?.hotel as z.infer<typeof HotelSelectionSchema> | null || null
    },
    priceLock: priceLock ? {
      id: String(priceLock.id),
      expiresAt: priceLock.priceLockedUntil && typeof priceLock.priceLockedUntil === 'object' && 'toISOString' in priceLock.priceLockedUntil
        ? (priceLock.priceLockedUntil as Date).toISOString()
        : null,
      amount: Number(priceLock.priceLockedAmount) || undefined
    } : {
      id: null,
      expiresAt: null
    }
  };
}

// ============================================================================
// SEARCH SCHEMAS
// ============================================================================

export const FlightSearchSchema = z.object({
  tripId: z.string().uuid(),
  origin: z.string().min(3),          // IATA or city slug
  destination: z.string().min(3),     // IATA or city slug
  dates: z.object({ out: z.string(), back: z.string().optional() }),
  cabin: z.enum(['economy','premium_economy','business','first']).default('economy'),
  radiusKm: z.number().int().min(0).max(500).optional(),
  allowHubs: z.boolean().default(true),
  passengers: z.number().int().min(1).max(9).default(1),
  budgetTier: z.enum(['safe','stretch','splurge']).optional()
});

export const HotelSearchSchema = z.object({
  tripId: z.string().uuid(),
  destinationId: z.string().uuid(),
  dates: z.object({ in: z.string(), out: z.string() }),
  rooms: z.number().int().min(1).max(4).default(1),
  guests: z.number().int().min(1).max(12).default(2),
  budgetTier: z.enum(['safe','stretch','splurge']).optional(),
  brand: z.string().optional(),
  amenities: z.array(z.string()).optional(),
  sort: z.enum(['recommended','price_asc','price_desc','rating_desc']).default('recommended'),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(10).max(50).default(20)
});

// ============================================================================
// SEARCH RESPONSE SCHEMAS
// ============================================================================

export const FlightOptionSchema = z.object({
  id: z.string(),
  price: z.number(),
  currency: z.string().length(3),
  segments: z.array(z.object({
    from: z.string(), to: z.string(),
    dep: z.string(), arr: z.string(),
    carrier: z.string(), number: z.string()
  })),
  cabin: z.enum(['economy','premium_economy','business','first']),
  riskScore: z.number().min(0).max(100),
  altRouteType: z.enum(['hub','radius','standard']).optional(),
  baggage: z.object({ carryOn: z.boolean(), checked: z.number() }).optional(),
  reasonCodes: z.array(z.string()).min(1) // require explainability
});

export const HotelOptionSchema = z.object({
  id: z.string(),
  name: z.string(),
  stars: z.number().min(0).max(5),
  nightly: z.number(),
  currency: z.string().length(3),
  location: z.object({ lat: z.number(), lng: z.number(), neighborhood: z.string().optional() }),
  amenities: z.array(z.string()),
  brand: z.string().optional(),
  voyagerMaps: z.object({ rating: z.number().min(0).max(5), overall: z.number().min(0).max(5), reviewCount: z.number().int().min(0), photos: z.array(z.string()) }),
  reasonCodes: z.array(z.string()).min(1)
});

export const FlightSearchResponseSchema = z.object({
  options: z.array(FlightOptionSchema),
  page: z.number(), 
  total: z.number()
});

export const HotelSearchResponseSchema = z.object({
  options: z.array(HotelOptionSchema),
  page: z.number(), 
  total: z.number()
});

// ============================================================================
// CHECKOUT SCHEMAS
// ============================================================================

export const CheckoutSessionSchema = z.object({
  tripId: z.string().uuid(),
  customerId: z.string().min(3)
});

export const CheckoutSessionResponseSchema = z.object({
  url: z.string().url(),
  expiresAt: z.string().datetime()
});

// ============================================================================
// PRICE MONITOR SCHEMAS
// ============================================================================

export const PriceMonitorSchema = z.object({
  tripId: z.string().uuid(),
  email: z.string().email()
});

export const PriceMonitorResponseSchema = z.object({
  ok: z.boolean(),
  subscribedAt: z.string().datetime()
});

// ============================================================================
// MAPS SCHEMAS
// ============================================================================

export const MapsDetailsSchema = z.object({
  placeId: z.string(),
  lat: z.number().optional(),
  lng: z.number().optional()
});

export const MapsReviewSchema = z.object({
  author: z.string(),
  rating: z.number().min(1).max(5),
  text: z.string(),
  source: z.string()
});

export const MapsDetailsResponseSchema = z.object({
  photos: z.array(z.string().url()),
  reviews: z.array(MapsReviewSchema),
  rating: z.number().min(1).max(5).nullable(),
  sourceBreakdown: z.record(z.string(), z.number())
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type BudgetTier = z.infer<typeof BudgetTierEnum>;
export type TripPriority = z.infer<typeof TripPriorityEnum>;
export type TripStatus = z.infer<typeof TripStatusEnum>;
export type TripType = z.infer<typeof TripTypeEnum>;
export type DestinationRef = z.infer<typeof DestinationRefSchema>;
export type TripDestination = z.infer<typeof TripDestinationSchema>;
export type TripCreate = z.infer<typeof TripCreateSchema>;
export type TripUpdate = z.infer<typeof TripUpdateSchema>;
export type TripResponse = z.infer<typeof TripResponseSchema>;
export type DayBlock = z.infer<typeof DayBlockSchema>;
export type ItineraryPreviewRequest = z.infer<typeof ItineraryPreviewRequestSchema>;
export type ItineraryPreviewResponse = z.infer<typeof ItineraryPreviewResponseSchema>;
export type FlightHold = z.infer<typeof FlightHoldSchema>;
export type HotelHold = z.infer<typeof HotelHoldSchema>;
export type HoldRelease = z.infer<typeof HoldReleaseSchema>;
export type HoldResponse = z.infer<typeof HoldResponseSchema>;
export type FlightSearch = z.infer<typeof FlightSearchSchema>;
export type HotelSearch = z.infer<typeof HotelSearchSchema>;
export type FlightOption = z.infer<typeof FlightOptionSchema>;
export type HotelOption = z.infer<typeof HotelOptionSchema>;
export type FlightSearchResponse = z.infer<typeof FlightSearchResponseSchema>;
export type HotelSearchResponse = z.infer<typeof HotelSearchResponseSchema>;
export type CheckoutSession = z.infer<typeof CheckoutSessionSchema>;
export type CheckoutSessionResponse = z.infer<typeof CheckoutSessionResponseSchema>;
export type PriceMonitor = z.infer<typeof PriceMonitorSchema>;
export type PriceMonitorResponse = z.infer<typeof PriceMonitorResponseSchema>;
export type MapsDetails = z.infer<typeof MapsDetailsSchema>;
export type MapsReview = z.infer<typeof MapsReviewSchema>;
export type MapsDetailsResponse = z.infer<typeof MapsDetailsResponseSchema>;