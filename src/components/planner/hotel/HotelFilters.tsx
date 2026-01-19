import { useState } from 'react';
import { 
  Filter, 
  Star, 
  Wifi, 
  UtensilsCrossed,
  Dumbbell,
  Waves,
  Car,
  Coffee,
  Sparkles,
  X,
  ArrowUpDown 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
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

export interface HotelFiltersState {
  priceRange: [number, number];
  starRating: number[];
  amenities: string[];
  propertyTypes: string[];
  guestRating: number;
  sortBy: 'price' | 'rating' | 'distance' | 'recommended';
  freeCancellation: boolean;
  breakfastIncluded: boolean;
}

interface HotelFiltersProps {
  filters: HotelFiltersState;
  onFiltersChange: (filters: HotelFiltersState) => void;
  priceRange: [number, number];
}

const amenityOptions = [
  { id: 'wifi', label: 'Free WiFi', icon: Wifi },
  { id: 'breakfast', label: 'Breakfast', icon: Coffee },
  { id: 'pool', label: 'Pool', icon: Waves },
  { id: 'gym', label: 'Fitness Center', icon: Dumbbell },
  { id: 'parking', label: 'Free Parking', icon: Car },
  { id: 'spa', label: 'Spa', icon: Sparkles },
  { id: 'restaurant', label: 'Restaurant', icon: UtensilsCrossed },
];

const propertyTypes = [
  'Hotel',
  'Resort',
  'Boutique Hotel',
  'Apartment',
  'Villa',
  'Hostel',
];

export default function HotelFilters({
  filters,
  onFiltersChange,
  priceRange,
}: HotelFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const updateFilter = <K extends keyof HotelFiltersState>(
    key: K,
    value: HotelFiltersState[K]
  ) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const toggleStarRating = (rating: number) => {
    const newRatings = filters.starRating.includes(rating)
      ? filters.starRating.filter(r => r !== rating)
      : [...filters.starRating, rating];
    updateFilter('starRating', newRatings);
  };

  const toggleAmenity = (amenity: string) => {
    const newAmenities = filters.amenities.includes(amenity)
      ? filters.amenities.filter(a => a !== amenity)
      : [...filters.amenities, amenity];
    updateFilter('amenities', newAmenities);
  };

  const togglePropertyType = (type: string) => {
    const newTypes = filters.propertyTypes.includes(type)
      ? filters.propertyTypes.filter(t => t !== type)
      : [...filters.propertyTypes, type];
    updateFilter('propertyTypes', newTypes);
  };

  const clearFilters = () => {
    onFiltersChange({
      priceRange: priceRange,
      starRating: [],
      amenities: [],
      propertyTypes: [],
      guestRating: 0,
      sortBy: 'recommended',
      freeCancellation: false,
      breakfastIncluded: false,
    });
  };

  const activeFilterCount = [
    filters.priceRange[0] > priceRange[0] || filters.priceRange[1] < priceRange[1],
    filters.starRating.length > 0,
    filters.amenities.length > 0,
    filters.propertyTypes.length > 0,
    filters.guestRating > 0,
    filters.freeCancellation,
    filters.breakfastIncluded,
  ].filter(Boolean).length;

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      {/* Quick Star Filter */}
      <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
        {[3, 4, 5].map((rating) => (
          <button
            key={rating}
            onClick={() => toggleStarRating(rating)}
            className={`flex items-center gap-1 px-2 py-1 rounded text-sm transition-colors ${
              filters.starRating.includes(rating)
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {rating}
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          </button>
        ))}
      </div>

      {/* Sort Dropdown */}
      <Select
        value={filters.sortBy}
        onValueChange={(value) => updateFilter('sortBy', value as HotelFiltersState['sortBy'])}
      >
        <SelectTrigger className="w-44 h-9">
          <ArrowUpDown className="w-4 h-4 mr-2" />
          <SelectValue placeholder="Sort by" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="recommended">Recommended</SelectItem>
          <SelectItem value="price">Price: Low to High</SelectItem>
          <SelectItem value="rating">Guest Rating</SelectItem>
          <SelectItem value="distance">Distance to Center</SelectItem>
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
              <SheetTitle>Hotel Filters</SheetTitle>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Clear all
              </Button>
            </div>
          </SheetHeader>

          <div className="mt-6 space-y-8">
            {/* Price Range */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Price per night</h4>
                <span className="text-sm font-medium text-primary">
                  ${filters.priceRange[0]} – ${filters.priceRange[1]}
                </span>
              </div>
              <Slider
                value={filters.priceRange}
                onValueChange={(value) => updateFilter('priceRange', value as [number, number])}
                min={priceRange[0]}
                max={priceRange[1]}
                step={25}
                className="py-1"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>${priceRange[0]}</span>
                <span>${priceRange[1]}+</span>
              </div>
            </div>

            {/* Star Rating */}
            <div>
              <h4 className="font-medium mb-3">Star Rating</h4>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((rating) => (
                  <button
                    key={rating}
                    onClick={() => toggleStarRating(rating)}
                    className={`flex items-center gap-1 px-3 py-2 rounded-lg border transition-colors ${
                      filters.starRating.includes(rating)
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {rating}
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  </button>
                ))}
              </div>
            </div>

            {/* Guest Rating */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Guest Rating</h4>
                <span className="text-sm font-medium text-primary">
                  {filters.guestRating > 0 ? `${filters.guestRating}+` : 'Any'}
                </span>
              </div>
              <Slider
                value={[filters.guestRating]}
                onValueChange={([value]) => updateFilter('guestRating', value)}
                min={0}
                max={9}
                step={1}
                className="py-1"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Any</span>
                <span>9+ Exceptional</span>
              </div>
            </div>

            {/* Quick Options */}
            <div>
              <h4 className="font-medium mb-3">Popular Filters</h4>
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="free-cancellation"
                    checked={filters.freeCancellation}
                    onCheckedChange={(checked) => updateFilter('freeCancellation', !!checked)}
                  />
                  <Label htmlFor="free-cancellation" className="cursor-pointer">
                    Free cancellation
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="breakfast-included"
                    checked={filters.breakfastIncluded}
                    onCheckedChange={(checked) => updateFilter('breakfastIncluded', !!checked)}
                  />
                  <Label htmlFor="breakfast-included" className="cursor-pointer">
                    Breakfast included
                  </Label>
                </div>
              </div>
            </div>

            {/* Amenities */}
            <div>
              <h4 className="font-medium mb-3">Amenities</h4>
              <div className="grid grid-cols-2 gap-2">
                {amenityOptions.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => toggleAmenity(id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors text-left ${
                      filters.amenities.includes(id)
                        ? 'border-primary bg-primary/5 text-primary'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-sm">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Property Type */}
            <div>
              <h4 className="font-medium mb-3">Property Type</h4>
              <div className="flex flex-wrap gap-2">
                {propertyTypes.map((type) => (
                  <button
                    key={type}
                    onClick={() => togglePropertyType(type)}
                    className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                      filters.propertyTypes.includes(type)
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    {type}
                  </button>
                ))}
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
      <div className="flex flex-wrap gap-1">
        {filters.amenities.map((amenity) => {
          const option = amenityOptions.find(a => a.id === amenity);
          return option ? (
            <Badge key={amenity} variant="secondary" className="gap-1">
              {option.label}
              <X 
                className="w-3 h-3 cursor-pointer" 
                onClick={() => toggleAmenity(amenity)}
              />
            </Badge>
          ) : null;
        })}
        {filters.freeCancellation && (
          <Badge variant="secondary" className="gap-1">
            Free cancellation
            <X 
              className="w-3 h-3 cursor-pointer" 
              onClick={() => updateFilter('freeCancellation', false)}
            />
          </Badge>
        )}
      </div>
    </div>
  );
}
