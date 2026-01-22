import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export interface TripNotification {
  id: string;
  tripId: string;
  userId: string;
  type: 'activity_reminder' | 'weather_alert' | 'feedback_prompt' | 'trip_start' | 'trip_end' | 'activity_change';
  title: string;
  message: string;
  activityId?: string;
  activityName?: string; // Actual activity name for display
  scheduledFor: string;
  sent: boolean;
  createdAt: string;
  tripName?: string;
  destination?: string;
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

// Get all pending notifications for a user
export async function getUserNotifications(userId: string): Promise<TripNotification[]> {
  const { data, error } = await supabase.functions.invoke('trip-notifications', {
    body: {
      action: 'get-user-notifications',
      userId
    }
  });

  if (error) {
    console.error('Failed to get notifications:', error);
    throw error;
  }

  return data?.notifications || [];
}

// Mark a notification as sent/dismissed
export async function dismissNotification(tripId: string, notificationId: string): Promise<void> {
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
    refetchInterval: 60000, // Refetch every minute
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
    mutationFn: ({ tripId, notificationId }: { tripId: string; notificationId: string }) => 
      dismissNotification(tripId, notificationId),
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
  }
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
