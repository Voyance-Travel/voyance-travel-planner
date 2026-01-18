/**
 * Friend Profile Preview Card
 * Shows friend's Travel DNA, archetype, and recent trips on hover/click
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Compass, 
  MapPin, 
  Calendar, 
  Sparkles,
  Globe,
  Heart,
  Mountain,
  Utensils,
  Camera,
  Loader2
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface FriendProfileCardProps {
  friendId: string;
  children: React.ReactNode;
  className?: string;
}

interface FriendProfileData {
  profile: {
    id: string;
    display_name: string | null;
    handle: string | null;
    avatar_url: string | null;
    bio: string | null;
    travel_dna: any;
  };
  travelDNA: {
    primary_archetype_name: string | null;
    secondary_archetype_name: string | null;
    trait_scores: Record<string, number> | null;
    emotional_drivers: string[] | null;
    tone_tags: string[] | null;
  } | null;
  recentTrips: {
    id: string;
    destination: string;
    start_date: string;
    status: string;
  }[];
  stats: {
    tripsCompleted: number;
    countriesVisited: number;
  };
}

// Archetype icons and colors
const archetypeStyles: Record<string, { icon: React.ReactNode; gradient: string }> = {
  'Cultural Explorer': { icon: <Globe className="h-4 w-4" />, gradient: 'from-violet-500 to-purple-500' },
  'Relaxation Seeker': { icon: <Heart className="h-4 w-4" />, gradient: 'from-rose-500 to-pink-500' },
  'Adventure Enthusiast': { icon: <Mountain className="h-4 w-4" />, gradient: 'from-emerald-500 to-teal-500' },
  'Culinary Traveler': { icon: <Utensils className="h-4 w-4" />, gradient: 'from-orange-500 to-amber-500' },
  'Photo Journeyer': { icon: <Camera className="h-4 w-4" />, gradient: 'from-sky-500 to-cyan-500' },
  'default': { icon: <Compass className="h-4 w-4" />, gradient: 'from-indigo-500 to-blue-500' },
};

async function fetchFriendProfile(friendId: string): Promise<FriendProfileData> {
  // Fetch profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, display_name, handle, avatar_url, bio, travel_dna')
    .eq('id', friendId)
    .single();

  if (profileError) throw profileError;

  // Fetch travel DNA
  const { data: travelDNA } = await supabase
    .from('travel_dna_profiles')
    .select('primary_archetype_name, secondary_archetype_name, trait_scores, emotional_drivers, tone_tags')
    .eq('user_id', friendId)
    .maybeSingle();

  // Fetch recent trips (completed/upcoming, public visibility could be added later)
  const { data: trips } = await supabase
    .from('trips')
    .select('id, destination, start_date, status')
    .eq('user_id', friendId)
    .in('status', ['completed', 'booked', 'active'])
    .order('start_date', { ascending: false })
    .limit(3);

  // Calculate stats
  const completedTrips = trips?.filter(t => t.status === 'completed') || [];
  
  return {
    profile,
    travelDNA: travelDNA as FriendProfileData['travelDNA'],
    recentTrips: trips || [],
    stats: {
      tripsCompleted: completedTrips.length,
      countriesVisited: new Set(completedTrips.map(t => t.destination)).size,
    },
  };
}

export default function FriendProfileCard({ friendId, children, className }: FriendProfileCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['friend-profile', friendId],
    queryFn: () => fetchFriendProfile(friendId),
    enabled: isOpen,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const archetype = data?.travelDNA?.primary_archetype_name || 'Explorer';
  const style = archetypeStyles[archetype] || archetypeStyles.default;

  return (
    <HoverCard openDelay={300} closeDelay={100} open={isOpen} onOpenChange={setIsOpen}>
      <HoverCardTrigger asChild className={className}>
        {children}
      </HoverCardTrigger>
      <HoverCardContent 
        side="top" 
        align="center" 
        className="w-80 p-0 overflow-hidden border-0 shadow-2xl"
      >
        {isLoading ? (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-14 w-14 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <Skeleton className="h-16 w-full" />
          </div>
        ) : error ? (
          <div className="p-6 text-center text-muted-foreground">
            Unable to load profile
          </div>
        ) : data ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            {/* Header with gradient */}
            <div className={cn(
              "relative h-20 bg-gradient-to-r",
              style.gradient
            )}>
              <div className="absolute inset-0 bg-black/10" />
            </div>

            {/* Profile content */}
            <div className="px-4 pb-4">
              {/* Avatar */}
              <div className="-mt-10 mb-3">
                <Avatar className="h-16 w-16 ring-4 ring-background shadow-lg">
                  <AvatarImage src={data.profile.avatar_url || undefined} />
                  <AvatarFallback className={cn("bg-gradient-to-br text-white text-xl font-bold", style.gradient)}>
                    {(data.profile.display_name || data.profile.handle || '?')[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>

              {/* Name & Handle */}
              <div className="mb-3">
                <h4 className="font-semibold text-foreground">
                  {data.profile.display_name || data.profile.handle}
                </h4>
                {data.profile.handle && (
                  <p className="text-sm text-muted-foreground">@{data.profile.handle}</p>
                )}
              </div>

              {/* Travel DNA Archetype */}
              {data.travelDNA?.primary_archetype_name && (
                <div className="mb-3">
                  <Badge 
                    className={cn(
                      "gap-1.5 py-1 text-white border-0",
                      `bg-gradient-to-r ${style.gradient}`
                    )}
                  >
                    {style.icon}
                    {data.travelDNA.primary_archetype_name}
                  </Badge>
                </div>
              )}

              {/* Emotional Drivers / Tone Tags */}
              {data.travelDNA?.tone_tags && data.travelDNA.tone_tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {data.travelDNA.tone_tags.slice(0, 4).map((tag, i) => (
                    <Badge key={i} variant="secondary" className="text-xs capitalize">
                      {tag.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Stats */}
              <div className="grid grid-cols-2 gap-3 py-3 border-t border-border">
                <div className="text-center">
                  <p className="text-lg font-semibold text-foreground">{data.stats.tripsCompleted}</p>
                  <p className="text-xs text-muted-foreground">Trips</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-foreground">{data.stats.countriesVisited}</p>
                  <p className="text-xs text-muted-foreground">Destinations</p>
                </div>
              </div>

              {/* Recent Trips */}
              {data.recentTrips.length > 0 && (
                <div className="pt-3 border-t border-border">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Recent Adventures
                  </p>
                  <div className="space-y-2">
                    {data.recentTrips.slice(0, 2).map((trip) => (
                      <div 
                        key={trip.id}
                        className="flex items-center justify-between text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-foreground">{trip.destination}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(trip.start_date), 'MMM yyyy')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        ) : null}
      </HoverCardContent>
    </HoverCard>
  );
}
