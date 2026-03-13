/**
 * What's Nearby — Editorial
 * Location-based archetype-filtered suggestions with magazine aesthetic
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Coffee, Utensils, Compass, Wine, Cookie,
  MapPin, Navigation, Star, Clock,
  Loader2, RefreshCw, AlertCircle, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useGeolocation } from '@/hooks/useGeolocation';
import { useNearbySuggestions, NearbyCategory, NearbySuggestion } from '@/hooks/useNearbySuggestions';

interface WhatsNearbyProps {
  archetype?: string;
  className?: string;
}

const CATEGORIES: { id: NearbyCategory; label: string; icon: React.ReactNode }[] = [
  { id: 'coffee', label: 'Coffee', icon: <Coffee className="w-4 h-4" /> },
  { id: 'food', label: 'Food', icon: <Utensils className="w-4 h-4" /> },
  { id: 'wander', label: 'Wander', icon: <Compass className="w-4 h-4" /> },
  { id: 'drinks', label: 'Drinks', icon: <Wine className="w-4 h-4" /> },
  { id: 'snacks', label: 'Snacks', icon: <Cookie className="w-4 h-4" /> },
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
      transition={{ delay: index * 0.08 }}
      className="group"
    >
      <div className="py-4 border-b border-border/30 last:border-b-0">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-serif text-base font-semibold truncate">{suggestion.name}</h4>
              {suggestion.isOpen !== undefined && (
                <Badge 
                  variant={suggestion.isOpen ? "default" : "secondary"}
                  className={cn(
                    "text-[10px] px-1.5 py-0",
                    suggestion.isOpen 
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" 
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
            
            {/* Why for you — pull-quote */}
            <div className="pl-3 border-l-2 border-primary/20 mb-3">
              <p className="font-serif text-xs italic text-primary/80">
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
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  {suggestion.rating}
                </span>
              )}
              {priceDisplay && (
                <span className="text-muted-foreground/70">{priceDisplay}</span>
              )}
            </div>
          </div>
          
          <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary transition-colors shrink-0 mt-1" />
        </div>
      </div>
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
    await fetchSuggestions(position.lat, position.lng, category, archetype, getTimeOfDay());
  };

  useEffect(() => {
    if (position && selectedCategory && suggestions.length === 0 && !suggestionsLoading) {
      fetchSuggestions(position.lat, position.lng, selectedCategory, archetype, getTimeOfDay());
    }
  }, [position, selectedCategory, suggestions.length, suggestionsLoading, fetchSuggestions, archetype]);

  const handleRefresh = () => {
    if (position && selectedCategory) {
      fetchSuggestions(position.lat, position.lng, selectedCategory, archetype, getTimeOfDay());
    }
  };

  const handleBack = () => {
    setSelectedCategory(null);
    clearSuggestions();
  };

  const isLoading = locationLoading || suggestionsLoading;

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-primary" />
          <h3 className="font-serif text-xl font-semibold">What's Nearby</h3>
        </div>
        {selectedCategory && (
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isLoading}>
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </Button>
        )}
      </div>

      {/* Permission denied */}
      {permissionDenied && (
        <div className="pl-4 border-l-2 border-amber-500/30 py-2">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Location access needed</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Enable location in your browser settings to see nearby places.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Category pills */}
      <AnimatePresence mode="wait">
        {!selectedCategory ? (
          <motion.div
            key="categories"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">
                Curated for You
              </span>
              <div className="flex-1 h-px bg-gradient-to-r from-primary/20 to-transparent" />
            </div>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategorySelect(cat.id)}
                  disabled={permissionDenied}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2.5 rounded-full transition-all",
                    "border border-border/50 hover:border-primary/30",
                    "hover:bg-primary/5 hover:shadow-sm",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  <span className="text-muted-foreground">{cat.icon}</span>
                  <span className="text-sm font-medium">{cat.label}</span>
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="results"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            {/* Back + category */}
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={handleBack} className="font-serif italic text-muted-foreground">
                ← Back
              </Button>
              <Badge variant="secondary" className="flex items-center gap-1.5 rounded-full">
                {CATEGORIES.find(c => c.id === selectedCategory)?.icon}
                {CATEGORIES.find(c => c.id === selectedCategory)?.label}
              </Badge>
            </div>

            {/* Loading */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm font-serif italic">
                    {locationLoading ? 'Getting your location...' : 'Finding nearby places...'}
                  </span>
                </div>
              </div>
            )}

            {/* Results */}
            {!isLoading && suggestions.length > 0 && (
              <div>
                {suggestions.map((suggestion, index) => (
                  <SuggestionCard key={suggestion.id} suggestion={suggestion} index={index} />
                ))}
              </div>
            )}

            {/* Empty */}
            {!isLoading && suggestions.length === 0 && !locationError && (
              <div className="text-center py-12 text-muted-foreground">
                <Compass className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="font-serif text-sm italic">No places found nearby</p>
                <Button variant="ghost" size="sm" onClick={handleRefresh} className="mt-3 font-serif italic">
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
