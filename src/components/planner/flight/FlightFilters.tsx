import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Filter, 
  Plane, 
  Clock, 
  Briefcase, 
  ChevronDown, 
  X,
  ArrowUpDown 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface FlightFiltersState {
  directOnly: boolean;
  airlines: string[];
  maxPrice: number;
  departureTimeRange: [number, number]; // Hours 0-24
  arrivalTimeRange: [number, number];
  maxDuration: number; // Minutes
  bagsIncluded: boolean;
  sortBy: 'price' | 'duration' | 'departure' | 'arrival' | 'recommended';
}

interface FlightFiltersProps {
  filters: FlightFiltersState;
  onFiltersChange: (filters: FlightFiltersState) => void;
  availableAirlines: string[];
  priceRange: [number, number];
}

const popularAirlines = [
  'Delta',
  'United',
  'American',
  'Southwest',
  'JetBlue',
  'Alaska',
  'Spirit',
  'Frontier',
  'British Airways',
  'Lufthansa',
  'Air France',
  'Emirates',
];

function formatTimeRange(hours: number): string {
  const h = Math.floor(hours);
  const period = h >= 12 ? 'PM' : 'AM';
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${displayHour}:00 ${period}`;
}

export default function FlightFilters({
  filters,
  onFiltersChange,
  availableAirlines,
  priceRange,
}: FlightFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const updateFilter = <K extends keyof FlightFiltersState>(
    key: K,
    value: FlightFiltersState[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleAirline = (airline: string) => {
    const newAirlines = filters.airlines.includes(airline)
      ? filters.airlines.filter(a => a !== airline)
      : [...filters.airlines, airline];
    updateFilter('airlines', newAirlines);
  };

  const clearFilters = () => {
    onFiltersChange({
      directOnly: false,
      airlines: [],
      maxPrice: priceRange[1],
      departureTimeRange: [0, 24],
      arrivalTimeRange: [0, 24],
      maxDuration: 1440, // 24 hours
      bagsIncluded: false,
      sortBy: 'recommended',
    });
  };

  const activeFilterCount = [
    filters.directOnly,
    filters.airlines.length > 0,
    filters.maxPrice < priceRange[1],
    filters.departureTimeRange[0] > 0 || filters.departureTimeRange[1] < 24,
    filters.arrivalTimeRange[0] > 0 || filters.arrivalTimeRange[1] < 24,
    filters.bagsIncluded,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      {/* Quick Filters */}
      <div className="flex items-center gap-2">
        <Switch
          id="direct-only"
          checked={filters.directOnly}
          onCheckedChange={(checked) => updateFilter('directOnly', checked)}
        />
        <Label htmlFor="direct-only" className="text-sm cursor-pointer">
          Non-stop only
        </Label>
      </div>

      {/* Sort Dropdown */}
      <Select
        value={filters.sortBy}
        onValueChange={(value) => updateFilter('sortBy', value as FlightFiltersState['sortBy'])}
      >
        <SelectTrigger className="w-44 h-9">
          <ArrowUpDown className="w-4 h-4 mr-2" />
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="recommended">Recommended</SelectItem>
          <SelectItem value="price">Price: Low to High</SelectItem>
          <SelectItem value="duration">Duration: Shortest</SelectItem>
          <SelectItem value="departure">Departure: Earliest</SelectItem>
          <SelectItem value="arrival">Arrival: Earliest</SelectItem>
        </SelectContent>
      </Select>

      {/* All Filters Sheet */}
      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <Filter className="w-4 h-4" />
            All Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <div className="flex items-center justify-between">
              <SheetTitle>Flight Filters</SheetTitle>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear all
              </Button>
            </div>
          </SheetHeader>

          <div className="mt-6 space-y-8">
            {/* Stops */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Plane className="w-4 h-4" />
                Stops
              </h4>
              <div className="flex items-center gap-2">
                <Switch
                  id="direct-filter"
                  checked={filters.directOnly}
                  onCheckedChange={(checked) => updateFilter('directOnly', checked)}
                />
                <Label htmlFor="direct-filter">Non-stop flights only</Label>
              </div>
            </div>

            {/* Price */}
            <div>
              <h4 className="font-medium mb-3">
                Max Price: ${filters.maxPrice}
              </h4>
              <Slider
                value={[filters.maxPrice]}
                onValueChange={([value]) => updateFilter('maxPrice', value)}
                min={priceRange[0]}
                max={priceRange[1]}
                step={50}
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>${priceRange[0]}</span>
                <span>${priceRange[1]}</span>
              </div>
            </div>

            {/* Departure Time */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Departure Time
              </h4>
              <Slider
                value={filters.departureTimeRange}
                onValueChange={(value) => updateFilter('departureTimeRange', value as [number, number])}
                min={0}
                max={24}
                step={1}
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{formatTimeRange(filters.departureTimeRange[0])}</span>
                <span>{formatTimeRange(filters.departureTimeRange[1])}</span>
              </div>
            </div>

            {/* Arrival Time */}
            <div>
              <h4 className="font-medium mb-3">Arrival Time</h4>
              <Slider
                value={filters.arrivalTimeRange}
                onValueChange={(value) => updateFilter('arrivalTimeRange', value as [number, number])}
                min={0}
                max={24}
                step={1}
              />
              <div className="flex justify-between text-xs text-muted-foreground mt-1">
                <span>{formatTimeRange(filters.arrivalTimeRange[0])}</span>
                <span>{formatTimeRange(filters.arrivalTimeRange[1])}</span>
              </div>
            </div>

            {/* Airlines */}
            <div>
              <h4 className="font-medium mb-3">Airlines</h4>
              <div className="grid grid-cols-2 gap-2">
                {(availableAirlines.length > 0 ? availableAirlines : popularAirlines).map((airline) => (
                  <div key={airline} className="flex items-center space-x-2">
                    <Checkbox
                      id={`airline-${airline}`}
                      checked={filters.airlines.includes(airline)}
                      onCheckedChange={() => toggleAirline(airline)}
                    />
                    <Label 
                      htmlFor={`airline-${airline}`}
                      className="text-sm cursor-pointer"
                    >
                      {airline}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Bags */}
            <div>
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Briefcase className="w-4 h-4" />
                Baggage
              </h4>
              <div className="flex items-center gap-2">
                <Switch
                  id="bags-included"
                  checked={filters.bagsIncluded}
                  onCheckedChange={(checked) => updateFilter('bagsIncluded', checked)}
                />
                <Label htmlFor="bags-included">Checked bag included</Label>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4 border-t">
            <Button className="w-full" onClick={() => setIsOpen(false)}>
              Show Results
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Active Filter Tags */}
      {filters.airlines.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {filters.airlines.map((airline) => (
            <Badge key={airline} variant="secondary" className="gap-1">
              {airline}
              <X 
                className="w-3 h-3 cursor-pointer" 
                onClick={() => toggleAirline(airline)}
              />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
