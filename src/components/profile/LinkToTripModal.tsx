/**
 * Link to Trip Modal - Editorial Redesign
 * Clean, sophisticated trip selection with Travel DNA blend toggle
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
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
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Plane, 
  Calendar, 
  MapPin, 
  Check, 
  Loader2,
  Users,
  Info,
  Dna
} from 'lucide-react';
import { format } from 'date-fns';
import { parseLocalDate } from '@/utils/dateUtils';
import { supabase } from '@/integrations/supabase/client';
import { useAddTripCollaborator, useTripCollaborators } from '@/services/tripCollaboratorsAPI';
import { cn } from '@/lib/utils';
import { fetchTravelDNA, calculateGuestCompatibility } from '@/utils/travelDNACompatibility';

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
  const [includePreferences, setIncludePreferences] = useState(true);
  const [friendHasDNA, setFriendHasDNA] = useState<boolean | null>(null);
  const [compatibilityScore, setCompatibilityScore] = useState<number | null>(null);
  
  const addCollaborator = useAddTripCollaborator();
  const { data: existingCollaborators } = useTripCollaborators(selectedTripId || undefined);

  // Fetch user's trips
  useEffect(() => {
    async function fetchTrips() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('trips')
        .select('id, name, destination, destination_country, start_date, end_date, status')
        .eq('user_id', user.id)
        .in('status', ['draft', 'planning', 'booked'])
        .gte('end_date', today)
        .order('start_date', { ascending: true });

      if (!error && data) {
        setTrips(data);
      }
      setLoading(false);
    }

    if (open) {
      fetchTrips();
      setSelectedTripId(null);
      setIncludePreferences(true);
      
      // Check if friend has Travel DNA
      async function checkFriendDNA() {
        const dna = await fetchTravelDNA(friend.id);
        setFriendHasDNA(!!dna?.trait_scores);
        
        // Calculate compatibility if friend has DNA
        if (dna?.trait_scores) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const score = await calculateGuestCompatibility(user.id, friend.id);
            setCompatibilityScore(score);
          }
        }
      }
      checkFriendDNA();
    }
  }, [open, friend.id]);

  const handleLink = async () => {
    if (!selectedTripId) return;

    try {
      await addCollaborator.mutateAsync({
        tripId: selectedTripId,
        userId: friend.id,
        permission: 'edit',
        includePreferences,
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-medium">
            Link to Trip
          </DialogTitle>
          <DialogDescription className="text-sm">
            Include their preferences when generating your itinerary
          </DialogDescription>
        </DialogHeader>

        {/* Friend preview with compatibility */}
        <div className="flex items-center justify-between py-3 border-b border-border">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={friend.avatar_url || undefined} />
              <AvatarFallback className="bg-muted text-muted-foreground">
                {(friend.display_name || friend.handle || '?')[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium text-foreground">{friend.display_name || friend.handle}</p>
              {friend.handle && <p className="text-xs text-muted-foreground">@{friend.handle}</p>}
            </div>
          </div>
          {compatibilityScore !== null && (
            <Badge variant="secondary" className="text-xs gap-1">
              <Dna className="h-3 w-3" />
              {compatibilityScore}% match
            </Badge>
          )}
        </div>

        {/* Travel DNA blend toggle */}
        <div className="flex items-center justify-between py-3 border-b border-border">
          <div className="space-y-0.5">
            <Label htmlFor="blend-toggle" className="text-sm font-medium flex items-center gap-2">
              <Dna className="h-4 w-4 text-primary" />
              Include Travel DNA
            </Label>
            <p className="text-xs text-muted-foreground">
              {friendHasDNA === false 
                ? `${friend.display_name || 'They'} hasn't completed the quiz yet`
                : 'Blend their preferences when generating itinerary'
              }
            </p>
          </div>
          <Switch
            id="blend-toggle"
            checked={includePreferences}
            onCheckedChange={setIncludePreferences}
            disabled={friendHasDNA === false}
          />
        </div>

        {/* Trip selection */}
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Select a trip</p>
          
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : trips.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-border rounded-lg">
              <Plane className="h-6 w-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No upcoming trips</p>
              <p className="text-xs text-muted-foreground">Start planning a trip to link friends</p>
            </div>
          ) : (
            <ScrollArea className="h-[200px]">
              <div className="space-y-2 pr-3">
                {trips.map((trip, index) => (
                  <motion.button
                    key={trip.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.03 }}
                    onClick={() => setSelectedTripId(trip.id)}
                    className={cn(
                      "w-full text-left p-3 rounded-lg border transition-all",
                      selectedTripId === trip.id
                        ? "border-foreground bg-muted/50"
                        : "border-border hover:border-muted-foreground/50"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium text-foreground truncate">{trip.name}</h4>
                          {selectedTripId === trip.id && (
                            <Check className="h-4 w-4 text-foreground flex-shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{trip.destination}{trip.destination_country ? `, ${trip.destination_country}` : ''}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {format(parseLocalDate(trip.start_date), 'MMM d')} – {format(parseLocalDate(trip.end_date), 'MMM d, yyyy')}
                          </span>
                        </div>
                      </div>
                      <Badge 
                        variant="outline"
                        className="capitalize text-xs font-normal flex-shrink-0"
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

        {/* Info note */}
        <div className="flex items-start gap-2 py-3 border-t border-border text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
          <p>
            Their travel preferences will be considered when generating your itinerary.
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleLink}
            disabled={!selectedTripId || addCollaborator.isPending}
          >
            {addCollaborator.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : (
              <Users className="h-4 w-4 mr-1.5" />
            )}
            Link
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
