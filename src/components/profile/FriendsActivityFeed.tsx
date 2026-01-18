/**
 * Friends Activity Feed
 * Shows when friends are planning trips or completed adventures
 */

import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { 
  Plane, 
  MapPin, 
  Calendar, 
  Sparkles, 
  CheckCircle,
  Clock,
  PartyPopper,
  Loader2,
  Users
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import FriendProfileCard from './FriendProfileCard';

interface FriendsActivityFeedProps {
  userId: string;
  className?: string;
  limit?: number;
}

interface FriendActivity {
  id: string;
  type: 'planning' | 'completed' | 'upcoming' | 'active';
  friend: {
    id: string;
    display_name: string | null;
    handle: string | null;
    avatar_url: string | null;
  };
  trip: {
    id: string;
    destination: string;
    destination_country: string | null;
    start_date: string;
    end_date: string;
    status: string;
  };
  timestamp: string;
}

async function fetchFriendsActivity(limit: number): Promise<FriendActivity[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // Get all accepted friends
  const { data: friendsAsRequester } = await supabase
    .from('friendships')
    .select('addressee_id')
    .eq('requester_id', user.id)
    .eq('status', 'accepted');

  const { data: friendsAsAddressee } = await supabase
    .from('friendships')
    .select('requester_id')
    .eq('addressee_id', user.id)
    .eq('status', 'accepted');

  const friendIds = [
    ...(friendsAsRequester || []).map(f => f.addressee_id),
    ...(friendsAsAddressee || []).map(f => f.requester_id),
  ];

  if (friendIds.length === 0) return [];

  // Get friends' recent trips
  const { data: trips, error } = await supabase
    .from('trips')
    .select(`
      id,
      destination,
      destination_country,
      start_date,
      end_date,
      status,
      updated_at,
      user_id,
      profile:profiles!trips_user_id_fkey(id, display_name, handle, avatar_url)
    `)
    .in('user_id', friendIds)
    .in('status', ['planning', 'booked', 'active', 'completed'])
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error || !trips) return [];

  // Transform to activity format
  const activities: FriendActivity[] = trips.map(trip => {
    let type: FriendActivity['type'] = 'planning';
    const startDate = new Date(trip.start_date);
    const now = new Date();

    if (trip.status === 'completed') {
      type = 'completed';
    } else if (trip.status === 'active') {
      type = 'active';
    } else if (trip.status === 'booked' && startDate > now) {
      type = 'upcoming';
    }

    return {
      id: trip.id,
      type,
      friend: trip.profile as unknown as FriendActivity['friend'],
      trip: {
        id: trip.id,
        destination: trip.destination,
        destination_country: trip.destination_country,
        start_date: trip.start_date,
        end_date: trip.end_date,
        status: trip.status,
      },
      timestamp: trip.updated_at,
    };
  });

  return activities;
}

// Activity type configurations
const activityConfig = {
  planning: {
    icon: Plane,
    label: 'is planning a trip to',
    gradient: 'from-sky-100 to-cyan-100 dark:from-sky-900/20 dark:to-cyan-900/20',
    iconColor: 'text-sky-500',
    badge: 'Planning',
    badgeVariant: 'secondary' as const,
  },
  upcoming: {
    icon: Calendar,
    label: 'has a trip coming up to',
    gradient: 'from-violet-100 to-purple-100 dark:from-violet-900/20 dark:to-purple-900/20',
    iconColor: 'text-violet-500',
    badge: 'Upcoming',
    badgeVariant: 'default' as const,
  },
  active: {
    icon: MapPin,
    label: 'is currently traveling in',
    gradient: 'from-emerald-100 to-teal-100 dark:from-emerald-900/20 dark:to-teal-900/20',
    iconColor: 'text-emerald-500',
    badge: 'Traveling Now',
    badgeVariant: 'default' as const,
  },
  completed: {
    icon: CheckCircle,
    label: 'completed a trip to',
    gradient: 'from-amber-100 to-orange-100 dark:from-amber-900/20 dark:to-orange-900/20',
    iconColor: 'text-amber-500',
    badge: 'Completed',
    badgeVariant: 'secondary' as const,
  },
};

export default function FriendsActivityFeed({ userId, className, limit = 5 }: FriendsActivityFeedProps) {
  const { data: activities, isLoading } = useQuery({
    queryKey: ['friends-activity', userId, limit],
    queryFn: () => fetchFriendsActivity(limit),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000, // Refresh every 5 minutes
  });

  if (isLoading) {
    return (
      <div className={cn("flex justify-center py-8", className)}>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "text-center py-12 px-6 rounded-2xl bg-gradient-to-br from-muted/30 via-muted/20 to-transparent border-2 border-dashed border-muted",
          className
        )}
      >
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30 flex items-center justify-center mx-auto mb-4">
          <Users className="h-8 w-8 text-indigo-500" />
        </div>
        <h3 className="font-semibold text-lg text-foreground mb-1">No friend activity yet</h3>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto">
          When your friends plan or complete trips, you'll see their adventures here!
        </p>
      </motion.div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-900/30 dark:to-purple-900/30">
          <Sparkles className="h-5 w-5 text-indigo-500" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Friends' Adventures</h3>
          <p className="text-sm text-muted-foreground">See what your travel crew is up to</p>
        </div>
      </div>

      {/* Activity list */}
      <div className="space-y-3">
        {activities.map((activity, index) => {
          const config = activityConfig[activity.type];
          const Icon = config.icon;

          return (
            <motion.div
              key={activity.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "p-4 rounded-xl bg-gradient-to-r transition-all hover:shadow-md",
                config.gradient
              )}
            >
              <div className="flex items-start gap-3">
                {/* Friend avatar with hover preview */}
                <FriendProfileCard friendId={activity.friend.id}>
                  <button className="flex-shrink-0">
                    <Avatar className="h-11 w-11 ring-2 ring-white dark:ring-gray-800 shadow-sm cursor-pointer hover:ring-primary transition-all">
                      <AvatarImage src={activity.friend.avatar_url || undefined} />
                      <AvatarFallback className="bg-white dark:bg-gray-800">
                        {(activity.friend.display_name || activity.friend.handle || '?')[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </FriendProfileCard>

                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-semibold text-foreground">
                      {activity.friend.display_name || activity.friend.handle}
                    </span>
                    <span className="text-muted-foreground"> {config.label} </span>
                    <span className="font-semibold text-foreground">
                      {activity.trip.destination}
                      {activity.trip.destination_country ? `, ${activity.trip.destination_country}` : ''}
                    </span>
                  </p>
                  
                  <div className="flex items-center gap-3 mt-2">
                    <Badge variant={config.badgeVariant} className="gap-1 text-xs">
                      <Icon className={cn("h-3 w-3", config.iconColor)} />
                      {config.badge}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                    </span>
                  </div>

                  {/* Trip dates for upcoming/active */}
                  {(activity.type === 'upcoming' || activity.type === 'active') && (
                    <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(activity.trip.start_date), 'MMM d')} - {format(new Date(activity.trip.end_date), 'MMM d, yyyy')}
                    </p>
                  )}
                </div>

                {/* Activity type icon */}
                <div className={cn(
                  "p-2 rounded-full bg-white/80 dark:bg-gray-800/80",
                  config.iconColor
                )}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
