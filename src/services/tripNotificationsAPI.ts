import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface TripNotification {
  id: string;
  tripId: string;
  userId: string;
  type: 'activity_reminder' | 'weather_alert' | 'feedback_prompt' | 'trip_start' | 'trip_end' | 'activity_change' | 'trip_invite' | 'proposal_created' | 'member_joined' | 'proposal_decided';
  title: string;
  message: string;
  activityId?: string;
  activityName?: string;
  scheduledFor: string;
  sent: boolean;
  read: boolean;
  createdAt: string;
  tripName?: string;
  destination?: string;
  source: 'edge' | 'db';
}

// Schedule notifications for a trip when it becomes active
export async function scheduleTripNotifications(tripId: string, userId: string): Promise<TripNotification[]> {
  const { data, error } = await supabase.functions.invoke('trip-notifications', {
    body: {
      action: 'schedule',
      tripId,
      userId
    }
  });

  if (error) {
    console.error('Failed to schedule notifications:', error);
    throw error;
  }

  return data?.notifications || [];
}

// Get all pending notifications for a user from the edge function
async function getEdgeFunctionNotifications(userId: string): Promise<TripNotification[]> {
  try {
    const { data, error } = await supabase.functions.invoke('trip-notifications', {
      body: {
        action: 'get-user-notifications',
        userId
      }
    });

    if (error) {
      console.error('Failed to get edge function notifications:', error);
      return [];
    }

    return (data?.notifications || []).map((n: any) => ({
      ...n,
      read: n.sent || false,
      source: 'edge' as const,
    }));
  } catch {
    return [];
  }
}

// Get collaboration notifications from the trip_notifications table
async function getDbNotifications(userId: string): Promise<TripNotification[]> {
  const { data, error } = await supabase
    .from('trip_notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('Failed to get DB notifications:', error);
    return [];
  }

  return (data || []).map((n: any) => ({
    id: n.id,
    tripId: n.trip_id,
    userId: n.user_id,
    type: n.notification_type,
    title: n.metadata?.title || n.notification_type,
    message: n.metadata?.message || '',
    activityId: n.metadata?.activityId,
    activityName: n.metadata?.activityName,
    scheduledFor: n.scheduled_for || n.created_at,
    sent: n.sent || false,
    read: n.read || false,
    createdAt: n.created_at,
    tripName: n.metadata?.tripName,
    destination: n.metadata?.destination,
    source: 'db' as const,
  }));
}

// Get merged notifications from both sources
export async function getUserNotifications(userId: string): Promise<TripNotification[]> {
  const [edgeNotifs, dbNotifs] = await Promise.all([
    getEdgeFunctionNotifications(userId),
    getDbNotifications(userId),
  ]);

  // Merge & dedupe by id, sort by scheduledFor desc
  const map = new Map<string, TripNotification>();
  for (const n of [...edgeNotifs, ...dbNotifs]) {
    if (!map.has(n.id)) {
      map.set(n.id, n);
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => new Date(b.scheduledFor).getTime() - new Date(a.scheduledFor).getTime()
  );
}

// Mark a notification as read/dismissed
export async function dismissNotification(tripId: string, notificationId: string, source: 'edge' | 'db' = 'edge'): Promise<void> {
  if (source === 'db') {
    const { error } = await supabase
      .from('trip_notifications')
      .update({ read: true, sent: true })
      .eq('id', notificationId);

    if (error) {
      console.error('Failed to dismiss DB notification:', error);
      throw error;
    }
    return;
  }

  const { error } = await supabase.functions.invoke('trip-notifications', {
    body: {
      action: 'mark-sent',
      tripId,
      notificationId
    }
  });

  if (error) {
    console.error('Failed to dismiss notification:', error);
    throw error;
  }
}

// Mark all notifications as read
export async function markAllAsRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('trip_notifications')
    .update({ read: true, sent: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) {
    console.error('Failed to mark all as read:', error);
    throw error;
  }
}

// Get due notifications (for background processing)
export async function getDueNotifications(): Promise<{ tripId: string; notification: TripNotification }[]> {
  const { data, error } = await supabase.functions.invoke('trip-notifications', {
    body: {
      action: 'get-due'
    }
  });

  if (error) {
    console.error('Failed to get due notifications:', error);
    throw error;
  }

  return data?.notifications || [];
}

// React Query Hooks
export function useUserNotifications(userId: string | null) {
  return useQuery({
    queryKey: ['user-notifications', userId],
    queryFn: () => userId ? getUserNotifications(userId) : [],
    enabled: !!userId,
    refetchInterval: 60000,
    staleTime: 30000
  });
}

export function useScheduleNotifications() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tripId, userId }: { tripId: string; userId: string }) => 
      scheduleTripNotifications(tripId, userId),
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['user-notifications', userId] });
    }
  });
}

export function useDismissNotification() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ tripId, notificationId, source }: { tripId: string; notificationId: string; source?: 'edge' | 'db' }) => 
      dismissNotification(tripId, notificationId, source),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-notifications'] });
    }
  });
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (userId: string) => markAllAsRead(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-notifications'] });
    }
  });
}

// Notification type icons and colors
export const NOTIFICATION_CONFIG = {
  activity_reminder: {
    icon: 'Bell',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10'
  },
  weather_alert: {
    icon: 'Cloud',
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10'
  },
  feedback_prompt: {
    icon: 'MessageSquare',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10'
  },
  trip_start: {
    icon: 'Plane',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10'
  },
  trip_end: {
    icon: 'Flag',
    color: 'text-rose-500',
    bgColor: 'bg-rose-500/10'
  },
  activity_change: {
    icon: 'RefreshCw',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10'
  },
  trip_invite: {
    icon: 'UserPlus',
    color: 'text-primary',
    bgColor: 'bg-primary/10'
  },
  proposal_created: {
    icon: 'MessageSquare',
    color: 'text-violet-500',
    bgColor: 'bg-violet-500/10'
  },
  member_joined: {
    icon: 'UserPlus',
    color: 'text-emerald-500',
    bgColor: 'bg-emerald-500/10'
  },
  proposal_decided: {
    icon: 'Flag',
    color: 'text-orange-500',
    bgColor: 'bg-orange-500/10'
  },
};

// Format notification time relative to now
export function formatNotificationTime(scheduledFor: string): string {
  const scheduled = new Date(scheduledFor);
  const now = new Date();
  const diffMs = scheduled.getTime() - now.getTime();
  const diffMins = Math.round(diffMs / (1000 * 60));
  
  if (diffMins < 0) {
    const absMins = Math.abs(diffMins);
    if (absMins < 60) return `${absMins}m ago`;
    if (absMins < 1440) return `${Math.round(absMins / 60)}h ago`;
    return `${Math.round(absMins / 1440)}d ago`;
  }
  
  if (diffMins < 60) return `in ${diffMins}m`;
  if (diffMins < 1440) return `in ${Math.round(diffMins / 60)}h`;
  return `in ${Math.round(diffMins / 1440)}d`;
}
