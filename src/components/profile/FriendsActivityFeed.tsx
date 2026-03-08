/**
 * Friends Activity Feed - Editorial Redesign
 * Clean, minimal activity stream
 */

import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { 
  Plane, 
  MapPin, 
  Calendar, 
  CheckCircle,
  Loader2,
  Users
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';
import { parseLocalDate } from '@/utils/dateUtils';
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
    ` as '*')
    .in('user_id', friendIds)
    .in('status', ['planning', 'booked', 'active', 'completed'])
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error || !trips) return [];

  // Transform to activity format
  const activities: FriendActivity[] = trips.map(trip => {
    let type: FriendActivity['type'] = 'planning';
    const startDate = parseLocalDate(trip.start_date);
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

// Activity type configurations - minimal editorial style
const activityConfig = {
  planning: {
    icon: Plane,
    label: 'is planning',
  },
  upcoming: {
    icon: Calendar,
    label: 'has booked',
  },
  active: {
    icon: MapPin,
    label: 'is traveling in',
  },
  completed: {
    icon: CheckCircle,
    label: 'visited',
  },
};

export default function FriendsActivityFeed({ userId, className, limit = 5 }: FriendsActivityFeedProps) {
  const { data: activities, isLoading } = useQuery({
    queryKey: ['friends-activity', userId, limit],
    queryFn: () => fetchFriendsActivity(limit),
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
  });

  if (isLoading) {
    return (
      <div className={cn("flex justify-center py-12", className)}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className={cn(
        "text-center py-16 border border-dashed border-border rounded-lg",
        className
      )}>
        <Users className="h-8 w-8 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-sm font-medium text-foreground mb-1">No activity yet</h3>
        <p className="text-sm text-muted-foreground">
          Your friends' travel adventures will appear here
        </p>
      </div>
    );
  }

  return (
    <div className={cn("divide-y divide-border", className)}>
      {activities.map((activity, index) => {
        const config = activityConfig[activity.type];
        const Icon = config.icon;

        return (
          <motion.div
            key={activity.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: index * 0.03 }}
            className="py-4"
          >
            <div className="flex items-start gap-4">
              {/* Friend avatar with hover preview */}
              <FriendProfileCard friendId={activity.friend.id}>
                <button className="flex-shrink-0">
                  <Avatar className="h-10 w-10 cursor-pointer hover:opacity-80 transition-opacity">
                    <AvatarImage src={activity.friend.avatar_url || undefined} />
                    <AvatarFallback className="bg-muted text-muted-foreground text-sm">
                      {(activity.friend.display_name || activity.friend.handle || '?')[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </FriendProfileCard>

              <div className="flex-1 min-w-0">
                <p className="text-sm">
                  <span className="font-medium text-foreground">
                    {activity.friend.display_name || activity.friend.handle}
                  </span>
                  <span className="text-muted-foreground"> {config.label} </span>
                  <span className="font-medium text-foreground">
                    {activity.trip.destination}
                    {activity.trip.destination_country ? `, ${activity.trip.destination_country}` : ''}
                  </span>
                </p>
                
                <div className="flex items-center gap-3 mt-1.5">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Icon className="h-3 w-3" />
                    {activity.type === 'completed' ? 'Completed' : 
                     activity.type === 'active' ? 'Traveling now' :
                     activity.type === 'upcoming' ? 'Upcoming' : 'Planning'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })}
                  </span>
                </div>

                {/* Trip dates for upcoming/active */}
                {(activity.type === 'upcoming' || activity.type === 'active') && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(parseLocalDate(activity.trip.start_date), 'MMM d')} – {format(parseLocalDate(activity.trip.end_date), 'MMM d, yyyy')}
                  </p>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
