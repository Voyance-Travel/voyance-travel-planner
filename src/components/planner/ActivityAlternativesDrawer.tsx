import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Search, Star, MapPin, Clock, DollarSign, 
  Sparkles, Loader2, ArrowRightLeft, Check,
  Shuffle, Heart, Utensils, Camera, Mountain, 
  Wine, Music, ShoppingBag, Palette, Footprints
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
import type { ItineraryActivity } from '@/types/itinerary';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { trackActivitySwap } from '@/services/behaviorTrackingService';

interface ActivityAlternativesDrawerProps {
  open: boolean;
  onClose: () => void;
  activity: ItineraryActivity | null;
  destination?: string;
  existingActivities?: string[];
  onSelectAlternative: (activity: ItineraryActivity) => void;
}

interface AlternativeActivity {
  id: string;
  name: string;
  description: string;
  category: string;
  estimatedDuration: string;
  estimatedCost: number;
  location: string;
  rating?: number;
  matchScore?: number;
  whyRecommended?: string;
  suggestionType?: 'similar' | 'different';
  distanceFromOriginal?: string;
  walkTimeFromOriginal?: string;
}

// Map AI category strings to valid ActivityType
const normalizeCategory = (category: string): ItineraryActivity['type'] => {
  const categoryLower = (category || '').toLowerCase();
  
  if (['transportation', 'accommodation', 'dining', 'cultural', 'activity', 'relaxation', 'shopping'].includes(categoryLower)) {
    return categoryLower as ItineraryActivity['type'];
  }
  
  if (['restaurant', 'food', 'cafe', 'bar', 'eating', 'breakfast', 'lunch', 'dinner'].some(k => categoryLower.includes(k))) {
    return 'dining';
  }
  if (['museum', 'art', 'history', 'heritage', 'monument', 'gallery', 'theater', 'theatre'].some(k => categoryLower.includes(k))) {
    return 'cultural';
  }
  if (['shop', 'market', 'boutique', 'store', 'mall'].some(k => categoryLower.includes(k))) {
    return 'shopping';
  }
  if (['spa', 'wellness', 'massage', 'beach', 'pool'].some(k => categoryLower.includes(k))) {
    return 'relaxation';
  }
  if (['flight', 'train', 'bus', 'taxi', 'transfer', 'transit'].some(k => categoryLower.includes(k))) {
    return 'transportation';
  }
  if (['hotel', 'hostel', 'stay', 'lodging', 'airbnb'].some(k => categoryLower.includes(k))) {
    return 'accommodation';
  }
  
  return 'activity';
};

// Quick suggestion chips
const QUICK_SUGGESTIONS = [
  { label: 'Similar', icon: ArrowRightLeft, query: null, type: 'similar' as const },
  { label: 'Something Different', icon: Shuffle, query: 'completely_different', type: 'different' as const },
  { label: 'Food & Dining', icon: Utensils, query: 'food dining restaurant' },
  { label: 'Photo Spots', icon: Camera, query: 'instagram photo scenic views' },
  { label: 'Outdoor', icon: Mountain, query: 'outdoor nature hiking walking' },
  { label: 'Wine & Drinks', icon: Wine, query: 'wine bar drinks cocktails' },
  { label: 'Nightlife', icon: Music, query: 'nightlife music entertainment' },
  { label: 'Shopping', icon: ShoppingBag, query: 'shopping markets boutiques' },
  { label: 'Art & Culture', icon: Palette, query: 'art museum gallery culture' },
  { label: 'Relaxation', icon: Heart, query: 'spa wellness relaxation massage' },
];

// Hard client-side timeout for foreground requests (ms)
const FOREGROUND_TIMEOUT_MS = 15_000;

export default function ActivityAlternativesDrawer({
  open,
  onClose,
  activity,
  destination,
  existingActivities = [],
  onSelectAlternative,
}: ActivityAlternativesDrawerProps) {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);
  const [similarAlternatives, setSimilarAlternatives] = useState<AlternativeActivity[]>([]);
  const [differentAlternatives, setDifferentAlternatives] = useState<AlternativeActivity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingType, setLoadingType] = useState<'initial' | 'similar' | 'different' | 'filter' | 'search'>('initial');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Sequence guard: only the latest foreground request ID is honoured
  const fgRequestIdRef = useRef(0);
  // Separate sequence for background preload
  const bgRequestIdRef = useRef(0);
  // Track whether user has interacted with filters/search (suppresses bg preload)
  const userInteractedRef = useRef(false);
  // Active AbortController — abort previous request when a new one starts
  const activeAbortRef = useRef<AbortController | null>(null);

  /** Invoke edge function with a hard timeout and real AbortController. Returns null if timed out/aborted. */
  const invokeWithTimeout = useCallback(async (
    body: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<Record<string, unknown> | null> => {
    // Abort any previous in-flight request
    activeAbortRef.current?.abort();

    const controller = new AbortController();
    activeAbortRef.current = controller;
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${supabaseUrl}/functions/v1/get-activity-alternatives`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseKey,
            'Authorization': `Bearer ${session?.access_token || supabaseKey}`,
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        }
      );

      clearTimeout(timer);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      clearTimeout(timer);
      if ((err as Error)?.name === 'AbortError') {
        return null; // timed out or superseded by newer request
      }
      throw err;
    }
  }, []);

  // Reset state when drawer closes
  useEffect(() => {
    if (open && activity) {
      userInteractedRef.current = false;
      fetchInitialAlternatives();
    } else {
      fgRequestIdRef.current++;
      bgRequestIdRef.current++;
      setSimilarAlternatives([]);
      setDifferentAlternatives([]);
      setActiveFilter(null);
      setSearchQuery('');
      setIsLoading(false);
    }
    return () => {
      fgRequestIdRef.current++;
      bgRequestIdRef.current++;
    };
  }, [open, activity]);

  const buildBaseBody = useCallback(() => {
    if (!activity) return null;
    return {
      currentActivity: {
        id: activity.id,
        name: activity.title,
        type: activity.type,
        description: activity.description,
        time: activity.time,
      },
      destination,
      excludeActivities: existingActivities,
    };
  }, [activity, destination, existingActivities]);

  const fetchInitialAlternatives = async () => {
    const baseBody = buildBaseBody();
    if (!baseBody) return;

    // Bump foreground request ID — any older request results will be ignored
    const requestId = ++fgRequestIdRef.current;

    setIsLoading(true);
    setLoadingType('initial');
    setSimilarAlternatives([]);
    setDifferentAlternatives([]);

    try {
      const data = await invokeWithTimeout(
        { ...baseBody, searchQuery: null, suggestionMode: 'similar' },
        FOREGROUND_TIMEOUT_MS,
      );

      // Stale check
      if (fgRequestIdRef.current !== requestId) return;

      if (data?.alternatives) {
        setSimilarAlternatives(
          (data.alternatives as AlternativeActivity[]).map((a) => ({
            ...a,
            suggestionType: 'similar' as const,
          }))
        );
      }
    } catch (error) {
      if (fgRequestIdRef.current !== requestId) return;
      console.error('Error fetching alternatives:', error);
      toast.error('Failed to load suggestions');
    } finally {
      if (fgRequestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }

    // Background preload "different" — separate sequence, does not affect loading state
    fetchDifferentInBackground(baseBody);
  };

  /** Background preload for "different" alternatives. Never touches isLoading. */
  const fetchDifferentInBackground = async (baseBody: Record<string, unknown>) => {
    const bgId = ++bgRequestIdRef.current;

    try {
      const data = await invokeWithTimeout(
        { ...baseBody, searchQuery: 'completely_different', suggestionMode: 'different' },
        FOREGROUND_TIMEOUT_MS,
      );

      // Ignore if user has already interacted or a newer bg request was issued
      if (bgRequestIdRef.current !== bgId || userInteractedRef.current) return;

      if (data?.alternatives) {
        setDifferentAlternatives(
          (data.alternatives as AlternativeActivity[]).map((a) => ({
            ...a,
            suggestionType: 'different' as const,
          }))
        );
      }
    } catch {
      // Background failure is silent
    }
  };

  const handleQuickFilter = async (suggestion: typeof QUICK_SUGGESTIONS[0]) => {
    if (!activity) return;
    userInteractedRef.current = true;

    // If clicking the same filter, deselect it and reload initial
    if (activeFilter === suggestion.label) {
      setActiveFilter(null);
      userInteractedRef.current = false;
      fetchInitialAlternatives();
      return;
    }

    setActiveFilter(suggestion.label);
    const requestId = ++fgRequestIdRef.current;
    setIsLoading(true);
    setLoadingType('filter');

    try {
      const data = await invokeWithTimeout(
        {
          currentActivity: {
            id: activity.id,
            name: activity.title,
            type: activity.type,
            description: activity.description,
            time: activity.time,
          },
          destination,
          searchQuery: suggestion.query,
          excludeActivities: existingActivities,
          suggestionMode: suggestion.type || 'filter',
        },
        FOREGROUND_TIMEOUT_MS,
      );

      if (fgRequestIdRef.current !== requestId) return;

      if (!data) {
        // Timed out — show a toast instead of spinning forever
        toast.info('Taking longer than usual — showing quick suggestions');
        return;
      }

      if (data?.alternatives) {
        if (suggestion.type === 'similar') {
          setSimilarAlternatives(data.alternatives as AlternativeActivity[]);
          setDifferentAlternatives([]);
        } else if (suggestion.type === 'different') {
          setSimilarAlternatives([]);
          setDifferentAlternatives(data.alternatives as AlternativeActivity[]);
        } else {
          setSimilarAlternatives(data.alternatives as AlternativeActivity[]);
          setDifferentAlternatives([]);
        }
      }
    } catch (error) {
      if (fgRequestIdRef.current !== requestId) return;
      console.error('Error:', error);
      toast.error('Failed to load suggestions');
    } finally {
      if (fgRequestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  };

  const handleCustomSearch = async () => {
    if (!activity || !searchQuery.trim()) return;
    userInteractedRef.current = true;
    
    setActiveFilter(null);
    const requestId = ++fgRequestIdRef.current;
    setIsLoading(true);
    setLoadingType('search');

    try {
      const data = await invokeWithTimeout(
        {
          currentActivity: {
            id: activity.id,
            name: activity.title,
            type: activity.type,
            description: activity.description,
            time: activity.time,
          },
          destination,
          searchQuery: searchQuery.trim(),
          excludeActivities: existingActivities,
          suggestionMode: 'search',
        },
        FOREGROUND_TIMEOUT_MS,
      );

      if (fgRequestIdRef.current !== requestId) return;

      if (!data) {
        toast.info('Taking longer than usual — try again shortly');
        return;
      }

      if (data?.alternatives) {
        setSimilarAlternatives(data.alternatives as AlternativeActivity[]);
        setDifferentAlternatives([]);
      }
    } catch (error) {
      if (fgRequestIdRef.current !== requestId) return;
      console.error('Error:', error);
      toast.error('Failed to search');
    } finally {
      if (fgRequestIdRef.current === requestId) {
        setIsLoading(false);
      }
    }
  };

  const handleSelectAlternative = (alt: AlternativeActivity) => {
    setSelectedId(alt.id);
    
    if (activity) {
      trackActivitySwap(
        activity.id,
        activity.title,
        activity.type || 'activity',
        activity.tags || [],
        alt.id,
        alt.name,
        alt.category,
        [],
        destination
      );
    }
    
    const newActivity: ItineraryActivity = {
      id: alt.id,
      title: alt.name,
      description: alt.description,
      time: activity?.time || '09:00',
      duration: alt.estimatedDuration,
      type: normalizeCategory(alt.category),
      cost: alt.estimatedCost,
      location: {
        name: alt.location,
        address: alt.location,
      },
      rating: alt.rating,
      tags: [],
      isLocked: false,
      tips: alt.whyRecommended || undefined,
    };

    setTimeout(() => {
      onSelectAlternative(newActivity);
      toast.success(`Swapped to "${alt.name}"`);
      setSelectedId(null);
    }, 150);
  };

  const renderAlternativeCard = (alt: AlternativeActivity, index: number) => (
    <motion.div
      key={alt.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ delay: index * 0.05 }}
      className={`
        p-4 rounded-lg border transition-all cursor-pointer
        ${selectedId === alt.id 
          ? 'border-primary bg-primary/5 ring-2 ring-primary' 
          : 'border-border hover:border-primary/50 hover:bg-muted/50'}
      `}
      onClick={() => handleSelectAlternative(alt)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-medium text-foreground truncate">
              {alt.name}
            </h4>
            {alt.matchScore && alt.matchScore >= 90 && (
              <Badge className="bg-primary/10 text-primary text-xs gap-1">
                <Sparkles className="w-3 h-3" />
                Best Match
              </Badge>
            )}
          </div>
          
          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
            {alt.description}
          </p>

          {alt.whyRecommended && (
            <p className="text-xs text-primary mb-2 italic">
              ✨ {alt.whyRecommended}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {alt.rating && (
              <span className="flex items-center gap-1">
                <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                {alt.rating}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {alt.estimatedDuration}
            </span>
            <span className="flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              ${alt.estimatedCost}
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              {typeof alt.location === 'string' 
                ? alt.location 
                : (alt.location as { name?: string; address?: string })?.name || 
                  (alt.location as { name?: string; address?: string })?.address || ''}
            </span>
          </div>
          {(alt.walkTimeFromOriginal || alt.distanceFromOriginal) && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground/80 mt-1">
              {alt.walkTimeFromOriginal && (
                <span className="flex items-center gap-1">
                  <Footprints className="w-3 h-3" />
                  {alt.walkTimeFromOriginal}
                </span>
              )}
              {alt.distanceFromOriginal && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {alt.distanceFromOriginal}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors">
          {selectedId === alt.id ? (
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <Check className="w-4 h-4 text-primary-foreground" />
            </div>
          ) : (
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center hover:bg-muted/80">
              <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );

  const hasAlternatives = similarAlternatives.length > 0 || differentAlternatives.length > 0;

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()} modal={true}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0">
        <SheetHeader className="p-6 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-primary" />
            Swap Activity
          </SheetTitle>
          <SheetDescription>
            {activity ? (
              <span>
                Replacing: <strong>{activity.title}</strong>
              </span>
            ) : (
              'Choose a new activity'
            )}
          </SheetDescription>
        </SheetHeader>

        {/* Search input */}
        <div className="p-4 border-b border-border">
          <form 
            onSubmit={(e) => {
              e.preventDefault();
              handleCustomSearch();
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none z-10" />
              <Input
                placeholder="Search for something specific..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-10 bg-background"
                disabled={isLoading}
                maxLength={100}
              />
            </div>
            <Button 
              type="submit"
              size="sm" 
              className="h-10 px-4"
              disabled={isLoading || !searchQuery.trim()}
            >
              {isLoading && loadingType === 'search' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Search'
              )}
            </Button>
          </form>
        </div>

        {/* Quick suggestion chips */}
        <div className="p-4 border-b border-border">
          <div className="flex flex-wrap gap-2">
            {QUICK_SUGGESTIONS.map((suggestion) => {
              const Icon = suggestion.icon;
              const isActive = activeFilter === suggestion.label;
              return (
                <Button
                  key={suggestion.label}
                  variant={isActive ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleQuickFilter(suggestion)}
                  disabled={isLoading}
                  className="gap-1.5 text-xs h-8"
                >
                  <Icon className="w-3.5 h-3.5" />
                  {suggestion.label}
                </Button>
              );
            })}
          </div>
        </div>

        {/* Results */}
        <ScrollArea className="flex-1 h-[calc(100vh-320px)]">
          <div className="p-4 space-y-3">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="w-8 h-8 animate-spin mb-3 text-primary" />
                <p className="text-sm font-medium">
                  {loadingType === 'initial' && 'Finding the best alternatives...'}
                  {loadingType === 'filter' && 'Searching for options...'}
                  {loadingType === 'search' && 'Searching...'}
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Powered by AI personalization
                </p>
              </div>
            ) : !hasAlternatives ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Sparkles className="w-8 h-8 mb-3 opacity-50" />
                <p className="text-sm">No alternatives found</p>
                <p className="text-xs mt-1">Try a different search or filter</p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {/* Similar alternatives section */}
                {similarAlternatives.length > 0 && (
                  <div>
                    {!activeFilter && differentAlternatives.length > 0 && (
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        Similar Options
                      </h3>
                    )}
                    {similarAlternatives.map((alt, i) => renderAlternativeCard(alt, i))}
                  </div>
                )}

                {/* Different alternatives section */}
                {differentAlternatives.length > 0 && (
                  <div>
                    {!activeFilter && similarAlternatives.length > 0 && (
                      <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 mt-4">
                        Something Different
                      </h3>
                    )}
                    {differentAlternatives.map((alt, i) => 
                      renderAlternativeCard(alt, i + similarAlternatives.length)
                    )}
                  </div>
                )}
              </AnimatePresence>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
