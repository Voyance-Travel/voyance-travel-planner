import { useState, useMemo, useEffect } from 'react';
import { registerSubscription, unregisterSubscription } from '@/lib/realtimeSubscriptionManager';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, ChevronRight, MessageSquare, Plane, Flag, Cloud, RefreshCw, UserPlus, Check, CheckCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useAuth } from '@/contexts/AuthContext';
import { 
  useUserNotifications, 
  useDismissNotification,
  useMarkAllAsRead,
  formatNotificationTime,
  type TripNotification 
} from '@/services/tripNotificationsAPI';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

// Helper to create readable name from activity ID
function humanizeActivityId(id: string): string {
  if (!id) return 'Activity';
  return id
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\d+/g, '')
    .replace(/:/g, '')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim() || 'Activity';
}

// Sanitize notification text to clean up any undefined/object issues from old data
function sanitizeNotificationText(text: string, activityId?: string): string {
  if (!text) return activityId ? humanizeActivityId(activityId) : 'Activity';
  
  const activityNameFromId = activityId ? humanizeActivityId(activityId) : 'Activity';
  
  return text
    .replace(/undefined/gi, activityNameFromId)
    .replace(/\[object Object\]/gi, '')
    .replace(/Coming up: Activity$/i, `Coming up: ${activityNameFromId}`)
    .replace(/How was Activity\?/i, `How was ${activityNameFromId}?`)
    .replace(/at\s*\.\s*Time/gi, 'Time')
    .replace(/at\s+Time/gi, 'Time')
    .replace(/\s+/g, ' ')
    .trim();
}

const iconMap: Record<string, typeof Bell> = {
  activity_reminder: Bell,
  weather_alert: Cloud,
  feedback_prompt: MessageSquare,
  trip_start: Plane,
  trip_end: Flag,
  activity_change: RefreshCw,
  friend_request: UserPlus,
  trip_invite: UserPlus,
  proposal_created: MessageSquare,
  member_joined: UserPlus,
  proposal_decided: Flag,
};

const colorMap: Record<string, string> = {
  activity_reminder: 'text-blue-500 bg-blue-500/10',
  weather_alert: 'text-amber-500 bg-amber-500/10',
  feedback_prompt: 'text-purple-500 bg-purple-500/10',
  trip_start: 'text-emerald-500 bg-emerald-500/10',
  trip_end: 'text-rose-500 bg-rose-500/10',
  activity_change: 'text-orange-500 bg-orange-500/10',
  friend_request: 'text-primary bg-primary/10',
  trip_invite: 'text-emerald-500 bg-emerald-500/10',
  proposal_created: 'text-violet-500 bg-violet-500/10',
  member_joined: 'text-emerald-500 bg-emerald-500/10',
  proposal_decided: 'text-orange-500 bg-orange-500/10',
};

interface FriendRequest {
  id: string;
  requester_id: string;
  created_at: string;
  requesterName: string;
  requesterHandle?: string;
  requesterAvatar?: string;
}

function usePendingFriendRequests(userId: string | null) {
  return useQuery({
    queryKey: ['pending-friend-requests', userId],
    queryFn: async (): Promise<FriendRequest[]> => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('friendships')
        .select('id, requester_id, created_at')
        .eq('addressee_id', userId)
        .eq('status', 'pending');
      
      if (error) {
        console.error('Failed to fetch friend requests:', error);
        return [];
      }
      
      if (!data || data.length === 0) return [];
      
      const requesterIds = data.map(r => r.requester_id);
      // Query profiles directly (not profiles_friends view) because the requester
      // may not have a handle set yet, and the view filters WHERE handle IS NOT NULL.
      // RLS on profiles already allows viewing pending friend request senders.
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, handle, avatar_url')
        .in('id', requesterIds);
      
      const profileMap = new Map(
        (profiles || []).map(p => [p.id, p])
      );
      
      return data.map(r => {
        const profile = profileMap.get(r.requester_id);
        return {
          id: r.id,
          requester_id: r.requester_id,
          created_at: r.created_at,
          requesterName: profile?.display_name || 'Someone',
          requesterHandle: profile?.handle || undefined,
          requesterAvatar: profile?.avatar_url || undefined,
        };
      });
    },
    enabled: !!userId,
    refetchInterval: 60000,
    staleTime: 30000,
  });
}

function useRespondToFriendRequest() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ requestId, response }: { requestId: string; response: 'accepted' | 'declined' }) => {
      const { error } = await supabase
        .from('friendships')
        .update({ status: response, updated_at: new Date().toISOString() })
        .eq('id', requestId);
      
      if (error) throw error;
    },
    onSuccess: (_, { response }) => {
      queryClient.invalidateQueries({ queryKey: ['pending-friend-requests'] });
      queryClient.invalidateQueries({ queryKey: ['friendships'] });
      toast.success(response === 'accepted' ? 'Friend request accepted!' : 'Friend request declined');
    },
    onError: () => {
      toast.error('Failed to respond to friend request');
    },
  });
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const { data: rawNotifications = [], isLoading } = useUserNotifications(user?.id || null);
  const { data: friendRequests = [], isLoading: friendRequestsLoading } = usePendingFriendRequests(user?.id || null);
  const dismissMutation = useDismissNotification();
  const markAllReadMutation = useMarkAllAsRead();
  const respondMutation = useRespondToFriendRequest();

  // Realtime subscription via the subscription manager
  useEffect(() => {
    if (!user?.id) return;

    const key = `notifications-${user.id}`;
    registerSubscription(key, () =>
      supabase
        .channel(key)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'trip_notifications',
            filter: `user_id=eq.${user.id}`,
          },
          () => {
            queryClient.invalidateQueries({ queryKey: ['user-notifications', user.id] });
          }
        )
        .subscribe()
    );

    return () => {
      unregisterSubscription(key);
    };
  }, [user?.id, queryClient]);

  // Sanitize notifications and filter out dismissed ones
  const notifications = useMemo(() => {
    return rawNotifications
      .filter(n => !dismissedIds.has(n.id))
      .map(n => ({
        ...n,
        title: sanitizeNotificationText(n.title, n.activityId),
        message: sanitizeNotificationText(n.message, n.activityId)
      }));
  }, [rawNotifications, dismissedIds]);

  const unreadCount = notifications.filter(n => !n.read && !n.sent).length + friendRequests.length;

  const handleNotificationClick = (notification: TripNotification) => {
    // Mark as read
    if (!notification.read && !notification.sent) {
      dismissMutation.mutate({
        tripId: notification.tripId,
        notificationId: notification.id,
        source: notification.source,
      });
    }
    
    // Navigate to trip
    if (notification.type === 'feedback_prompt' && notification.activityId) {
      navigate(`/trip/${notification.tripId}?activity=${notification.activityId}`);
    } else if (notification.type === 'member_joined') {
      // Prompt group unlock when owner clicks a member_joined notification
      navigate(`/trip/${notification.tripId}?groupUnlock=true`);
    } else {
      navigate(`/trip/${notification.tripId}`);
    }
    setOpen(false);
  };

  const handleDismiss = (e: React.MouseEvent, notification: TripNotification) => {
    e.stopPropagation();
    dismissMutation.mutate({
      tripId: notification.tripId,
      notificationId: notification.id,
      source: notification.source,
    });
  };

  const handleMarkAllRead = () => {
    if (user?.id) {
      markAllReadMutation.mutate(user.id);
    }
  };

  const handleFriendResponse = (e: React.MouseEvent, requestId: string, response: 'accepted' | 'declined') => {
    e.stopPropagation();
    respondMutation.mutate({ requestId, response });
  };

  if (!user) return null;

  const allLoading = isLoading && friendRequestsLoading;
  const hasContent = notifications.length > 0 || friendRequests.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          <AnimatePresence>
            {unreadCount > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center"
              >
                <span className="text-[10px] font-bold text-primary-foreground">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold">Notifications</h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                  onClick={handleMarkAllRead}
                  disabled={markAllReadMutation.isPending}
                >
                  <CheckCheck className="h-3 w-3 mr-1" />
                  Read all
                </Button>
                <Badge variant="secondary" className="text-xs">
                  {unreadCount} new
                </Badge>
              </>
            )}
          </div>
        </div>

        <ScrollArea className="h-[300px]">
          {allLoading ? (
            <div className="flex items-center justify-center h-20">
              <div className="animate-pulse text-muted-foreground">Loading...</div>
            </div>
          ) : !hasContent ? (
            <div className="flex flex-col items-center justify-center h-32 text-center px-4">
              <Bell className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Notifications will appear here during your trips
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {/* Friend Requests - shown first */}
              {friendRequests.map((request) => (
                <motion.div
                  key={`fr-${request.id}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="px-4 py-3 hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex gap-3">
                    <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', colorMap.friend_request)}>
                      <UserPlus className="w-4 h-4" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium line-clamp-1">
                        Friend Request from {request.requesterName}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <span className="font-medium text-foreground">{request.requesterName}</span>{request.requesterHandle ? ` (@${request.requesterHandle})` : ''} wants to connect
                      </p>
                      
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="default"
                          className="h-6 px-3 text-xs gap-1"
                          disabled={respondMutation.isPending}
                          onClick={(e) => handleFriendResponse(e, request.id, 'accepted')}
                        >
                          <Check className="h-3 w-3" />
                          Accept
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-3 text-xs"
                          disabled={respondMutation.isPending}
                          onClick={(e) => handleFriendResponse(e, request.id, 'declined')}
                        >
                          Decline
                        </Button>
                        <span className="text-[10px] text-muted-foreground/60 ml-auto">
                          {formatNotificationTime(request.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
              
              {/* Trip Notifications */}
              {notifications.map((notification) => {
                const Icon = iconMap[notification.type] || Bell;
                const colorClass = colorMap[notification.type] || 'text-muted-foreground bg-muted';
                const isRead = notification.read || notification.sent;
                
                return (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors group",
                      !isRead && "bg-primary/5"
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex gap-3">
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', colorClass)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={cn("text-sm line-clamp-1", !isRead ? "font-semibold" : "font-medium")}>
                            {notification.title}
                          </p>
                          <button
                            onClick={(e) => handleDismiss(e, notification)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
                          >
                            <X className="w-3 h-3 text-muted-foreground" />
                          </button>
                        </div>
                        
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                          {notification.message}
                        </p>
                        
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-muted-foreground/60">
                            {notification.tripName || notification.destination}
                          </span>
                          <span className="text-[10px] text-muted-foreground/60">•</span>
                          <span className="text-[10px] text-muted-foreground/60">
                            {formatNotificationTime(notification.scheduledFor)}
                          </span>
                          {!isRead && (
                            <span className="ml-auto w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                          )}
                        </div>
                      </div>
                      
                      <ChevronRight className="w-4 h-4 text-muted-foreground/50 flex-shrink-0 self-center" />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

export default NotificationBell;
