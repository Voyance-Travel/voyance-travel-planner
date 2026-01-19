import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import {
  MapPin,
  Calendar,
  Users,
  Plane,
  Hotel,
  Check,
  Share2,
  Printer,
  Mail,
  MessageCircle,
  Download,
  ExternalLink,
  Sparkles,
  Clock,
  ChevronDown,
  ChevronUp,
  Star,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import DynamicDestinationPhotos from '@/components/planner/shared/DynamicDestinationPhotos';

interface FlightDetails {
  airline: string;
  flightNumber?: string;
  departure: string;
  arrival: string;
  departureAirport: string;
  arrivalAirport: string;
  cabin: string;
  price: number;
}

interface HotelDetails {
  name: string;
  stars: number;
  neighborhood: string;
  roomType: string;
  checkIn: string;
  checkOut: string;
  pricePerNight: number;
  totalPrice: number;
  amenities: string[];
  imageUrl?: string;
}

interface TripSummaryData {
  destination: string;
  departureCity: string;
  startDate: string;
  endDate: string;
  travelers: number;
  outboundFlight?: FlightDetails;
  returnFlight?: FlightDetails;
  hotel?: HotelDetails;
  totalCost: number;
  tripName?: string;
}

interface EditorialTripSummaryProps {
  data: TripSummaryData;
  onBook: () => void;
  onSave: () => void;
  onBuildItinerary: () => void;
  onBack: () => void;
  isLoading?: boolean;
  priceLockExpiry?: Date;
}

const formatCabin = (cabin: string): string => {
  const cabinLabels: Record<string, string> = {
    economy: 'Economy',
    premium_economy: 'Premium Economy',
    business: 'Business Class',
    first: 'First Class',
  };
  return cabinLabels[cabin] || cabin.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};

export default function EditorialTripSummary({
  data,
  onBook,
  onSave,
  onBuildItinerary,
  onBack,
  isLoading,
  priceLockExpiry,
}: EditorialTripSummaryProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [costExpanded, setCostExpanded] = useState(true);

  const nights = Math.ceil(
    (new Date(data.endDate).getTime() - new Date(data.startDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  const daysUntilTrip = Math.ceil(
    (new Date(data.startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  const timeRemaining = priceLockExpiry
    ? Math.max(0, Math.floor((priceLockExpiry.getTime() - Date.now()) / 60000))
    : 0;

  // Calculate breakdown
  const flightSubtotal = ((data.outboundFlight?.price || 0) + (data.returnFlight?.price || 0)) * data.travelers;
  const flightTaxes = flightSubtotal * 0.12;
  const flightTotal = flightSubtotal + flightTaxes;
  const hotelSubtotal = data.hotel?.totalPrice || 0;
  const hotelTaxes = hotelSubtotal * 0.15;
  const hotelTotal = hotelSubtotal + hotelTaxes;
  // Only charge service fee if user has selected flights or hotels
  const hasSelections = flightSubtotal > 0 || hotelSubtotal > 0;
  const serviceFee = hasSelections ? 29.99 : 0;
  const grandTotal = flightTotal + hotelTotal + serviceFee;

  const handlePrint = () => {
    window.print();
    toast.success('Opening print dialog...');
  };

  const handleShare = async (method: 'copy' | 'email' | 'message') => {
    const tripUrl = window.location.href;
    const tripText = `Check out my trip to ${data.destination}! ${format(new Date(data.startDate), 'MMM d')} - ${format(new Date(data.endDate), 'MMM d, yyyy')}`;
    try {
      switch (method) {
        case 'copy':
          await navigator.clipboard.writeText(`${tripText}\n${tripUrl}`);
          toast.success('Trip link copied!');
          break;
        case 'email': {
          const emailSubject = encodeURIComponent(`My Trip to ${data.destination}`);
          const emailBody = encodeURIComponent(`${tripText}\n\nView trip: ${tripUrl}`);
          window.open(`mailto:?subject=${emailSubject}&body=${emailBody}`);
          break;
        }
        case 'message':
          if (navigator.share) {
            await navigator.share({ title: `Trip to ${data.destination}`, text: tripText, url: tripUrl });
          } else {
            await navigator.clipboard.writeText(`${tripText}\n${tripUrl}`);
            toast.success('Link copied!');
          }
          break;
      }
    } catch {
      toast.error('Failed to share');
    }
  };

  // Extract destination city name
  const destinationCity = data.destination.replace(/\s*\([^)]*\)\s*/, '').trim();

  return (
    <motion.div 
      ref={printRef} 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="print:max-w-none"
    >
      {/* Full-bleed Hero - extend into the nav area */}
      <div className="relative -mx-4 md:-mx-8 lg:-mx-16 -mt-6 mb-12">
        <div className="relative h-[50vh] min-h-[420px] max-h-[520px] overflow-hidden">
          <DynamicDestinationPhotos 
            destination={data.destination} 
            startDate={data.startDate} 
            endDate={data.endDate} 
            travelers={data.travelers} 
            variant="hero"
            hideOverlayText={true}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
          
          {/* Hero Content */}
          <div className="absolute inset-0 flex flex-col justify-end p-8 md:p-12 lg:p-16">
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="max-w-4xl"
            >
              <p className="text-white/70 text-sm font-medium tracking-[0.2em] uppercase mb-3">
                Your Journey Awaits
              </p>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-serif font-light text-white mb-6 leading-[0.95]">
                {destinationCity}
              </h1>
              <div className="flex flex-wrap items-center gap-6 text-white/80 text-base">
                <span className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {format(new Date(data.startDate), 'MMM d')} – {format(new Date(data.endDate), 'MMM d, yyyy')}
                </span>
                <span className="w-px h-4 bg-white/30" />
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  {data.travelers} {data.travelers === 1 ? 'traveler' : 'travelers'}
                </span>
                <span className="w-px h-4 bg-white/30" />
                <span className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {nights} nights
                </span>
              </div>
            </motion.div>
          </div>
          
          {/* Countdown Badge */}
          {daysUntilTrip > 0 && (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="absolute top-6 right-6 md:top-8 md:right-8"
            >
              <div className="bg-white/95 backdrop-blur-md rounded-full px-5 py-3 shadow-xl">
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Departing in</p>
                <p className="text-2xl font-light text-foreground">
                  {daysUntilTrip} <span className="text-sm">days</span>
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto">
        {/* Toolbar */}
        <motion.div
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="flex items-center justify-between mb-12 pb-6 border-b border-border/50"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-medium text-foreground">Trip Confirmed</h2>
              <p className="text-sm text-muted-foreground">Review your selections below</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Share2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Share</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleShare('copy')}>
                  <ExternalLink className="w-4 h-4 mr-2" />Copy Link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleShare('email')}>
                  <Mail className="w-4 h-4 mr-2" />Email
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleShare('message')}>
                  <MessageCircle className="w-4 h-4 mr-2" />Message
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => toast.info('PDF coming soon')}>
                  <Download className="w-4 h-4 mr-2" />Download PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="ghost" size="icon" onClick={handlePrint} className="print:hidden">
              <Printer className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>

        {/* Price Lock Alert */}
        {priceLockExpiry && timeRemaining > 0 && (
          <motion.div
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35 }}
            className="mb-12 p-6 rounded-none border-l-4 border-l-amber-500 bg-gradient-to-r from-amber-50/80 to-transparent"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Clock className="w-6 h-6 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-900">Price locked for {timeRemaining} minutes</p>
                  <p className="text-sm text-amber-700/80">Complete your booking to secure these rates</p>
                </div>
              </div>
              <Button onClick={onBook} className="bg-amber-600 hover:bg-amber-700">
                Book Now
              </Button>
            </div>
          </motion.div>
        )}

        {/* Two Column Layout */}
        <div className="grid lg:grid-cols-3 gap-12 lg:gap-16">
          {/* Left Column - Details */}
          <div className="lg:col-span-2 space-y-16">
            {/* Flights Section */}
            {data.outboundFlight && (
              <motion.section
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4 }}
              >
                <div className="flex items-center gap-3 mb-8">
                  <Plane className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-serif">Your Flights</h2>
                </div>

                <div className="space-y-6">
                  {/* Outbound */}
                  <div className="group">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">
                      Outbound · {format(new Date(data.startDate), 'EEEE, MMMM d')}
                    </p>
                    <div className="flex items-center justify-between py-6 border-y border-border/50">
                      <div className="flex items-center gap-8 md:gap-12">
                        <div>
                          <p className="text-3xl md:text-4xl font-light tracking-tight">{data.outboundFlight.departure}</p>
                          <p className="text-sm text-muted-foreground mt-1">{data.outboundFlight.departureAirport}</p>
                        </div>
                        <div className="flex flex-col items-center gap-1">
                          <ArrowRight className="w-5 h-5 text-muted-foreground/50" />
                          <p className="text-[10px] text-muted-foreground">{data.outboundFlight.airline}</p>
                        </div>
                        <div>
                          <p className="text-3xl md:text-4xl font-light tracking-tight">{data.outboundFlight.arrival}</p>
                          <p className="text-sm text-muted-foreground mt-1">{data.outboundFlight.arrivalAirport}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {formatCabin(data.outboundFlight.cabin)}
                      </Badge>
                    </div>
                  </div>

                  {/* Return */}
                  {data.returnFlight && (
                    <div className="group">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4">
                        Return · {format(new Date(data.endDate), 'EEEE, MMMM d')}
                      </p>
                      <div className="flex items-center justify-between py-6 border-y border-border/50">
                        <div className="flex items-center gap-8 md:gap-12">
                          <div>
                            <p className="text-3xl md:text-4xl font-light tracking-tight">{data.returnFlight.departure}</p>
                            <p className="text-sm text-muted-foreground mt-1">{data.returnFlight.departureAirport}</p>
                          </div>
                          <div className="flex flex-col items-center gap-1">
                            <ArrowRight className="w-5 h-5 text-muted-foreground/50" />
                            <p className="text-[10px] text-muted-foreground">{data.returnFlight.airline}</p>
                          </div>
                          <div>
                            <p className="text-3xl md:text-4xl font-light tracking-tight">{data.returnFlight.arrival}</p>
                            <p className="text-sm text-muted-foreground mt-1">{data.returnFlight.arrivalAirport}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {formatCabin(data.returnFlight.cabin)}
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>
              </motion.section>
            )}

            {/* Hotel Section */}
            {data.hotel && (
              <motion.section
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                <div className="flex items-center gap-3 mb-8">
                  <Hotel className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-serif">Your Stay</h2>
                </div>

                <div className="flex flex-col md:flex-row gap-8">
                  {/* Hotel Image */}
                  {data.hotel.imageUrl && (
                    <div className="w-full md:w-48 h-48 md:h-auto rounded-lg overflow-hidden shrink-0">
                      <img 
                        src={data.hotel.imageUrl} 
                        alt={data.hotel.name} 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  
                  {/* Hotel Details */}
                  <div className="flex-1">
                    <h3 className="text-2xl font-serif font-light mb-3">{data.hotel.name}</h3>
                    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mb-4">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {data.hotel.neighborhood}
                      </span>
                      <span className="flex items-center gap-0.5">
                        {[...Array(data.hotel.stars)].map((_, i) => (
                          <Star key={i} className="h-3.5 w-3.5 fill-primary text-primary" />
                        ))}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-6">{data.hotel.roomType}</p>
                    
                    <div className="flex gap-8">
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Check-in</p>
                        <p className="text-base font-medium mt-1">{format(new Date(data.startDate), 'EEE, MMM d')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Check-out</p>
                        <p className="text-base font-medium mt-1">{format(new Date(data.endDate), 'EEE, MMM d')}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Duration</p>
                        <p className="text-base font-medium mt-1">{nights} nights</p>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.section>
            )}
          </div>

          {/* Right Column - Pricing */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="sticky top-24"
            >
              {/* Price Summary Card */}
              <div className="bg-muted/30 rounded-none p-8 mb-6">
                <button
                  onClick={() => setCostExpanded(!costExpanded)}
                  className="w-full flex items-center justify-between mb-6"
                >
                  <p className="text-sm text-muted-foreground uppercase tracking-wider">Total</p>
                  <div className="flex items-center gap-2">
                    <p className="text-3xl font-light">${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                    {costExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>

                <AnimatePresence>
                  {costExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="space-y-4 pt-4 border-t border-border/50">
                        {/* Flights */}
                        {data.outboundFlight && (
                          <div>
                            <div className="flex items-center gap-2 text-sm font-medium mb-2">
                              <Plane className="h-3.5 w-3.5 text-primary" />
                              Flights
                            </div>
                            <div className="space-y-1 text-sm pl-5">
                              <div className="flex justify-between text-muted-foreground">
                                <span>Outbound × {data.travelers}</span>
                                <span>${(data.outboundFlight.price * data.travelers).toFixed(0)}</span>
                              </div>
                              {data.returnFlight && (
                                <div className="flex justify-between text-muted-foreground">
                                  <span>Return × {data.travelers}</span>
                                  <span>${(data.returnFlight.price * data.travelers).toFixed(0)}</span>
                                </div>
                              )}
                              <div className="flex justify-between text-muted-foreground/70 text-xs">
                                <span>Taxes & fees</span>
                                <span>${flightTaxes.toFixed(0)}</span>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Hotel */}
                        {data.hotel && (
                          <div>
                            <div className="flex items-center gap-2 text-sm font-medium mb-2">
                              <Hotel className="h-3.5 w-3.5 text-primary" />
                              Accommodation
                            </div>
                            <div className="space-y-1 text-sm pl-5">
                              <div className="flex justify-between text-muted-foreground">
                                <span>{nights} nights</span>
                                <span>${hotelSubtotal.toFixed(0)}</span>
                              </div>
                              <div className="flex justify-between text-muted-foreground/70 text-xs">
                                <span>Taxes & fees</span>
                                <span>${hotelTaxes.toFixed(0)}</span>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex justify-between text-sm text-muted-foreground pt-2">
                          <span>Service fee</span>
                          <span>${serviceFee.toFixed(0)}</span>
                        </div>
                        
                        <div className="flex justify-between items-baseline pt-4 border-t border-border/50">
                          <div>
                            <p className="font-medium">Grand Total</p>
                            <p className="text-xs text-muted-foreground">${(grandTotal / data.travelers).toFixed(0)}/person</p>
                          </div>
                          <p className="text-2xl font-light">${grandTotal.toFixed(0)}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <Button 
                  onClick={onBook} 
                  disabled={isLoading} 
                  size="lg" 
                  className="w-full h-14 text-base font-normal rounded-none"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Complete Booking
                </Button>
                
                <div className="grid grid-cols-2 gap-3">
                  <Button 
                    variant="outline" 
                    onClick={onBuildItinerary} 
                    disabled={isLoading} 
                    className="h-12 rounded-none text-sm font-normal"
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Itinerary
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={onSave} 
                    disabled={isLoading} 
                    className="h-12 rounded-none text-sm font-normal"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                </div>
                
                <Button 
                  variant="ghost" 
                  onClick={onBack} 
                  className="w-full text-sm text-muted-foreground hover:text-foreground"
                >
                  ← Back to Hotels
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
