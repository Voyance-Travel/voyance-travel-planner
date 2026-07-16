// Extracted from EditorialItinerary.tsx during the file-size decomposition.
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Clock, Hotel, MapPin, Plane, Sparkles, Train } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { safeFormatDate } from '@/utils/dateUtils';
import { AirportHotelTransfer, type SelectedTransfer } from '../AirportHotelTransfer';
import type { FlightSelection, HotelSelection, CityHotelInfo } from '../EditorialItinerary';

interface TransferOption {
  mode: string;
  duration: string;
  durationMinutes: number;
  estimatedCost?: string;
  notes?: string;
}

interface TransferData {
  taxi: { duration: string; cost: string };
  train: { duration: string; cost: string };
}

interface ArrivalGamePlanProps {
  flightSelection?: FlightSelection | null;
  hotelSelection?: HotelSelection | null;
  allHotels?: CityHotelInfo[];
  destination: string;
  onNavigateToBookings?: () => void;
  onAddFlightInline?: () => void;
  onAddHotelInline?: () => void;
  /** For multi-city arrivals: the city being arrived at */
  arrivalCityInfo?: CityHotelInfo;
  /** Day number (1-indexed), defaults to 1 */
  dayNumber?: number;
}

export function ArrivalGamePlan({ flightSelection, hotelSelection, allHotels, destination, onNavigateToBookings, onAddFlightInline, onAddHotelInline, arrivalCityInfo, dayNumber = 1 }: ArrivalGamePlanProps) {
  const outbound = flightSelection?.outbound;
  const fallbackCityHotel = allHotels?.find(h => !!h.hotel?.name)?.hotel || null;
  const effectiveHotelSelection = hotelSelection?.name ? hotelSelection : fallbackCityHotel;
  const hasHotel = !!effectiveHotelSelection?.name;
  const [transferData, setTransferData] = useState<TransferData | null>(null);
  const [isLoadingTransfer, setIsLoadingTransfer] = useState(false);
  
  // Multi-city: check if arriving by train/bus (not flight)
  const isTrainBusArrival = arrivalCityInfo?.transportType && ['train', 'bus', 'ferry', 'car'].includes(arrivalCityInfo.transportType);
  // Human label for the chosen non-flight mode, so an incomplete leg prompts
  // for the RIGHT thing ("Add your train details") instead of forcing a flight.
  const arrivalModeLabel = arrivalCityInfo?.transportType === 'train' ? 'Train'
    : arrivalCityInfo?.transportType === 'bus' ? 'Bus'
    : arrivalCityInfo?.transportType === 'ferry' ? 'Ferry'
    : arrivalCityInfo?.transportType === 'car' ? 'Drive'
    : 'Flight';
  const transportDetails = arrivalCityInfo?.transportDetails;
  
  // Determine flight completeness: need arrival time for game plan to be useful
  const hasAnyFlightData = !!outbound;
  const hasCompleteFlightData = !!(outbound?.arrival?.time || outbound?.departure?.time);
  // For train/bus arrivals, we have arrival data from transportDetails
  const hasTransportArrival = isTrainBusArrival && !!(transportDetails?.arrivalTime as string);
  const hasFlight = hasCompleteFlightData; // Only show game plan if we have times
  const hasAnyArrivalData = hasFlight || hasTransportArrival;
  
  // Fetch dynamic transfer data from Google Maps Distance Matrix API
  // Runs when hotel exists (flight optional - uses destination airport as fallback)
  useEffect(() => {
    if (!effectiveHotelSelection?.name) return;
    
    const fetchTransferData = async () => {
      setIsLoadingTransfer(true);
      try {
        const arrivalAirport = outbound?.arrival?.airport || '';
        const arrivalTime = outbound?.arrival?.time || '';
        
        // Build origin string (airport) - use flight data or fallback to destination airport
        const origin = arrivalAirport 
          ? `${arrivalAirport} Airport, ${destination}`
          : `${destination} Airport`;
        
        // Build destination string (hotel or city center)
        const hotelDest = effectiveHotelSelection?.address 
          || `${effectiveHotelSelection.name}, ${destination}`;
        
        const response = await supabase.functions.invoke('airport-transfers', {
          body: { 
            origin, 
            destination: hotelDest,
            city: destination, // City name for database fare lookup
            airportCode: arrivalAirport || undefined,
            arrivalTime: arrivalTime ? new Date().toISOString() : undefined
          }
        });
        
        if (response.error) {
          console.error('Transfer API error:', response.error);
          return;
        }
        
        const data = response.data;
        if (data?.options) {
          // Map API response to our format
          const taxiOption = data.options.find((o: TransferOption) => 
            (o.mode || '').toLowerCase().includes('taxi') || (o.mode || '').toLowerCase().includes('ride')
          );
          const transitOption = data.options.find((o: TransferOption) => 
            (o.mode || '').toLowerCase().includes('train') || (o.mode || '').toLowerCase().includes('bus')
          );
          
          setTransferData({
            taxi: {
              duration: taxiOption?.duration || '30-50 min',
              cost: taxiOption?.estimatedCost || 'Varies',
            },
            train: {
              duration: transitOption?.duration || 'N/A',
              cost: transitOption?.estimatedCost || 'N/A',
            },
          });
        }
      } catch (error) {
        console.error('Failed to fetch transfer data:', error);
      } finally {
        setIsLoadingTransfer(false);
      }
    };
    
    fetchTransferData();
  }, [outbound?.arrival?.airport, effectiveHotelSelection?.name, effectiveHotelSelection?.address, destination]);
  
  // Parse arrival time and calculate recommendations (move up to use in all states)
  const arrivalTime = outbound?.arrival?.time || '';
  const arrivalAirport = outbound?.arrival?.airport || '';
  const departureTime = outbound?.departure?.time || '';
  
  // Calculate recommended airport arrival (2.5 hours before for international, 2 for domestic)
  const getRecommendedAirportArrival = () => {
    if (!departureTime) return null;
    const match = departureTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) return departureTime;
    
    let hours = parseInt(match[1], 10);
    const mins = match[2];
    const period = match[3]?.toUpperCase();
    
    // Convert to 24h if needed
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    // Subtract 2.5 hours for international
    hours -= 2;
    let finalMins = parseInt(mins, 10) - 30;
    if (finalMins < 0) {
      finalMins += 60;
      hours -= 1;
    }
    if (hours < 0) hours += 24;
    
    // Format back to 12h
    const finalPeriod = hours >= 12 ? 'PM' : 'AM';
    const finalHours = hours % 12 || 12;
    return `${finalHours}:${String(finalMins).padStart(2, '0')} ${finalPeriod}`;
  };

  // Post-landing advice based on arrival time - aware of hotel availability
  const getPostLandingAdvice = (): { action: string; reason: string; isMissing?: boolean } => {
    // For train/bus arrivals, use transport arrival time
    if (isTrainBusArrival && hasTransportArrival) {
      if (!hasHotel) {
        return { action: 'Add hotel for personalized tips', reason: 'We\'ll calculate transfer times from the station', isMissing: true };
      }
      return { action: 'Head to your hotel', reason: 'No customs or security, so you can go straight to check-in' };
    }
    if (!hasFlight && !hasTransportArrival) {
      return { action: 'Add travel details for arrival tips', reason: 'We\'ll plan your arrival day activities', isMissing: true };
    }
    
    if (!arrivalTime) {
      return hasHotel 
        ? { action: 'Head to your hotel', reason: 'Check in and settle before exploring' }
        : { action: 'Add hotel for personalized tips', reason: 'We\'ll help plan your arrival day perfectly', isMissing: true };
    }
    
    const match = arrivalTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (!match) return hasHotel 
      ? { action: 'Head to your hotel', reason: 'Check in and settle before exploring' }
      : { action: 'Add hotel for personalized tips', reason: 'We\'ll help plan your arrival day perfectly', isMissing: true };
    
    let hours = parseInt(match[1], 10);
    const period = match[3]?.toUpperCase();
    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    if (!hasHotel) {
      return { action: 'Add hotel for personalized tips', reason: 'We\'ll calculate transfer times and plan your arrival', isMissing: true };
    }
    
    if (hours >= 21 || hours < 6) {
      return { action: 'Head to hotel & rest', reason: 'Late arrival - get a good night\'s sleep for tomorrow\'s adventures' };
    } else if (hours >= 18) {
      return { action: 'Check in, then dinner nearby', reason: 'Evening arrival - perfect for a local dinner experience' };
    } else if (hours >= 12) {
      return { action: 'Check in, then lunch & explore', reason: 'Afternoon arrival - grab lunch and explore the neighborhood' };
    } else {
      return { action: 'Head to hotel, drop bags & start exploring', reason: 'Early arrival - make the most of your first day!' };
    }
  };

  // Fallback transfer estimate when API hasn't loaded yet
  const getStaticTransferEstimate = (): TransferData => {
    const transferFallback: Record<string, TransferData> = {
      'rome': { taxi: { duration: '45-60 min', cost: '€48 fixed' }, train: { duration: '32 min', cost: '€14' } },
      'paris': { taxi: { duration: '35-60 min', cost: '€55 fixed' }, train: { duration: '35 min', cost: '€11' } },
      'london': { taxi: { duration: '45-75 min', cost: '£60-90' }, train: { duration: '15 min', cost: '£25' } },
      'tokyo': { taxi: { duration: '60-90 min', cost: '¥25,000+' }, train: { duration: '35 min', cost: '¥3,000' } },
      'new york': { taxi: { duration: '45-75 min', cost: '$55-75' }, train: { duration: '45 min', cost: '$11' } },
      'default': { taxi: { duration: '30-50 min', cost: 'Varies' }, train: { duration: '30-45 min', cost: 'Varies' } },
    };
    
    const destKey = (destination || '').toLowerCase().trim();
    return transferFallback[destKey] || 
      Object.entries(transferFallback).find(([key]) => destKey.includes(key) || key.includes(destKey))?.[1] ||
      transferFallback['default'];
  };

  const recommendedArrival = getRecommendedAirportArrival();
  const postLanding = getPostLandingAdvice();
  const transfer = transferData || getStaticTransferEstimate();

  // Build context strings for train/bus arrivals
  const transportArrivalTime = isTrainBusArrival ? (transportDetails?.arrivalTime as string) || '' : '';
  const transportArrivalStation = isTrainBusArrival && transportDetails
    ? ((transportDetails as Record<string, unknown>).arrivalStation as string || (transportDetails as Record<string, unknown>).arrivalPoint as string || '')
    : '';
  const transportCarrier = isTrainBusArrival && transportDetails 
    ? ((transportDetails as Record<string, unknown>).carrier as string || '') 
    : '';

  // Subtitle: adapt per context
  const headerIcon = isTrainBusArrival ? <Train className="h-5 w-5 text-primary" /> : <Plane className="h-5 w-5 text-primary" />;
  const headerTitle = dayNumber === 1 
    ? 'Your Arrival Game Plan'
    : `Arriving in ${destination}`;
  const headerSubtitle = isTrainBusArrival
    ? `${arrivalCityInfo?.transportType === 'train' ? 'Train' : arrivalCityInfo?.transportType === 'bus' ? 'Bus' : arrivalCityInfo?.transportType === 'ferry' ? 'Ferry' : 'Drive'} arrival, Day ${dayNumber}`
    : dayNumber === 1 
      ? 'Everything you need for Day 1'
      : `Flight arrival, Day ${dayNumber}`;

  return (
    <div className="border border-border bg-card rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-3 sm:p-4 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-full">
            {headerIcon}
          </div>
          <div>
            <h3 className="font-serif text-base sm:text-lg font-medium">{headerTitle}</h3>
            <p className="text-sm text-muted-foreground">{headerSubtitle}</p>
          </div>
        </div>
      </div>

      <div className="p-3 sm:p-4 space-y-3 sm:space-y-4">
        {/* Train/Bus Arrival Section */}
        {isTrainBusArrival && hasTransportArrival ? (
          <>
            {/* Arrival info */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">
                  Arriving at {transportArrivalTime}
                  {transportArrivalStation ? ` (${transportArrivalStation})` : ''}
                </p>
                <p className="text-xs text-muted-foreground">
                  {transportCarrier ? `${transportCarrier} · ` : ''}
                  No airport security. Head straight to your hotel after arrival
                </p>
              </div>
            </div>
          </>
        ) : hasFlight ? (
          <>
            {/* Recommended Airport Arrival */}
            {recommendedArrival && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm">Leave for the airport by {recommendedArrival}</p>
                  <p className="text-xs text-muted-foreground">
                    We recommend 2.5 hours before your {departureTime} departure for international flights
                  </p>
                </div>
              </div>
            )}

            {/* Landing Info */}
            {arrivalTime && (
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <MapPin className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-sm">
                    Landing at {arrivalTime}{arrivalAirport ? ` (${arrivalAirport})` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {hasHotel ? postLanding.reason : 'Add your hotel to see transfer options and personalized arrival tips'}
                  </p>
                </div>
              </div>
            )}
          </>
        ) : hasAnyFlightData ? (
          // Partial flight data - show what we have and prompt to finish
          <div className="flex items-center justify-between gap-3 p-3 bg-secondary/30 rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <Plane className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">Finish Flight Details</p>
                <p className="text-xs text-muted-foreground">
                  {outbound?.airline ? `${outbound.airline} ` : ''}
                  {outbound?.flightNumber ? `${outbound.flightNumber} • ` : ''}
                  Add times for your personalized game plan
                </p>
              </div>
            </div>
            {onNavigateToBookings && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onNavigateToBookings}
                className="shrink-0"
              >
                Finish Details
              </Button>
            )}
          </div>
        ) : isTrainBusArrival ? (
          // Non-flight arrival the user explicitly chose (train/bus/car/ferry)
          // but with no times yet — prompt for THAT mode, never a flight.
          <div className="flex items-center justify-between gap-3 p-3 bg-secondary/30 rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <Train className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">Add Your {arrivalModeLabel} Details</p>
                <p className="text-xs text-muted-foreground">We'll plan your arrival day around your arrival time</p>
              </div>
            </div>
            {onNavigateToBookings && (
              <Button
                variant="outline"
                size="sm"
                onClick={onNavigateToBookings}
                className="shrink-0"
              >
                Add Details
              </Button>
            )}
          </div>
        ) : (
          // No flight data at all
          <div className="flex items-center justify-between gap-3 p-3 bg-secondary/30 rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <Plane className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">Add Your Flight</p>
                <p className="text-xs text-muted-foreground">We'll plan your arrival day around your landing time</p>
              </div>
            </div>
            {(onAddFlightInline || onNavigateToBookings) && (
              <Button
                variant="outline"
                size="sm"
                onClick={onAddFlightInline || onNavigateToBookings}
                className="shrink-0"
              >
                Add Flight
              </Button>
            )}
          </div>
        )}

        {/* Hotel Section - Show hotel details */}
        {hasHotel ? (
          <>
            {/* Hotel Info Block */}
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Hotel className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{effectiveHotelSelection?.name}</p>
                {effectiveHotelSelection?.address && (
                  <p className="text-xs text-muted-foreground mt-0.5">{effectiveHotelSelection.address}</p>
                )}
                {(effectiveHotelSelection?.checkInDate || allHotels?.[0]?.checkInDate) && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Check-in from {safeFormatDate(effectiveHotelSelection?.checkInDate || allHotels?.[0]?.checkInDate, 'MMM d', 'Date TBD')}
                    {` at ${effectiveHotelSelection?.checkInTime || effectiveHotelSelection?.checkIn || allHotels?.[0]?.hotel?.checkIn || '3:00 PM'}`} (early luggage storage usually available)
                  </p>
                )}
              </div>
            </div>

            {/* Transfer Options - Rich comparison */}
            <AirportHotelTransfer
              tripId=""
              origin={isTrainBusArrival && transportArrivalStation 
                ? `${transportArrivalStation}, ${destination}` 
                : (arrivalAirport || `${destination} Airport`)}
              destination={effectiveHotelSelection?.address || `${effectiveHotelSelection?.name}, ${destination}`}
              city={destination}
              airportCode={isTrainBusArrival ? undefined : (arrivalAirport || undefined)}
              hotelName={effectiveHotelSelection?.name || undefined}
              arrivalTime={isTrainBusArrival ? transportArrivalTime : (arrivalTime || undefined)}
              travelers={1}
              compact={true}
              onTransferSelected={() => {}}
            />
          </>
        ) : (
          <div className="flex items-center justify-between gap-3 p-3 bg-secondary/30 rounded-lg border border-border">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <Hotel className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-sm">Add Your Hotel</p>
                <p className="text-xs text-muted-foreground">Get transfer times and check-in recommendations</p>
              </div>
            </div>
            {(onAddHotelInline || onNavigateToBookings) && (
              <Button
                variant="outline"
                size="sm"
                onClick={onAddHotelInline || onNavigateToBookings}
                className="shrink-0"
              >
                Add Hotel
              </Button>
            )}
          </div>
        )}

        {/* Post-Landing Action - only show when both flight and hotel exist */}
        {hasFlight && hasHotel && (
          <div className="flex items-start gap-3 pt-3 border-t border-border">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">Recommended: {postLanding.action}</p>
              <p className="text-xs text-muted-foreground">{postLanding.reason}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
