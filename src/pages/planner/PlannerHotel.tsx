import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, 
  Star, 
  MapPin, 
  Wifi,
  UtensilsCrossed,
  Dumbbell,
  Waves,
  Check,
  ArrowRight,
  Loader2,
  SlidersHorizontal,
  ChevronDown
} from 'lucide-react';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  useHotelSearch,
  useCreateHotelHold,
  type HotelOption,
  type HotelSearchParams 
} from '@/services/hotelAPI';

const amenityIcons: Record<string, typeof Wifi> = {
  'Free WiFi': Wifi,
  'WiFi': Wifi,
  'Restaurant': UtensilsCrossed,
  'Breakfast': UtensilsCrossed,
  'Gym': Dumbbell,
  'Pool': Waves,
  'Spa': Waves,
};

function HotelCard({ 
  hotel, 
  isSelected, 
  onSelect,
  isLoading,
  nights
}: { 
  hotel: HotelOption; 
  isSelected: boolean;
  onSelect: () => void;
  isLoading: boolean;
  nights: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`
        relative bg-card rounded-xl border-2 transition-all duration-200 overflow-hidden
        ${isSelected 
          ? 'border-primary shadow-lg ring-2 ring-primary/20' 
          : 'border-border hover:border-primary/50 hover:shadow-md'
        }
      `}
    >
      {/* Recommended Badge */}
      {hotel.isRecommended && (
        <div className="absolute top-4 left-4 z-10">
          <Badge className="bg-primary text-primary-foreground gap-1">
            <Star className="h-3 w-3 fill-current" />
            Top Pick
          </Badge>
        </div>
      )}
      
      <div className="flex flex-col md:flex-row">
        {/* Image */}
        <div className="md:w-64 h-48 md:h-auto shrink-0 relative">
          <img 
            src={hotel.imageUrl} 
            alt={hotel.name}
            className="w-full h-full object-cover"
          />
        </div>
        
        {/* Content */}
        <div className="flex-1 p-5">
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="mb-3">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {hotel.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex items-center gap-0.5">
                      {[...Array(hotel.stars)].map((_, i) => (
                        <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <span className="text-sm text-muted-foreground">·</span>
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {hotel.neighborhood}
                    </span>
                  </div>
                </div>
                
                {/* Rating */}
                <div className="text-right shrink-0">
                  <div className="bg-primary text-primary-foreground text-sm font-bold px-2 py-1 rounded">
                    {hotel.rating.toFixed(1)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {hotel.reviewCount} reviews
                  </p>
                </div>
              </div>
            </div>
            
            {/* Description */}
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {hotel.description}
            </p>
            
            {/* Amenities */}
            <div className="flex flex-wrap gap-2 mb-4">
              {hotel.amenities.slice(0, 5).map((amenity, i) => {
                const Icon = amenityIcons[amenity] || Building2;
                return (
                  <Badge key={i} variant="secondary" className="gap-1 text-xs">
                    <Icon className="h-3 w-3" />
                    {amenity}
                  </Badge>
                );
              })}
              {hotel.amenities.length > 5 && (
                <Badge variant="secondary" className="text-xs">
                  +{hotel.amenities.length - 5} more
                </Badge>
              )}
            </div>
            
            {/* Price & CTA */}
            <div className="mt-auto flex items-end justify-between">
              <div>
                <p className="text-2xl font-bold text-foreground">
                  ${hotel.pricePerNight}
                  <span className="text-sm font-normal text-muted-foreground">/night</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  ${hotel.price} total for {nights} night{nights > 1 ? 's' : ''}
                </p>
              </div>
              
              <Button
                onClick={onSelect}
                disabled={isLoading}
                variant={isSelected ? "default" : "outline"}
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isSelected ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Selected
                  </>
                ) : (
                  'Select'
                )}
              </Button>
            </div>
            
            {/* Why we recommend */}
            {hotel.rationale && hotel.rationale.length > 0 && (
              <Collapsible className="mt-4">
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground p-0 h-auto">
                    <ChevronDown className="h-4 w-4 mr-1" />
                    Why we recommend this
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ul className="mt-2 space-y-1">
                    {hotel.rationale.map((reason, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-foreground">
                        <Check className="h-3 w-3 text-primary shrink-0" />
                        {reason}
                      </li>
                    ))}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function HotelSkeleton() {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="flex flex-col md:flex-row">
        <Skeleton className="md:w-64 h-48" />
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

export default function PlannerHotel() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(null);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]);
  const [holdingHotelId, setHoldingHotelId] = useState<string | null>(null);
  
  const createHold = useCreateHotelHold();
  
  // Get search params from URL or use defaults
  const checkIn = searchParams.get('checkIn') || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const checkOut = searchParams.get('checkOut') || new Date(Date.now() + 37 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const nights = calculateNights(checkIn, checkOut);
  
  const hotelParams: HotelSearchParams = useMemo(() => ({
    destination: searchParams.get('destination') || 'Paris',
    checkIn,
    checkOut,
    guests: parseInt(searchParams.get('guests') || '2'),
    priceMin: priceRange[0],
    priceMax: priceRange[1],
  }), [searchParams, checkIn, checkOut, priceRange]);
  
  const { data: hotels, isLoading, error } = useHotelSearch(hotelParams);
  
  const handleSelectHotel = async (hotel: HotelOption) => {
    if (selectedHotelId === hotel.id) {
      setSelectedHotelId(null);
      return;
    }
    
    setSelectedHotelId(hotel.id);
    setHoldingHotelId(hotel.id);
    
    try {
      const tripId = searchParams.get('tripId') || 'temp-trip';
      await createHold.mutateAsync({
        tripId,
        optionId: hotel.id,
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
    
    // Save selection and navigate to itinerary
    const params = new URLSearchParams(searchParams);
    params.set('hotelId', selectedHotelId);
    navigate(`/planner/itinerary?${params.toString()}`);
  };

  const filteredHotels = useMemo(() => {
    if (!hotels) return [];
    return hotels.filter(h => 
      h.pricePerNight >= priceRange[0] && 
      h.pricePerNight <= priceRange[1]
    );
  }, [hotels, priceRange]);

  return (
    <MainLayout>
      <Head 
        title="Select Hotel | Voyance" 
        description="Choose the perfect accommodation for your trip"
      />
      
      <section className="pt-24 pb-16 min-h-screen bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
              <span>Trip Setup</span>
              <ArrowRight className="h-3 w-3" />
              <span>Flights</span>
              <ArrowRight className="h-3 w-3" />
              <span className="text-foreground font-medium">Hotel</span>
              <ArrowRight className="h-3 w-3" />
              <span>Itinerary</span>
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl font-bold text-foreground mb-2">
              Select Your Hotel
            </h1>
            <p className="text-muted-foreground">
              {hotelParams.destination} · {nights} night{nights > 1 ? 's' : ''} · {hotelParams.guests} guest{hotelParams.guests > 1 ? 's' : ''}
            </p>
          </motion.div>
          
          {/* Filters */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6 p-4 bg-card rounded-xl border border-border"
          >
            <div className="flex flex-col sm:flex-row gap-6">
              <div className="flex-1">
                <Label className="text-sm font-medium mb-2 block">
                  Price per night: ${priceRange[0]} - ${priceRange[1]}
                </Label>
                <Slider
                  value={priceRange}
                  onValueChange={(value) => setPriceRange(value as [number, number])}
                  min={0}
                  max={1000}
                  step={25}
                  className="mt-2"
                />
              </div>
              <Button variant="outline" size="sm" className="gap-2 self-end">
                <SlidersHorizontal className="h-4 w-4" />
                More filters
              </Button>
            </div>
          </motion.div>
          
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
                      We couldn't find hotels for your search. Please try again.
                    </p>
                    <Button onClick={() => window.location.reload()}>
                      Try Again
                    </Button>
                  </CardContent>
                </Card>
              ) : filteredHotels.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-lg font-medium text-foreground mb-2">
                      No hotels found
                    </p>
                    <p className="text-muted-foreground">
                      Try adjusting your price range or search criteria.
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
                  {filteredHotels.map((hotel) => (
                    <HotelCard
                      key={hotel.id}
                      hotel={hotel}
                      isSelected={selectedHotelId === hotel.id}
                      onSelect={() => handleSelectHotel(hotel)}
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
      </section>
    </MainLayout>
  );
}
