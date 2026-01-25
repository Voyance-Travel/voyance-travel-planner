/**
 * Friend Profile Preview Card - Editorial Redesign
 * Clean, sophisticated hover preview
 */

import { useState } from 'react';
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { MapPin, Compass } from 'lucide-react';
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

async function fetchFriendProfile(friendId: string): Promise<FriendProfileData> {
  // Fetch profile using the friends-safe view that only exposes non-sensitive fields
  // This excludes travel_dna, home_airport, first_name, last_name for privacy
  // Note: Using 'as any' because profiles_friends view is not in generated types yet
  const { data: profile, error: profileError } = await supabase
    .from('profiles_friends' as any)
    .select('id, display_name, handle, avatar_url, bio')
    .eq('id', friendId)
    .single() as { data: FriendProfileData['profile'] | null; error: any };

  if (profileError) throw profileError;
  if (!profile) throw new Error('Profile not found');

  // Fetch travel DNA
  const { data: travelDNA } = await supabase
    .from('travel_dna_profiles')
    .select('primary_archetype_name, secondary_archetype_name, trait_scores, emotional_drivers, tone_tags')
    .eq('user_id', friendId)
    .maybeSingle();

  // Fetch recent trips
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
    staleTime: 5 * 60 * 1000,
  });

  return (
    <HoverCard openDelay={300} closeDelay={100} open={isOpen} onOpenChange={setIsOpen}>
      <HoverCardTrigger asChild className={className}>
        {children}
      </HoverCardTrigger>
      <HoverCardContent 
        side="top" 
        align="center" 
        className="w-72 p-0 overflow-hidden"
      >
        {isLoading ? (
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <Skeleton className="h-12 w-full" />
          </div>
        ) : error ? (
          <div className="p-5 text-center text-sm text-muted-foreground">
            Unable to load profile
          </div>
        ) : data ? (
          <div className="p-5 space-y-4">
            {/* Profile Header */}
            <div className="flex items-start gap-3">
              <Avatar className="h-12 w-12">
                <AvatarImage src={data.profile.avatar_url || undefined} />
                <AvatarFallback className="bg-muted text-muted-foreground font-medium">
                  {(data.profile.display_name || data.profile.handle || '?')[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-foreground truncate">
                  {data.profile.display_name || data.profile.handle}
                </h4>
                {data.profile.handle && (
                  <p className="text-xs text-muted-foreground">@{data.profile.handle}</p>
                )}
                {data.travelDNA?.primary_archetype_name && (
                  <Badge variant="secondary" className="mt-1.5 text-xs font-normal">
                    <Compass className="h-3 w-3 mr-1" />
                    {data.travelDNA.primary_archetype_name}
                  </Badge>
                )}
              </div>
            </div>

            {/* Bio */}
            {data.profile.bio && (
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                {data.profile.bio}
              </p>
            )}

            {/* Tone Tags */}
            {data.travelDNA?.tone_tags && data.travelDNA.tone_tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {data.travelDNA.tone_tags.slice(0, 3).map((tag, i) => (
                  <span 
                    key={i} 
                    className="text-[10px] text-muted-foreground px-2 py-0.5 rounded-full border border-border"
                  >
                    {tag.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                ))}
              </div>
            )}

            {/* Stats */}
            <div className="flex gap-6 pt-3 border-t border-border">
              <div>
                <p className="text-lg font-medium text-foreground">{data.stats.tripsCompleted}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Trips</p>
              </div>
              <div>
                <p className="text-lg font-medium text-foreground">{data.stats.countriesVisited}</p>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Places</p>
              </div>
            </div>

            {/* Recent Trips */}
            {data.recentTrips.length > 0 && (
              <div className="pt-3 border-t border-border space-y-2">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Recent
                </p>
                {data.recentTrips.slice(0, 2).map((trip) => (
                  <div 
                    key={trip.id}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-1.5 text-foreground">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      <span>{trip.destination}</span>
                    </div>
                    <span className="text-muted-foreground">
                      {format(new Date(trip.start_date), 'MMM yyyy')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </HoverCardContent>
    </HoverCard>
  );
}
