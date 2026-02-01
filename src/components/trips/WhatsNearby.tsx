/**
 * What's Nearby Component
 * 
 * Location-based archetype-filtered suggestions for active trips.
 * Categories: coffee, food, wander, drinks, snacks
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Coffee, 
  Utensils, 
  Compass, 
  Wine, 
  Cookie,
  MapPin,
  Navigation,
  Star,
  Clock,
  Loader2,
  RefreshCw,
  AlertCircle,
  ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useNearbySuggestions, NearbyCategory, NearbySuggestion } from '@/hooks/useNearbySuggestions';

interface WhatsNearbyProps {
  archetype?: string;
  className?: string;
}

const CATEGORIES: { id: NearbyCategory; label: string; icon: React.ReactNode; emoji: string }[] = [
  { id: 'coffee', label: 'Coffee', icon: <Coffee className="w-4 h-4" />, emoji: '☕' },
  { id: 'food', label: 'Food', icon: <Utensils className="w-4 h-4" />, emoji: '🍜' },
  { id: 'wander', label: 'Wander', icon: <Compass className="w-4 h-4" />, emoji: '🚶' },
  { id: 'drinks', label: 'Drinks', icon: <Wine className="w-4 h-4" />, emoji: '🍷' },
  { id: 'snacks', label: 'Snacks', icon: <Cookie className="w-4 h-4" />, emoji: '🍦' },
];

function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function SuggestionCard({ suggestion, index }: { suggestion: NearbySuggestion; index: number }) {
  const priceDisplay = suggestion.priceLevel 
    ? '$'.repeat(Math.min(suggestion.priceLevel, 4)) 
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
    >
      <Card className="hover:shadow-md transition-shadow cursor-pointer group">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-medium text-sm truncate">{suggestion.name}</h4>
                {suggestion.isOpen !== undefined && (
                  <Badge 
                    variant={suggestion.isOpen ? "default" : "secondary"}
                    className={cn(
                      "text-[10px] px-1.5 py-0",
                      suggestion.isOpen 
                        ? "bg-green-500/10 text-green-600 border-green-500/20" 
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {suggestion.isOpen ? 'Open' : 'Closed'}
                  </Badge>
                )}
              </div>
              
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                {suggestion.description}
              </p>
              
              {/* Why for you - archetype-specific */}
              <div className="bg-primary/5 rounded-md px-2 py-1.5 mb-2">
                <p className="text-xs text-primary italic">
                  "{suggestion.whyForYou}"
                </p>
              </div>
              
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Navigation className="w-3 h-3" />
                  {suggestion.distance}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {suggestion.walkTime}
                </span>
                {suggestion.rating && (
                  <span className="flex items-center gap-1">
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    {suggestion.rating}
                  </span>
                )}
                {priceDisplay && (
                  <span className="text-muted-foreground/70">{priceDisplay}</span>
                )}
              </div>
            </div>
            
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function WhatsNearby({ archetype, className }: WhatsNearbyProps) {
  const [selectedCategory, setSelectedCategory] = useState<NearbyCategory | null>(null);
  const { position, loading: locationLoading, error: locationError, requestLocation, permissionDenied } = useGeolocation();
  const { suggestions, loading: suggestionsLoading, fetchSuggestions, clearSuggestions } = useNearbySuggestions();

  const handleCategorySelect = async (category: NearbyCategory) => {
    if (!position) {
      requestLocation();
      setSelectedCategory(category);
      return;
    }

    setSelectedCategory(category);
    await fetchSuggestions(
      position.lat,
      position.lng,
      category,
      archetype,
      getTimeOfDay()
    );
  };

  // Fetch when position becomes available after category selection
  useEffect(() => {
    if (position && selectedCategory && suggestions.length === 0 && !suggestionsLoading) {
      fetchSuggestions(
        position.lat,
        position.lng,
        selectedCategory,
        archetype,
        getTimeOfDay()
      );
    }
  }, [position, selectedCategory, suggestions.length, suggestionsLoading, fetchSuggestions, archetype]);

  const handleRefresh = () => {
    if (position && selectedCategory) {
      fetchSuggestions(
        position.lat,
        position.lng,
        selectedCategory,
        archetype,
        getTimeOfDay()
      );
    }
  };

  const handleBack = () => {
    setSelectedCategory(null);
    clearSuggestions();
  };

  const isLoading = locationLoading || suggestionsLoading;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          <h3 className="font-semibold">What's Nearby</h3>
        </div>
        {selectedCategory && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </Button>
        )}
      </div>

      {/* Permission denied state */}
      {permissionDenied && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0" />
            <div>
              <p className="text-sm font-medium">Location access needed</p>
              <p className="text-xs text-muted-foreground mt-1">
                Enable location in your browser settings to see nearby places.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Category selector */}
      <AnimatePresence mode="wait">
        {!selectedCategory ? (
          <motion.div
            key="categories"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-5 gap-2"
          >
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => handleCategorySelect(cat.id)}
                disabled={permissionDenied}
                className={cn(
                  "flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all",
                  "bg-muted/50 hover:bg-muted border border-transparent",
                  "hover:border-primary/20 hover:shadow-sm",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <span className="text-xl">{cat.emoji}</span>
                <span className="text-xs font-medium">{cat.label}</span>
              </button>
            ))}
          </motion.div>
        ) : (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {/* Back button + category indicator */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleBack}>
                ← Back
              </Button>
              <Badge variant="secondary">
                {CATEGORIES.find(c => c.id === selectedCategory)?.emoji}{' '}
                {CATEGORIES.find(c => c.id === selectedCategory)?.label}
              </Badge>
            </div>

            {/* Loading state */}
            {isLoading && (
              <div className="flex items-center justify-center py-8">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">
                    {locationLoading ? 'Getting your location...' : 'Finding nearby places...'}
                  </span>
                </div>
              </div>
            )}

            {/* Suggestions list */}
            {!isLoading && suggestions.length > 0 && (
              <div className="space-y-2">
                {suggestions.map((suggestion, index) => (
                  <SuggestionCard 
                    key={suggestion.id} 
                    suggestion={suggestion} 
                    index={index}
                  />
                ))}
              </div>
            )}

            {/* Empty state */}
            {!isLoading && suggestions.length === 0 && !locationError && (
              <div className="text-center py-8 text-muted-foreground">
                <Compass className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No places found nearby</p>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={handleRefresh}
                  className="mt-2"
                >
                  Try again
                </Button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
