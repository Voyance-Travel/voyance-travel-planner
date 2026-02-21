/**
 * ProfileHotelSearchModal
 * 
 * When the user clicks "Find My Hotel" on the profile page,
 * this modal shows their upcoming trips without hotel selections
 * and lets them pick one to launch the hotel search on that trip.
 * If no trips exist, it directs them to create one.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, MapPin, Calendar, ChevronRight,
  Plane, Plus, Loader2, Hotel
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle, DialogDescription
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { parseLocalDate } from '@/utils/dateUtils';
import { getDestinationImage } from '@/utils/destinationImages';

interface TripOption {
  id: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  hasHotel: boolean;
  image: string;
  status: string;
}

interface ProfileHotelSearchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ProfileHotelSearchModal({
  open,
  onOpenChange,
}: ProfileHotelSearchModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!open || !user?.id) return;

    async function loadTrips() {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('trips')
          .select('id, destination, start_date, end_date, travelers, hotel_selection, status, metadata')
          .eq('user_id', user!.id)
          .order('start_date', { ascending: true });

        if (error) throw error;

        const now = new Date();
        const mapped: TripOption[] = (data || [])
          .filter((t: any) => {
            // Only future/current trips
            if (!t.end_date) return true;
            return parseLocalDate(t.end_date) >= now;
          })
          .map((t: any) => ({
            id: t.id,
            destination: t.destination || 'Unknown',
            startDate: t.start_date || '',
            endDate: t.end_date || '',
            travelers: t.travelers || 1,
            hasHotel: !!t.hotel_selection,
            image:
              (typeof t?.metadata?.hero_image === 'string' && t.metadata.hero_image.length > 0)
                ? t.metadata.hero_image
                : getDestinationImage(t.destination || ''),
            status: t.status || 'draft',
          }));

        setTrips(mapped);
      } catch (err) {
        console.error('Failed to load trips for hotel search:', err);
      } finally {
        setIsLoading(false);
      }
    }

    loadTrips();
  }, [open, user?.id]);

  const tripsWithoutHotels = trips.filter(t => !t.hasHotel);
  const tripsWithHotels = trips.filter(t => t.hasHotel);

  const handleSelectTrip = (tripId: string) => {
    onOpenChange(false);
    // Navigate to the trip page with a query param to auto-open hotel search
    navigate(`/trip/${tripId}?openHotelSearch=true`);
  };

  const handleCreateTrip = () => {
    onOpenChange(false);
    navigate('/start');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[85vh] p-0 gap-0">
        <DialogHeader className="p-6 pb-3">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="rounded-full bg-sky-500/10 p-2">
              <Building2 className="h-4 w-4 text-sky-600" />
            </div>
            Find My Hotel
          </DialogTitle>
          <DialogDescription>
            Pick a trip to search for the perfect hotel match
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[60vh]">
          <div className="px-6 pb-6 space-y-4">
            {isLoading && (
              <div className="py-12 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Loading your trips…</p>
              </div>
            )}

            {!isLoading && trips.length === 0 && (
              <div className="py-10 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
                  <Plane className="h-7 w-7 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">No trips yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Create a trip first, then we'll find the perfect hotel for it.
                  </p>
                </div>
                <Button onClick={handleCreateTrip} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Plan a Trip
                </Button>
              </div>
            )}

            {/* Trips needing hotels */}
            {!isLoading && tripsWithoutHotels.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                  Needs a hotel
                </p>
                <div className="space-y-2">
                  {tripsWithoutHotels.map((trip, index) => (
                    <TripOptionCard
                      key={trip.id}
                      trip={trip}
                      index={index}
                      onSelect={() => handleSelectTrip(trip.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Trips that already have hotels */}
            {!isLoading && tripsWithHotels.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                  Already has a hotel
                </p>
                <div className="space-y-2">
                  {tripsWithHotels.map((trip, index) => (
                    <TripOptionCard
                      key={trip.id}
                      trip={trip}
                      index={index}
                      onSelect={() => handleSelectTrip(trip.id)}
                      muted
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Create new trip option */}
            {!isLoading && trips.length > 0 && (
              <button
                onClick={handleCreateTrip}
                className="w-full flex items-center gap-3 p-3 rounded-xl border border-dashed border-border hover:border-primary/50 hover:bg-accent/50 transition-all group"
              >
                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                  <Plus className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-medium text-foreground">Plan a new trip</p>
                  <p className="text-xs text-muted-foreground">Start from scratch</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function TripOptionCard({
  trip,
  index,
  onSelect,
  muted = false,
}: {
  trip: TripOption;
  index: number;
  onSelect: () => void;
  muted?: boolean;
}) {
  const formattedDates = trip.startDate && trip.endDate
    ? `${format(parseLocalDate(trip.startDate), 'MMM d')} – ${format(parseLocalDate(trip.endDate), 'MMM d')}`
    : 'Dates TBD';

  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-xl border transition-all group text-left",
        muted
          ? "border-border/50 opacity-70 hover:opacity-100 hover:border-border"
          : "border-border hover:border-primary/50 hover:shadow-sm"
      )}
    >
      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
        <img
          src={trip.image}
          alt={trip.destination}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="text-sm font-semibold text-foreground truncate">
            {trip.destination}
          </h4>
          {trip.hasHotel && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-0.5">
              <Hotel className="h-2.5 w-2.5" />
              Hotel set
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
          <Calendar className="h-3 w-3" />
          {formattedDates}
        </div>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
    </motion.button>
  );
}
