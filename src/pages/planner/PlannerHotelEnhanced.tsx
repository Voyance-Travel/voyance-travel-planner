import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, ArrowRight, Sparkles, Dna } from 'lucide-react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { syncHotelToLedger } from '@/services/budgetLedgerSync';
import { patchItineraryWithHotel, patchItineraryWithMultipleHotels } from '@/services/hotelItineraryPatch';
import { useAuth } from '@/contexts/AuthContext';
import { useBudgetAlerts } from '@/hooks/useBudgetAlerts';
import { getTripCities, updateCityHotel } from '@/services/tripCitiesService';

import {
  useHotelSearch,
  useCreateHotelHold,
  enrichHotel,
  type HotelOption,
  type HotelSearchParams,
} from '@/services/hotelAPI';

import { useTripPlanner } from '@/contexts/TripPlannerContext';
import { useTravelDNAHotelRanking, type RankedHotel } from '@/hooks/useTravelDNAHotelRanking';

// Enhanced components
import DynamicDestinationPhotos from '@/components/planner/shared/DynamicDestinationPhotos';
import EditorialProgressTracker from '@/components/planner/shared/EditorialProgressTracker';
import LoadingInterlude from '@/components/planner/shared/LoadingInterlude';
import HotelFilters, { type HotelFiltersState } from '@/components/planner/hotel/HotelFilters';
import EnhancedHotelCard, { type EnhancedHotelOption } from '@/components/planner/hotel/EnhancedHotelCard';
import { ManualBookingModal, type ManualHotelData } from '@/components/planner/ManualBookingModal';

// User hotel preferences type
interface UserHotelPreferences {
  accommodation_style?: string | null;
  hotel_style?: string | null;
  hotel_vs_flight?: string | null;
}

function HotelSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="flex flex-col md:flex-row">
        <Skeleton className="md:w-80 h-56" />
        <div className="flex-1 p-5">
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-32 mb-4" />
          <Skeleton className="h-16 w-full mb-4" />
          <div className="flex gap-2 mb-4">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-20" />
          </div>
          <div className="flex justify-between items-end">
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
      </div>
    </div>
  );
}

function calculateNights(checkIn: string, checkOut: string): number {
  const start = new Date(checkIn);
  const end = new Date(checkOut);
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

function toEnhancedHotel(
  hotel: HotelOption,
  nights: number,
  rankedHotel?: RankedHotel
): EnhancedHotelOption {
  return {
    id: hotel.id,
    name: hotel.name,
    stars: hotel.stars,
    rating: hotel.rating,
    reviewCount: (hotel as any).reviewCount || 150,
    neighborhood: hotel.neighborhood,
    distanceToCenter: (hotel as any).distanceToCenter || '1.2 km from center',
    description: hotel.description || `Experience comfort at ${hotel.name}.`,
    images: (hotel as any).images || [hotel.imageUrl].filter(Boolean),
    amenities: hotel.amenities,
    roomOptions: [
      {
        id: `${hotel.id}-standard`,
        name: hotel.roomType || 'Standard Room',
        price: hotel.price,
        pricePerNight: hotel.pricePerNight,
        sleeps: 2,
        bedType: 'Queen Bed',
        features: ['Free WiFi'],
        freeCancellation: true,
      },
      {
        id: `${hotel.id}-deluxe`,
        name: 'Deluxe Room',
        price: Math.round(hotel.price * 1.3),
        pricePerNight: Math.round(hotel.pricePerNight * 1.3),
        sleeps: 2,
        bedType: 'King Bed',
        features: ['Balcony', 'City view', 'Free WiFi'],
        freeCancellation: true,
        breakfastIncluded: true,
      },
      {
        id: `${hotel.id}-suite`,
        name: 'Junior Suite',
        price: Math.round(hotel.price * 1.8),
        pricePerNight: Math.round(hotel.pricePerNight * 1.8),
        sleeps: 3,
        bedType: 'King Bed + Sofa',
        features: ['Living area', 'Panoramic view', 'Free WiFi'],
        freeCancellation: true,
        breakfastIncluded: true,
      },
    ],
    reviews: [
      { author: 'Sarah M.', rating: 4.5, date: '2 weeks ago', text: 'Wonderful stay! The location was perfect and staff were incredibly helpful.' },
      { author: 'James T.', rating: 5, date: '1 month ago', text: 'Exceeded all expectations. Will definitely return!' },
    ],
    policies: {
      checkIn: '3:00 PM',
      checkOut: '11:00 AM',
      cancellation: 'Free cancellation up to 24 hours before check-in',
    },
    isRecommended: rankedHotel?.isRecommended ?? hotel.isRecommended,
    rationale: rankedHotel?.matchReasons ?? hotel.rationale,
    dnaMatchScore: rankedHotel?.dnaMatchScore,
    matchReasons: rankedHotel?.matchReasons,
  };
}

export default function PlannerHotelEnhanced() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { state: plannerState, setBasics, setHotel, saveTrip, loadTrip } = useTripPlanner();
  const { budgetAlertsEnabled } = useBudgetAlerts();

  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(plannerState.hotel?.id || null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [holdingHotelId, setHoldingHotelId] = useState<string | null>(null);
  const [showSkipModal, setShowSkipModal] = useState(false);
  
  // Multi-city state: which trip_cities row this hotel belongs to
  const cityIdFromUrl = searchParams.get('cityId') || null;
  const [multiCityCityId, setMultiCityCityId] = useState<string | null>(cityIdFromUrl);
  const [isMultiCity, setIsMultiCity] = useState(false);

  // User preferences state
  const [userPreferences, setUserPreferences] = useState<UserHotelPreferences | null>(null);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const hasAppliedPreferences = useRef(false);

  // "Cute buffer" overlay: only on initial load for a given destination/dates
  const [showInterlude, setShowInterlude] = useState(true);

  const createHold = useCreateHotelHold();

  const destination = plannerState.basics.destination || searchParams.get('destination') || 'Paris';
  const startDate =
    plannerState.basics.startDate ||
    searchParams.get('startDate') ||
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate =
    plannerState.basics.endDate ||
    searchParams.get('endDate') ||
    new Date(Date.now() + 37 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const travelers = Number(plannerState.basics.travelers || searchParams.get('travelers') || 2);
  const origin = searchParams.get('origin') || plannerState.basics.originCity || 'JFK';
  const tripBudget = Number(searchParams.get('budget')) || plannerState.basics.budgetAmount;
  
  // Hotel sub-budget: only use explicit user-defined allocation, not hardcoded splits.
  // Passing undefined suppresses per-card "over budget" badges when no real allocation exists.
  const hotelBudget: number | undefined = undefined;

  // Load user preferences for personalization
  useEffect(() => {
    async function loadPreferences() {
      if (!user?.id) {
        setPreferencesLoaded(true);
        return;
      }
      
      try {
        const { data, error } = await supabase
          .from('user_preferences')
          .select('accommodation_style, hotel_style, hotel_vs_flight')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (!error && data) {
          setUserPreferences(data);
          // Loaded user hotel preferences
        }
      } catch (err) {
        console.warn('[PlannerHotel] Failed to load preferences:', err);
      } finally {
        setPreferencesLoaded(true);
      }
    }
    
    loadPreferences();
  }, [user?.id]);

  // Load trip from tripId in URL if context is empty
  useEffect(() => {
    const tripIdFromUrl = searchParams.get('tripId');
    if (tripIdFromUrl && !plannerState.tripId && !plannerState.basics.destination) {
      loadTrip(tripIdFromUrl);
    }
  }, [searchParams, plannerState.tripId, plannerState.basics.destination, loadTrip]);

  // Detect multi-city: check if trip_cities exist for this trip
  useEffect(() => {
    const tripId = searchParams.get('tripId') || plannerState.tripId;
    if (!tripId) return;

    getTripCities(tripId).then(cities => {
      if (cities.length > 1) {
        setIsMultiCity(true);
        if (!cityIdFromUrl) {
          const matchingCity = cities.find(c =>
            c.city_name?.toLowerCase() === destination.toLowerCase()
          );
          if (matchingCity) setMultiCityCityId(matchingCity.id);
        }
        const targetCityId = cityIdFromUrl || cities.find(c =>
          c.city_name?.toLowerCase() === destination.toLowerCase()
        )?.id;
        if (targetCityId) {
          const city = cities.find(c => c.id === targetCityId);
          if (city?.hotel_selection) {
            const hotelRaw = city.hotel_selection as any;
            const hotelData = Array.isArray(hotelRaw) && hotelRaw.length > 0 ? hotelRaw[0] : hotelRaw;
            if (hotelData?.name) {
              setHotel(hotelData);
              setSelectedHotelId(hotelData.id || null);
            }
          }
        }
      }
    }).catch(err => console.warn('[PlannerHotel] Failed to check trip_cities:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plannerState.tripId, destination]);

  useEffect(() => {
    if (!plannerState.basics.destination || plannerState.basics.destination !== destination) {
      setBasics({ destination, startDate, endDate, travelers, originCity: origin });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination, startDate, endDate, travelers, origin]);

  useEffect(() => {
    setShowInterlude(true);
  }, [destination, startDate, endDate, travelers]);

  const nights = calculateNights(startDate, endDate);

  // Map user preferences to default filter values
  const getDefaultStarRating = useCallback((style: string | null | undefined): number[] => {
    if (!style) return [];
    switch (style.toLowerCase()) {
      case 'luxury':
        return [5];
      case 'upscale':
      case 'premium':
        return [4, 5];
      case 'boutique':
        return [4, 5];
      case 'mid-range':
      case 'moderate':
        return [3, 4];
      case 'budget':
      case 'hostel':
        return [2, 3];
      default:
        return [];
    }
  }, []);

  const getDefaultAmenities = useCallback((style: string | null | undefined): string[] => {
    if (!style) return [];
    switch (style.toLowerCase()) {
      case 'luxury':
        return ['Spa', 'Pool', 'Gym'];
      case 'business':
        return ['WiFi', 'Business Center'];
      case 'family':
        return ['Pool', 'Kids Club'];
      default:
        return [];
    }
  }, []);

  // NOTE: Budget should *guide* not block. We keep budget for warnings/sorting,
  // but default hotel results should not be hard-capped by budget.
  const maxPricePerNight = 10000;

  const [filters, setFilters] = useState<HotelFiltersState>({
    priceRange: [0, maxPricePerNight],
    starRating: [],
    amenities: [],
    propertyTypes: [],
    guestRating: 0,
    sortBy: hotelBudget ? 'price' : 'recommended', // guide toward budget-friendly options
    freeCancellation: false,
    breakfastIncluded: false,
  });

  // Apply user preferences gently: we avoid auto-filtering (which can lead to "No hotels found")
  // and instead let preferences influence ranking/badges.
  useEffect(() => {
    if (!preferencesLoaded || hasAppliedPreferences.current) return;
    hasAppliedPreferences.current = true;
  }, [preferencesLoaded]);

  // Check if user has personalized preferences
  const hasPersonalizedPreferences = useMemo(() => {
    return !!(userPreferences?.accommodation_style || userPreferences?.hotel_style);
  }, [userPreferences]);

  const hotelParams: HotelSearchParams = useMemo(
    () => ({
      destination,
      checkIn: startDate,
      checkOut: endDate,
      guests: travelers,
      // Don't pass price filters to API - filter on frontend after receiving data
    }),
    [destination, startDate, endDate, travelers]
  );

  const { data: hotels, isLoading, error } = useHotelSearch(hotelParams);

  // Get DNA-ranked hotels
  const {
    rankedHotels: dnaRankedHotels,
    isPersonalized,
    isLoading: isDNALoading,
    userBudgetTier,
  } = useTravelDNAHotelRanking(hotels || []);

  // Create a map for quick DNA lookup
  const dnaRankingMap = useMemo(() => {
    const map = new Map<string, RankedHotel>();
    for (const hotel of dnaRankedHotels) {
      map.set(hotel.id, hotel);
    }
    return map;
  }, [dnaRankedHotels]);

  // Calculate actual price range from hotels to set dynamic filter bounds
  const priceStats = useMemo(() => {
    if (!hotels?.length) return { min: 0, max: 10000 };
    const prices = hotels.map((h) => h.pricePerNight);
    return {
      min: Math.floor(Math.min(...prices)),
      max: Math.ceil(Math.max(...prices) * 1.1), // 10% buffer
    };
  }, [hotels]);

  // Ensure our local price filter range always matches the destination/currency.
  // This prevents "no results" when the API returns prices in JPY/MAD/etc.
  useEffect(() => {
    if (!hotels?.length) return;

    setFilters((prev) => {
      const nextMin = priceStats.min;
      const nextMax = priceStats.max;

      const isGenericDefault = prev.priceRange[0] === 0 && prev.priceRange[1] === 10000;
      const outOfBounds = prev.priceRange[0] < nextMin || prev.priceRange[1] > nextMax;

      if (isGenericDefault || outOfBounds || prev.priceRange[0] > prev.priceRange[1]) {
        return { ...prev, priceRange: [nextMin, nextMax] };
      }

      const clamped: [number, number] = [
        Math.max(nextMin, prev.priceRange[0]),
        Math.min(nextMax, prev.priceRange[1]),
      ];

      // If the clamp produced an invalid range, reset to safe bounds.
      if (clamped[0] > clamped[1]) {
        return { ...prev, priceRange: [nextMin, nextMax] };
      }

      if (clamped[0] !== prev.priceRange[0] || clamped[1] !== prev.priceRange[1]) {
        return { ...prev, priceRange: clamped };
      }

      return prev;
    });
  }, [hotels, priceStats.min, priceStats.max]);

  // Auto-select DNA sort when user has DNA and it's first load
  useEffect(() => {
    if (isPersonalized && !hasAppliedPreferences.current) {
      setFilters((prev) => ({ ...prev, sortBy: 'dna' }));
    }
  }, [isPersonalized]);

  useEffect(() => {
    if (!isLoading) setShowInterlude(false);
  }, [isLoading]);

  const filteredHotels = useMemo(() => {
    if (!hotels) return [];

    let result = [...hotels];

    if (filters.starRating.length > 0) {
      result = result.filter((h) => filters.starRating.includes(h.stars));
    }

    // Always apply price filter (range is initialized to the destination's real bounds)
    const [minPrice, maxPrice] = filters.priceRange;
    if (minPrice <= maxPrice) {
      result = result.filter((h) => h.pricePerNight >= minPrice && h.pricePerNight <= maxPrice);
    }

    if (filters.guestRating > 0) {
      result = result.filter((h) => h.rating >= filters.guestRating);
    }

    if (filters.amenities.length > 0) {
      result = result.filter((h) =>
        filters.amenities.every((a) => h.amenities.some((ha) => ha.toLowerCase().includes(a.toLowerCase())))
      );
    }

    result.sort((a, b) => {
      switch (filters.sortBy) {
        case 'price':
          return a.pricePerNight - b.pricePerNight;
        case 'rating':
          return b.rating - a.rating;
        case 'dna': {
          // Sort by DNA match score
          const aScore = dnaRankingMap.get(a.id)?.dnaMatchScore ?? 0;
          const bScore = dnaRankingMap.get(b.id)?.dnaMatchScore ?? 0;
          return bScore - aScore;
        }
        case 'recommended':
        default:
          if (a.isRecommended && !b.isRecommended) return -1;
          if (!a.isRecommended && b.isRecommended) return 1;
          return b.rating - a.rating;
      }
    });

    return result;
  }, [hotels, filters, dnaRankingMap]);

  const enhancedHotels = useMemo(
    () => filteredHotels.map((h) => toEnhancedHotel(h, nights, dnaRankingMap.get(h.id))),
    [filteredHotels, nights, dnaRankingMap]
  );

  const handleSelectHotel = async (hotelId: string, roomId: string) => {
    const hotel = filteredHotels.find((h) => h.id === hotelId);
    if (!hotel) return;

    setSelectedHotelId(hotelId);
    setSelectedRoomId(roomId);
    setHoldingHotelId(hotelId);

    const enhancedHotel = enhancedHotels.find((h) => h.id === hotelId);
    const room = enhancedHotel?.roomOptions.find((r) => r.id === roomId);

    // Build initial hotel selection
    const hotelPhotos = hotel.photos || hotel.images || (hotel.imageUrl ? [hotel.imageUrl] : []);
    
    let hotelSelection = {
      id: hotelId,
      name: hotel.name,
      location: hotel.neighborhood,
      address: hotel.address || hotel.neighborhood,
      neighborhood: hotel.neighborhood,
      rating: hotel.rating,
      pricePerNight: room?.pricePerNight || hotel.pricePerNight,
      roomType: room?.name || hotel.roomType || 'Room',
      amenities: hotel.amenities,
      imageUrl: hotelPhotos[0] ?? undefined,
      images: hotelPhotos,
      website: hotel.website || undefined,
      googleMapsUrl: hotel.googleMapsUrl || undefined,
      reviewCount: hotel.reviewCount,
      description: hotel.description,
      checkIn: enhancedHotel?.policies?.checkIn || '15:00',
      checkOut: enhancedHotel?.policies?.checkOut || '11:00',
      placeId: hotel.placeId || undefined,
    };

    // Enrich hotel with Google Places data (address, website, photos)
    try {
      const enrichment = await enrichHotel(hotel.name, destination);
      if (enrichment) {
        hotelSelection = {
          ...hotelSelection,
          address: enrichment.address || hotelSelection.address,
          website: enrichment.website || hotelSelection.website,
          googleMapsUrl: enrichment.googleMapsUrl || hotelSelection.googleMapsUrl,
          images: enrichment.photos?.length ? enrichment.photos : hotelSelection.images,
          imageUrl: enrichment.photos?.[0] || hotelSelection.imageUrl,
          placeId: enrichment.placeId || hotelSelection.placeId,
        };
        // Hotel enriched with Google Places data
      }
    } catch (err) {
      console.warn('[PlannerHotel] Hotel enrichment failed:', err);
    }

    // Persist to TripPlannerContext for summary/booking
    setHotel(hotelSelection);

    // Immediately save to database (incremental persistence)
    try {
      if (isMultiCity && multiCityCityId) {
        // Multi-city: save to the specific trip_cities row as an array (consistent with AddBookingInline)
        const pricePerNight = room?.pricePerNight || hotel.pricePerNight || 0;
        const hotelArray = [hotelSelection];
        await supabase
          .from('trip_cities')
          .update({
            hotel_selection: JSON.parse(JSON.stringify(hotelArray)),
            hotel_cost_cents: Math.round(pricePerNight * Math.max(1, Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))) * 100),
          } as any)
          .eq('id', multiCityCityId);

        // Sync hotel price to budget ledger
        const tripId = searchParams.get('tripId') || plannerState.tripId;
        if (tripId) {
          const nights = Math.max(1, Math.ceil(
            (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
          ));
          syncHotelToLedger(tripId, {
            ...hotelSelection,
            checkIn: startDate,
            checkOut: endDate,
            totalPrice: pricePerNight * nights,
          } as any).catch(err => console.warn('[PlannerHotel] Budget sync failed:', err));
          // Multi-city: fetch all city hotels and use multi-hotel patcher
          getTripCities(tripId).then(async (cities) => {
            const allHotels = cities
              .filter((c: any) => c.hotel_selection)
              .map((c: any) => {
                const hs = Array.isArray(c.hotel_selection) ? c.hotel_selection[0] : c.hotel_selection;
                if (!hs?.name) return null;
                return { name: hs.name, address: hs.address || hs.location, checkInDate: hs.checkInDate || hs.checkIn, checkOutDate: hs.checkOutDate || hs.checkOut };
              })
              .filter(Boolean) as Array<{ name: string; address?: string; checkInDate?: string; checkOutDate?: string }>;
            if (allHotels.length > 1) {
              await patchItineraryWithMultipleHotels(tripId, allHotels);
            } else {
              await patchItineraryWithHotel(tripId, { name: hotelSelection.name, address: hotelSelection.address, checkInDate: startDate, checkOutDate: endDate });
            }
          }).catch(err => console.warn('[PlannerHotel] Itinerary patch failed:', err));
          window.dispatchEvent(new CustomEvent('booking-changed', { detail: { tripId } }));
        }
      } else {
        // Single-city: save via TripPlannerContext (writes to trips.hotel_selection)
        const tripId = await saveTrip();
        if (tripId) {
          // Sync hotel price to budget ledger
          const pricePerNight = room?.pricePerNight || hotel.pricePerNight || 0;
          const nights = Math.max(1, Math.ceil(
            (new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)
          ));
          syncHotelToLedger(tripId, {
            ...hotelSelection,
            checkIn: startDate,
            checkOut: endDate,
            totalPrice: pricePerNight * nights,
          } as any).catch(err => console.warn('[PlannerHotel] Budget sync failed:', err));
          patchItineraryWithHotel(tripId, {
            name: hotelSelection.name,
            address: hotelSelection.address,
            checkInDate: startDate,
            checkOutDate: endDate,
          }).catch(err => console.warn('[PlannerHotel] Itinerary patch failed:', err));
          window.dispatchEvent(new CustomEvent('booking-changed', { detail: { tripId } }));
        }
      }
    } catch (err) {
      console.warn('[PlannerHotel] Incremental save failed:', err);
    }

    try {
      const tripId = searchParams.get('tripId') || plannerState.tripId || 'temp-trip';
      await createHold.mutateAsync({
        tripId,
        optionId: hotelId,
        total: hotel.price,
        currency: hotel.currency || 'USD',
      });

      toast.success('Hotel selected!');
    } catch {
      toast.info('Hotel selected (price lock unavailable)');
    } finally {
      setHoldingHotelId(null);
    }
  };

  const getNavigationParams = () => {
    const params = new URLSearchParams(searchParams);
    params.set('destination', destination);
    params.set('origin', origin);
    params.set('startDate', startDate);
    params.set('endDate', endDate);
    params.set('travelers', String(travelers));
    return params;
  };

  const handleContinue = async () => {
    if (!plannerState.hotel?.id) {
      toast.error('Please select a hotel and room first');
      return;
    }

    // Save trip first
    const tripId = plannerState.tripId || await saveTrip();
    if (!tripId) {
      toast.error('Could not save trip. Please try again.');
      return;
    }

    // If hotel has a price (Amadeus booking), go to checkout page
    // Otherwise (manual entry, free), go directly to itinerary
    const hotelPrice = plannerState.hotel?.pricePerNight || 0;
    if (hotelPrice > 0 && plannerState.hotel?.id !== 'manual') {
      // Navigate to booking/checkout page for payment
      navigate(`/planner/booking?tripId=${tripId}`);
    } else {
      // Free/manual hotel - skip to itinerary generation
      navigate(`/trip/${tripId}?generate=true`);
    }
  };

  const handleSkipHotel = async () => {
    // Skip directly to itinerary generation - no modal needed
    // User explicitly said "I'll add my hotel later"
    const tripId = plannerState.tripId || await saveTrip();
    if (tripId) {
      // Navigate directly to itinerary with generate flag
      navigate(`/trip/${tripId}?generate=true`);
    } else {
      toast.error('Could not save trip. Please try again.');
    }
  };

  const handleManualHotelSubmit = async (data: { hotel?: ManualHotelData }) => {
    if (data.hotel) {
      const manualHotel = {
        id: 'manual',
        name: data.hotel.name || 'Manual Entry',
        location: data.hotel.neighborhood || destination,
        address: data.hotel.address,
        neighborhood: data.hotel.neighborhood,
        rating: 0,
        pricePerNight: 0,
        roomType: 'Standard',
        amenities: [],
        checkIn: data.hotel.checkInTime,
        checkOut: data.hotel.checkOutTime,
      };

      // Store in context for summary/booking
      setHotel(manualHotel);

      // Multi-city: also persist to trip_cities as an array
      if (isMultiCity && multiCityCityId) {
        try {
          const hotelArray = [manualHotel];
          await supabase
            .from('trip_cities')
            .update({
              hotel_selection: JSON.parse(JSON.stringify(hotelArray)),
              hotel_cost_cents: 0,
            } as any)
            .eq('id', multiCityCityId);
        } catch (err) {
          console.warn('[PlannerHotel] Failed to save manual hotel to trip_cities:', err);
        }
      }

      // Sync budget + itinerary for manual hotels
      const manualTripId = searchParams.get('tripId') || plannerState.tripId;
      if (manualTripId && manualHotel.name) {
        syncHotelToLedger(manualTripId, manualHotel as any)
          .catch(err => console.warn('[PlannerHotel] Manual hotel budget sync failed:', err));
        // Manual hotel: checkIn/checkOut are times not dates, use trip dates instead
        const manualCheckInDate = startDate || searchParams.get('startDate') || undefined;
        const manualCheckOutDate = endDate || searchParams.get('endDate') || undefined;
        patchItineraryWithHotel(manualTripId, {
          name: manualHotel.name,
          address: manualHotel.address,
          checkInDate: manualCheckInDate,
          checkOutDate: manualCheckOutDate,
        }).catch(err => console.warn('[PlannerHotel] Manual hotel itinerary patch failed:', err));
        window.dispatchEvent(new CustomEvent('booking-changed', { detail: { tripId: manualTripId } }));
      }

      toast.success('Hotel details saved');
    }
    
    // Navigate directly to itinerary generation (same as skip flow)
    const tripId = plannerState.tripId || await saveTrip();
    if (tripId) {
      navigate(`/trip/${tripId}?generate=true`);
    } else {
      toast.error('Could not save trip. Please try again.');
    }
  };

  return (
    <MainLayout>
      <Head title="Select Hotel | Voyance" description="Choose the perfect accommodation" />

      <LoadingInterlude
        visible={isLoading && showInterlude}
        title="Finding the right stay…"
        subtitle={`Curating hotels in ${destination}.`}
      />

      <section className="py-8 min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <DynamicDestinationPhotos
            destination={destination}
            startDate={startDate}
            endDate={endDate}
            travelers={travelers}
            variant="banner"
            className="mb-6"
          />

          <div className="grid lg:grid-cols-[1fr_320px] gap-6">
            <div>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground">Select Your Hotel</h1>
                  {isPersonalized && (
                    <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary border-primary/20">
                      <Dna className="h-3 w-3" />
                      Matched to your DNA
                    </Badge>
                  )}
                  {!isPersonalized && hasPersonalizedPreferences && (
                    <Badge variant="secondary" className="gap-1 bg-accent/10 text-accent border-accent/20">
                      <Sparkles className="h-3 w-3" />
                      Personalized for you
                    </Badge>
                  )}
                  {hotelBudget && (
                    <Badge variant="outline" className="text-xs">
                      ~${hotelBudget.toLocaleString()} budget
                    </Badge>
                  )}
                </div>
                <p className="text-muted-foreground">
                  {destination} · {nights} night{nights > 1 ? 's' : ''} · {travelers} guest{travelers > 1 ? 's' : ''}
                </p>
              </motion.div>

              <HotelFilters 
                filters={filters} 
                onFiltersChange={setFilters} 
                priceRange={[priceStats.min, priceStats.max]}
                hasTravelDNA={isPersonalized}
              />

              <div className="space-y-4">
                <AnimatePresence mode="wait">
                  {isLoading ? (
                    <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <HotelSkeleton key={i} />
                      ))}
                    </motion.div>
                  ) : error ? (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-lg font-medium text-foreground mb-2">Failed to load hotels</p>
                        <p className="text-muted-foreground">Please try again.</p>
                      </CardContent>
                    </Card>
                  ) : enhancedHotels.length === 0 ? (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-lg font-medium text-foreground mb-2">No hotels found</p>
                        <p className="text-muted-foreground">Try adjusting your filters.</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <motion.div key="hotels" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                      {enhancedHotels.map((hotel) => (
                        <EnhancedHotelCard
                          key={hotel.id}
                          hotel={hotel}
                          isSelected={selectedHotelId === hotel.id}
                          selectedRoom={selectedRoomId || undefined}
                          onSelect={(roomId) => handleSelectHotel(hotel.id, roomId)}
                          isLoading={holdingHotelId === hotel.id}
                          nights={nights}
                          budgetPerNight={hotelBudget && nights > 0 ? Math.round(hotelBudget / nights) : undefined}
                          showBudgetWarnings={budgetAlertsEnabled}
                          isPersonalized={isPersonalized}
                        />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mt-8 flex justify-between items-center"
              >
                <Button variant="outline" onClick={() => navigate(-1)}>
                  Back
                </Button>
                <Button onClick={handleContinue} disabled={!plannerState.hotel?.id} size="lg" className="lg:hidden">
                  {plannerState.hotel?.pricePerNight && plannerState.hotel?.id !== 'manual' 
                    ? 'Continue to Checkout' 
                    : 'Build Itinerary'}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </motion.div>
            </div>

            <div className="hidden lg:block">
              <div className="sticky top-24 space-y-4">
                <EditorialProgressTracker
                  destination={destination}
                  startDate={startDate}
                  endDate={endDate}
                  travelers={travelers}
                  currentStep="hotels"
                  flightSelected={!!(plannerState.flights?.departure && plannerState.flights?.return)}
                  hotelSelected={!!plannerState.hotel}
                  flightDetails={plannerState.flights?.departure ? { airline: plannerState.flights.departure.airline } : undefined}
                  hotelDetails={plannerState.hotel ? { name: plannerState.hotel.name, pricePerNight: plannerState.hotel.pricePerNight } : undefined}
                />
                
                {/* Action Buttons */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="space-y-3"
                >
                  <Button 
                    onClick={handleContinue} 
                    disabled={!plannerState.hotel?.id || plannerState.isLoading} 
                    size="lg"
                    className="w-full h-12"
                  >
                    {plannerState.isLoading ? 'Saving...' : (plannerState.hotel?.pricePerNight && plannerState.hotel?.id !== 'manual' ? 'Continue to Checkout' : 'Build Itinerary')}
                    {!plannerState.isLoading && <ArrowRight className="h-4 w-4 ml-2" />}
                  </Button>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Manual Entry Modal - for entering hotel details manually */}
      <ManualBookingModal
        open={showSkipModal}
        onClose={() => setShowSkipModal(false)}
        onSubmit={handleManualHotelSubmit}
        type="hotel"
        onSkip={handleSkipHotel}
      />
    </MainLayout>
  );
}
