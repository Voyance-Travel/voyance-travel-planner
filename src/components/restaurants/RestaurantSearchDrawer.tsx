/**
 * Restaurant Search Drawer
 * 
 * Allows users to search and filter restaurants when swapping dining activities.
 * Integrates with recommend-restaurants edge function for personalized results.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Star, MapPin, Clock, DollarSign,
  Sparkles, Loader2, Check, X, Filter,
  Utensils, Leaf, ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { ItineraryActivity } from '@/types/itinerary';
import { 
  getRestaurantRecommendations, 
  type ScoredRestaurant,
  type RecommendationRequest 
} from '@/services/restaurantRecommendationService';
import { toast } from 'sonner';

// =============================================================================
// TYPES
// =============================================================================

interface RestaurantSearchDrawerProps {
  open: boolean;
  onClose: () => void;
  activity: ItineraryActivity | null;
  destination: string;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'any';
  onSelectRestaurant: (restaurant: ItineraryActivity) => void;
}

type MealType = 'breakfast' | 'lunch' | 'dinner' | 'any';
type BudgetLevel = 'budget' | 'moderate' | 'upscale' | 'fine_dining';

// =============================================================================
// CONSTANTS
// =============================================================================

const CUISINE_OPTIONS = [
  'Italian', 'Japanese', 'Mexican', 'Chinese', 'Indian', 'Thai',
  'French', 'Mediterranean', 'American', 'Korean', 'Vietnamese',
  'Greek', 'Spanish', 'Middle Eastern', 'Seafood', 'Steakhouse'
];

const DIETARY_OPTIONS = [
  { value: 'vegetarian', label: 'Vegetarian', icon: '🥗' },
  { value: 'vegan', label: 'Vegan', icon: '🌱' },
  { value: 'gluten-free', label: 'Gluten-Free', icon: '🌾' },
  { value: 'halal', label: 'Halal', icon: '☪️' },
  { value: 'kosher', label: 'Kosher', icon: '✡️' },
];

const PRICE_LEVELS = [
  { value: 'budget', label: '$', description: 'Budget-friendly' },
  { value: 'moderate', label: '$$', description: 'Moderate' },
  { value: 'upscale', label: '$$$', description: 'Upscale' },
  { value: 'fine_dining', label: '$$$$', description: 'Fine Dining' },
];

const RATING_OPTIONS = [
  { value: 4.0, label: '4.0+ stars' },
  { value: 4.5, label: '4.5+ stars' },
];

// =============================================================================
// COMPONENT
// =============================================================================

export default function RestaurantSearchDrawer({
  open,
  onClose,
  activity,
  destination,
  mealType: initialMealType = 'any',
  onSelectRestaurant,
}: RestaurantSearchDrawerProps) {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [restaurants, setRestaurants] = useState<ScoredRestaurant[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  // Filter state
  const [showFilters, setShowFilters] = useState(false);
  const [mealType, setMealType] = useState<MealType>(initialMealType);
  const [budgetLevel, setBudgetLevel] = useState<BudgetLevel | ''>('');
  const [minRating, setMinRating] = useState<number>(4.0); // Default to 4+ stars only
  const [selectedCuisines, setSelectedCuisines] = useState<string[]>([]);
  const [selectedDietary, setSelectedDietary] = useState<string[]>([]);

  // Load restaurants when drawer opens
  useEffect(() => {
    if (open && destination) {
      fetchRestaurants();
    } else {
      // Reset state when drawer closes
      setRestaurants([]);
      setSearchQuery('');
      setSelectedId(null);
      setShowFilters(false);
    }
  }, [open, destination]);

  const fetchRestaurants = async () => {
    setIsLoading(true);
    
    try {
      const request: RecommendationRequest = {
        destination,
        mealType: mealType !== 'any' ? mealType : undefined,
        budgetLevel: budgetLevel || undefined,
        maxResults: 15,
        minRating: minRating, // Send minimum rating to API
      };

      const response = await getRestaurantRecommendations(request);

      if (response.success) {
        let filtered = response.recommendations;
        
        // Apply client-side filters
        if (minRating > 0) {
          filtered = filtered.filter(r => r.rating >= minRating);
        }
        
        if (selectedCuisines.length > 0) {
          filtered = filtered.filter(r => 
            r.cuisine.some(c => 
              selectedCuisines.some(sc => c.toLowerCase().includes(sc.toLowerCase()))
            )
          );
        }

        // Filter by search query
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          filtered = filtered.filter(r =>
            r.name.toLowerCase().includes(query) ||
            r.cuisine.some(c => c.toLowerCase().includes(query)) ||
            (r.highlights || []).some(h => h.toLowerCase().includes(query))
          );
        }

        setRestaurants(filtered);
      } else {
        toast.error('Failed to load restaurants');
      }
    } catch (error) {
      console.error('Error fetching restaurants:', error);
      toast.error('Failed to load restaurants');
    } finally {
      setIsLoading(false);
    }
  };

  // Re-fetch when filters change
  useEffect(() => {
    if (open && destination) {
      const debounce = setTimeout(() => {
        fetchRestaurants();
      }, 300);
      return () => clearTimeout(debounce);
    }
  }, [mealType, budgetLevel, minRating, selectedCuisines]);

  const handleSelectRestaurant = (restaurant: ScoredRestaurant) => {
    setSelectedId(restaurant.id);

    // Convert to ItineraryActivity format
    const newActivity: ItineraryActivity = {
      id: restaurant.id,
      title: restaurant.name,
      description: restaurant.cuisine.join(', ') + (restaurant.highlights?.length ? ` • ${restaurant.highlights[0]}` : ''),
      time: activity?.time || '12:00',
      duration: '1.5 hours',
      type: 'dining',
      cost: restaurant.priceLevel * 25, // Rough estimate based on price level
      location: {
        name: restaurant.name,
        address: restaurant.address,
        coordinates: restaurant.coordinates,
      },
      rating: restaurant.rating,
      tags: restaurant.cuisine,
      isLocked: false,
    };

    setTimeout(() => {
      onSelectRestaurant(newActivity);
      toast.success(`Selected "${restaurant.name}"`);
      setSelectedId(null);
    }, 150);
  };

  const toggleCuisine = (cuisine: string) => {
    setSelectedCuisines(prev => 
      prev.includes(cuisine) 
        ? prev.filter(c => c !== cuisine)
        : [...prev, cuisine]
    );
  };

  const toggleDietary = (dietary: string) => {
    setSelectedDietary(prev => 
      prev.includes(dietary) 
        ? prev.filter(d => d !== dietary)
        : [...prev, dietary]
    );
  };

  const activeFilterCount = [
    budgetLevel ? 1 : 0,
    minRating > 4.0 ? 1 : 0, // Only count if above default
    selectedCuisines.length > 0 ? 1 : 0,
    selectedDietary.length > 0 ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const clearFilters = () => {
    setBudgetLevel('');
    setMinRating(4.0); // Reset to default 4+ stars
    setSelectedCuisines([]);
    setSelectedDietary([]);
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="p-6 border-b border-border shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <Utensils className="w-5 h-5 text-primary" />
            Find a Restaurant
          </SheetTitle>
          <SheetDescription>
            {activity ? (
              <span>Replacing: <strong>{activity.title}</strong></span>
            ) : (
              `Restaurants in ${destination}`
            )}
          </SheetDescription>
        </SheetHeader>

        {/* Search Input */}
        <div className="p-4 border-b border-border shrink-0">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              fetchRestaurants();
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or cuisine..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10"
                disabled={isLoading}
                maxLength={100}
              />
            </div>
            <Button 
              type="button"
              variant={showFilters ? 'default' : 'outline'}
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-4 h-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </form>
        </div>

        {/* Filters Panel */}
        <Collapsible open={showFilters} onOpenChange={setShowFilters}>
          <CollapsibleContent>
            <div className="p-4 border-b border-border bg-muted/30 space-y-4">
              {/* Meal Type & Budget Row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Meal Type</label>
                  <Select value={mealType} onValueChange={(v) => setMealType(v as MealType)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any meal</SelectItem>
                      <SelectItem value="breakfast">Breakfast</SelectItem>
                      <SelectItem value="lunch">Lunch</SelectItem>
                      <SelectItem value="dinner">Dinner</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Price Range</label>
                  <Select value={budgetLevel} onValueChange={(v) => setBudgetLevel(v as BudgetLevel | '')}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Any price" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Any price</SelectItem>
                      {PRICE_LEVELS.map(p => (
                        <SelectItem key={p.value} value={p.value}>
                          {p.label} {p.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Rating Filter */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Minimum Rating</label>
                <div className="flex gap-2">
                  {RATING_OPTIONS.map(r => (
                    <Button
                      key={r.value}
                      variant={minRating === r.value ? 'default' : 'outline'}
                      size="sm"
                      className="flex-1 h-8 text-xs"
                      onClick={() => setMinRating(r.value)}
                    >
                      {r.value > 0 && <Star className="w-3 h-3 mr-1 fill-amber-500 text-amber-500" />}
                      {r.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Cuisine Chips */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Cuisine</label>
                <div className="flex flex-wrap gap-1.5">
                  {CUISINE_OPTIONS.slice(0, 10).map(cuisine => (
                    <Button
                      key={cuisine}
                      variant={selectedCuisines.includes(cuisine) ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => toggleCuisine(cuisine)}
                    >
                      {cuisine}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Dietary Options */}
              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">Dietary Needs</label>
                <div className="flex flex-wrap gap-1.5">
                  {DIETARY_OPTIONS.map(d => (
                    <Button
                      key={d.value}
                      variant={selectedDietary.includes(d.value) ? 'default' : 'outline'}
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => toggleDietary(d.value)}
                    >
                      <span>{d.icon}</span>
                      {d.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Clear Filters */}
              {activeFilterCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={clearFilters}
                >
                  <X className="w-3 h-3 mr-1" />
                  Clear all filters
                </Button>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Results */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="relative">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <Utensils className="w-4 h-4 text-primary absolute -top-1 -right-1" />
                </div>
                <p className="text-sm text-muted-foreground mt-3">
                  Finding the best restaurants...
                </p>
              </div>
            ) : restaurants.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Utensils className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No restaurants found</p>
                <p className="text-sm mt-1">Try adjusting your filters</p>
              </div>
            ) : (
              <>
                <p className="text-xs text-muted-foreground mb-2">
                  {restaurants.length} restaurant{restaurants.length !== 1 ? 's' : ''} found
                </p>
                <AnimatePresence>
                  {restaurants.map((restaurant, index) => (
                    <motion.div
                      key={restaurant.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ delay: index * 0.03 }}
                      className={`
                        p-4 rounded-lg border transition-all cursor-pointer
                        ${selectedId === restaurant.id 
                          ? 'border-primary bg-primary/5 ring-2 ring-primary' 
                          : 'border-border hover:border-primary/50 hover:bg-muted/50'}
                      `}
                      onClick={() => handleSelectRestaurant(restaurant)}
                    >
                      <div className="flex items-start gap-3">
                        {/* Photo */}
                        {restaurant.photoUrl && (
                          <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0">
                            <img 
                              src={restaurant.photoUrl} 
                              alt={restaurant.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-medium text-foreground line-clamp-1">
                              {restaurant.name}
                            </h4>
                            <div className="flex items-center gap-1 shrink-0">
                              <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                              <span className="text-sm font-medium">{restaurant.rating.toFixed(1)}</span>
                            </div>
                          </div>

                          {/* Cuisine tags */}
                          <div className="flex flex-wrap gap-1 mt-1">
                            {restaurant.cuisine.slice(0, 3).map(c => (
                              <Badge key={c} variant="secondary" className="text-xs h-5">
                                {c}
                              </Badge>
                            ))}
                            <Badge variant="outline" className="text-xs h-5">
                              {'$'.repeat(restaurant.priceLevel)}
                            </Badge>
                          </div>

                          {/* Match reasons */}
                          {restaurant.matchReasons.length > 0 && (
                            <p className="text-xs text-primary mt-1.5 flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />
                              {restaurant.matchReasons[0]}
                            </p>
                          )}

                          {/* Meta */}
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            {restaurant.reviewCount > 0 && (
                              <span>({restaurant.reviewCount.toLocaleString()} reviews)</span>
                            )}
                            {restaurant.distance && (
                              <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                {restaurant.distance < 1 
                                  ? `${Math.round(restaurant.distance * 1000)}m` 
                                  : `${restaurant.distance.toFixed(1)}km`}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Selection indicator */}
                        <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0">
                          {selectedId === restaurant.id ? (
                            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                              <Check className="w-4 h-4 text-primary-foreground" />
                            </div>
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                              <Utensils className="w-4 h-4 text-muted-foreground" />
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
