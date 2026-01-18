import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plane, Clock, ArrowRight, Check, Filter, Luggage, 
  ChevronDown, ChevronUp, Sparkles, SkipForward, 
  Plus, CircleDot, Wifi, Utensils
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';
import DestinationTeaser from '../shared/DestinationTeaser';
import TripProgressTracker from '../shared/TripProgressTracker';
import AirlineLogo, { getAirlineName } from '../shared/AirlineLogo';

interface Flight {
  id: string;
  airline: string;
  airlineCode: string;
  flightNumber: string;
  departureTime: string;
  arrivalTime: string;
  departureAirport: string;
  arrivalAirport: string;
  duration: string;
  stops: number;
  stopCities?: string[];
  layoverDurations?: string[];
  price: number;
  cabinClass: string;
  baggage: {
    carry: boolean;
    checked: boolean;
    checkedCount?: number;
  };
  amenities: string[];
  isRecommended?: boolean;
  matchScore?: number;
}

interface FlightSelectionProps {
  formData: {
    destination: string;
    departureCity: string;
    startDate: string;
    endDate: string;
    travelers?: number;
    budget?: string;
  };
  selectedDeparture: string | null;
  selectedReturn: string | null;
  onSelectDeparture: (id: string) => void;
  onSelectReturn: (id: string) => void;
  onContinue: () => void;
  onBack: () => void;
}

// Enhanced mock flight data with more details
const generateFlights = (date: string, isOutbound: boolean): Flight[] => [
  {
    id: `flight-1-${date}`,
    airline: 'Delta Air Lines',
    airlineCode: 'DL',
    flightNumber: 'DL 1234',
    departureTime: '06:00 AM',
    arrivalTime: '02:30 PM',
    departureAirport: 'ATL',
    arrivalAirport: 'NRT',
    duration: '14h 30m',
    stops: 0,
    price: 650,
    cabinClass: 'Main Cabin',
    baggage: { carry: true, checked: true, checkedCount: 1 },
    amenities: ['wifi', 'meals', 'entertainment'],
    isRecommended: true,
    matchScore: 95,
  },
  {
    id: `flight-2-${date}`,
    airline: 'United Airlines',
    airlineCode: 'UA',
    flightNumber: 'UA 7842',
    departureTime: '10:15 AM',
    arrivalTime: '07:45 PM +1',
    departureAirport: 'ATL',
    arrivalAirport: 'NRT',
    duration: '17h 30m',
    stops: 1,
    stopCities: ['San Francisco (SFO)'],
    layoverDurations: ['2h 15m'],
    price: 520,
    cabinClass: 'Economy',
    baggage: { carry: true, checked: false },
    amenities: ['wifi', 'entertainment'],
    matchScore: 78,
  },
  {
    id: `flight-3-${date}`,
    airline: 'Japan Airlines',
    airlineCode: 'JL',
    flightNumber: 'JL 8901',
    departureTime: '11:30 AM',
    arrivalTime: '04:00 PM +1',
    departureAirport: 'ATL',
    arrivalAirport: 'NRT',
    duration: '13h 30m',
    stops: 0,
    price: 890,
    cabinClass: 'Premium Economy',
    baggage: { carry: true, checked: true, checkedCount: 2 },
    amenities: ['wifi', 'meals', 'entertainment', 'power'],
    matchScore: 88,
  },
  {
    id: `flight-4-${date}`,
    airline: 'American Airlines',
    airlineCode: 'AA',
    flightNumber: 'AA 1567',
    departureTime: '02:45 PM',
    arrivalTime: '08:20 AM +1',
    departureAirport: 'ATL',
    arrivalAirport: 'NRT',
    duration: '15h 35m',
    stops: 1,
    stopCities: ['Dallas (DFW)'],
    layoverDurations: ['1h 45m'],
    price: 580,
    cabinClass: 'Main Cabin Extra',
    baggage: { carry: true, checked: true, checkedCount: 1 },
    amenities: ['wifi', 'meals'],
    matchScore: 72,
  },
  {
    id: `flight-5-${date}`,
    airline: 'Delta Air Lines',
    airlineCode: 'DL',
    flightNumber: 'DL 9012',
    departureTime: '08:00 PM',
    arrivalTime: '10:30 AM +1',
    departureAirport: 'ATL',
    arrivalAirport: 'NRT',
    duration: '13h 30m',
    stops: 0,
    price: 1250,
    cabinClass: 'Delta One',
    baggage: { carry: true, checked: true, checkedCount: 2 },
    amenities: ['wifi', 'meals', 'entertainment', 'power', 'lounge'],
    matchScore: 92,
  },
];

const cabinClasses = ['Economy', 'Main Cabin', 'Main Cabin Extra', 'Premium Economy', 'Delta One', 'Business', 'First'];

const amenityIcons: Record<string, React.ReactNode> = {
  wifi: <Wifi className="w-3.5 h-3.5" />,
  meals: <Utensils className="w-3.5 h-3.5" />,
  entertainment: <span className="text-xs">🎬</span>,
  power: <span className="text-xs">🔌</span>,
  lounge: <span className="text-xs">🛋️</span>,
};

function FlightCard({
  flight,
  isSelected,
  onSelect,
  showRecommended = false,
}: {
  flight: Flight;
  isSelected: boolean;
  onSelect: () => void;
  showRecommended?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative rounded-xl border-2 overflow-hidden transition-all',
        isSelected
          ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10'
          : 'border-slate-200 hover:border-slate-300 bg-white hover:shadow-md'
      )}
    >
      {/* Recommended Badge */}
      {flight.isRecommended && showRecommended && (
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-primary to-primary/80 text-white text-xs font-medium py-1.5 px-4 flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5" />
          Best Match for Your Trip • {flight.matchScore}% match
        </div>
      )}
      
      <button
        onClick={onSelect}
        className={cn(
          'w-full p-4 text-left',
          flight.isRecommended && showRecommended && 'pt-10'
        )}
      >
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          {/* Airline Info */}
          <div className="flex items-center gap-3 md:w-44 shrink-0">
            <AirlineLogo code={flight.airlineCode} name={flight.airline} size="lg" />
            <div>
              <p className="font-semibold text-slate-900">{flight.airline}</p>
              <p className="text-xs text-slate-500">{flight.flightNumber}</p>
              <p className="text-xs font-medium text-primary">{flight.cabinClass}</p>
            </div>
          </div>

          {/* Flight Times */}
          <div className="flex items-center gap-4 flex-1">
            <div className="text-center">
              <p className="text-xl font-bold text-slate-900">{flight.departureTime}</p>
              <p className="text-xs text-slate-500 font-medium">{flight.departureAirport}</p>
            </div>

            <div className="flex-1 flex flex-col items-center px-4">
              <div className="flex items-center gap-2 w-full">
                <div className="h-px flex-1 bg-slate-300" />
                {flight.stops > 0 ? (
                  <div className="flex items-center gap-1">
                    {flight.stopCities?.map((_, i) => (
                      <CircleDot key={i} className="w-3 h-3 text-slate-400" />
                    ))}
                  </div>
                ) : (
                  <Plane className="w-4 h-4 text-slate-400 rotate-90" />
                )}
                <div className="h-px flex-1 bg-slate-300" />
              </div>
              <p className="text-xs text-slate-500 mt-1">{flight.duration}</p>
              <p className={cn(
                'text-xs font-medium',
                flight.stops === 0 ? 'text-green-600' : 'text-amber-600'
              )}>
                {flight.stops === 0 ? 'Nonstop' : `${flight.stops} stop`}
              </p>
            </div>

            <div className="text-center">
              <p className="text-xl font-bold text-slate-900">{flight.arrivalTime}</p>
              <p className="text-xs text-slate-500 font-medium">{flight.arrivalAirport}</p>
            </div>
          </div>

          {/* Amenities */}
          <div className="hidden md:flex items-center gap-2 w-32 shrink-0">
            {flight.amenities.slice(0, 3).map((amenity) => (
              <div
                key={amenity}
                className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-600"
                title={amenity}
              >
                {amenityIcons[amenity]}
              </div>
            ))}
            {flight.amenities.length > 3 && (
              <span className="text-xs text-slate-500">+{flight.amenities.length - 3}</span>
            )}
          </div>

          {/* Price & Selection */}
          <div className="flex items-center gap-4 md:w-32 shrink-0 justify-end">
            <div className="text-right">
              <p className="text-xl font-bold text-slate-900">${flight.price}</p>
              <p className="text-xs text-slate-500">per person</p>
            </div>
            
            <div
              className={cn(
                'w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors',
                isSelected ? 'border-primary bg-primary' : 'border-slate-300'
              )}
            >
              {isSelected && <Check className="w-4 h-4 text-white" />}
            </div>
          </div>
        </div>

        {/* Baggage & Quick Info */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs text-slate-600">
            <Luggage className="w-4 h-4" />
            {flight.baggage.carry && <span>Carry-on</span>}
            {flight.baggage.checked && (
              <span className="text-green-600 font-medium">
                + {flight.baggage.checkedCount || 1} checked bag{(flight.baggage.checkedCount || 1) > 1 ? 's' : ''}
              </span>
            )}
            {!flight.baggage.checked && (
              <span className="text-amber-600">No checked bags</span>
            )}
          </div>
          
          {flight.stops > 0 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setExpanded(!expanded);
              }}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {expanded ? 'Hide' : 'View'} layover details
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          )}
        </div>
      </button>

      {/* Expanded Layover Details */}
      <AnimatePresence>
        {expanded && flight.stops > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-2 bg-slate-50 border-t border-slate-200">
              <p className="text-sm font-medium text-slate-700 mb-2">Layover Details</p>
              {flight.stopCities?.map((city, i) => (
                <div key={i} className="flex items-center gap-3 text-sm text-slate-600">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  <span>{city}</span>
                  <span className="text-slate-400">•</span>
                  <span className="font-medium">{flight.layoverDurations?.[i]} layover</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function FlightSelection({
  formData,
  selectedDeparture,
  selectedReturn,
  onSelectDeparture,
  onSelectReturn,
  onContinue,
  onBack,
}: FlightSelectionProps) {
  const [showFilters, setShowFilters] = useState(false);
  const [directOnly, setDirectOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState([1500]);
  const [selectedCabins, setSelectedCabins] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'recommended' | 'price' | 'duration'>('recommended');

  const departureFlights = useMemo(() => {
    let flights = generateFlights(formData.startDate, true);
    
    if (directOnly) {
      flights = flights.filter(f => f.stops === 0);
    }
    if (maxPrice[0] < 1500) {
      flights = flights.filter(f => f.price <= maxPrice[0]);
    }
    if (selectedCabins.length > 0) {
      flights = flights.filter(f => selectedCabins.includes(f.cabinClass));
    }
    
    // Sort
    if (sortBy === 'price') {
      flights.sort((a, b) => a.price - b.price);
    } else if (sortBy === 'duration') {
      flights.sort((a, b) => {
        const getDuration = (d: string) => {
          const match = d.match(/(\d+)h\s*(\d+)?m?/);
          return match ? parseInt(match[1]) * 60 + (parseInt(match[2]) || 0) : 0;
        };
        return getDuration(a.duration) - getDuration(b.duration);
      });
    } else {
      flights.sort((a, b) => (b.matchScore || 0) - (a.matchScore || 0));
    }
    
    return flights;
  }, [formData.startDate, directOnly, maxPrice, selectedCabins, sortBy]);

  const returnFlights = useMemo(() => {
    let flights = generateFlights(formData.endDate, false);
    
    if (directOnly) {
      flights = flights.filter(f => f.stops === 0);
    }
    if (maxPrice[0] < 1500) {
      flights = flights.filter(f => f.price <= maxPrice[0]);
    }
    if (selectedCabins.length > 0) {
      flights = flights.filter(f => selectedCabins.includes(f.cabinClass));
    }
    
    return flights;
  }, [formData.endDate, directOnly, maxPrice, selectedCabins]);

  const canContinue = selectedDeparture && selectedReturn;

  const toggleCabin = (cabin: string) => {
    setSelectedCabins(prev => 
      prev.includes(cabin) 
        ? prev.filter(c => c !== cabin)
        : [...prev, cabin]
    );
  };

  return (
    <div className="max-w-7xl mx-auto">
      {/* Skip Button */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-between items-center mb-4"
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            // Skip to hotels - user has their own flights
          }}
          className="text-slate-500 gap-2"
        >
          <Plus className="w-4 h-4" />
          I'll add my own flight
        </Button>
        <Button
          variant="ghost"
          onClick={onContinue}
          className="text-slate-500 hover:text-primary gap-2"
        >
          Skip flights
          <SkipForward className="w-4 h-4" />
        </Button>
      </motion.div>

      {/* Destination Teaser */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <DestinationTeaser
          destination={formData.destination}
          startDate={formData.startDate}
          endDate={formData.endDate}
          travelers={formData.travelers}
          compact
        />
      </motion.div>

      <div className="grid lg:grid-cols-4 gap-8">
        {/* Filters Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="lg:col-span-1"
        >
          <div className="sticky top-24 space-y-4">
            {/* Trip Progress */}
            <TripProgressTracker
              destination={formData.destination}
              startDate={formData.startDate}
              endDate={formData.endDate}
              travelers={formData.travelers}
              budget={formData.budget}
              flightSelected={!!selectedDeparture && !!selectedReturn}
              currentStep="flights"
            />

            {/* Filters Panel */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Filter className="w-4 h-4" />
                  Filters
                </h3>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setDirectOnly(false);
                    setMaxPrice([1500]);
                    setSelectedCabins([]);
                  }}
                  className="text-xs text-slate-500"
                >
                  Reset
                </Button>
              </div>

              <div className="space-y-5">
                {/* Direct Flights */}
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-slate-700">Direct flights only</Label>
                  <Switch checked={directOnly} onCheckedChange={setDirectOnly} />
                </div>

                {/* Max Price */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm text-slate-700">Max price</Label>
                    <span className="text-sm font-medium text-primary">${maxPrice[0]}</span>
                  </div>
                  <Slider
                    value={maxPrice}
                    onValueChange={setMaxPrice}
                    max={1500}
                    min={300}
                    step={50}
                  />
                </div>

                {/* Cabin Class */}
                <div>
                  <Label className="text-sm text-slate-700 mb-2 block">Cabin Class</Label>
                  <div className="flex flex-wrap gap-2">
                    {['Economy', 'Premium Economy', 'Business', 'First'].map((cabin) => (
                      <button
                        key={cabin}
                        onClick={() => toggleCabin(cabin)}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                          selectedCabins.includes(cabin)
                            ? 'bg-primary text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        )}
                      >
                        {cabin}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sort */}
                <div>
                  <Label className="text-sm text-slate-700 mb-2 block">Sort by</Label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 'recommended', label: 'Best Match' },
                      { value: 'price', label: 'Price' },
                      { value: 'duration', label: 'Duration' },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setSortBy(option.value as any)}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
                          sortBy === option.value
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        )}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Flight Lists */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:col-span-3 space-y-10"
        >
          {/* Header */}
          <div className="text-center">
            <h1 className="text-3xl font-display font-medium text-slate-900 mb-2">
              Choose your flights
            </h1>
            <p className="text-slate-600">
              {formData.departureCity} <ArrowRight className="inline w-4 h-4" />{' '}
              {formData.destination}
            </p>
          </div>

          {/* Outbound Flights */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Plane className="w-5 h-5 text-primary" />
                Outbound Flight
              </h2>
              <span className="text-sm text-slate-500">{formData.startDate}</span>
            </div>
            
            {departureFlights.length === 0 ? (
              <div className="bg-slate-50 rounded-xl p-8 text-center">
                <p className="text-slate-600">No flights match your filters. Try adjusting your criteria.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {departureFlights.map((flight, index) => (
                  <FlightCard
                    key={flight.id}
                    flight={flight}
                    isSelected={selectedDeparture === flight.id}
                    onSelect={() => onSelectDeparture(flight.id)}
                    showRecommended={index === 0 && sortBy === 'recommended'}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Return Flights */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Plane className="w-5 h-5 text-primary rotate-180" />
                Return Flight
              </h2>
              <span className="text-sm text-slate-500">{formData.endDate}</span>
            </div>
            
            {returnFlights.length === 0 ? (
              <div className="bg-slate-50 rounded-xl p-8 text-center">
                <p className="text-slate-600">No flights match your filters. Try adjusting your criteria.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {returnFlights.map((flight) => (
                  <FlightCard
                    key={flight.id}
                    flight={flight}
                    isSelected={selectedReturn === flight.id}
                    onSelect={() => onSelectReturn(flight.id)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="flex justify-between pt-6 border-t border-slate-200">
            <Button variant="outline" onClick={onBack} className="h-12 px-6">
              Back
            </Button>
            <Button
              onClick={onContinue}
              disabled={!canContinue}
              className="h-12 px-8 bg-slate-900 hover:bg-slate-800 text-white gap-2"
            >
              Continue to Hotels
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
