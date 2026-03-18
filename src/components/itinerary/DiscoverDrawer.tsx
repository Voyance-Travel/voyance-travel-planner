/**
 * DiscoverDrawer — Lane 3 of 3 itinerary editing tools.
 * Proactive AI suggestions → Conversational input → Category browse.
 * "We know you. Here's what we think you'd love."
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Compass, Loader2, AlertCircle, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { ProactivePicks, type ProactiveSuggestion } from './discover/ProactivePicks';
import { ConversationalInput } from './discover/ConversationalInput';
import { CategoryBrowse, CATEGORIES, type Category } from './discover/CategoryBrowse';
import { Badge } from '@/components/ui/badge';
import { Star, Plus, MapPin, Clock } from 'lucide-react';

/** Infer the best category from a natural language query */
function inferCategoryFromQuery(query: string): Category {
  const q = query.toLowerCase();

  const nightlifeKw = ['tonight', 'nightlife', 'club', 'clubs', 'comedy', 'comedy club', 'live music', 'jazz', 'karaoke', 'dance', 'dancing', 'dj', 'bar crawl', 'late night', 'night out', 'going out', 'party', 'speakeasy', 'lounge'];
  const attractionsKw = ['museum', 'gallery', 'landmark', 'monument', 'historic', 'architecture', 'theater', 'theatre', 'observation', 'sightseeing', 'see', 'visit', 'tour', 'attraction'];
  const eventsKw = ['happening', 'event', 'concert', 'festival', 'show', 'performance', 'what\'s on', 'whats on', 'what to do', 'things to do', 'local events', 'pop-up', 'market'];
  const drinksKw = ['bar', 'bars', 'cocktail', 'wine', 'beer', 'pub', 'drink', 'drinks', 'happy hour', 'rooftop'];
  const coffeeKw = ['coffee', 'cafe', 'café', 'tea', 'espresso', 'latte', 'cappuccino'];
  const wanderKw = ['walk', 'explore', 'park', 'garden', 'stroll', 'neighborhood', 'viewpoint', 'scenic'];
  const snacksKw = ['snack', 'ice cream', 'dessert', 'pastry', 'bakery', 'sweet', 'quick bite'];

  if (nightlifeKw.some(kw => q.includes(kw))) return 'nightlife';
  if (eventsKw.some(kw => q.includes(kw))) return 'events';
  if (attractionsKw.some(kw => q.includes(kw))) return 'attractions';
  if (drinksKw.some(kw => q.includes(kw))) return 'drinks';
  if (coffeeKw.some(kw => q.includes(kw))) return 'coffee';
  if (wanderKw.some(kw => q.includes(kw))) return 'wander';
  if (snacksKw.some(kw => q.includes(kw))) return 'snacks';

  // Default: use time-of-day heuristic
  const hour = new Date().getHours();
  if (hour >= 21 || hour < 4) return 'nightlife';
  if (hour >= 17) return 'drinks';
  return 'food';
}

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
}

export interface DayContext {
  dayNumber: number;
  activities: { title: string; category: string; time?: string; location?: string }[];
}

export interface DiscoverDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  destination: string;
  destinationCountry?: string;
  archetype?: string;
  tripCurrency?: string;
  interests?: string[];
  budgetTier?: string;
  tripDates?: { start: string; end: string };
  currentDay?: DayContext;
  blendedDna?: {
    blendedTraits: Record<string, number>;
    travelerProfiles: Array<{ userId: string; name: string; archetypeId: string; isOwner: boolean; weight: number }>;
    isBlended: boolean;
  };
  onAddActivity: (activity: {
    title: string;
    description: string;
    category: string;
    cost?: { amount: number; currency: string };
    location?: { name: string; address?: string };
  }) => void;
}

function getTimeOfDay() {
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
  interests,
  budgetTier,
  tripDates,
  currentDay,
  blendedDna,
  onAddActivity,
}: DiscoverDrawerProps) {
  // Proactive picks state
  const [proactiveLoading, setProactiveLoading] = useState(false);
  const [proactivePicks, setProactivePicks] = useState<{
    forYou: ProactiveSuggestion[];
    nearSchedule: ProactiveSuggestion[];
    hiddenGems: ProactiveSuggestion[];
  } | null>(null);
  const [proactiveError, setProactiveError] = useState<string | null>(null);
  const proactiveFetched = useRef(false);

  // Conversational search state
  const [conversationalLoading, setConversationalLoading] = useState(false);
  const [conversationalResults, setConversationalResults] = useState<NearbySuggestion[]>([]);
  const [conversationalQuery, setConversationalQuery] = useState('');

  // Category browse state
  const [showCategoryBrowse, setShowCategoryBrowse] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [categoryResults, setCategoryResults] = useState<NearbySuggestion[]>([]);
  const [categoryLoading, setCategoryLoading] = useState(false);

  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());

  // Fetch proactive picks on open
  useEffect(() => {
    if (isOpen && !proactiveFetched.current && destination) {
      proactiveFetched.current = true;
      fetchProactivePicks();
    }
    if (!isOpen) {
      proactiveFetched.current = false;
    }
  }, [isOpen, destination]);

  const fetchProactivePicks = useCallback(async () => {
    setProactiveLoading(true);
    setProactiveError(null);

    try {
      const { data, error } = await supabase.functions.invoke('discover-proactive', {
        body: {
          destination,
          archetype: archetype || 'flexible_wanderer',
          dayNumber: currentDay?.dayNumber || 1,
          dayActivities: currentDay?.activities || [],
          tripDates,
          budgetTier,
          interests,
          timeOfDay: getTimeOfDay(),
          blendedDna: blendedDna?.isBlended ? blendedDna : undefined,
        },
      });

      if (error) throw error;
      setProactivePicks({
        forYou: data?.forYou || [],
        nearSchedule: data?.nearSchedule || [],
        hiddenGems: data?.hiddenGems || [],
      });
    } catch (err) {
      console.error('[DiscoverDrawer] Proactive error:', err);
      setProactiveError('Could not load personalized suggestions. Try browsing by category below.');
    } finally {
      setProactiveLoading(false);
    }
  }, [destination, archetype, currentDay, tripDates, budgetTier, interests]);

  // Conversational search via nearby-suggestions with natural language
  const handleConversationalSearch = useCallback(async (query: string) => {
    setConversationalLoading(true);
    setConversationalQuery(query);
    setConversationalResults([]);

    try {
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
        toast.error('Could not locate this destination.');
        setConversationalLoading(false);
        return;
      }

      // Infer category from natural language query
      const inferredCategory = inferCategoryFromQuery(query);

      const { data, error } = await supabase.functions.invoke('nearby-suggestions', {
        body: {
          lat,
          lng,
          category: inferredCategory,
          archetype: archetype || 'flexible_wanderer',
          timeOfDay: getTimeOfDay(),
          radiusMeters: 1500,
          query, // pass natural language query for additional context
        },
      });

      if (error) throw error;
      setConversationalResults(data?.suggestions || []);
    } catch (err) {
      console.error('[DiscoverDrawer] Conversational error:', err);
      toast.error('Search failed. Please try again.');
    } finally {
      setConversationalLoading(false);
    }
  }, [destination, archetype]);

  // Category browse
  const handleCategorySelect = useCallback(async (cat: Category) => {
    // Toggle off if same category clicked
    if (selectedCategory === cat) {
      setSelectedCategory(null);
      setCategoryResults([]);
      setCategoryLoading(false);
      return;
    }

    setSelectedCategory(cat);
    setCategoryLoading(true);
    setCategoryResults([]);

    try {
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
        toast.error('Could not locate this destination.');
        setCategoryLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('nearby-suggestions', {
        body: { lat, lng, category: cat, archetype: archetype || 'flexible_wanderer', timeOfDay: getTimeOfDay(), radiusMeters: 1500 },
      });

      if (error) throw error;
      setCategoryResults(data?.suggestions || []);
    } catch (err) {
      console.error('[DiscoverDrawer] Category error:', err);
      toast.error('Failed to find suggestions.');
    } finally {
      setCategoryLoading(false);
    }
  }, [destination, archetype, selectedCategory]);

  // Add handler
  const handleAdd = (suggestion: ProactiveSuggestion | NearbySuggestion) => {
    const CATEGORY_MAP: Record<string, string> = {
      coffee: 'dining',
      food: 'dining',
      snacks: 'dining',
      wander: 'sightseeing',
      attractions: 'sightseeing',
      drinks: 'nightlife',
      nightlife: 'nightlife',
      events: 'activity',
    };
    const cat = CATEGORY_MAP[suggestion.category] || suggestion.category || 'activity';
    onAddActivity({
      title: suggestion.name,
      description: suggestion.description,
      category: cat,
      cost: ('priceLevel' in suggestion && suggestion.priceLevel) ? { amount: suggestion.priceLevel * 15, currency: tripCurrency } : undefined,
      location: {
        name: suggestion.name,
        address: 'address' in suggestion ? suggestion.address : undefined,
      },
    });
    setAddedIds(prev => new Set(prev).add(suggestion.id));
    toast.success(`Added "${suggestion.name}" to your day`);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl px-0 flex flex-col">
        <SheetHeader className="px-4 sm:px-6 pb-3 border-b border-border shrink-0">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <Compass className="h-5 w-5 text-primary" />
            Discover in {destination}
          </SheetTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Curated for you, based on your Travel DNA, schedule, and this destination
          </p>
        </SheetHeader>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-5">

          {/* TIER 1: Proactive AI Picks */}
          {proactiveLoading && (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
              <p className="text-sm text-muted-foreground">Finding what's perfect for you...</p>
            </div>
          )}

          {proactiveError && (
            <div className="flex flex-col items-center py-6 text-center">
              <AlertCircle className="h-6 w-6 text-muted-foreground/50 mb-2" />
              <p className="text-xs text-muted-foreground">{proactiveError}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={fetchProactivePicks}>Retry</Button>
            </div>
          )}

          {proactivePicks && !proactiveLoading && (
            <ProactivePicks
              forYou={proactivePicks.forYou}
              nearSchedule={proactivePicks.nearSchedule}
              hiddenGems={proactivePicks.hiddenGems}
              archetype={archetype || 'flexible_wanderer'}
              addedIds={addedIds}
              onAdd={handleAdd}
            />
          )}

          {/* TIER 2: Conversational Input */}
          <div className="space-y-3">
            <div className="border-t border-border/50 pt-4">
              <p className="text-xs text-muted-foreground mb-2 font-medium">Looking for something specific?</p>
              <ConversationalInput
                onSubmit={handleConversationalSearch}
                isLoading={conversationalLoading}
                placeholder={`"Quiet café to read" or "What's happening tonight?"`}
              />
            </div>

            {/* Conversational results */}
            {conversationalQuery && (
              <div className="space-y-2">
                {conversationalLoading && (
                  <div className="flex items-center gap-2 py-4 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">Searching for "{conversationalQuery}"...</span>
                  </div>
                )}
                {!conversationalLoading && conversationalResults.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">No results for "{conversationalQuery}". Try a different description.</p>
                )}
                {conversationalResults.map((s) => (
                  <NearbyCard key={s.id} suggestion={s} isAdded={addedIds.has(s.id)} onAdd={() => handleAdd(s)} />
                ))}
              </div>
            )}
          </div>

          {/* TIER 3: Category Browse */}
          <div className="border-t border-border/50 pt-4">
            <button
              onClick={() => setShowCategoryBrowse(!showCategoryBrowse)}
              className="flex items-center gap-2 w-full text-left mb-3"
            >
              <span className="text-xs font-medium text-muted-foreground">Browse by category</span>
              <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", showCategoryBrowse && "rotate-180")} />
            </button>

            {showCategoryBrowse && (
              <div className="space-y-3">
                <CategoryBrowse
                  selected={selectedCategory}
                  onSelect={handleCategorySelect}
                  isLoading={categoryLoading}
                />

                {/* Active filter header */}
                {selectedCategory && (
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary border-primary/20">
                      {CATEGORIES.find(c => c.key === selectedCategory)?.icon}
                      <span className="capitalize">{CATEGORIES.find(c => c.key === selectedCategory)?.label}</span> in {destination}
                      <button
                        onClick={() => { setSelectedCategory(null); setCategoryResults([]); }}
                        className="ml-1 hover:text-primary/70 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  </div>
                )}

                {categoryLoading && (
                  <div className="flex items-center gap-2 py-4 justify-center">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">Finding {selectedCategory} spots...</span>
                  </div>
                )}

                {selectedCategory && !categoryLoading && categoryResults.length === 0 && (
                  <div className="flex flex-col items-center py-8 text-center rounded-lg border border-dashed border-border/50 bg-muted/30">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center mb-3">
                      {CATEGORIES.find(c => c.key === selectedCategory)?.icon || <Compass className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <p className="text-sm font-medium text-foreground mb-1">No {selectedCategory} spots found</p>
                    <p className="text-xs text-muted-foreground">Try another category or search above</p>
                  </div>
                )}

                {categoryResults.map((s) => (
                  <NearbyCard key={s.id} suggestion={s} isAdded={addedIds.has(s.id)} onAdd={() => handleAdd(s)} />
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Reusable card for nearby-suggestions results (conversational + category browse) */
function NearbyCard({ suggestion, isAdded, onAdd }: { suggestion: NearbySuggestion; isAdded: boolean; onAdd: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3.5 space-y-2 hover:border-primary/20 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-semibold text-foreground text-sm">{suggestion.name}</h4>
            {suggestion.rating && (
              <span className="flex items-center gap-0.5 text-xs text-amber-600">
                <Star className="h-3 w-3 fill-current" />
                {suggestion.rating}
              </span>
            )}
            {suggestion.priceLevel > 0 && (
              <span className="text-xs text-muted-foreground">{renderPriceLevel(suggestion.priceLevel)}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{suggestion.description}</p>
        </div>
        <Button
          size="sm"
          variant={isAdded ? 'secondary' : 'outline'}
          onClick={() => !isAdded && onAdd()}
          disabled={isAdded}
          className={cn(
            'shrink-0 gap-1 h-8',
            !isAdded && 'hover:bg-primary hover:text-primary-foreground hover:border-primary'
          )}
        >
          {isAdded ? <>✓ Added</> : <><Plus className="h-3.5 w-3.5" /> Add</>}
        </Button>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
        {suggestion.walkTime && (
          <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{suggestion.walkTime} walk</span>
        )}
        {suggestion.distance && (
          <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{suggestion.distance}</span>
        )}
        {suggestion.isOpen !== undefined && (
          <Badge variant={suggestion.isOpen ? 'default' : 'secondary'} className="text-[10px] py-0 px-1.5">
            {suggestion.isOpen ? 'Open' : 'Closed'}
          </Badge>
        )}
      </div>
      {suggestion.whyForYou && (
        <p className="text-xs text-primary/80 italic bg-primary/5 rounded-lg px-2.5 py-1.5">
          ✨ {suggestion.whyForYou}
        </p>
      )}
    </div>
  );
}

export default DiscoverDrawer;
