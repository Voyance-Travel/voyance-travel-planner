import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  useHotelSearch,
  useCreateHotelHold,
  type HotelOption,
  type HotelSearchParams 
} from '@/services/hotelAPI';

// Enhanced components
import DynamicDestinationPhotos from '@/components/planner/shared/DynamicDestinationPhotos';
import EditorialProgressTracker from '@/components/planner/shared/EditorialProgressTracker';
import HotelFilters, { type HotelFiltersState } from '@/components/planner/hotel/HotelFilters';
import EnhancedHotelCard, { type EnhancedHotelOption } from '@/components/planner/hotel/EnhancedHotelCard';

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

// Convert API hotel to enhanced format
function toEnhancedHotel(hotel: HotelOption, nights: number): EnhancedHotelOption {
  return {
    id: hotel.id,
    name: hotel.name,
    stars: hotel.stars,
    rating: hotel.rating,
    reviewCount: (hotel as any).reviewCount || 150,
    neighborhood: hotel.neighborhood,
    distanceToCenter: (hotel as any).distanceToCenter || '1.2 km from center',
    description: hotel.description || `Experience luxury and comfort at ${hotel.name}, located in the heart of ${hotel.neighborhood}.`,
    images: (hotel as any).images || [hotel.imageUrl],
    amenities: hotel.amenities,
    roomOptions: [
      {
        id: `${hotel.id}-standard`,
        name: 'Standard Room',
        price: hotel.price,
        pricePerNight: hotel.pricePerNight,
        sleeps: 2,
        bedType: 'Queen Bed',
        features: ['City view', 'Free WiFi'],
        freeCancellation: true,
      },
      {
        id: `${hotel.id}-deluxe`,
        name: 'Deluxe Room',
        price: Math.round(hotel.price * 1.3),
        pricePerNight: Math.round(hotel.pricePerNight * 1.3),
        sleeps: 2,
        bedType: 'King Bed',
        features: ['Balcony', 'City view', 'Free WiFi', 'Mini bar'],
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
        features: ['Living area', 'Panoramic view', 'Free WiFi', 'Mini bar', 'Lounge access'],
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
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [holdingHotelId, setHoldingHotelId] = useState<string | null>(null);
  
  const createHold = useCreateHotelHold();
  
  // Filter state
  const [filters, setFilters] = useState<HotelFiltersState>({
    priceRange: [0, 1000],
    starRating: [],
    amenities: [],
    propertyTypes: [],
    guestRating: 0,
    sortBy: 'recommended',
    freeCancellation: false,
    breakfastIncluded: false,
  });
  
  // Get search params
  const destination = searchParams.get('destination') || 'Paris';
  const startDate = searchParams.get('startDate') || searchParams.get('checkIn') || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const endDate = searchParams.get('endDate') || searchParams.get('checkOut') || new Date(Date.now() + 37 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const travelers = parseInt(searchParams.get('travelers') || searchParams.get('guests') || '2');
  const origin = searchParams.get('origin') || 'JFK';
  const flightId = searchParams.get('flightId');
  const cabin = searchParams.get('cabin') || 'economy';
  
  const nights = calculateNights(startDate, endDate);
  
  const hotelParams: HotelSearchParams = useMemo(() => ({
    destination,
    checkIn: startDate,
    checkOut: endDate,
    guests: travelers,
    priceMin: filters.priceRange[0],
    priceMax: filters.priceRange[1],
  }), [destination, startDate, endDate, travelers, filters.priceRange]);
  
  const { data: hotels, isLoading, error } = useHotelSearch(hotelParams);

  // Apply filters and sorting
  const filteredHotels = useMemo(() => {
    if (!hotels) return [];
    
    let result = [...hotels];
    
    // Filter by star rating
    if (filters.starRating.length > 0) {
      result = result.filter(h => filters.starRating.includes(h.stars));
    }
    
    // Filter by price range
    result = result.filter(h => 
      h.pricePerNight >= filters.priceRange[0] && 
      h.pricePerNight <= filters.priceRange[1]
    );
    
    // Filter by guest rating
    if (filters.guestRating > 0) {
      result = result.filter(h => h.rating >= filters.guestRating);
    }
    
    // Filter by amenities
    if (filters.amenities.length > 0) {
      result = result.filter(h => 
        filters.amenities.every(a => 
          h.amenities.some(ha => ha.toLowerCase().includes(a.toLowerCase()))
        )
      );
    }
    
    // Sort
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

  const enhancedHotels = useMemo(() => 
    filteredHotels.map(h => toEnhancedHotel(h, nights)), 
    [filteredHotels, nights]
  );
  
  const handleSelectHotel = async (hotelId: string, roomId: string) => {
    const hotel = filteredHotels.find(h => h.id === hotelId);
    if (!hotel) return;
    
    setSelectedHotelId(hotelId);
    setSelectedRoomId(roomId);
    setHoldingHotelId(hotelId);
    
    try {
      const tripId = searchParams.get('tripId') || 'temp-trip';
      await createHold.mutateAsync({
        tripId,
        optionId: hotelId,
        total: hotel.price,
        currency: hotel.currency || 'USD',
      });
      
      toast.success('Hotel selected! Price locked for 30 minutes.');
    } catch (error) {
      console.error('Failed to create hold:', error);
      toast.info('Hotel selected (price lock unavailable)');
    } finally {
      setHoldingHotelId(null);
    }
  };
  
  const handleContinue = () => {
    if (!selectedHotelId) {
      toast.error('Please select a hotel first');
      return;
    }
    
    const params = new URLSearchParams(searchParams);
    params.set('hotelId', selectedHotelId);
    if (selectedRoomId) params.set('roomId', selectedRoomId);
    navigate(`/planner/itinerary?${params.toString()}`);
  };

  return (
    <MainLayout>
      <Head 
        title="Select Hotel | Voyance" 
        description="Choose the perfect accommodation for your trip"
      />
      
      <section className="py-8 min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {/* Destination Teaser */}
          <DynamicDestinationPhotos 
            destination={destination}
            startDate={startDate}
            endDate={endDate}
            travelers={travelers}
            variant="banner"
            className="mb-6"
          />
          
          <div className="grid lg:grid-cols-[1fr_320px] gap-6">
            {/* Main Content */}
            <div>
              {/* Header */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6"
              >
                <h1 className="font-serif text-2xl sm:text-3xl font-bold text-foreground mb-2">
                  Select Your Hotel
                </h1>
                <p className="text-muted-foreground">
                  {destination} · {nights} night{nights > 1 ? 's' : ''} · {travelers} guest{travelers > 1 ? 's' : ''}
                </p>
              </motion.div>
              
              {/* Filters */}
              <HotelFilters 
                filters={filters}
                onFiltersChange={setFilters}
                priceRange={[0, 1000]}
              />
              
              {/* Hotel List */}
              <div className="space-y-4">
                <AnimatePresence mode="wait">
                  {isLoading ? (
                    <motion.div
                      key="loading"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-4"
                    >
                      {[...Array(3)].map((_, i) => (
                        <HotelSkeleton key={i} />
                      ))}
                    </motion.div>
                  ) : error ? (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-lg font-medium text-foreground mb-2">
                          Failed to load hotels
                        </p>
                        <p className="text-muted-foreground mb-4">
                          Please try again or adjust your search.
                        </p>
                        <Button onClick={() => window.location.reload()}>
                          Try Again
                        </Button>
                      </CardContent>
                    </Card>
                  ) : enhancedHotels.length === 0 ? (
                    <Card>
                      <CardContent className="py-12 text-center">
                        <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <p className="text-lg font-medium text-foreground mb-2">
                          No hotels found
                        </p>
                        <p className="text-muted-foreground">
                          Try adjusting your filters or price range.
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <motion.div
                      key="hotels"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-4"
                    >
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
              
              {/* Continue Button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="mt-8 flex justify-between items-center"
              >
                <Button variant="outline" onClick={() => navigate(-1)}>
                  Back
                </Button>
                <Button 
                  onClick={handleContinue}
                  disabled={!selectedHotelId}
                  size="lg"
                >
                  Continue to Itinerary
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </motion.div>
            </div>
            
            {/* Sidebar - Progress Tracker */}
            <div className="hidden lg:block">
              <div className="sticky top-24">
                <EditorialProgressTracker
                  destination={destination}
                  startDate={startDate}
                  endDate={endDate}
                  travelers={travelers}
                  currentStep="hotels"
                  flightSelected={!!flightId}
                  hotelSelected={!!selectedHotelId}
                  flightDetails={flightId ? { airline: 'Selected Flight' } : undefined}
                  hotelDetails={selectedHotelId ? {
                    name: filteredHotels.find(h => h.id === selectedHotelId)?.name,
                    pricePerNight: filteredHotels.find(h => h.id === selectedHotelId)?.pricePerNight,
                  } : undefined}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
