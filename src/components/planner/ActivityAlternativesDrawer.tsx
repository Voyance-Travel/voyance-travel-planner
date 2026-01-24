import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Search, Star, MapPin, Clock, DollarSign, 
  Sparkles, Loader2, ArrowRightLeft, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
}

export default function ActivityAlternativesDrawer({
  open,
  onClose,
  activity,
  destination,
  existingActivities = [],
  onSelectAlternative,
}: ActivityAlternativesDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [alternatives, setAlternatives] = useState<AlternativeActivity[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Fetch alternatives when drawer opens
  useEffect(() => {
    if (open && activity) {
      fetchAlternatives();
    }
  }, [open, activity]);

  const fetchAlternatives = async () => {
    if (!activity) return;
    
    setIsLoading(true);
    setAlternatives([]);

    try {
      // Use edge function to get AI-powered alternatives
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
          searchQuery,
          excludeActivities: existingActivities,
        },
      });

      if (error) {
        console.error('Error fetching alternatives:', error);
        // Fallback to sample alternatives
        setAlternatives(getSampleAlternatives(activity));
      } else if (data?.alternatives) {
        setAlternatives(data.alternatives);
      } else {
        setAlternatives(getSampleAlternatives(activity));
      }
    } catch (error) {
      console.error('Error:', error);
      setAlternatives(getSampleAlternatives(activity));
    } finally {
      setIsLoading(false);
    }
  };

  // Generate sample alternatives as fallback
  const getSampleAlternatives = (activity: ItineraryActivity): AlternativeActivity[] => {
    const baseAlternatives: AlternativeActivity[] = [
      {
        id: `alt-1-${activity.id}`,
        name: `Premium ${activity.title}`,
        description: `An enhanced version of this experience with exclusive access and personalized service.`,
        category: activity.type,
        estimatedDuration: activity.duration || '2 hours',
        estimatedCost: Math.round(activity.cost * 1.5),
        location: activity.location?.name || 'Various locations',
        rating: 4.8,
        matchScore: 95,
        whyRecommended: 'Similar activity with premium experience',
      },
      {
        id: `alt-2-${activity.id}`,
        name: `Local ${activity.type} Experience`,
        description: `Discover authentic local culture with a guided experience led by residents.`,
        category: activity.type,
        estimatedDuration: '3 hours',
        estimatedCost: Math.round(activity.cost * 0.8),
        location: 'Local neighborhood',
        rating: 4.6,
        matchScore: 88,
        whyRecommended: 'More authentic, budget-friendly option',
      },
      {
        id: `alt-3-${activity.id}`,
        name: `Group ${activity.type} Tour`,
        description: `Join a small group for a social experience with expert guides.`,
        category: activity.type,
        estimatedDuration: '2.5 hours',
        estimatedCost: Math.round(activity.cost * 0.6),
        location: 'City center',
        rating: 4.4,
        matchScore: 82,
        whyRecommended: 'Great for meeting fellow travelers',
      },
    ];

    return baseAlternatives;
  };

  const handleSearch = () => {
    fetchAlternatives();
  };

  const handleSelectAlternative = (alt: AlternativeActivity) => {
    setSelectedId(alt.id);
    
    const newActivity: ItineraryActivity = {
      id: alt.id,
      title: alt.name,
      description: alt.description,
      time: activity?.time || '09:00',
      duration: alt.estimatedDuration,
      type: alt.category as ItineraryActivity['type'],
      cost: alt.estimatedCost,
      location: {
        name: alt.location,
        address: alt.location,
      },
      rating: alt.rating,
      tags: [],
      isLocked: false,
    };

    setTimeout(() => {
      onSelectAlternative(newActivity);
      toast.success(`Swapped to "${alt.name}"`);
      setSelectedId(null);
    }, 300);
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0">
        <SheetHeader className="p-6 border-b border-border">
          <SheetTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-primary" />
            Find Alternatives
          </SheetTitle>
          <SheetDescription>
            {activity ? (
              <span>
                Replacing: <strong>{activity.title}</strong>
              </span>
            ) : (
              'Search for similar activities'
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="p-4 border-b border-border">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search activities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-9"
              />
            </div>
            <Button onClick={handleSearch} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-200px)]">
          <div className="p-4 space-y-3">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="relative">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  <Sparkles className="w-4 h-4 text-primary absolute -top-1 -right-1" />
                </div>
                <p className="text-sm text-muted-foreground mt-3">
                  Finding alternatives...
                </p>
              </div>
            ) : alternatives.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Search className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No alternatives found</p>
                <p className="text-sm mt-1">Try a different search term</p>
              </div>
            ) : (
              <AnimatePresence>
                {alternatives.map((alt, index) => (
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
                            {alt.location}
                          </span>
                        </div>
                      </div>

                      <div className="flex-shrink-0">
                        {selectedId === alt.id ? (
                          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                            <Check className="w-4 h-4 text-primary-foreground" />
                          </div>
                        ) : (
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <ArrowRightLeft className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
