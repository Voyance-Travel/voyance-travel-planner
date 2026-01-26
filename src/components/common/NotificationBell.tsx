import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, ChevronRight, MessageSquare, Plane, Flag, Cloud, RefreshCw } from 'lucide-react';
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
  formatNotificationTime,
  type TripNotification 
} from '@/services/tripNotificationsAPI';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

// Helper to create readable name from activity ID
function humanizeActivityId(id: string): string {
  if (!id) return 'Activity';
  return id
    .replace(/_/g, ' ')
    .replace(/-/g, ' ')
    .replace(/\d+/g, '') // Remove numbers
    .replace(/:/g, '') // Remove colons from time-based IDs
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
    .trim() || 'Activity';
}

// Sanitize notification text to clean up any undefined/object issues from old data
function sanitizeNotificationText(text: string, activityId?: string): string {
  if (!text) return activityId ? humanizeActivityId(activityId) : 'Activity';
  
  // Get a readable name from the activity ID for replacements
  const activityNameFromId = activityId ? humanizeActivityId(activityId) : 'Activity';
  
  // Replace common issues from old data
  return text
    .replace(/undefined/gi, activityNameFromId)
    .replace(/\[object Object\]/gi, '')
    .replace(/Coming up: Activity$/i, `Coming up: ${activityNameFromId}`)
    .replace(/How was Activity\?/i, `How was ${activityNameFromId}?`)
    .replace(/at\s*\.\s*Time/gi, 'Time') // Clean "at . Time" 
    .replace(/at\s+Time/gi, 'Time') // Clean "at Time"
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();
}
const iconMap = {
  activity_reminder: Bell,
  weather_alert: Cloud,
  feedback_prompt: MessageSquare,
  trip_start: Plane,
  trip_end: Flag,
  activity_change: RefreshCw
};

const colorMap = {
  activity_reminder: 'text-blue-500 bg-blue-500/10',
  weather_alert: 'text-amber-500 bg-amber-500/10',
  feedback_prompt: 'text-purple-500 bg-purple-500/10',
  trip_start: 'text-emerald-500 bg-emerald-500/10',
  trip_end: 'text-rose-500 bg-rose-500/10',
  activity_change: 'text-orange-500 bg-orange-500/10'
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const { data: rawNotifications = [], isLoading } = useUserNotifications(user?.id || null);
  const dismissMutation = useDismissNotification();

  // Sanitize notifications to clean up any bad data from old notifications
  const notifications = useMemo(() => {
    return rawNotifications.map(n => ({
      ...n,
      title: sanitizeNotificationText(n.title, n.activityId),
      message: sanitizeNotificationText(n.message, n.activityId)
    }));
  }, [rawNotifications]);

  const unreadCount = notifications.filter(n => !n.sent).length;

  const handleNotificationClick = (notification: TripNotification) => {
    // Navigate to trip or activity
    if (notification.type === 'feedback_prompt' && notification.activityId) {
      navigate(`/trips/${notification.tripId}?activity=${notification.activityId}`);
    } else {
      navigate(`/trips/${notification.tripId}`);
    }
    setOpen(false);
  };

  const handleDismiss = (e: React.MouseEvent, notification: TripNotification) => {
    e.stopPropagation();
    dismissMutation.mutate({
      tripId: notification.tripId,
      notificationId: notification.id
    });
  };

  if (!user) return null;

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
          {unreadCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {unreadCount} new
            </Badge>
          )}
        </div>

        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-20">
              <div className="animate-pulse text-muted-foreground">Loading...</div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center px-4">
              <Bell className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Notifications will appear here during your trips
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => {
                const Icon = iconMap[notification.type] || Bell;
                const colorClass = colorMap[notification.type] || 'text-muted-foreground bg-muted';
                
                return (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="px-4 py-3 hover:bg-muted/50 cursor-pointer transition-colors group"
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <div className="flex gap-3">
                      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', colorClass)}>
                        <Icon className="w-4 h-4" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-medium line-clamp-1">
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
