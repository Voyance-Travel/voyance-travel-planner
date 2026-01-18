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
    <motion.div ref={printRef} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-4xl mx-auto print:max-w-none">
      {/* Compact Hero */}
      <div className="relative mb-6 rounded-2xl overflow-hidden h-40 md:h-48">
        <DynamicDestinationPhotos destination={data.destination} startDate={data.startDate} endDate={data.endDate} travelers={data.travelers} variant="hero" />
        {daysUntilTrip > 0 && (
          <div className="absolute top-3 right-3 bg-background/90 backdrop-blur-sm rounded-xl px-3 py-2 shadow border border-border">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Trip in</p>
            <p className="text-xl font-bold text-foreground">{daysUntilTrip} days</p>
          </div>
        )}
      </div>

      {/* Compact Header */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-border"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-serif font-semibold text-foreground">Your Trip is Ready</h1>
            <p className="text-sm text-muted-foreground">{data.tripName || `${nights} nights in ${data.destination}`}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5 h-8"><Share2 className="w-3.5 h-3.5" />Share</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleShare('copy')}><ExternalLink className="w-4 h-4 mr-2" />Copy Link</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShare('email')}><Mail className="w-4 h-4 mr-2" />Email</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleShare('message')}><MessageCircle className="w-4 h-4 mr-2" />Message</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => toast.info('PDF download coming soon!')}><Download className="w-4 h-4 mr-2" />Download PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="sm" className="gap-1.5 h-8 print:hidden" onClick={handlePrint}><Printer className="w-3.5 h-3.5" /></Button>
        </div>
      </motion.div>

      {/* Price Lock Warning - compact */}
      {priceLockExpiry && timeRemaining > 0 && (
        <motion.div
          initial={{ y: 5, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mb-6 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-3"
        >
          <Clock className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="font-medium text-sm text-amber-800">Price locked for {timeRemaining} min</p>
          </div>
          <Button onClick={onBook} size="sm" variant="default">Book Now</Button>
        </motion.div>
      )}

      {/* Two-column layout - tighter */}
      <div className="grid lg:grid-cols-5 gap-6">
        {/* Left - Details */}
        <div className="lg:col-span-3 space-y-5">
          {/* Flights */}
          {data.outboundFlight && (
            <motion.section initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }} className="space-y-3">
              <div className="flex items-center gap-2">
                <Plane className="w-4 h-4 text-primary" />
                <h2 className="font-medium text-muted-foreground uppercase text-[11px] tracking-wide">Flights</h2>
              </div>
              {/* Outbound */}
              <div className="bg-card rounded-xl border border-border p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <p className="text-lg font-bold">{data.outboundFlight.departure}</p>
                    <p className="text-[11px] text-muted-foreground">{data.outboundFlight.departureAirport}</p>
                  </div>
                  <div className="text-muted-foreground text-sm">→</div>
                  <div>
                    <p className="text-lg font-bold">{data.outboundFlight.arrival}</p>
                    <p className="text-[11px] text-muted-foreground">{data.outboundFlight.arrivalAirport}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">{data.outboundFlight.airline}</p>
                  <Badge variant="secondary" className="text-[10px] mt-0.5">{formatCabin(data.outboundFlight.cabin)}</Badge>
                </div>
              </div>
              {/* Return */}
              {data.returnFlight && (
                <div className="bg-card rounded-xl border border-border p-4 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-lg font-bold">{data.returnFlight.departure}</p>
                      <p className="text-[11px] text-muted-foreground">{data.returnFlight.departureAirport}</p>
                    </div>
                    <div className="text-muted-foreground text-sm">→</div>
                    <div>
                      <p className="text-lg font-bold">{data.returnFlight.arrival}</p>
                      <p className="text-[11px] text-muted-foreground">{data.returnFlight.arrivalAirport}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{data.returnFlight.airline}</p>
                    <Badge variant="secondary" className="text-[10px] mt-0.5">{formatCabin(data.returnFlight.cabin)}</Badge>
                  </div>
                </div>
              )}
            </motion.section>
          )}

          {/* Hotel - compact */}
          {data.hotel && (
            <motion.section initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
              <div className="flex items-center gap-2 mb-2">
                <Hotel className="w-4 h-4 text-primary" />
                <h2 className="font-medium text-muted-foreground uppercase text-[11px] tracking-wide">Accommodation</h2>
              </div>
              <div className="bg-card rounded-xl border border-border overflow-hidden flex">
                {(data.hotel as any).imageUrl && (
                  <img src={(data.hotel as any).imageUrl} alt={data.hotel.name} className="w-28 h-28 object-cover shrink-0" />
                )}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-base font-semibold mb-1">{data.hotel.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3" />
                      <span>{data.hotel.neighborhood}</span>
                      <span className="flex items-center gap-0.5">
                        {[...Array(data.hotel.stars)].map((_, i) => (
                          <Star key={i} className="h-2.5 w-2.5 fill-primary text-primary" />
                        ))}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{data.hotel.roomType}</p>
                  </div>
                </div>
                <div className="p-4 text-right shrink-0 flex flex-col justify-between text-xs">
                  <div>
                    <p className="text-muted-foreground">Check-in</p>
                    <p className="font-medium">{format(new Date(data.startDate), 'MMM d')}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Check-out</p>
                    <p className="font-medium">{format(new Date(data.endDate), 'MMM d')}</p>
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
            className="sticky top-24 bg-card rounded-2xl border border-border overflow-hidden"
          >
            <button
              onClick={() => setCostExpanded(!costExpanded)}
              className="w-full p-5 flex items-center justify-between hover:bg-muted/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-primary" />
                <h2 className="text-lg font-semibold">Trip Total</h2>
              </div>
              <div className="flex items-center gap-4">
                <p className="text-2xl font-bold text-primary">${grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                {costExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
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
                  <div className="px-5 pb-5 space-y-4">
                    {/* Flights */}
                    {data.outboundFlight && (
                      <div className="bg-muted/30 rounded-xl p-4 space-y-2 text-sm">
                        <div className="flex items-center gap-2 font-medium"><Plane className="h-4 w-4 text-primary" />Flights</div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Outbound × {data.travelers}</span><span>${(data.outboundFlight.price * data.travelers).toFixed(2)}</span></div>
                        {data.returnFlight && <div className="flex justify-between"><span className="text-muted-foreground">Return × {data.travelers}</span><span>${(data.returnFlight.price * data.travelers).toFixed(2)}</span></div>}
                        <div className="flex justify-between text-muted-foreground/80"><span>Taxes & fees (est.)</span><span>${flightTaxes.toFixed(2)}</span></div>
                        <div className="flex justify-between pt-2 border-t border-border font-medium"><span>Subtotal</span><span>${flightTotal.toFixed(2)}</span></div>
                      </div>
                    )}
                    {/* Hotel */}
                    {data.hotel && (
                      <div className="bg-muted/30 rounded-xl p-4 space-y-2 text-sm">
                        <div className="flex items-center gap-2 font-medium"><Hotel className="h-4 w-4 text-primary" />Accommodation</div>
                        <div className="flex justify-between"><span className="text-muted-foreground">{nights} nights × ${data.hotel.pricePerNight}</span><span>${hotelSubtotal.toFixed(2)}</span></div>
                        <div className="flex justify-between text-muted-foreground/80"><span>Taxes & fees (est.)</span><span>${hotelTaxes.toFixed(2)}</span></div>
                        <div className="flex justify-between pt-2 border-t border-border font-medium"><span>Subtotal</span><span>${hotelTotal.toFixed(2)}</span></div>
                      </div>
                    )}
                    <div className="flex justify-between text-sm px-2"><span className="text-muted-foreground">Voyance service fee</span><span>${serviceFee.toFixed(2)}</span></div>
                    <div className="flex items-center justify-between pt-4 border-t border-border px-2">
                      <div>
                        <p className="text-lg font-semibold">Grand Total</p>
                        <p className="text-sm text-muted-foreground">${(grandTotal / data.travelers).toFixed(2)} per person</p>
                      </div>
                      <p className="text-3xl font-bold text-primary">${grandTotal.toFixed(2)}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Actions */}
            <div className="p-5 border-t border-border space-y-4">
              <Button onClick={onBook} disabled={isLoading} size="lg" className="w-full h-14 text-lg gap-2">
                <Check className="w-5 h-5" />
                Book Trip
              </Button>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="outline" onClick={onBuildItinerary} disabled={isLoading} className="h-11"><Calendar className="w-4 h-4 mr-2" />Preview Itinerary</Button>
                <Button variant="outline" onClick={onSave} disabled={isLoading} className="h-11"><Download className="w-4 h-4 mr-2" />Save for Later</Button>
              </div>
              <Button variant="ghost" onClick={onBack} className="w-full">← Back to Hotels</Button>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
