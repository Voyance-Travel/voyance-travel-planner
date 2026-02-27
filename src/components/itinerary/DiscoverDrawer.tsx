/**
 * DiscoverDrawer — Find nearby activities, cafés, restaurants, and attractions
 * during a trip. Uses the nearby-suggestions edge function with archetype-aware results.
 */

import { useState, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Compass, Coffee, UtensilsCrossed, Footprints, Wine, IceCream, Plus, Star, MapPin, Clock, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type Category = 'coffee' | 'food' | 'wander' | 'drinks' | 'snacks';
type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

interface NearbySuggestion {
  id: string;
  name: string;
  category: string;
  description: string;
  whyForYou: string;
  distance: string;
  walkTime: string;
  priceLevel: number;
  rating?: number;
  isOpen?: boolean;
  address?: string;
  coordinates?: { lat: number; lng: number };
}

interface DiscoverDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  destination: string;
  destinationCountry?: string;
  archetype?: string;
  tripCurrency?: string;
  onAddActivity: (activity: {
    title: string;
    description: string;
    category: string;
    cost?: { amount: number; currency: string };
    location?: { name: string; address?: string };
  }) => void;
}

const CATEGORIES: { key: Category; label: string; icon: React.ReactNode }[] = [
  { key: 'coffee', label: 'Cafés', icon: <Coffee className="h-4 w-4" /> },
  { key: 'food', label: 'Restaurants', icon: <UtensilsCrossed className="h-4 w-4" /> },
  { key: 'wander', label: 'Explore', icon: <Footprints className="h-4 w-4" /> },
  { key: 'drinks', label: 'Drinks', icon: <Wine className="h-4 w-4" /> },
  { key: 'snacks', label: 'Snacks', icon: <IceCream className="h-4 w-4" /> },
];

function getTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

function renderPriceLevel(level: number) {
  return Array(level).fill('$').join('');
}

export function DiscoverDrawer({
  isOpen,
  onClose,
  destination,
  archetype,
  tripCurrency = 'USD',
  onAddActivity,
}: DiscoverDrawerProps) {
  const [category, setCategory] = useState<Category>('food');
  const [suggestions, setSuggestions] = useState<NearbySuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  const fetchSuggestions = useCallback(async (cat: Category) => {
    setIsLoading(true);
    setError(null);
    setHasSearched(true);
    setSuggestions([]);

    try {
      // Use destination geocoding as fallback — the edge function uses AI to find places near coordinates
      // For now, we geocode the destination to get approximate coordinates
      const geocodeRes = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(destination)}&format=json&limit=1`,
        { headers: { 'User-Agent': 'Voyance/1.0' } }
      );
      const geocodeData = await geocodeRes.json();
      
      let lat = 0, lng = 0;
      if (geocodeData?.[0]) {
        lat = parseFloat(geocodeData[0].lat);
        lng = parseFloat(geocodeData[0].lon);
      }

      if (!lat || !lng) {
        setError('Could not locate this destination. Try a different search.');
        setIsLoading(false);
        return;
      }

      const { data, error: fnError } = await supabase.functions.invoke('nearby-suggestions', {
        body: {
          lat,
          lng,
          category: cat,
          archetype: archetype || 'flexible_wanderer',
          timeOfDay: getTimeOfDay(),
          radiusMeters: 1500,
        },
      });

      if (fnError) throw fnError;
      setSuggestions(data?.suggestions || []);
    } catch (err) {
      console.error('[DiscoverDrawer] Error:', err);
      setError('Failed to find suggestions. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [destination, archetype]);

  const handleCategoryChange = (cat: Category) => {
    setCategory(cat);
    fetchSuggestions(cat);
  };

  const handleAddToItinerary = (suggestion: NearbySuggestion) => {
    onAddActivity({
      title: suggestion.name,
      description: suggestion.description,
      category: suggestion.category === 'coffee' ? 'dining' : suggestion.category === 'wander' ? 'sightseeing' : suggestion.category === 'drinks' ? 'nightlife' : 'dining',
      cost: suggestion.priceLevel ? { amount: suggestion.priceLevel * 15, currency: tripCurrency } : undefined,
      location: {
        name: suggestion.name,
        address: suggestion.address,
      },
    });
    setAddedIds(prev => new Set(prev).add(suggestion.id));
    toast.success(`Added "${suggestion.name}" to your day`);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl px-0">
        <SheetHeader className="px-4 sm:px-6 pb-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <Compass className="h-5 w-5 text-primary" />
            Discover in {destination}
          </SheetTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Find things to do nearby - personalized for your travel style
          </p>
        </SheetHeader>

        {/* Category Filters */}
        <div className="px-4 sm:px-6 py-3 border-b border-border flex gap-2 overflow-x-auto scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat.key}
              variant={category === cat.key && hasSearched ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleCategoryChange(cat.key)}
              className={cn(
                'gap-1.5 shrink-0 transition-all',
                category === cat.key && hasSearched
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-primary/10 hover:border-primary/30'
              )}
            >
              {cat.icon}
              {cat.label}
            </Button>
          ))}
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3">
          {!hasSearched && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Compass className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <p className="text-muted-foreground font-medium mb-1">What are you in the mood for?</p>
              <p className="text-sm text-muted-foreground/70">Pick a category above to discover nearby spots</p>
            </div>
          )}

          {isLoading && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
              <p className="text-sm text-muted-foreground">Finding great spots near {destination}...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-8 w-8 text-destructive/50 mb-3" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => fetchSuggestions(category)}>
                Try Again
              </Button>
            </div>
          )}

          {hasSearched && !isLoading && !error && suggestions.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <p className="text-muted-foreground">No suggestions found for this category.</p>
              <p className="text-sm text-muted-foreground/70 mt-1">Try a different category</p>
            </div>
          )}

          {suggestions.map((suggestion) => {
            const isAdded = addedIds.has(suggestion.id);
            return (
              <div
                key={suggestion.id}
                className="rounded-xl border border-border bg-card p-4 space-y-2 hover:border-primary/20 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-semibold text-foreground">{suggestion.name}</h4>
                      {suggestion.rating && (
                        <span className="flex items-center gap-0.5 text-xs text-amber-600">
                          <Star className="h-3 w-3 fill-current" />
                          {suggestion.rating}
                        </span>
                      )}
                      {suggestion.priceLevel > 0 && (
                        <span className="text-xs text-muted-foreground">
                          {renderPriceLevel(suggestion.priceLevel)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{suggestion.description}</p>
                  </div>
                  <Button
                    size="sm"
                    variant={isAdded ? 'secondary' : 'outline'}
                    onClick={() => !isAdded && handleAddToItinerary(suggestion)}
                    disabled={isAdded}
                    className={cn(
                      'shrink-0 gap-1',
                      !isAdded && 'hover:bg-primary hover:text-primary-foreground hover:border-primary'
                    )}
                  >
                    {isAdded ? (
                      <>✓ Added</>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        Add
                      </>
                    )}
                  </Button>
                </div>

                {/* Meta row */}
                <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  {suggestion.walkTime && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {suggestion.walkTime} walk
                    </span>
                  )}
                  {suggestion.distance && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {suggestion.distance}
                    </span>
                  )}
                  {suggestion.isOpen !== undefined && (
                    <Badge variant={suggestion.isOpen ? 'default' : 'secondary'} className="text-[10px] py-0 px-1.5">
                      {suggestion.isOpen ? 'Open' : 'Closed'}
                    </Badge>
                  )}
                </div>

                {/* Archetype-specific reason */}
                {suggestion.whyForYou && (
                  <p className="text-xs text-primary/80 italic bg-primary/5 rounded-lg px-2.5 py-1.5">
                    ✨ {suggestion.whyForYou}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default DiscoverDrawer;
