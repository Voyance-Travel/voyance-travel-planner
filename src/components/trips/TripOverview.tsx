/**
 * TripOverview
 * Comprehensive trip overview with day progress, reservations hub, and tickets/QR access
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, MapPin, Clock, ChevronRight, Check, 
  Ticket, QrCode, Plane, Hotel, Utensils, 
  Download, ExternalLink, Copy, CalendarDays,
  Bookmark, Star, AlertCircle, Sparkles
} from 'lucide-react';
import { format, differenceInDays, isToday, isBefore, isAfter } from 'date-fns';
import { parseLocalDate } from '@/utils/dateUtils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { BookableActivity } from '@/services/bookingStateMachine';

// Types
interface Reservation {
  id: string;
  type: 'flight' | 'hotel' | 'restaurant' | 'activity' | 'transport';
  title: string;
  date: string;
  time?: string;
  confirmationNumber?: string;
  voucherUrl?: string;
  qrCode?: string;
  status: 'confirmed' | 'pending' | 'cancelled';
  vendorName?: string;
  location?: string;
  notes?: string;
}

interface DayProgress {
  dayNumber: number;
  date: string;
  theme?: string;
  activitiesTotal: number;
  activitiesCompleted: number;
  isToday: boolean;
  isPast: boolean;
}

interface SavedItem {
  id: string;
  name: string;
  category?: string;
  location?: string;
  notes?: string;
}

interface TripOverviewProps {
  tripId: string;
  tripName: string;
  destination: string;
  startDate: string;
  endDate: string;
  days: Array<{
    dayNumber: number;
    date: string;
    theme?: string;
    activities: Array<{
      id: string;
      name: string;
      category?: string;
    }>;
  }>;
  reservations?: Reservation[];
  savedItems?: SavedItem[];
  completedActivities?: Set<string>;
  onDaySelect?: (dayNumber: number) => void;
}

// Icons by reservation type
const typeIcons: Record<string, React.ElementType> = {
  flight: Plane,
  hotel: Hotel,
  restaurant: Utensils,
  activity: Ticket,
  transport: MapPin,
};

// Status colors
const statusColors: Record<string, string> = {
  confirmed: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  pending: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  cancelled: 'bg-red-500/10 text-red-600 border-red-500/30',
};

export function TripOverview({
  tripId,
  tripName,
  destination,
  startDate,
  endDate,
  days,
  reservations = [],
  savedItems = [],
  completedActivities = new Set(),
  onDaySelect,
}: TripOverviewProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'days' | 'reservations' | 'saved'>('days');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Calculate trip progress
  const tripProgress = useMemo(() => {
    const now = new Date();
    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);
    
    const totalDays = differenceInDays(end, start);
    const currentDayNumber = Math.max(1, Math.min(
      differenceInDays(now, start) + 1, 
      totalDays
    ));
    const daysRemaining = Math.max(0, differenceInDays(end, now));
    const progressPercent = (currentDayNumber / totalDays) * 100;

    return { totalDays, currentDayNumber, daysRemaining, progressPercent };
  }, [startDate, endDate]);

  // Calculate day progress for each day
  const dayProgress = useMemo((): DayProgress[] => {
    const now = new Date();
    
    return days.map(day => {
      const dayDate = parseLocalDate(day.date);
      const completed = day.activities.filter(a => completedActivities.has(a.id)).length;
      
      return {
        dayNumber: day.dayNumber,
        date: day.date,
        theme: day.theme,
        activitiesTotal: day.activities.length,
        activitiesCompleted: completed,
        isToday: isToday(dayDate),
        isPast: isBefore(dayDate, now) && !isToday(dayDate),
      };
    });
  }, [days, completedActivities]);

  // Upcoming reservations (sorted by date)
  const upcomingReservations = useMemo(() => {
    const now = new Date();
    return reservations
      .filter(r => r.status !== 'cancelled')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map(r => ({
        ...r,
        isUpcoming: isAfter(parseLocalDate(r.date), now) || isToday(parseLocalDate(r.date)),
      }));
  }, [reservations]);

  const handleCopyConfirmation = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    toast.success('Confirmation copied');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Trip Header */}
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-serif font-bold">{destination}</h2>
          <p className="text-muted-foreground">
            {format(parseLocalDate(startDate), 'MMM d')} - {format(parseLocalDate(endDate), 'MMM d, yyyy')}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              Day {tripProgress.currentDayNumber} of {tripProgress.totalDays}
            </span>
            <span className="font-medium">
              {tripProgress.daysRemaining === 0 
                ? 'Last day!' 
                : `${tripProgress.daysRemaining} day${tripProgress.daysRemaining > 1 ? 's' : ''} remaining`}
            </span>
          </div>
          <Progress value={tripProgress.progressPercent} className="h-2" />
        </div>
      </div>

      {/* Day Progress Grid */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Your Trip
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {dayProgress.map(day => (
              <button
                key={day.dayNumber}
                onClick={() => onDaySelect?.(day.dayNumber)}
                className={cn(
                  'flex-shrink-0 flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all min-w-[64px]',
                  day.isToday 
                    ? 'border-primary bg-primary/5' 
                    : day.isPast 
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-border hover:border-primary/50'
                )}
              >
                <span className="text-xs text-muted-foreground">Day</span>
                <span className={cn(
                  'text-lg font-bold',
                  day.isToday && 'text-primary'
                )}>
                  {day.dayNumber}
                </span>
                {day.isPast ? (
                  <Check className="h-4 w-4 text-emerald-500" />
                ) : day.isToday ? (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    NOW
                  </Badge>
                ) : (
                  <span className="text-[10px] text-muted-foreground">
                    {format(parseLocalDate(day.date), 'MMM d')}
                  </span>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Reservations, Tickets, Saved */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="days" className="gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            Days
          </TabsTrigger>
          <TabsTrigger value="reservations" className="gap-1.5">
            <Ticket className="h-3.5 w-3.5" />
            Reservations
            {upcomingReservations.length > 0 && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5">
                {upcomingReservations.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="saved" className="gap-1.5">
            <Bookmark className="h-3.5 w-3.5" />
            Saved
          </TabsTrigger>
        </TabsList>

        {/* Days Tab */}
        <TabsContent value="days" className="space-y-3 mt-4">
          {dayProgress.map(day => (
            <motion.div
              key={day.dayNumber}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: day.dayNumber * 0.05 }}
            >
              <Card 
                className={cn(
                  'cursor-pointer transition-all hover:shadow-md',
                  day.isToday && 'ring-2 ring-primary/50'
                )}
                onClick={() => onDaySelect?.(day.dayNumber)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center font-bold',
                        day.isPast 
                          ? 'bg-emerald-500/10 text-emerald-600' 
                          : day.isToday 
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                      )}>
                        {day.isPast ? <Check className="h-5 w-5" /> : day.dayNumber}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">
                            Day {day.dayNumber}
                          </h4>
                          {day.isToday && (
                            <Badge className="bg-primary text-primary-foreground text-[10px]">
                              Today
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {day.theme || format(parseLocalDate(day.date), 'EEEE, MMM d')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-medium">
                          {day.activitiesCompleted}/{day.activitiesTotal}
                        </p>
                        <p className="text-xs text-muted-foreground">activities</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </TabsContent>

        {/* Reservations Tab */}
        <TabsContent value="reservations" className="space-y-3 mt-4">
          {upcomingReservations.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Ticket className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                <h4 className="font-medium mb-1">No reservations yet</h4>
                <p className="text-sm text-muted-foreground">
                  Confirmed bookings will appear here
                </p>
              </CardContent>
            </Card>
          ) : (
            upcomingReservations.map((reservation, idx) => {
              const Icon = typeIcons[reservation.type] || Ticket;
              const isUpcoming = reservation.isUpcoming;
              
              return (
                <motion.div
                  key={reservation.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card className={cn(!isUpcoming && 'opacity-60')}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center',
                          reservation.status === 'confirmed' 
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-amber-500/10 text-amber-600'
                        )}>
                          <Icon className="h-5 w-5" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-medium truncate">{reservation.title}</h4>
                              <p className="text-sm text-muted-foreground">
                                {format(parseLocalDate(reservation.date), 'EEE, MMM d')}
                                {reservation.time && ` · ${reservation.time}`}
                              </p>
                            </div>
                            <Badge 
                              variant="outline" 
                              className={cn('text-[10px] flex-shrink-0', statusColors[reservation.status])}
                            >
                              {reservation.status}
                            </Badge>
                          </div>

                          {reservation.vendorName && (
                            <p className="text-xs text-muted-foreground mt-1">
                              via {reservation.vendorName}
                            </p>
                          )}

                          {/* Confirmation & Actions */}
                          {reservation.confirmationNumber && (
                            <div className="flex items-center gap-2 mt-3 p-2 bg-muted/50 rounded-lg">
                              <QrCode className="h-4 w-4 text-muted-foreground" />
                              <code className="text-xs font-mono flex-1 truncate">
                                {reservation.confirmationNumber}
                              </code>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyConfirmation(reservation.id, reservation.confirmationNumber!);
                                }}
                              >
                                {copiedId === reservation.id ? (
                                  <Check className="h-3 w-3 text-emerald-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          )}

                          {/* Actions Row */}
                          <div className="flex items-center gap-2 mt-3">
                            {reservation.qrCode && (
                              <Button size="sm" variant="outline" className="h-8 gap-1.5">
                                <QrCode className="h-3.5 w-3.5" />
                                Show QR
                              </Button>
                            )}
                            {reservation.voucherUrl && (
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-8 gap-1.5"
                                onClick={() => window.open(reservation.voucherUrl, '_blank')}
                              >
                                <Download className="h-3.5 w-3.5" />
                                Voucher
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </TabsContent>

        {/* Saved Tab */}
        <TabsContent value="saved" className="space-y-3 mt-4">
          {savedItems.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Bookmark className="h-10 w-10 mx-auto text-muted-foreground/50 mb-3" />
                <h4 className="font-medium mb-1">Nothing saved yet</h4>
                <p className="text-sm text-muted-foreground">
                  Save places for spontaneous visits
                </p>
              </CardContent>
            </Card>
          ) : (
            savedItems.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className="cursor-pointer hover:shadow-md transition-all">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                        <Star className="h-5 w-5 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium truncate">{item.name}</h4>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          {item.category && (
                            <Badge variant="outline" className="text-[10px]">
                              {item.category}
                            </Badge>
                          )}
                          {item.location && (
                            <span className="truncate">{item.location}</span>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default TripOverview;
