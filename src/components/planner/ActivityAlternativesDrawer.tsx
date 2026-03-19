import { useState, useEffect } from 'react';
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
  existingActivities?: string[]; // Names of activities already in the itinerary
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
  
  // Direct matches
  if (['transportation', 'accommodation', 'dining', 'cultural', 'activity', 'relaxation', 'shopping'].includes(categoryLower)) {
    return categoryLower as ItineraryActivity['type'];
  }
  
  // Map common variations
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
  
  // Default to 'activity' for sightseeing, adventure, outdoor, etc.
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
  
  // Track active request to cancel stale ones
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cancel any in-flight request
  const cancelPendingRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  // Fetch both similar and different alternatives when drawer opens
  useEffect(() => {
    if (open && activity) {
      fetchInitialAlternatives();
    } else {
      cancelPendingRequest();
      setSimilarAlternatives([]);
      setDifferentAlternatives([]);
      setActiveFilter(null);
      setSearchQuery('');
    }
    return () => cancelPendingRequest();
  }, [open, activity]);

  const invokeWithCancel = async (body: Record<string, unknown>) => {
    cancelPendingRequest();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const { data, error } = await supabase.functions.invoke('get-activity-alternatives', {
      body,
    });

    // If this request was cancelled, don't process result
    if (controller.signal.aborted) return null;

    if (error) throw error;
    return data;
  };

  const fetchInitialAlternatives = async () => {
    if (!activity) return;
    
    setIsLoading(true);
    setLoadingType('initial');
    setSimilarAlternatives([]);
    setDifferentAlternatives([]);

    try {
      // Single call for similar alternatives first (fast), then different in background
      const baseBody = {
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

      const similarData = await invokeWithCancel({
        ...baseBody,
        searchQuery: null,
        suggestionMode: 'similar',
      });

      if (similarData?.alternatives) {
        setSimilarAlternatives(
          similarData.alternatives.map((a: AlternativeActivity) => ({
            ...a,
            suggestionType: 'similar' as const,
          }))
        );
      }
      
      // Loading done for the user — fetch "different" in background without blocking
      setIsLoading(false);
      
      const differentData = await invokeWithCancel({
        ...baseBody,
        searchQuery: 'completely_different',
        suggestionMode: 'different',
      });

      if (differentData?.alternatives) {
        setDifferentAlternatives(
          differentData.alternatives.map((a: AlternativeActivity) => ({
            ...a,
            suggestionType: 'different' as const,
          }))
        );
      }
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return;
      console.error('Error fetching alternatives:', error);
      toast.error('Failed to load suggestions');
      setIsLoading(false);
    }
  };

  const handleQuickFilter = async (suggestion: typeof QUICK_SUGGESTIONS[0]) => {
    if (!activity) return;

    // If clicking the same filter, deselect it and reload initial
    if (activeFilter === suggestion.label) {
      setActiveFilter(null);
      fetchInitialAlternatives();
      return;
    }

    setActiveFilter(suggestion.label);
    setIsLoading(true);
    setLoadingType('filter');

    try {
      const data = await invokeWithCancel({
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
      });

      if (!data) return; // Request was cancelled

      if (data?.alternatives) {
        if (suggestion.type === 'similar') {
          setSimilarAlternatives(data.alternatives);
          setDifferentAlternatives([]);
        } else if (suggestion.type === 'different') {
          setSimilarAlternatives([]);
          setDifferentAlternatives(data.alternatives);
        } else {
          setSimilarAlternatives(data.alternatives);
          setDifferentAlternatives([]);
        }
      }
    } catch (error) {
      if ((error as Error)?.name === 'AbortError') return;
      console.error('Error:', error);
      toast.error('Failed to load suggestions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomSearch = async () => {
    if (!activity || !searchQuery.trim()) return;
    
    // Clear filters when doing custom search
    setActiveFilter(null);
    setIsLoading(true);
    setLoadingType('search');

    try {
      const { data, error } = await supabase.functions.invoke('get-activity-alternatives', {
        body: {
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
      });

      if (error) {
        console.error('Error searching alternatives:', error);
        toast.error('Failed to search');
      } else if (data?.alternatives) {
        setSimilarAlternatives(data.alternatives);
        setDifferentAlternatives([]);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to search');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectAlternative = (alt: AlternativeActivity) => {
    setSelectedId(alt.id);
    
    // Track the swap for personalization learning
    if (activity) {
      trackActivitySwap(
        activity.id,
        activity.title,
        activity.type || 'activity',
        activity.tags || [],
        alt.id,
        alt.name,
        alt.category,
        [], // New activity tags will be populated by the AI
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

    // Slight delay for visual feedback, then swap
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
          <p className="text-xs text-muted-foreground mb-3">Or choose a category:</p>
          <div className="flex flex-wrap gap-2">
            {QUICK_SUGGESTIONS.map((suggestion) => {
              const Icon = suggestion.icon;
              const isActive = activeFilter === suggestion.label;
              return (
                <Button
                  key={suggestion.label}
                  variant={isActive ? "default" : "outline"}
                  size="sm"
                  className={`
                    gap-1.5 text-xs h-8
                    ${isActive ? '' : 'hover:bg-muted'}
                  `}
                  onClick={() => handleQuickFilter(suggestion)}
                  disabled={isLoading}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {suggestion.label}
                </Button>
              );
            })}
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-380px)]">
          <div className="p-4 space-y-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground mt-3">
                  {loadingType === 'initial' 
                    ? 'Finding the best alternatives...' 
                    : 'Searching for options...'}
                </p>
              </div>
            ) : !hasAlternatives ? (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No alternatives found</p>
                <p className="text-sm mt-1">Try a different filter</p>
              </div>
            ) : (
              <>
                {/* Similar Activities Section */}
                {similarAlternatives.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <ArrowRightLeft className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-medium text-foreground">
                        {activeFilter && activeFilter !== 'Similar' && activeFilter !== 'Something Different'
                          ? activeFilter
                          : 'Similar Activities'}
                      </h3>
                      <Badge variant="secondary" className="text-xs">
                        {similarAlternatives.length}
                      </Badge>
                    </div>
                    <AnimatePresence>
                      <div className="space-y-3">
                        {similarAlternatives.map((alt, index) => 
                          renderAlternativeCard(alt, index)
                        )}
                      </div>
                    </AnimatePresence>
                  </div>
                )}

                {/* Different Activities Section */}
                {differentAlternatives.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Shuffle className="w-4 h-4 text-accent-foreground" />
                      <h3 className="text-sm font-medium text-foreground">
                        Something Different
                      </h3>
                      <Badge variant="outline" className="text-xs">
                        {differentAlternatives.length}
                      </Badge>
                    </div>
                    <AnimatePresence>
                      <div className="space-y-3">
                        {differentAlternatives.map((alt, index) => 
                          renderAlternativeCard(alt, index + similarAlternatives.length)
                        )}
                      </div>
                    </AnimatePresence>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
