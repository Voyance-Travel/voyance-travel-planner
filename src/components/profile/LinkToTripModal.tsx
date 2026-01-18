/**
 * Link to Trip Modal
 * Allows users to link a friend to one of their trips
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Plane, 
  Calendar, 
  MapPin, 
  Check, 
  Loader2,
  Users,
  Sparkles,
  Link2
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { useAddTripCollaborator, useTripCollaborators } from '@/services/tripCollaboratorsAPI';
import { cn } from '@/lib/utils';

interface LinkToTripModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  friend: {
    id: string;
    display_name: string | null;
    handle: string | null;
    avatar_url: string | null;
  };
}

interface UserTrip {
  id: string;
  name: string;
  destination: string;
  destination_country: string | null;
  start_date: string;
  end_date: string;
  status: string;
}

export default function LinkToTripModal({ open, onOpenChange, friend }: LinkToTripModalProps) {
  const [trips, setTrips] = useState<UserTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  
  const addCollaborator = useAddTripCollaborator();
  const { data: existingCollaborators } = useTripCollaborators(selectedTripId || undefined);

  // Fetch user's trips
  useEffect(() => {
    async function fetchTrips() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setLoading(true);
      const { data, error } = await supabase
        .from('trips')
        .select('id, name, destination, destination_country, start_date, end_date, status')
        .eq('user_id', user.id)
        .in('status', ['draft', 'planning', 'booked'])
        .order('start_date', { ascending: true });

      if (!error && data) {
        setTrips(data);
      }
      setLoading(false);
    }

    if (open) {
      fetchTrips();
      setSelectedTripId(null);
    }
  }, [open]);

  const handleLink = async () => {
    if (!selectedTripId) return;

    try {
      await addCollaborator.mutateAsync({
        tripId: selectedTripId,
        userId: friend.id,
        permission: 'contributor',
      });
      onOpenChange(false);
    } catch (error) {
      // Error handled in mutation
    }
  };

  const isAlreadyLinked = (tripId: string) => {
    if (selectedTripId !== tripId) return false;
    return existingCollaborators?.some(c => c.user_id === friend.id);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            Link Friend to Trip
          </DialogTitle>
          <DialogDescription>
            Include {friend.display_name || friend.handle}'s preferences when generating your itinerary
          </DialogDescription>
        </DialogHeader>

        {/* Friend preview */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-pink-50 to-purple-50 dark:from-pink-900/10 dark:to-purple-900/10 border border-pink-100 dark:border-pink-800/30">
          <Avatar className="h-12 w-12 ring-2 ring-white dark:ring-gray-800">
            <AvatarImage src={friend.avatar_url || undefined} />
            <AvatarFallback className="bg-gradient-to-br from-pink-400 to-purple-400 text-white">
              {(friend.display_name || friend.handle || '?')[0].toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold text-foreground">{friend.display_name || friend.handle}</p>
            {friend.handle && <p className="text-sm text-muted-foreground">@{friend.handle}</p>}
          </div>
        </div>

        {/* Trip selection */}
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">Select a trip:</p>
          
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : trips.length === 0 ? (
            <div className="text-center py-8 px-4 rounded-xl bg-muted/30 border-2 border-dashed border-muted">
              <Plane className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground">No upcoming trips</p>
              <p className="text-sm text-muted-foreground">Start planning a trip to link friends!</p>
            </div>
          ) : (
            <ScrollArea className="h-[240px] pr-3">
              <div className="space-y-2">
                {trips.map((trip, index) => (
                  <motion.button
                    key={trip.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => setSelectedTripId(trip.id)}
                    className={cn(
                      "w-full text-left p-4 rounded-xl border-2 transition-all",
                      selectedTripId === trip.id
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                        : "border-border hover:border-muted-foreground/50 bg-card"
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-foreground">{trip.name}</h4>
                          {selectedTripId === trip.id && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5" />
                          <span>{trip.destination}{trip.destination_country ? `, ${trip.destination_country}` : ''}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>
                            {format(new Date(trip.start_date), 'MMM d')} - {format(new Date(trip.end_date), 'MMM d, yyyy')}
                          </span>
                        </div>
                      </div>
                      <Badge 
                        variant={trip.status === 'booked' ? 'default' : 'secondary'}
                        className="capitalize"
                      >
                        {trip.status}
                      </Badge>
                    </div>
                  </motion.button>
                ))}
              </div>
            </ScrollArea>
          )}
        </div>

        {/* Info about what linking does */}
        <div className="flex items-start gap-2 p-3 rounded-lg bg-indigo-50 dark:bg-indigo-900/10 text-sm">
          <Sparkles className="h-4 w-4 text-indigo-500 mt-0.5 flex-shrink-0" />
          <p className="text-muted-foreground">
            Their travel preferences will be considered when generating your itinerary—finding experiences you'll both love!
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleLink}
            disabled={!selectedTripId || addCollaborator.isPending}
            className="gap-2 bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600"
          >
            {addCollaborator.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Users className="h-4 w-4" />
            )}
            Link to Trip
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
