import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plane, 
  Clock, 
  Check, 
  Star,
  Loader2,
  ChevronDown,
  ChevronUp,
  Wifi,
  Zap,
  Briefcase,
  UtensilsCrossed,
  Monitor,
  Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import AirlineLogo from '@/components/planner/shared/AirlineLogo';

interface CabinOption {
  cabin: 'economy' | 'premium_economy' | 'business' | 'first';
  price: number;
  seatsRemaining?: number;
  features?: string[];
}

interface FlightSegment {
  departure: string;
  arrival: string;
  departureAirport: string;
  arrivalAirport: string;
  duration: number;
  airline: string;
  flightNumber: string;
  aircraft?: string;
}

interface LayoverInfo {
  airport: string;
  city: string;
  duration: number;
}

export interface EnhancedFlightOption {
  id: string;
  segments: FlightSegment[];
  cabinOptions: CabinOption[];
  totalDuration: number;
  stops: number;
  layovers?: LayoverInfo[];
  isRecommended?: boolean;
  amenities?: string[];
  baggageIncluded?: {
    carry: boolean;
    checked: boolean;
    weight?: string;
  };
  rationale?: string[];
  co2Emissions?: string;
}

interface EnhancedFlightCardProps {
  flight: EnhancedFlightOption;
  isSelected: boolean;
  selectedCabin?: string;
  onSelect: (cabin: string) => void;
  isLoading?: boolean;
}

const cabinLabels: Record<string, string> = {
  economy: 'Economy',
  premium_economy: 'Premium',
  business: 'Business',
  first: 'First',
};

const formatCabinClass = (cabin: string): string => {
  return cabinLabels[cabin] || cabin.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
};

const amenityIcons: Record<string, typeof Wifi> = {
  'WiFi': Wifi,
  'Power': Zap,
  'Entertainment': Monitor,
  'Meals': UtensilsCrossed,
};

function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export default function EnhancedFlightCard({
  flight,
  isSelected,
  selectedCabin,
  onSelect,
  isLoading,
}: EnhancedFlightCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedCabinIndex, setSelectedCabinIndex] = useState(0);
  
  const primarySegment = flight.segments[0];
  const lastSegment = flight.segments[flight.segments.length - 1];
  const lowestPrice = Math.min(...flight.cabinOptions.map(c => c.price));

  const handleCabinSelect = (index: number) => {
    setSelectedCabinIndex(index);
    onSelect(flight.cabinOptions[index].cabin);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative bg-card rounded-xl border transition-all duration-200 overflow-hidden',
        isSelected 
          ? 'border-primary shadow-lg ring-2 ring-primary/20' 
          : 'border-border hover:border-primary/40 hover:shadow-md'
      )}
    >
      {/* Recommended Badge - Positioned better */}
      {flight.isRecommended && (
        <div className="bg-primary/10 border-b border-primary/20 text-primary text-xs font-medium py-2 px-4 flex items-center justify-center gap-1.5">
          <Star className="h-3.5 w-3.5 fill-current" />
          Best match for your preferences
        </div>
      )}
      
      <div className="p-4 md:p-5">
        {/* Main Flight Info Row - More spacious */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
          {/* Airline Logo & Info */}
          <div className="flex items-center gap-3 lg:w-44 shrink-0">
            <AirlineLogo code={primarySegment.airline} size="lg" />
            <div className="min-w-0">
              <p className="font-semibold text-foreground text-sm truncate">{primarySegment.airline}</p>
              <p className="text-xs text-muted-foreground truncate">
                {flight.segments.map(s => s.flightNumber).join(' · ')}
              </p>
            </div>
          </div>
          
          {/* Flight Times - Better spacing */}
          <div className="flex-1 flex items-center gap-4 md:gap-6">
            {/* Departure */}
            <div className="text-center shrink-0">
              <p className="text-lg md:text-xl font-bold text-foreground">
                {formatTime(primarySegment.departure)}
              </p>
              <p className="text-xs text-muted-foreground font-medium">{primarySegment.departureAirport}</p>
            </div>
            
            {/* Flight Path Visualization - Cleaner */}
            <div className="flex-1 flex flex-col items-center px-2 min-w-[80px]">
              <p className="text-xs text-muted-foreground mb-1.5 font-medium">
                {formatDuration(flight.totalDuration)}
              </p>
              <div className="relative w-full max-w-[180px]">
                {/* Flight path line */}
                <div className="h-px bg-border w-full" />
                {/* Plane icon */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-1">
                  <Plane className="h-3.5 w-3.5 text-primary rotate-90" />
                </div>
                {/* Dots at ends */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-muted-foreground rounded-full" />
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-muted-foreground rounded-full" />
              </div>
              {/* Stops info - Improved */}
              <div className={cn(
                "text-xs mt-1.5 font-medium",
                flight.stops === 0 ? 'text-emerald-600' : 'text-muted-foreground'
              )}>
                {flight.stops === 0 ? (
                  <span className="flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    Nonstop
                  </span>
                ) : (
                  <span className="text-center">
                    <span className="block">{flight.stops} stop{flight.stops > 1 ? 's' : ''}</span>
                    {flight.layovers?.[0] && (
                      <span className="text-[10px] text-muted-foreground/70 block">
                        {formatDuration(flight.layovers[0].duration)} in {flight.layovers[0].city}
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>
            
            {/* Arrival */}
            <div className="text-center shrink-0">
              <p className="text-lg md:text-xl font-bold text-foreground">
                {formatTime(lastSegment.arrival)}
              </p>
              <p className="text-xs text-muted-foreground font-medium">{lastSegment.arrivalAirport}</p>
            </div>
          </div>
          
          {/* Price - Cleaner */}
          <div className="text-right lg:w-28 shrink-0 lg:border-l lg:border-border lg:pl-4">
            <p className="text-xs text-muted-foreground">From</p>
            <p className="text-xl md:text-2xl font-bold text-foreground">${lowestPrice}</p>
            <p className="text-[10px] text-muted-foreground">per person</p>
          </div>
        </div>

        {/* Cabin Selection - Refined */}
        <div className="mt-5 pt-4 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground mb-2.5 uppercase tracking-wide">Select cabin</p>
          <div className="flex flex-wrap gap-2">
            {flight.cabinOptions.map((option, index) => (
              <button
                key={option.cabin}
                onClick={() => handleCabinSelect(index)}
                className={cn(
                  'flex-1 min-w-[90px] max-w-[120px] p-2.5 rounded-lg border transition-all text-left',
                  selectedCabinIndex === index
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
                )}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-medium text-xs">{formatCabinClass(option.cabin)}</span>
                  {selectedCabinIndex === index && (
                    <Check className="h-3.5 w-3.5 text-primary" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold">${option.price}</span>
                  {option.seatsRemaining && option.seatsRemaining < 5 && (
                    <span className="text-[9px] text-destructive font-medium">
                      {option.seatsRemaining} left
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Expand/Collapse Details */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="mt-3 w-full flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1.5"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Hide details
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              View details
            </>
          )}
        </button>

        {/* Expanded Details */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-3 border-t border-border space-y-3">
                {/* Flight Segments */}
                {flight.segments.map((segment, index) => (
                  <div key={index}>
                    {/* Layover info before this segment (except first) */}
                    {index > 0 && flight.layovers?.[index - 1] && (
                      <div className="flex items-center gap-2 py-2 px-3 bg-amber-50 border border-amber-100 rounded-lg mb-2 text-xs">
                        <Clock className="h-3.5 w-3.5 text-amber-600" />
                        <span className="text-amber-800">
                          {formatDuration(flight.layovers[index - 1].duration)} layover in {flight.layovers[index - 1].city} ({flight.layovers[index - 1].airport})
                        </span>
                      </div>
                    )}
                    
                    <div className="flex items-start gap-3">
                      <div className="flex flex-col items-center">
                        <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                        <div className="w-0.5 h-10 bg-border" />
                        <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                      </div>
                      
                      <div className="flex-1 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium text-sm">{formatTime(segment.departure)}</span>
                            <span className="text-muted-foreground mx-1.5 text-xs">·</span>
                            <span className="text-muted-foreground text-xs">{segment.departureAirport}</span>
                          </div>
                          <div className="text-right text-xs text-muted-foreground">
                            {segment.airline} {segment.flightNumber}
                          </div>
                        </div>
                        
                        <div className="text-[10px] text-muted-foreground pl-1 flex items-center gap-3">
                          <span>{formatDuration(segment.duration)}</span>
                          {segment.aircraft && <span>• {segment.aircraft}</span>}
                        </div>
                        
                        <div>
                          <span className="font-medium text-sm">{formatTime(segment.arrival)}</span>
                          <span className="text-muted-foreground mx-1.5 text-xs">·</span>
                          <span className="text-muted-foreground text-xs">{segment.arrivalAirport}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Amenities & Baggage */}
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {flight.amenities?.map((amenity) => {
                    const Icon = amenityIcons[amenity] || Info;
                    return (
                      <Badge key={amenity} variant="secondary" className="gap-1 text-[10px] py-0.5">
                        <Icon className="h-2.5 w-2.5" />
                        {amenity}
                      </Badge>
                    );
                  })}
                  {flight.baggageIncluded?.carry && (
                    <Badge variant="secondary" className="gap-1 text-[10px] py-0.5">
                      <Briefcase className="h-2.5 w-2.5" />
                      Carry-on
                    </Badge>
                  )}
                  {flight.baggageIncluded?.checked && (
                    <Badge variant="secondary" className="gap-1 text-[10px] py-0.5">
                      <Briefcase className="h-2.5 w-2.5" />
                      Checked bag
                    </Badge>
                  )}
                </div>

                {/* Why Recommended */}
                {flight.rationale && flight.rationale.length > 0 && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Why we recommend this</p>
                    <ul className="space-y-1">
                      {flight.rationale.map((reason, i) => (
                        <li key={i} className="flex items-center gap-1.5 text-xs">
                          <Check className="h-3 w-3 text-primary shrink-0" />
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Select Button */}
        <div className="mt-4 pt-3 border-t border-border flex justify-end">
          <Button
            onClick={() => onSelect(flight.cabinOptions[selectedCabinIndex].cabin)}
            disabled={isLoading}
            variant={isSelected ? "default" : "outline"}
            size="default"
            className="min-w-[140px]"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : isSelected ? (
              <Check className="h-4 w-4 mr-2" />
            ) : null}
            {isSelected ? 'Selected' : `Select · $${flight.cabinOptions[selectedCabinIndex].price}`}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
