/**
 * Agent Hotel Search
 * 
 * Reuses existing Amadeus hotel search API for agents to search hotels
 * directly from the trip workspace. Allows adding hotels as booking segments.
 */

import { useState } from 'react';
import { 
  Search, 
  Hotel, 
  MapPin, 
  CalendarIcon, 
  Users, 
  Plus,
  Star,
  Loader2,
  AlertCircle,
  Check,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { parseLocalDate } from '@/utils/dateUtils';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { searchHotels, type HotelOption } from '@/services/hotelAPI';
import { createSegment, type BookingSegment } from '@/services/agencyCRM';
import { format, differenceInDays } from 'date-fns';

interface AgentHotelSearchProps {
  tripId: string;
  defaultDestination?: string;
  defaultCheckIn?: string;
  defaultCheckOut?: string;
  defaultGuests?: number;
  onHotelAdded?: (segment: BookingSegment) => void;
  onManualEntry?: () => void;
}

export default function AgentHotelSearch({
  tripId,
  defaultDestination = '',
  defaultCheckIn = '',
  defaultCheckOut = '',
  defaultGuests = 2,
  onHotelAdded,
  onManualEntry,
}: AgentHotelSearchProps) {
  const [destination, setDestination] = useState(defaultDestination);
  const [checkIn, setCheckIn] = useState(defaultCheckIn);
  const [checkOut, setCheckOut] = useState(defaultCheckOut);
  const [guests, setGuests] = useState(defaultGuests);
  
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<HotelOption[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [addingHotelId, setAddingHotelId] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!destination) {
      toast({ title: 'Please enter a destination', variant: 'destructive' });
      return;
    }
    if (!checkIn || !checkOut) {
      toast({ title: 'Please select check-in and check-out dates', variant: 'destructive' });
      return;
    }

    setIsSearching(true);
    setHasSearched(true);

    try {
      const hotels = await searchHotels({
        destination,
        checkIn,
        checkOut,
        guests,
        rooms: 1,
      });
      setResults(hotels);
      
      if (hotels.length === 0) {
        toast({ title: 'No hotels found for this search' });
      }
    } catch (error) {
      console.error('Hotel search failed:', error);
      toast({ title: 'Search failed. Try again.', variant: 'destructive' });
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddHotel = async (hotel: HotelOption) => {
    setAddingHotelId(hotel.id);

    try {
      const nights = differenceInDays(new Date(checkOut), new Date(checkIn));
      const totalCents = Math.round((hotel.price || 0) * 100);
      
      const segment = await createSegment({
        trip_id: tripId,
        segment_type: 'hotel',
        status: 'pending',
        vendor_name: hotel.name,
        destination: hotel.address || destination,
        start_date: checkIn,
        end_date: checkOut,
        room_type: hotel.roomType || 'Standard Room',
        room_count: 1,
        net_cost_cents: totalCents,
        sell_price_cents: totalCents,
        commission_cents: Math.round(totalCents * 0.1), // Default 10% commission estimate
        segment_details: {
          hotel_id: hotel.id,
          rating: hotel.rating,
          stars: hotel.stars,
          amenities: hotel.amenities,
          image_url: hotel.imageUrl,
          nights,
          guests,
          source: 'amadeus_search',
        },
        notes: `${hotel.stars || 0}-star hotel • ${nights} nights • ${guests} guests`,
      });

      toast({ 
        title: 'Hotel added!',
        description: `${hotel.name} added to trip bookings`,
      });
      
      onHotelAdded?.(segment);
    } catch (error) {
      console.error('Failed to add hotel:', error);
      toast({ title: 'Failed to add hotel', variant: 'destructive' });
    } finally {
      setAddingHotelId(null);
    }
  };

  const formatPrice = (price: number | undefined) => {
    if (!price) return 'Price unavailable';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="space-y-6">
      {/* Search Form */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Hotel className="h-5 w-5" />
            Search Hotels
          </CardTitle>
          <CardDescription>
            Search Amadeus inventory or enter booking details manually
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <Label>Destination</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  placeholder="City or hotel name"
                  className="pl-10"
                />
              </div>
            </div>
            
            <div>
              <Label>Check-in</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={checkIn}
                  onChange={(e) => setCheckIn(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div>
              <Label>Check-out</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={checkOut}
                  onChange={(e) => setCheckOut(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <div>
              <Label>Guests</Label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={guests}
                  onChange={(e) => setGuests(parseInt(e.target.value) || 1)}
                  className="pl-10"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={handleSearch} disabled={isSearching} className="gap-2">
              {isSearching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Search Hotels
            </Button>
            {onManualEntry && (
              <Button variant="outline" onClick={onManualEntry} className="gap-2">
                <Plus className="h-4 w-4" />
                Manual Entry
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {isSearching && (
        <div className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Searching hotels...</p>
        </div>
      )}

      {!isSearching && hasSearched && results.length === 0 && (
        <Card className="text-center py-12">
          <CardContent>
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No hotels found</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your search criteria or enter booking details manually
            </p>
            {onManualEntry && (
              <Button variant="outline" onClick={onManualEntry}>
                <Plus className="h-4 w-4 mr-2" />
                Enter Manually
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {!isSearching && results.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{results.length} hotels found</h3>
            <Badge variant="secondary">
              {checkIn && checkOut && (
                `${differenceInDays(new Date(checkOut), new Date(checkIn))} nights`
              )}
            </Badge>
          </div>

          <div className="grid gap-4">
            {results.map((hotel) => (
              <Card key={hotel.id} className="overflow-hidden hover:border-primary/50 transition-colors">
                <div className="flex flex-col sm:flex-row">
                  {/* Image */}
                  <div className="sm:w-48 h-32 sm:h-auto bg-muted flex-shrink-0">
                    {hotel.imageUrl ? (
                      <img
                        src={hotel.imageUrl}
                        alt={hotel.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Hotel className="h-12 w-12 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <CardContent className="flex-1 p-4">
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-start gap-2 mb-1">
                          <h4 className="font-semibold text-lg">{hotel.name}</h4>
                          {hotel.stars && (
                            <div className="flex items-center gap-0.5">
                              {Array.from({ length: hotel.stars }).map((_, i) => (
                                <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                              ))}
                            </div>
                          )}
                        </div>
                        
                        {hotel.address && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mb-2">
                            <MapPin className="h-3 w-3" />
                            {hotel.address}
                          </p>
                        )}

                        {hotel.rating && (
                          <Badge variant="secondary" className="mb-2">
                            {hotel.rating.toFixed(1)} rating
                          </Badge>
                        )}

                        {hotel.amenities && hotel.amenities.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {hotel.amenities.slice(0, 4).map((amenity, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {amenity}
                              </Badge>
                            ))}
                            {hotel.amenities.length > 4 && (
                              <Badge variant="outline" className="text-xs">
                                +{hotel.amenities.length - 4} more
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Price & Actions */}
                      <div className="sm:text-right flex sm:flex-col items-center sm:items-end gap-3">
                        <div>
                          <p className="text-2xl font-bold">{formatPrice(hotel.price)}</p>
                          <p className="text-xs text-muted-foreground">total stay</p>
                        </div>
                        
                        <Button
                          onClick={() => handleAddHotel(hotel)}
                          disabled={addingHotelId === hotel.id}
                          className="gap-2"
                        >
                          {addingHotelId === hotel.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Plus className="h-4 w-4" />
                          )}
                          Add to Trip
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
