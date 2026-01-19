import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, ArrowRight, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

import {
  useHotelSearch,
  useCreateHotelHold,
  enrichHotel,
  type HotelOption,
  type HotelSearchParams,
} from '@/services/hotelAPI';

import { useTripPlanner } from '@/contexts/TripPlannerContext';

// Enhanced components
import DynamicDestinationPhotos from '@/components/planner/shared/DynamicDestinationPhotos';
import EditorialProgressTracker from '@/components/planner/shared/EditorialProgressTracker';
import LoadingInterlude from '@/components/planner/shared/LoadingInterlude';
import HotelFilters, { type HotelFiltersState } from '@/components/planner/hotel/HotelFilters';
import EnhancedHotelCard, { type EnhancedHotelOption } from '@/components/planner/hotel/EnhancedHotelCard';

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

function toEnhancedHotel(hotel: HotelOption, nights: number): EnhancedHotelOption {
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
    isRecommended: hotel.isRecommended,
    rationale: hotel.rationale,
  };
}

export default function PlannerHotelEnhanced() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { state: plannerState, setBasics, setHotel, saveTrip } = useTripPlanner();

  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(plannerState.hotel?.id || null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [holdingHotelId, setHoldingHotelId] = useState<string | null>(null);
  
  // User preferences state
  const [userPreferences, setUserPreferences] = useState<UserHotelPreferences | null>(null);
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const hasAppliedPreferences = useRef(false);

  // "Cute buffer" overlay — only on initial load for a given destination/dates
  const [showInterlude, setShowInterlude] = useState(true);

  const createHold = useCreateHotelHold();

  const destination = searchParams.get('destination') || plannerState.basics.destination || 'Paris';
  const startDate =
    searchParams.get('startDate') ||
    plannerState.basics.startDate ||
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate =
    searchParams.get('endDate') ||
    plannerState.basics.endDate ||
    new Date(Date.now() + 37 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const travelers = Number(searchParams.get('travelers') || plannerState.basics.travelers || 2);
  const origin = searchParams.get('origin') || plannerState.basics.originCity || 'JFK';
  const tripBudget = Number(searchParams.get('budget')) || plannerState.basics.budgetAmount;
  
  // Calculate hotel budget (assume ~60% of total budget for hotels if budget is set)
  const hotelBudget = tripBudget ? Math.round(tripBudget * 0.6) : undefined;

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
          console.log('[PlannerHotel] Loaded user hotel preferences:', data);
        }
      } catch (err) {
        console.warn('[PlannerHotel] Failed to load preferences:', err);
      } finally {
        setPreferencesLoaded(true);
      }
    }
    
    loadPreferences();
  }, [user?.id]);

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

  // Calculate max price per night from hotel budget
  const maxPricePerNight = hotelBudget && nights > 0 ? Math.round(hotelBudget / nights) : 10000;

  const [filters, setFilters] = useState<HotelFiltersState>({
    priceRange: [0, maxPricePerNight], // Apply budget if set
    starRating: [],
    amenities: [],
    propertyTypes: [],
    guestRating: 0,
    sortBy: hotelBudget ? 'price' : 'recommended', // Sort by price if on budget
    freeCancellation: false,
    breakfastIncluded: false,
  });

  // Apply user preferences as initial filters (once)
  useEffect(() => {
    if (!preferencesLoaded || hasAppliedPreferences.current) return;
    if (!userPreferences) return;
    
    const preferredStars = getDefaultStarRating(userPreferences.accommodation_style);
    const preferredAmenities = getDefaultAmenities(userPreferences.hotel_style);
    
    if (preferredStars.length > 0 || preferredAmenities.length > 0) {
      setFilters(prev => ({
        ...prev,
        starRating: preferredStars,
        amenities: preferredAmenities,
      }));
      console.log('[PlannerHotel] Applied user preferences to filters:', { preferredStars, preferredAmenities });
    }
    
    hasAppliedPreferences.current = true;
  }, [preferencesLoaded, userPreferences, getDefaultStarRating, getDefaultAmenities]);

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

      if (clamped[0] !== prev.priceRange[0] || clamped[1] !== prev.priceRange[1]) {
        return { ...prev, priceRange: clamped };
      }

      return prev;
    });
  }, [hotels, priceStats.min, priceStats.max]);

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
    result = result.filter(
      (h) => h.pricePerNight >= filters.priceRange[0] && h.pricePerNight <= filters.priceRange[1]
    );

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
        case 'recommended':
        default:
          if (a.isRecommended && !b.isRecommended) return -1;
          if (!a.isRecommended && b.isRecommended) return 1;
          return b.rating - a.rating;
      }
    });

    return result;
  }, [hotels, filters]);

  const enhancedHotels = useMemo(
    () => filteredHotels.map((h) => toEnhancedHotel(h, nights)),
    [filteredHotels, nights]
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
        console.log('[PlannerHotel] Hotel enriched with Google Places data');
      }
    } catch (err) {
      console.warn('[PlannerHotel] Hotel enrichment failed:', err);
    }

    // Persist to TripPlannerContext for summary/booking
    setHotel(hotelSelection);

    // Immediately save to database (incremental persistence)
    try {
      const tripId = await saveTrip();
      if (tripId) {
        console.log('[PlannerHotel] Hotel selection saved to database:', tripId);
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

  const handleContinue = async () => {
    if (!plannerState.hotel?.id) {
      toast.error('Please select a hotel and room first');
      return;
    }

    // Save trip to database with hotel selection
    try {
      const tripId = await saveTrip();
      if (tripId) {
        console.log('[PlannerHotel] Trip saved with hotel selection:', tripId);
      }
    } catch (error) {
      console.error('[PlannerHotel] Failed to save trip:', error);
      // Continue navigation even if save fails - data is still in context
    }

    const params = new URLSearchParams(searchParams);
    params.set('destination', destination);
    params.set('origin', origin);
    params.set('startDate', startDate);
    params.set('endDate', endDate);
    params.set('travelers', String(travelers));

    navigate(`/planner/summary?${params.toString()}`);
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
                  {hasPersonalizedPreferences && (
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

              <HotelFilters filters={filters} onFiltersChange={setFilters} priceRange={[priceStats.min, priceStats.max]} />

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
                <Button onClick={handleContinue} disabled={!plannerState.hotel?.id} size="lg">
                  Continue to Trip Summary
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
                
                {/* Floating Continue Button */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <Button 
                    onClick={handleContinue} 
                    disabled={!plannerState.hotel?.id} 
                    size="lg"
                    className="w-full h-12"
                  >
                    Continue to Trip Summary
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
