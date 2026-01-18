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
  DollarSign,
  ChevronDown,
  ChevronUp,
  Star,
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
import { cn } from '@/lib/utils';

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
    premium_economy: 'Premium',
    business: 'Business',
    first: 'First',
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
  const [isSharing, setIsSharing] = useState(false);
  const [costExpanded, setCostExpanded] = useState(false); // collapsed by default

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
  const serviceFee = 29.99;
  const grandTotal = flightTotal + hotelTotal + serviceFee;

  const handlePrint = () => {
    window.print();
    toast.success('Opening print dialog...');
  };

  const handleShare = async (method: 'copy' | 'email' | 'message') => {
    setIsSharing(true);
    const tripUrl = window.location.href;
    const tripText = `Check out my trip to ${data.destination}! ${format(new Date(data.startDate), 'MMM d')} - ${format(new Date(data.endDate), 'MMM d, yyyy')}`;
    try {
      switch (method) {
        case 'copy':
          await navigator.clipboard.writeText(`${tripText}\n${tripUrl}`);
          toast.success('Trip link copied to clipboard!');
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
            toast.success('Link copied! You can paste it in any messaging app.');
          }
          break;
      }
    } catch {
      toast.error('Failed to share. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <motion.div ref={printRef} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto print:max-w-none">
      {/* Cinematic Hero */}
      <div className="relative mb-8 rounded-3xl overflow-hidden h-56 md:h-72 shadow-2xl">
        <DynamicDestinationPhotos destination={data.destination} startDate={data.startDate} endDate={data.endDate} travelers={data.travelers} variant="hero" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        
        {/* Overlay Content */}
        <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-8">
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
            <p className="text-white/80 text-sm font-medium tracking-wide uppercase mb-1">Your Journey Awaits</p>
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-white mb-2">{data.destination}</h1>
            <div className="flex flex-wrap items-center gap-4 text-white/90 text-sm">
              <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" />{format(new Date(data.startDate), 'MMM d')} – {format(new Date(data.endDate), 'MMM d, yyyy')}</span>
              <span className="flex items-center gap-1.5"><Users className="w-4 h-4" />{data.travelers} {data.travelers === 1 ? 'traveler' : 'travelers'}</span>
              <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" />{nights} nights</span>
            </div>
          </motion.div>
        </div>
        
        {daysUntilTrip > 0 && (
          <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-lg">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Departing in</p>
            <p className="text-2xl font-bold text-foreground">{daysUntilTrip} <span className="text-sm font-normal text-muted-foreground">days</span></p>
          </div>
        )}
      </div>

      {/* Action Bar */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="flex items-center justify-between gap-3 mb-8"
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Trip Summary</h2>
            <p className="text-sm text-muted-foreground">Everything's ready for your adventure</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 rounded-full px-4"><Share2 className="w-4 h-4" />Share</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuItem onClick={() => handleShare('copy')}><ExternalLink className="w-4 h-4 mr-2" />Copy Link</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShare('email')}><Mail className="w-4 h-4 mr-2" />Email</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShare('message')}><MessageCircle className="w-4 h-4 mr-2" />Message</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => toast.info('PDF download coming soon!')}><Download className="w-4 h-4 mr-2" />Download PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" className="rounded-full print:hidden" onClick={handlePrint}><Printer className="w-4 h-4" /></Button>
        </div>
      </motion.div>

      {/* Price Lock Warning - refined */}
      {priceLockExpiry && timeRemaining > 0 && (
        <motion.div
          initial={{ y: 5, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-8 px-5 py-4 rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/60 flex items-center gap-4 shadow-sm"
        >
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-amber-900">Price locked for {timeRemaining} minutes</p>
            <p className="text-sm text-amber-700/80">Complete your booking to secure these rates</p>
          </div>
          <Button onClick={onBook} size="sm" className="rounded-full px-6">Book Now</Button>
        </motion.div>
      )}

      {/* Two-column layout */}
      <div className="grid lg:grid-cols-5 gap-8">
        {/* Left - Details */}
        <div className="lg:col-span-3 space-y-6">
          {/* Flights */}
          {data.outboundFlight && (
            <motion.section initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }} className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Plane className="w-4 h-4 text-primary" />
                </div>
                <h2 className="font-semibold text-foreground">Flights</h2>
              </div>
              
              {/* Outbound Flight Card */}
              <div className="group relative bg-gradient-to-br from-card to-muted/30 rounded-2xl border border-border/50 p-5 hover:shadow-lg transition-all duration-300">
                <div className="absolute top-3 right-3">
                  <Badge variant="secondary" className="text-[10px] font-medium rounded-full px-3">{formatCabin(data.outboundFlight.cabin)}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide">Outbound · {format(new Date(data.startDate), 'EEE, MMM d')}</p>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">{data.outboundFlight.departure}</p>
                    <p className="text-xs text-muted-foreground mt-1">{data.outboundFlight.departureAirport}</p>
                  </div>
                  <div className="flex-1 flex flex-col items-center">
                    <div className="w-full h-px bg-gradient-to-r from-border via-primary/30 to-border relative">
                      <Plane className="w-4 h-4 text-primary absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90" />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-2">{data.outboundFlight.airline}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-foreground">{data.outboundFlight.arrival}</p>
                    <p className="text-xs text-muted-foreground mt-1">{data.outboundFlight.arrivalAirport}</p>
                  </div>
                </div>
              </div>
              
              {/* Return Flight Card */}
              {data.returnFlight && (
                <div className="group relative bg-gradient-to-br from-card to-muted/30 rounded-2xl border border-border/50 p-5 hover:shadow-lg transition-all duration-300">
                  <div className="absolute top-3 right-3">
                    <Badge variant="secondary" className="text-[10px] font-medium rounded-full px-3">{formatCabin(data.returnFlight.cabin)}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3 uppercase tracking-wide">Return · {format(new Date(data.endDate), 'EEE, MMM d')}</p>
                  <div className="flex items-center gap-6">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-foreground">{data.returnFlight.departure}</p>
                      <p className="text-xs text-muted-foreground mt-1">{data.returnFlight.departureAirport}</p>
                    </div>
                    <div className="flex-1 flex flex-col items-center">
                      <div className="w-full h-px bg-gradient-to-r from-border via-primary/30 to-border relative">
                        <Plane className="w-4 h-4 text-primary absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90" />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-2">{data.returnFlight.airline}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-foreground">{data.returnFlight.arrival}</p>
                      <p className="text-xs text-muted-foreground mt-1">{data.returnFlight.arrivalAirport}</p>
                    </div>
                  </div>
                </div>
              )}
            </motion.section>
          )}

          {/* Hotel */}
          {data.hotel && (
            <motion.section initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Hotel className="w-4 h-4 text-primary" />
                </div>
                <h2 className="font-semibold text-foreground">Accommodation</h2>
              </div>
              
              <div className="group bg-gradient-to-br from-card to-muted/30 rounded-2xl border border-border/50 overflow-hidden hover:shadow-lg transition-all duration-300">
                <div className="flex">
                  {(data.hotel as any).imageUrl && (
                    <img src={(data.hotel as any).imageUrl} alt={data.hotel.name} className="w-32 h-auto object-cover shrink-0" />
                  )}
                  <div className="p-5 flex-1">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-semibold mb-2">{data.hotel.name}</h3>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5" />{data.hotel.neighborhood}</span>
                          <span className="flex items-center gap-0.5">
                            {[...Array(data.hotel.stars)].map((_, i) => (
                              <Star key={i} className="h-3 w-3 fill-primary text-primary" />
                            ))}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-2">{data.hotel.roomType}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">Check-in</p>
                        <p className="font-medium text-sm">{format(new Date(data.startDate), 'EEE, MMM d')}</p>
                        <p className="text-xs text-muted-foreground mt-2">Check-out</p>
                        <p className="font-medium text-sm">{format(new Date(data.endDate), 'EEE, MMM d')}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.section>
          )}
        </div>

        {/* Right - Cost & Actions */}
        <div className="lg:col-span-2">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="sticky top-24 bg-gradient-to-br from-card via-card to-muted/20 rounded-3xl border border-border/50 overflow-hidden shadow-xl"
          >
            {/* Total Header */}
            <button
              onClick={() => setCostExpanded(!costExpanded)}
              className="w-full p-6 flex items-center justify-between hover:bg-muted/20 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left">
                  <p className="text-sm text-muted-foreground">Estimated Total</p>
                  <p className="text-2xl font-bold text-foreground">${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="text-xs">Details</span>
                {costExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
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
                  <div className="px-6 pb-6 space-y-4">
                    {/* Flights Breakdown */}
                    {data.outboundFlight && (
                      <div className="bg-muted/40 rounded-2xl p-4 space-y-3 text-sm">
                        <div className="flex items-center gap-2 font-medium">
                          <Plane className="h-4 w-4 text-primary" />
                          Flights
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Outbound × {data.travelers}</span>
                          <span>${(data.outboundFlight.price * data.travelers).toFixed(2)}</span>
                        </div>
                        {data.returnFlight && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Return × {data.travelers}</span>
                            <span>${(data.returnFlight.price * data.travelers).toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-muted-foreground/70 text-xs">
                          <span>Taxes & fees (est.)</span>
                          <span>${flightTaxes.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between pt-3 border-t border-border/50 font-medium">
                          <span>Subtotal</span>
                          <span>${flightTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Hotel Breakdown */}
                    {data.hotel && (
                      <div className="bg-muted/40 rounded-2xl p-4 space-y-3 text-sm">
                        <div className="flex items-center gap-2 font-medium">
                          <Hotel className="h-4 w-4 text-primary" />
                          Accommodation
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{nights} nights × ${data.hotel.pricePerNight.toFixed(0)}</span>
                          <span>${hotelSubtotal.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground/70 text-xs">
                          <span>Taxes & fees (est.)</span>
                          <span>${hotelTaxes.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between pt-3 border-t border-border/50 font-medium">
                          <span>Subtotal</span>
                          <span>${hotelTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex justify-between text-sm px-1">
                      <span className="text-muted-foreground">Voyance service fee</span>
                      <span>${serviceFee.toFixed(2)}</span>
                    </div>
                    
                    <div className="flex items-center justify-between pt-4 border-t border-border/50 px-1">
                      <div>
                        <p className="text-lg font-semibold">Grand Total</p>
                        <p className="text-xs text-muted-foreground">${(grandTotal / data.travelers).toFixed(2)} per person</p>
                      </div>
                      <p className="text-2xl font-bold text-primary">${grandTotal.toFixed(2)}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Actions */}
            <div className="p-6 border-t border-border/50 space-y-4 bg-gradient-to-t from-muted/30 to-transparent">
              <Button onClick={onBook} disabled={isLoading} size="lg" className="w-full h-14 text-lg gap-2 rounded-2xl shadow-lg hover:shadow-xl transition-all">
                <Check className="w-5 h-5" />
                Book Trip
              </Button>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={onBuildItinerary} disabled={isLoading} className="h-12 rounded-xl text-sm">
                  <Calendar className="w-4 h-4 mr-2" />
                  Itinerary
                </Button>
                <Button variant="outline" onClick={onSave} disabled={isLoading} className="h-12 rounded-xl text-sm">
                  <Download className="w-4 h-4 mr-2" />
                  Save
                </Button>
              </div>
              <Button variant="ghost" onClick={onBack} className="w-full text-sm text-muted-foreground hover:text-foreground">
                ← Back to Hotels
              </Button>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
