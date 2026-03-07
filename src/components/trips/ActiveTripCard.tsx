/**
 * ActiveTripCard - Enhanced card for trips currently in progress
 * Features: day progress, current activity preview, quick actions, feedback prompts
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
 import { Link, useNavigate } from 'react-router-dom';
import { 
  Plane, 
  Calendar, 
  MapPin, 
  Clock, 
  ChevronRight,
  Sparkles,
  MessageSquare,
  Star,
  Navigation,
  Sun,
  Moon,
  Coffee,
  Utensils,
  Camera
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { parseLocalDate } from '@/utils/dateUtils';
import { useTripHeroImage } from '@/hooks/useTripHeroImage';
 import { openMapLocation, isIOS } from '@/utils/mapNavigation';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ActiveTripCardProps {
  trip: {
    id: string;
    destination: string;
    name?: string | null;
    startDate: string | null;
    endDate: string | null;
    hasItineraryData?: boolean;
    flightSelection?: unknown;
    hotelSelection?: unknown;
    travelers?: number;
    departureCity?: string | null;
    metadata?: Record<string, unknown>;
  };
}

function getTimeOfDayIcon() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return Coffee;
  if (hour >= 12 && hour < 17) return Sun;
  if (hour >= 17 && hour < 21) return Utensils;
  return Moon;
}

function getTimeOfDayGreeting() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 17) return 'Good afternoon';
  if (hour >= 17 && hour < 21) return 'Good evening';
  return 'Night owl mode';
}

export default function ActiveTripCard({ trip }: ActiveTripCardProps) {
   const navigate = useNavigate();
  const [userRating, setUserRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [isSavingRating, setIsSavingRating] = useState(false);

  // Load existing rating
  useEffect(() => {
    const loadRating = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('trip_ratings' as any)
        .select('rating')
        .eq('user_id', user.id)
        .eq('trip_id', trip.id)
        .maybeSingle();
      if ((data as any)?.rating) setUserRating((data as any).rating as number);
    };
    loadRating();
  }, [trip.id]);

  const handleRatingClick = async (rating: number) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Sign in to rate your trip');
      return;
    }
    setIsSavingRating(true);
    const newRating = rating === userRating ? 0 : rating; // toggle off if same
    try {
      if (newRating === 0) {
        await (supabase.from('trip_ratings' as any) as any).delete().eq('user_id', user.id).eq('trip_id', trip.id);
      } else {
        await supabase.from('trip_ratings' as any).upsert(
          { user_id: user.id, trip_id: trip.id, rating: newRating, updated_at: new Date().toISOString() } as any,
          { onConflict: 'user_id,trip_id' }
        );
      }
      setUserRating(newRating);
      if (newRating > 0) toast.success(`Rated ${newRating} star${newRating > 1 ? 's' : ''}!`);
    } catch {
      toast.error('Failed to save rating');
    } finally {
      setIsSavingRating(false);
    }
  };

  // Use smart hero image hook with API fallback for uncurated destinations
  const seededHero = trip.metadata?.hero_image;
  const seededHeroUrl = typeof seededHero === 'string' && seededHero.length > 0 ? seededHero : null;
  
  const { imageUrl, isLoading, onError: onImageError } = useTripHeroImage({
    destination: trip.destination,
    seededHeroUrl,
    tripId: trip.id,
  });

  // Calculate trip progress
  const now = new Date();
  const startDate = trip.startDate ? parseLocalDate(trip.startDate) : null;
  const endDate = trip.endDate ? parseLocalDate(trip.endDate) : null;
  
  let currentDay = 1;
  let totalDays = 1;
  let progressPercent = 0;
  let daysRemaining = 0;
  
  if (startDate && endDate) {
    totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    currentDay = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    currentDay = Math.max(1, Math.min(currentDay, totalDays));
    progressPercent = (currentDay / totalDays) * 100;
    daysRemaining = totalDays - currentDay;
  }

  const TimeIcon = getTimeOfDayIcon();
  const greeting = getTimeOfDayGreeting();

   // Generate map URL for the destination
   const getMapUrl = () => {
     const query = encodeURIComponent(trip.destination);
     if (isIOS()) {
       return `https://maps.apple.com/?q=${query}`;
     }
     return `https://www.google.com/maps/search/?api=1&query=${query}`;
   };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative bg-card rounded-3xl overflow-hidden border-2 border-green-500/30 shadow-lg"
    >
      {/* Animated glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 via-transparent to-accent/5 pointer-events-none" />
      
      {/* Hero Image Section */}
      <div className="relative h-64 overflow-hidden">
        <img 
          src={imageUrl} 
          alt={trip.destination} 
          className="w-full h-full object-cover"
          onError={onImageError}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10" />
        
        {/* Live Badge */}
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <Badge className="bg-green-500 text-white border-0 gap-1.5 shadow-lg animate-pulse">
            <span className="w-2 h-2 bg-white rounded-full" />
            LIVE
          </Badge>
          <Badge className="bg-black/50 text-white border-0 backdrop-blur-sm">
            Day {currentDay} of {totalDays}
          </Badge>
        </div>

        {/* Time of Day Greeting */}
        <div className="absolute top-4 right-4">
          <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm rounded-full px-3 py-1.5 text-white text-sm">
            <TimeIcon className="h-4 w-4 text-amber-400" />
            <span>{greeting}</span>
          </div>
        </div>
        
        {/* Destination Title */}
        <div className="absolute bottom-4 left-4 right-4">
          <p className="text-white/70 text-sm mb-1 flex items-center gap-1.5">
            <Navigation className="h-3 w-3" />
            You're currently in
          </p>
          <h2 className="font-serif text-3xl font-bold text-white drop-shadow-lg">
            {trip.destination}
          </h2>
          {trip.name && trip.name !== trip.destination && (
            <p className="text-white/80 text-sm mt-1">{trip.name}</p>
          )}
        </div>
      </div>

      {/* Content Section */}
      <div className="p-6 space-y-5">
        {/* Trip Timeline */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-foreground">
              Day {currentDay} of {totalDays}
            </span>
            <span className="text-muted-foreground">
              {daysRemaining === 0 
                ? '🎉 Last day!' 
                : `${daysRemaining} day${daysRemaining > 1 ? 's' : ''} remaining`}
            </span>
          </div>
          <Progress value={progressPercent} className="h-2 bg-muted" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{trip.startDate ? parseLocalDate(trip.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'Start'}</span>
            <span>{trip.endDate ? parseLocalDate(trip.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'End'}</span>
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 gap-3">
          <Button 
             asChild
            variant="default"
            className="h-auto py-4 flex-col gap-2"
          >
             <Link to={`/itinerary/${trip.id}`}>
               <Calendar className="h-5 w-5" />
               <span className="text-sm font-medium">Today's Plan</span>
             </Link>
          </Button>
          
          <Button 
            asChild
            variant="outline"
            className="h-auto py-4 flex-col gap-2 border-border/60"
          >
            <a href={getMapUrl()} target="_blank" rel="noopener noreferrer">
            <MapPin className="h-5 w-5" />
            <span className="text-sm font-medium">Open Map</span>
            </a>
          </Button>
        </div>

        {/* Feedback Prompt */}
        <motion.div 
          className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl p-4"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center flex-shrink-0">
              <Camera className="h-5 w-5 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-sm text-foreground">
                How's your trip going?
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Share a quick update or rate today's activities
              </p>
            </div>
            <Button 
              variant="ghost" 
              size="sm" 
              className="flex-shrink-0 text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
              onClick={() => navigate(`/trip/${trip.id}/feedback`)}
            >
              Share
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </motion.div>

        {/* Daily Experience Rating */}
        <div className="py-3 border-t border-border/50 space-y-1.5">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-foreground">How was today?</span>
              <p className="text-xs text-muted-foreground">
                {userRating > 0 
                  ? `You rated today ${userRating}/5. This helps personalize future trips`
                  : 'Tap a star to rate your experience today'}
              </p>
            </div>
          </div>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((rating) => (
              <button
                key={rating}
                disabled={isSavingRating}
                className="p-1.5 rounded-full hover:bg-muted transition-colors group"
                onClick={() => handleRatingClick(rating)}
                onMouseEnter={() => setHoverRating(rating)}
                onMouseLeave={() => setHoverRating(0)}
              >
                <Star className={cn(
                  "h-5 w-5 transition-colors",
                  (hoverRating || userRating) >= rating
                    ? "text-amber-400 fill-amber-400"
                    : "text-muted-foreground/40 group-hover:text-amber-400 group-hover:fill-amber-400"
                )} />
              </button>
            ))}
          </div>
        </div>

        {/* View Full Details */}
        <Link 
          to={`/trip/${trip.id}`}
          className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors pt-2"
        >
          <span>View full trip details</span>
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>
    </motion.div>
  );
}
