/**
 * JourneyPlaylist — Connected timeline view for multi-city journey trips
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Plane, Train, Car, Ship, Bus, Calendar, MapPin, ArrowRight, 
  ChevronRight, Sparkles, Eye, Edit3, Globe, Trash2, Loader2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useTripHeroImage } from '@/hooks/useTripHeroImage';
import { getDestinationImage } from '@/utils/destinationImages';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Must match the Trip interface in TripDashboard
interface JourneyTrip {
  id: string;
  destination: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  status: string;
  travelers: number;
  hasItineraryData: boolean;
  itineraryStatus: string | null;
  journeyId: string | null;
  journeyName: string | null;
  journeyOrder: number | null;
  journeyTotalLegs: number | null;
  transitionMode: string | null;
  isPaid?: boolean;
}

interface JourneyPlaylistProps {
  journeyName: string;
  trips: JourneyTrip[];
  index: number;
  onDeleteJourney?: (tripIds: string[]) => void;
}

function getTransportIcon(mode: string | null) {
  switch (mode) {
    case 'flight': return Plane;
    case 'train': return Train;
    case 'drive':
    case 'car': return Car;
    case 'ferry': return Ship;
    case 'bus': return Bus;
    default: return ArrowRight;
  }
}

function getTransportLabel(mode: string | null, toCity: string) {
  switch (mode) {
    case 'flight': return `Flight to ${toCity}`;
    case 'train': return `Train to ${toCity}`;
    case 'drive':
    case 'car': return `Drive to ${toCity}`;
    case 'ferry': return `Ferry to ${toCity}`;
    case 'bus': return `Bus to ${toCity}`;
    default: return `→ Next: ${toCity}`;
  }
}

function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function daysBetween(start: string, end: string): number {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  return Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)));
}

function JourneyLegCard({ trip, isLast }: { trip: JourneyTrip; isLast: boolean }) {
  const navigate = useNavigate();
  const { imageUrl } = useTripHeroImage({ destination: trip.destination });
  const fallback = getDestinationImage(trip.destination.toLowerCase());
  const heroImg = imageUrl || fallback;

  const nights = trip.startDate && trip.endDate ? daysBetween(trip.startDate, trip.endDate) : 0;
  const hasItinerary = trip.hasItineraryData && trip.itineraryStatus !== 'failed';

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: (trip.journeyOrder || 0) * 0.1 }}
      onClick={() => navigate(`/trip/${trip.id}`)}
      className="group cursor-pointer flex gap-3 sm:gap-4"
    >
      {/* Timeline dot */}
      <div className="flex flex-col items-center pt-3 shrink-0">
        <div className="w-3 h-3 rounded-full bg-primary border-2 border-background ring-2 ring-primary/20" />
        {!isLast && <div className="w-0.5 flex-1 bg-border mt-1" />}
      </div>

      {/* Card */}
      <div className="flex-1 pb-4">
        <div className="rounded-xl border border-border bg-card overflow-hidden group-hover:border-primary/30 group-hover:shadow-md transition-all">
          {/* Mini hero */}
          <div className="relative h-28 sm:h-36 overflow-hidden">
            <img
              src={heroImg}
              alt={trip.destination}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

            {/* Leg badge */}
            <Badge className="absolute top-2.5 left-2.5 bg-background/80 text-foreground backdrop-blur-sm text-[10px] border-0">
              Leg {trip.journeyOrder}
            </Badge>

            <div className="absolute bottom-2.5 left-2.5 right-2.5">
              <h4 className="font-serif text-lg sm:text-xl font-semibold text-white drop-shadow-lg line-clamp-1">
                {trip.destination}
              </h4>
            </div>
          </div>

          {/* Details */}
          <div className="p-3 sm:p-4 space-y-2.5">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs sm:text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-primary/70" />
                {formatDateShort(trip.startDate)} – {formatDateShort(trip.endDate)}
              </span>
              {nights > 0 && (
                <span className="text-muted-foreground/60">
                  {nights} night{nights !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            <Button
              variant={hasItinerary ? 'default' : 'outline'}
              size="sm"
              className="w-full gap-1.5 h-9 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                navigate(hasItinerary ? `/trip/${trip.id}` : `/trip/${trip.id}?generate=true`);
              }}
            >
              {hasItinerary ? (
                <>
                  <Eye className="h-3.5 w-3.5" />
                  View Itinerary
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  Generate
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function TransportConnector({ mode, toCity }: { mode: string | null; toCity: string }) {
  const TransportIcon = getTransportIcon(mode);
  const label = getTransportLabel(mode, toCity);

  return (
    <div className="flex gap-3 sm:gap-4 -mt-3 mb-1">
      {/* Timeline line with icon */}
      <div className="flex flex-col items-center shrink-0">
        <div className="w-0.5 h-2 bg-border" />
        <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center">
          <TransportIcon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="w-0.5 h-2 bg-border" />
      </div>

      {/* Label */}
      <div className="flex items-center">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
    </div>
  );
}

export default function JourneyPlaylist({ journeyName, trips, index, onDeleteJourney }: JourneyPlaylistProps) {
  const sortedTrips = [...trips].sort((a, b) => (a.journeyOrder || 0) - (b.journeyOrder || 0));
  const [isDeleting, setIsDeleting] = useState(false);
  
  const fullStart = sortedTrips[0]?.startDate;
  const fullEnd = sortedTrips[sortedTrips.length - 1]?.endDate;
  const totalDays = fullStart && fullEnd ? daysBetween(fullStart, fullEnd) : 0;

  // Check if any leg has paid bookings
  const hasPaidLeg = trips.some(t => t.isPaid);

  const handleDeleteJourney = async () => {
    if (hasPaidLeg) {
      toast.error('Cannot delete a journey with paid bookings');
      return;
    }

    setIsDeleting(true);
    const tripIds = trips.map(t => t.id);

    try {
      // Delete all legs in the journey
      const { error } = await supabase
        .from('trips')
        .delete()
        .in('id', tripIds);

      if (error) throw error;

      toast.success(`Deleted journey: ${journeyName}`);
      onDeleteJourney?.(tripIds);
    } catch (err: any) {
      console.error('Failed to delete journey:', err);
      toast.error('Failed to delete journey');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="rounded-2xl border border-border bg-card/50 overflow-hidden"
    >
      {/* Journey Header */}
      <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-border bg-gradient-to-r from-primary/5 via-transparent to-accent/5">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <Globe className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-serif text-lg sm:text-xl font-bold text-foreground truncate">
              {journeyName}
            </h3>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-muted-foreground">
              {fullStart && fullEnd && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDateShort(fullStart)} – {formatDateShort(fullEnd)}
                </span>
              )}
              {totalDays > 0 && (
                <span>{totalDays} days</span>
              )}
              <Badge variant="secondary" className="text-[10px]">
                {sortedTrips.length} legs
              </Badge>
            </div>
          </div>

          {/* Delete Journey Button */}
          {onDeleteJourney && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  className="w-8 h-8 rounded-full bg-muted/80 flex items-center justify-center opacity-60 hover:opacity-100 hover:bg-destructive/10 transition-all shrink-0"
                  title={hasPaidLeg ? 'Cannot delete: has paid bookings' : 'Delete journey'}
                  disabled={hasPaidLeg}
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this entire journey?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete <span className="font-semibold text-foreground">{journeyName}</span> and all {sortedTrips.length} legs ({sortedTrips.map(t => t.destination).join(' → ')}). This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteJourney}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Trash2 className="h-4 w-4 mr-2" />
                    )}
                    Delete Journey
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {/* Leg Cards with Timeline */}
      <div className="px-4 sm:px-6 py-4 sm:py-5">
        {sortedTrips.map((trip, i) => (
          <div key={trip.id}>
            {/* Transport connector between legs */}
            {i > 0 && (
              <TransportConnector
                mode={trip.transitionMode}
                toCity={trip.destination}
              />
            )}
            <JourneyLegCard trip={trip} isLast={i === sortedTrips.length - 1} />
          </div>
        ))}
      </div>
    </motion.div>
  );
}
