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
        'relative bg-card rounded-2xl border transition-all duration-200 overflow-hidden',
        isSelected 
          ? 'border-primary shadow-lg ring-2 ring-primary/20' 
          : 'border-border hover:border-primary/40 hover:shadow-md'
      )}
    >
      {/* Recommended Badge */}
      {flight.isRecommended && (
        <div className="absolute top-0 left-0 right-0 bg-primary text-primary-foreground text-xs font-medium py-2 px-4 flex items-center justify-center gap-1.5">
          <Star className="h-3.5 w-3.5 fill-current" />
          Best match for your preferences
        </div>
      )}
      
      <div className={cn('p-5 md:p-6', flight.isRecommended && 'pt-12')}>
        {/* Main Flight Info Row */}
        <div className="flex flex-col lg:flex-row lg:items-center gap-6">
          {/* Airline Logo & Info */}
          <div className="flex items-center gap-4 lg:w-48 shrink-0">
            <AirlineLogo code={primarySegment.airline} size="lg" />
            <div>
              <p className="font-semibold text-foreground text-base">{primarySegment.airline}</p>
              <p className="text-sm text-muted-foreground">
                {flight.segments.map(s => s.flightNumber).join(' · ')}
              </p>
            </div>
          </div>
          
          {/* Flight Times */}
          <div className="flex-1 flex items-center gap-6 lg:gap-8">
            {/* Departure */}
            <div className="text-center min-w-[70px]">
              <p className="text-xl md:text-2xl font-bold text-foreground">
                {formatTime(primarySegment.departure)}
              </p>
              <p className="text-sm text-muted-foreground font-medium">{primarySegment.departureAirport}</p>
            </div>
            
            {/* Flight Path Visualization */}
            <div className="flex-1 flex flex-col items-center px-2 min-w-[100px]">
              <p className="text-xs text-muted-foreground mb-2 font-medium">
                {formatDuration(flight.totalDuration)}
              </p>
              <div className="relative w-full max-w-[200px]">
                {/* Flight path line */}
                <div className="h-0.5 bg-muted w-full rounded-full" />
                {/* Plane icon in the middle */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-1">
                  <Plane className="h-4 w-4 text-primary rotate-90" />
                </div>
                {/* Origin dot */}
                <div className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-2 h-2 bg-primary rounded-full" />
                {/* Destination dot */}
                <div className="absolute -right-0.5 top-1/2 -translate-y-1/2 w-2 h-2 bg-primary rounded-full" />
              </div>
              <p className={cn(
                "text-xs mt-2 font-medium",
                flight.stops === 0 ? 'text-primary' : 'text-muted-foreground'
              )}>
                {flight.stops === 0 ? 'Nonstop' : (
                  <span>
                    {flight.stops} stop{flight.stops > 1 ? 's' : ''}
                    {flight.layovers?.[0] && ` · ${flight.layovers[0].city}`}
                  </span>
                )}
              </p>
            </div>
            
            {/* Arrival */}
            <div className="text-center min-w-[70px]">
              <p className="text-xl md:text-2xl font-bold text-foreground">
                {formatTime(lastSegment.arrival)}
              </p>
              <p className="text-sm text-muted-foreground font-medium">{lastSegment.arrivalAirport}</p>
            </div>
          </div>
          
          {/* Price */}
          <div className="text-right lg:w-36 shrink-0 lg:border-l lg:border-border lg:pl-6">
            <p className="text-xs text-muted-foreground mb-0.5">From</p>
            <p className="text-2xl md:text-3xl font-bold text-foreground">${lowestPrice}</p>
            <p className="text-xs text-muted-foreground">per person</p>
          </div>
        </div>

        {/* Cabin Selection */}
        <div className="mt-6 pt-5 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Select cabin class</p>
          <div className="flex flex-wrap gap-2">
            {flight.cabinOptions.map((option, index) => (
              <button
                key={option.cabin}
                onClick={() => handleCabinSelect(index)}
                className={cn(
                  'flex-1 min-w-[100px] max-w-[140px] p-3 rounded-xl border transition-all text-left',
                  selectedCabinIndex === index
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/40'
                )}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{formatCabinClass(option.cabin)}</span>
                  {selectedCabinIndex === index && (
                    <Check className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold">${option.price}</span>
                  {option.seatsRemaining && option.seatsRemaining < 5 && (
                    <span className="text-[10px] text-destructive font-medium">
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
          className="mt-4 w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="h-4 w-4" />
              Hide details
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4" />
              View flight details
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
              <div className="pt-4 border-t border-border space-y-4">
                {/* Flight Segments */}
                {flight.segments.map((segment, index) => (
                  <div key={index}>
                    {/* Layover info before this segment (except first) */}
                    {index > 0 && flight.layovers?.[index - 1] && (
                      <div className="flex items-center gap-2 py-2 px-3 bg-muted/50 rounded-lg mb-3 text-sm">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {formatDuration(flight.layovers[index - 1].duration)} layover in {flight.layovers[index - 1].city}
                        </span>
                      </div>
                    )}
                    
                    <div className="flex items-start gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-3 h-3 rounded-full bg-primary" />
                        <div className="w-0.5 h-12 bg-border" />
                        <div className="w-3 h-3 rounded-full bg-primary" />
                      </div>
                      
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-medium">{formatTime(segment.departure)}</span>
                            <span className="text-muted-foreground mx-2">·</span>
                            <span className="text-muted-foreground">{segment.departureAirport}</span>
                          </div>
                          <div className="text-right text-sm text-muted-foreground">
                            {segment.airline} {segment.flightNumber}
                          </div>
                        </div>
                        
                        <div className="text-xs text-muted-foreground pl-2 flex items-center gap-4">
                          <span>{formatDuration(segment.duration)}</span>
                          {segment.aircraft && <span>• {segment.aircraft}</span>}
                        </div>
                        
                        <div>
                          <span className="font-medium">{formatTime(segment.arrival)}</span>
                          <span className="text-muted-foreground mx-2">·</span>
                          <span className="text-muted-foreground">{segment.arrivalAirport}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Amenities & Baggage */}
                <div className="flex flex-wrap gap-2 pt-2">
                  {flight.amenities?.map((amenity) => {
                    const Icon = amenityIcons[amenity] || Info;
                    return (
                      <Badge key={amenity} variant="secondary" className="gap-1">
                        <Icon className="h-3 w-3" />
                        {amenity}
                      </Badge>
                    );
                  })}
                  {flight.baggageIncluded?.carry && (
                    <Badge variant="secondary" className="gap-1">
                      <Briefcase className="h-3 w-3" />
                      Carry-on included
                    </Badge>
                  )}
                  {flight.baggageIncluded?.checked && (
                    <Badge variant="secondary" className="gap-1">
                      <Briefcase className="h-3 w-3" />
                      Checked bag included
                    </Badge>
                  )}
                </div>

                {/* Why Recommended */}
                {flight.rationale && flight.rationale.length > 0 && (
                  <div className="bg-muted/50 rounded-xl p-4">
                    <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Why we recommend this flight</p>
                    <ul className="space-y-1.5">
                      {flight.rationale.map((reason, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <Check className="h-3.5 w-3.5 text-primary shrink-0" />
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
        <div className="mt-5 pt-4 border-t border-border flex justify-end">
          <Button
            onClick={() => onSelect(flight.cabinOptions[selectedCabinIndex].cabin)}
            disabled={isLoading}
            variant={isSelected ? "default" : "outline"}
            size="lg"
            className="min-w-[160px]"
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
