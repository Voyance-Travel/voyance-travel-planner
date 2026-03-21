/**
 * TripOverview
 * Editorial magazine-style trip overview with day progress, reservations, and saved items
 */

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, MapPin, Clock, ChevronRight, Check, 
  Ticket, QrCode, Plane, Hotel, Utensils, 
  Download, ExternalLink, Copy,
  Bookmark, Star, AlertCircle
} from 'lucide-react';
import { format, differenceInDays, isToday, isBefore, isAfter } from 'date-fns';
import { parseLocalDate } from '@/utils/dateUtils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
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

const typeIcons: Record<string, React.ElementType> = {
  flight: Plane,
  hotel: Hotel,
  restaurant: Utensils,
  activity: Ticket,
  transport: MapPin,
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
  const [activeSection, setActiveSection] = useState<'days' | 'reservations' | 'saved'>('days');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  const tripProgress = useMemo(() => {
    const now = new Date();
    const start = parseLocalDate(startDate);
    const end = parseLocalDate(endDate);
    const totalDays = differenceInDays(end, start) + 1;
    const currentDayNumber = Math.max(1, Math.min(differenceInDays(now, start) + 1, totalDays));
    const daysRemaining = Math.max(0, differenceInDays(end, now));
    const progressPercent = (currentDayNumber / totalDays) * 100;
    return { totalDays, currentDayNumber, daysRemaining, progressPercent };
  }, [startDate, endDate]);

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

  const sections = [
    { id: 'days' as const, label: 'Days' },
    { id: 'reservations' as const, label: 'Reservations' },
    { id: 'saved' as const, label: 'Saved' },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="font-serif text-2xl font-bold">{destination}</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          {format(parseLocalDate(startDate), 'MMM d')} – {format(parseLocalDate(endDate), 'MMM d, yyyy')}
        </p>
      </div>

      {/* Progress — editorial */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
            Day {tripProgress.currentDayNumber} of {tripProgress.totalDays}
          </span>
          <span className="font-serif text-sm font-medium">
            {tripProgress.daysRemaining === 0 
              ? 'Last day!' 
              : `${tripProgress.daysRemaining} day${tripProgress.daysRemaining > 1 ? 's' : ''} remaining`}
          </span>
        </div>
        <Progress value={tripProgress.progressPercent} className="h-1.5" />
        <div className="h-px bg-gradient-to-r from-primary/20 via-border/50 to-transparent mt-6" />
      </div>

      {/* Section Navigation — pill buttons */}
      <div className="flex gap-2">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={cn(
              "px-4 py-2 rounded-full text-sm font-medium transition-all",
              activeSection === s.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {s.label}
            {s.id === 'reservations' && upcomingReservations.length > 0 && (
              <span className="ml-1.5 text-xs opacity-70">{upcomingReservations.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* Days — editorial timeline */}
      {activeSection === 'days' && (
        <div className="space-y-0">
          {dayProgress.map((day, idx) => {
            const dayData = days.find(d => d.dayNumber === day.dayNumber);
            const activities = dayData?.activities || [];

            return (
              <motion.div
                key={day.dayNumber}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
              >
                <button
                  onClick={() => setExpandedDay(expandedDay === day.dayNumber ? null : day.dayNumber)}
                  className="w-full text-left flex gap-4 py-4 border-b border-border/30 last:border-b-0 group"
                >
                  {/* Day number */}
                  <div className="shrink-0 w-10">
                    <span className={cn(
                      "font-serif text-2xl font-bold",
                      day.isToday ? "text-primary" : day.isPast ? "text-muted-foreground/40" : "text-foreground/20"
                    )}>
                      {String(day.dayNumber).padStart(2, '0')}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-serif text-base font-medium truncate">
                        {day.theme || format(parseLocalDate(day.date), 'EEEE')}
                      </span>
                      {day.isToday && (
                        <Badge className="bg-primary text-primary-foreground text-[9px] h-4 px-1.5">
                          NOW
                        </Badge>
                      )}
                      {day.isPast && (
                        <Check className="w-3.5 h-3.5 text-primary/50" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(parseLocalDate(day.date), 'MMM d')} · {day.activitiesCompleted}/{day.activitiesTotal} done
                    </p>
                  </div>

                  <ChevronRight className={cn(
                    'w-4 h-4 text-muted-foreground/30 transition-transform shrink-0 mt-1',
                    expandedDay === day.dayNumber && 'rotate-90'
                  )} />
                </button>

                <AnimatePresence>
                  {expandedDay === day.dayNumber && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="pl-14 pb-4 space-y-1.5">
                        {activities.length === 0 ? (
                          <p className="text-xs font-serif italic text-muted-foreground">Free day. Explore at your pace</p>
                        ) : activities.map((activity) => (
                          <div key={activity.id} className="flex items-center gap-2 py-1">
                            <div className={cn(
                              'w-1.5 h-1.5 rounded-full shrink-0',
                              completedActivities.has(activity.id) ? 'bg-primary/50' : 'bg-border'
                            )} />
                            <span className={cn(
                              "text-sm",
                              completedActivities.has(activity.id) && "text-muted-foreground line-through"
                            )}>
                              {activity.name}
                            </span>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Reservations — editorial */}
      {activeSection === 'reservations' && (
        <div>
          {upcomingReservations.length === 0 ? (
            <div className="text-center py-12">
              <Ticket className="h-8 w-8 mx-auto text-muted-foreground/30 mb-3" />
              <p className="font-serif text-sm italic text-muted-foreground">No reservations yet</p>
              <p className="text-xs text-muted-foreground mt-1">Confirmed bookings will appear here</p>
            </div>
          ) : (
            <div className="space-y-0">
              {upcomingReservations.map((reservation, idx) => {
                const Icon = typeIcons[reservation.type] || Ticket;
                return (
                  <motion.div
                    key={reservation.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className={cn(
                      "py-4 border-b border-border/30 last:border-b-0",
                      !reservation.isUpcoming && 'opacity-50'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Icon className="w-4 h-4 text-muted-foreground/50 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-serif text-base font-medium truncate">{reservation.title}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(parseLocalDate(reservation.date), 'EEE, MMM d')}
                          {reservation.time && ` · ${reservation.time}`}
                        </p>
                        {reservation.vendorName && (
                          <p className="font-serif text-xs italic text-muted-foreground/70 mt-1">
                            via {reservation.vendorName}
                          </p>
                        )}
                        {reservation.confirmationNumber && (
                          <div className="flex items-center gap-2 mt-2">
                            <code className="text-[11px] font-mono text-muted-foreground">
                              {reservation.confirmationNumber}
                            </code>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-5 w-5"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyConfirmation(reservation.id, reservation.confirmationNumber!);
                              }}
                            >
                              {copiedId === reservation.id ? (
                                <Check className="h-3 w-3 text-primary" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </Button>
                          </div>
                        )}
                        {(reservation.qrCode || reservation.voucherUrl) && (
                          <div className="flex items-center gap-2 mt-2">
                            {reservation.qrCode && (
                              <Button size="sm" variant="ghost" className="h-6 gap-1 text-xs rounded-full">
                                <QrCode className="h-3 w-3" /> QR
                              </Button>
                            )}
                            {reservation.voucherUrl && (
                              <Button 
                                size="sm" variant="ghost" className="h-6 gap-1 text-xs rounded-full"
                                onClick={() => window.open(reservation.voucherUrl, '_blank')}
                              >
                                <Download className="h-3 w-3" /> Voucher
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                      <Badge 
                        variant="outline" 
                        className={cn(
                          'text-[10px] shrink-0',
                          reservation.status === 'confirmed' ? 'text-primary/60 border-primary/20' : 'text-muted-foreground border-border'
                        )}
                      >
                        {reservation.status}
                      </Badge>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Saved — editorial */}
      {activeSection === 'saved' && (
        <div>
          {savedItems.length === 0 ? (
            <div className="text-center py-12">
              <Bookmark className="h-8 w-8 mx-auto text-muted-foreground/30 mb-3" />
              <p className="font-serif text-sm italic text-muted-foreground">Nothing saved yet</p>
              <p className="text-xs text-muted-foreground mt-1">Save places for spontaneous visits</p>
            </div>
          ) : (
            <div className="space-y-0">
              {savedItems.map((item, idx) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-center gap-3 py-4 border-b border-border/30 last:border-b-0 cursor-pointer group"
                >
                  <Star className="w-4 h-4 text-muted-foreground/30 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-serif text-base font-medium truncate">{item.name}</h4>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      {item.category && (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">
                          {item.category}
                        </span>
                      )}
                      {item.location && <span className="truncate">{item.location}</span>}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground/20 group-hover:text-primary transition-colors shrink-0" />
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default TripOverview;
