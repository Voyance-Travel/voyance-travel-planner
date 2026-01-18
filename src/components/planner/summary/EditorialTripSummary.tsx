import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
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
  ChevronRight
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

  const nights = Math.ceil(
    (new Date(data.endDate).getTime() - new Date(data.startDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  const daysUntilTrip = Math.ceil(
    (new Date(data.startDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  const timeRemaining = priceLockExpiry 
    ? Math.max(0, Math.floor((priceLockExpiry.getTime() - Date.now()) / 60000))
    : 0;

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
        case 'email':
          const emailSubject = encodeURIComponent(`My Trip to ${data.destination}`);
          const emailBody = encodeURIComponent(`${tripText}\n\nView trip: ${tripUrl}`);
          window.open(`mailto:?subject=${emailSubject}&body=${emailBody}`);
          break;
        case 'message':
          if (navigator.share) {
            await navigator.share({
              title: `Trip to ${data.destination}`,
              text: tripText,
              url: tripUrl,
            });
          } else {
            await navigator.clipboard.writeText(`${tripText}\n${tripUrl}`);
            toast.success('Link copied! You can paste it in any messaging app.');
          }
          break;
      }
    } catch (error) {
      console.error('Share failed:', error);
      toast.error('Failed to share. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  const handleDownloadPDF = () => {
    toast.info('Generating PDF... This feature is coming soon!');
  };

  return (
    <motion.div
      ref={printRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="max-w-4xl mx-auto print:max-w-none"
    >
      {/* Hero Section */}
      <div className="relative mb-8">
        <DynamicDestinationPhotos 
          destination={data.destination}
          startDate={data.startDate}
          endDate={data.endDate}
          travelers={data.travelers}
          variant="hero"
        />
        
        {/* Countdown Badge */}
        {daysUntilTrip > 0 && (
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="absolute top-4 right-4 bg-white/95 backdrop-blur-sm rounded-xl px-4 py-3 shadow-lg"
          >
            <p className="text-xs text-muted-foreground">Your trip in</p>
            <p className="text-2xl font-bold text-foreground">{daysUntilTrip} days</p>
          </motion.div>
        )}
      </div>

      {/* Trip Ready Banner */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="bg-gradient-to-r from-primary to-primary/80 rounded-2xl p-6 mb-8 text-primary-foreground"
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
              <Sparkles className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-serif font-semibold">Your Trip is Ready!</h1>
              <p className="text-primary-foreground/80">
                {data.tripName || `${nights} nights in ${data.destination}`}
              </p>
            </div>
          </div>
          
          {/* Share & Print Actions */}
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="gap-2">
                  <Share2 className="w-4 h-4" />
                  Share
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleShare('copy')}>
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Copy Link
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleShare('email')}>
                  <Mail className="w-4 h-4 mr-2" />
                  Send via Email
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleShare('message')}>
                  <MessageCircle className="w-4 h-4 mr-2" />
                  Share to Message
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDownloadPDF}>
                  <Download className="w-4 h-4 mr-2" />
                  Download PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button 
              variant="secondary" 
              size="sm" 
              className="gap-2 print:hidden"
              onClick={handlePrint}
            >
              <Printer className="w-4 h-4" />
              Print
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Price Lock Warning */}
      {priceLockExpiry && timeRemaining > 0 && (
        <motion.div 
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-center gap-3"
        >
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-amber-800">Price locked for {timeRemaining} minutes</p>
            <p className="text-sm text-amber-600">Book now to secure this rate. Prices may increase after.</p>
          </div>
          <Button onClick={onBook} size="sm" className="shrink-0">
            Book Now
          </Button>
        </motion.div>
      )}

      {/* Cost Breakdown */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="bg-card rounded-2xl border border-border p-6 mb-8"
      >
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary" />
          Trip Cost Breakdown
        </h2>
        
        <div className="space-y-4">
          {/* Flight Section */}
          {data.outboundFlight && (
            <div className="flex items-start justify-between py-3 border-b border-border">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Plane className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Flights</p>
                  <p className="text-sm text-muted-foreground">
                    {data.outboundFlight.airline} · {data.outboundFlight.cabin}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {data.departureCity} → {data.destination} → {data.departureCity}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-lg">
                  ${((data.outboundFlight.price + (data.returnFlight?.price || 0)) * data.travelers).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data.travelers} traveler{data.travelers > 1 ? 's' : ''} × 2 flights
                </p>
              </div>
            </div>
          )}

          {/* Hotel Section */}
          {data.hotel && (
            <div className="flex items-start justify-between py-3 border-b border-border">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Hotel className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{data.hotel.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {data.hotel.roomType} · {data.hotel.neighborhood}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    ${data.hotel.pricePerNight}/night × {nights} nights
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-lg">${data.hotel.totalPrice.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">{nights} nights</p>
              </div>
            </div>
          )}

          {/* Total */}
          <div className="flex items-center justify-between pt-2">
            <div>
              <p className="text-xl font-serif font-semibold">Total Trip Cost</p>
              <p className="text-sm text-muted-foreground">
                {format(new Date(data.startDate), 'MMM d')} - {format(new Date(data.endDate), 'MMM d, yyyy')}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold text-primary">${data.totalCost.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">
                ${Math.round(data.totalCost / data.travelers).toLocaleString()} per person
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Trip Details Cards */}
      <div className="grid md:grid-cols-2 gap-4 mb-8">
        {/* Outbound Flight */}
        {data.outboundFlight && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="bg-card rounded-xl border border-border p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <Plane className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Outbound Flight</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-2xl font-bold">{data.outboundFlight.departure}</p>
                <p className="text-sm text-muted-foreground">{data.outboundFlight.departureAirport}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
              <div className="text-right">
                <p className="text-2xl font-bold">{data.outboundFlight.arrival}</p>
                <p className="text-sm text-muted-foreground">{data.outboundFlight.arrivalAirport}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{data.outboundFlight.airline}</span>
              <Badge variant="secondary">{data.outboundFlight.cabin}</Badge>
            </div>
          </motion.div>
        )}

        {/* Return Flight */}
        {data.returnFlight && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.55 }}
            className="bg-card rounded-xl border border-border p-5"
          >
            <div className="flex items-center gap-2 mb-3">
              <Plane className="w-4 h-4 text-primary rotate-180" />
              <span className="text-sm font-medium text-muted-foreground">Return Flight</span>
            </div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-2xl font-bold">{data.returnFlight.departure}</p>
                <p className="text-sm text-muted-foreground">{data.returnFlight.departureAirport}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground" />
              <div className="text-right">
                <p className="text-2xl font-bold">{data.returnFlight.arrival}</p>
                <p className="text-sm text-muted-foreground">{data.returnFlight.arrivalAirport}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{data.returnFlight.airline}</span>
              <Badge variant="secondary">{data.returnFlight.cabin}</Badge>
            </div>
          </motion.div>
        )}
      </div>

      {/* Hotel Details */}
      {data.hotel && (
        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="bg-card rounded-xl border border-border p-5 mb-8"
        >
          <div className="flex items-center gap-2 mb-3">
            <Hotel className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-muted-foreground">Your Accommodation</span>
          </div>
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-xl font-semibold mb-1">{data.hotel.name}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <MapPin className="w-3.5 h-3.5" />
                <span>{data.hotel.neighborhood}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {data.hotel.amenities.slice(0, 4).map((amenity, i) => (
                  <Badge key={i} variant="secondary" className="text-xs">
                    {amenity}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Check-in</p>
              <p className="font-medium">{format(new Date(data.startDate), 'EEE, MMM d')}</p>
              <p className="text-sm text-muted-foreground mt-2">Check-out</p>
              <p className="font-medium">{format(new Date(data.endDate), 'EEE, MMM d')}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Action Buttons */}
      <motion.div 
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="space-y-4 print:hidden"
      >
        {/* Primary CTA */}
        <Button 
          onClick={onBook}
          disabled={isLoading}
          size="lg"
          className="w-full h-14 text-lg gap-2"
        >
          <Check className="w-5 h-5" />
          Book Trip for ${data.totalCost.toLocaleString()}
        </Button>

        {/* Secondary Actions */}
        <div className="grid grid-cols-2 gap-4">
          <Button 
            variant="outline" 
            onClick={onBuildItinerary}
            disabled={isLoading}
            className="h-12"
          >
            <Calendar className="w-4 h-4 mr-2" />
            Preview Itinerary
          </Button>
          <Button 
            variant="outline" 
            onClick={onSave}
            disabled={isLoading}
            className="h-12"
          >
            Save for Later
          </Button>
        </div>

        {/* Back */}
        <Button 
          variant="ghost" 
          onClick={onBack}
          className="w-full"
        >
          ← Back to Hotel Selection
        </Button>
      </motion.div>
    </motion.div>
  );
}
