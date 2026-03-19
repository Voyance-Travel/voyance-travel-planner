import { useMemo, useState } from 'react';
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
  Info,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import AirlineLogo, { getAirlineName } from '@/components/planner/shared/AirlineLogo';

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
  // Budget alert props (optional - only show if both are provided)
  budgetAmount?: number;
  showBudgetWarnings?: boolean;
}

const cabinLabels: Record<string, string> = {
  economy: 'Economy',
  premium_economy: 'Premium',
  business: 'Business',
  first: 'First',
};

const formatCabinClass = (cabin: string): string => {
  return cabinLabels[cabin] || cabin.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
};

const amenityIcons: Record<string, typeof Wifi> = {
  WiFi: Wifi,
  Power: Zap,
  Entertainment: Monitor,
  Meals: UtensilsCrossed,
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

function extractAirlineCode(segment: FlightSegment): string {
  // Prefer explicit carrier if it's already a code
  const raw = (segment.airline || '').toUpperCase().trim();
  const token = raw.split(' ')[0].replace(/[^A-Z0-9]/g, '');
  if (token.length === 2 || token.length === 3) return token;

  // Fallback: parse from flight number (e.g. "DL1234")
  const match = (segment.flightNumber || '').match(/^[A-Z0-9]{2,3}/i);
  return match?.[0]?.toUpperCase() || '';
}

export default function EnhancedFlightCard({
  flight,
  isSelected,
  selectedCabin,
  onSelect,
  isLoading,
  budgetAmount,
  showBudgetWarnings = true,
}: EnhancedFlightCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  // Track locally selected cabin index for preview (doesn't trigger selection)
  const [previewCabinIndex, setPreviewCabinIndex] = useState(0);

  const primarySegment = flight.segments[0];
  const lastSegment = flight.segments[flight.segments.length - 1];
  const lowestPrice = Math.min(...flight.cabinOptions.map((c) => c.price));
  
  // Check if flight exceeds budget
  const isOverBudget = useMemo(() => {
    if (!budgetAmount || !showBudgetWarnings) return false;
    return lowestPrice > budgetAmount;
  }, [budgetAmount, showBudgetWarnings, lowestPrice]);
  
  const budgetExcessPercent = useMemo(() => {
    if (!budgetAmount || lowestPrice <= budgetAmount) return 0;
    return Math.round(((lowestPrice - budgetAmount) / budgetAmount) * 100);
  }, [budgetAmount, lowestPrice]);

  const airlineCode = useMemo(() => extractAirlineCode(primarySegment), [primarySegment]);
  const airlineDisplayName = useMemo(() => {
    const raw = primarySegment.airline || airlineCode;
    return raw.length <= 3 ? getAirlineName(raw) : raw;
  }, [primarySegment.airline, airlineCode]);

  const stopSummary = useMemo(() => {
    if (flight.stops === 0) return 'Nonstop';
    const layovers = flight.layovers || [];
    if (layovers.length === 0) return `${flight.stops} stop${flight.stops > 1 ? 's' : ''}`;
    return `${flight.stops} stop${flight.stops > 1 ? 's' : ''} · ${layovers
      .map((l) => `${formatDuration(l.duration)} in ${l.airport}`)
      .join(' · ')}`;
  }, [flight.layovers, flight.stops]);

  // Preview cabin (for highlighting) - doesn't trigger selection
  const handleCabinPreview = (index: number) => {
    setPreviewCabinIndex(index);
  };

  // Actually select the flight with the chosen cabin
  const handleSelectFlight = () => {
    onSelect(flight.cabinOptions[activeCabin].cabin);
  };

  // Determine which cabin is active for display purposes
  const activeCabin = useMemo(() => {
    // If this flight is selected and we have a selectedCabin, use it
    if (isSelected && selectedCabin) {
      const idx = flight.cabinOptions.findIndex((c) => c.cabin === selectedCabin);
      if (idx >= 0) return idx;
    }
    // Otherwise use the preview index
    return previewCabinIndex;
  }, [flight.cabinOptions, selectedCabin, previewCabinIndex, isSelected]);

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
      {flight.isRecommended && (
        <div className="relative z-10 bg-primary/10 border-b border-primary/20 text-primary text-xs font-medium py-2 px-4 flex items-center justify-center gap-1.5">
          <Star className="h-3.5 w-3.5 fill-current" />
          Best match for your preferences
        </div>
      )}

      <div className="p-3 md:p-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
          <div className="flex items-center gap-2.5 lg:w-40 shrink-0">
            <AirlineLogo code={airlineCode} name={airlineDisplayName} size="md" />
            <div className="min-w-0">
              <p className="font-medium text-foreground text-sm truncate">{airlineDisplayName}</p>
              <p className="text-[11px] text-muted-foreground truncate">
                {flight.segments.map((s) => s.flightNumber).join(' · ')}
              </p>
            </div>
          </div>

          <div className="flex-1 flex items-center gap-3 md:gap-4">
            <div className="text-center shrink-0">
              <p className="text-base md:text-lg font-bold text-foreground leading-tight">{formatTime(primarySegment.departure)}</p>
              <p className="text-[11px] text-muted-foreground">{primarySegment.departureAirport}</p>
            </div>

            <div className="flex-1 flex flex-col items-center px-1 min-w-[70px]">
              <p className="text-[10px] text-muted-foreground mb-1">{formatDuration(flight.totalDuration)}</p>
              <div className="relative w-full max-w-[140px]">
                <div className="h-px bg-border w-full" />
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-0.5">
                  <Plane className="h-3 w-3 text-primary rotate-90" />
                </div>
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-1 bg-muted-foreground rounded-full" />
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-1 bg-muted-foreground rounded-full" />
              </div>
              <div className={cn('text-[10px] mt-1 font-medium text-center leading-tight', flight.stops === 0 ? 'text-primary' : 'text-muted-foreground')}>
                {stopSummary}
              </div>
            </div>

            <div className="text-center shrink-0">
              <p className="text-base md:text-lg font-bold text-foreground leading-tight">{formatTime(lastSegment.arrival)}</p>
              <p className="text-[11px] text-muted-foreground">{lastSegment.arrivalAirport}</p>
            </div>
          </div>

          <div className="text-right lg:w-28 shrink-0 lg:border-l lg:border-border lg:pl-3">
            <p className="text-[10px] text-muted-foreground">From</p>
            <p className={cn(
              "text-lg md:text-xl font-bold leading-tight",
              isOverBudget ? "text-amber-600" : "text-foreground"
            )}>
              ${lowestPrice}
            </p>
            <p className="text-[9px] text-muted-foreground">per person</p>
            {isOverBudget && (
              <div className="flex items-center justify-end gap-1 mt-0.5">
                <TrendingUp className="h-2.5 w-2.5 text-amber-500" />
                <span className="text-[9px] text-amber-600 font-medium">+{budgetExcessPercent}% over allocation</span>
              </div>
            )}
          </div>
        </div>

        {/* Selection row - more compact */}
        <div className="mt-3 pt-2.5 border-t border-border flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2.5">
          <div className="min-w-0">
            <p className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">Cabin</p>
            <div className="flex flex-wrap gap-1.5">
              {flight.cabinOptions.map((option, index) => (
                <button
                  key={option.cabin}
                  type="button"
                  onClick={() => handleCabinPreview(index)}
                  className={cn(
                    'min-w-[80px] max-w-[110px] p-1.5 rounded-lg border transition-all text-left',
                    activeCabin === index ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40'
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[11px]">{formatCabinClass(option.cabin)}</span>
                    {activeCabin === index && <div className="w-2 h-2 rounded-full bg-primary" />}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">${option.price}</span>
                    {option.seatsRemaining && option.seatsRemaining < 5 && (
                      <span className="text-[8px] text-destructive font-medium">{option.seatsRemaining} left</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={handleSelectFlight}
            disabled={isLoading}
            variant={isSelected ? 'default' : 'outline'}
            size="default"
            className="min-w-[180px]"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : isSelected ? (
              <Check className="h-4 w-4 mr-2" />
            ) : null}
            {isSelected ? 'Selected' : `Select · $${flight.cabinOptions[activeCabin].price}`}
          </Button>
        </div>

        <button
          type="button"
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
                {flight.segments.map((segment, index) => (
                  <div key={index}>
                    {index > 0 && flight.layovers?.[index - 1] && (
                      <div className="flex items-center gap-2 py-2 px-3 bg-muted/50 border border-border rounded-lg mb-2 text-xs">
                        <Clock className="h-3.5 w-3.5 text-primary" />
                        <span className="text-foreground">
                          {formatDuration(flight.layovers[index - 1].duration)} layover in {flight.layovers[index - 1].airport}
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

                {flight.rationale && flight.rationale.length > 0 && (
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-[10px] font-medium text-muted-foreground mb-1.5 uppercase tracking-wide">
                      Why we recommend this
                    </p>
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
      </div>
    </motion.div>
  );
}
