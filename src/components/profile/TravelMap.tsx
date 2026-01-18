import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  MapPin, 
  Plane, 
  Calendar, 
  Globe,
  CheckCircle,
  Clock,
  Stamp
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface TravelMapProps {
  userId: string;
  className?: string;
}

interface TripDestination {
  id: string;
  destination: string;
  destination_country: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
}

// Simple continent/region estimation based on country
function getRegion(country: string | null): string {
  if (!country) return 'Unknown';
  
  const countryLower = country.toLowerCase();
  
  const regions: Record<string, string[]> = {
    'Europe': ['france', 'italy', 'spain', 'germany', 'uk', 'england', 'portugal', 'greece', 'netherlands', 'belgium', 'switzerland', 'austria', 'czech', 'poland', 'sweden', 'norway', 'denmark', 'ireland', 'scotland', 'croatia', 'hungary'],
    'Asia': ['japan', 'china', 'thailand', 'vietnam', 'indonesia', 'bali', 'singapore', 'korea', 'malaysia', 'philippines', 'india', 'taiwan', 'hong kong', 'cambodia', 'laos', 'myanmar', 'sri lanka', 'nepal'],
    'Americas': ['usa', 'united states', 'canada', 'mexico', 'brazil', 'argentina', 'peru', 'colombia', 'chile', 'costa rica', 'cuba', 'jamaica', 'bahamas', 'puerto rico'],
    'Africa': ['morocco', 'egypt', 'south africa', 'kenya', 'tanzania', 'ethiopia', 'ghana', 'nigeria', 'tunisia'],
    'Oceania': ['australia', 'new zealand', 'fiji', 'tahiti', 'samoa'],
    'Middle East': ['dubai', 'uae', 'israel', 'jordan', 'turkey', 'qatar', 'oman', 'saudi'],
  };
  
  for (const [region, countries] of Object.entries(regions)) {
    if (countries.some(c => countryLower.includes(c))) {
      return region;
    }
  }
  
  return 'World';
}

const PASSPORT_STAMPS = [
  { emoji: '🗼', city: 'Paris' },
  { emoji: '🗽', city: 'New York' },
  { emoji: '🏯', city: 'Tokyo' },
  { emoji: '🎭', city: 'Venice' },
  { emoji: '🏛️', city: 'Rome' },
  { emoji: '🌴', city: 'Bali' },
  { emoji: '🏔️', city: 'Swiss Alps' },
  { emoji: '🌊', city: 'Maldives' },
];

export default function TravelMap({ userId, className }: TravelMapProps) {
  const [trips, setTrips] = useState<TripDestination[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadTrips() {
      if (!userId) return;
      
      try {
        const { data, error } = await supabase
          .from('trips')
          .select('id, destination, destination_country, status, start_date, end_date')
          .eq('user_id', userId)
          .order('start_date', { ascending: false });
        
        if (error) throw error;
        setTrips(data || []);
      } catch (error) {
        console.error('Failed to load trips:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadTrips();
  }, [userId]);

  const completedTrips = trips.filter(t => 
    t.status === 'completed' || 
    (t.end_date && new Date(t.end_date) < new Date())
  );
  
  const upcomingTrips = trips.filter(t => 
    ['booked', 'planning', 'draft'].includes(t.status) &&
    t.start_date && new Date(t.start_date) >= new Date()
  );

  // Calculate unique countries visited
  const countriesVisited = new Set(
    completedTrips
      .map(t => t.destination_country || t.destination)
      .filter(Boolean)
  );

  // Get regions visited
  const regionsVisited = new Set(
    completedTrips.map(t => getRegion(t.destination_country))
  );

  if (isLoading) {
    return (
      <div className={cn("bg-card rounded-xl border border-border p-8", className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-40 bg-muted rounded" />
          <div className="h-48 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("bg-card rounded-xl border border-border overflow-hidden", className)}
    >
      {/* Header */}
      <div className="p-6 border-b border-border bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Stamp className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-serif text-xl font-semibold text-foreground">
                Digital Passport
              </h3>
              <p className="text-sm text-muted-foreground">Your travel footprint</p>
            </div>
          </div>
          <Badge variant="secondary" className="gap-1">
            <Globe className="h-3 w-3" />
            {countriesVisited.size} countries
          </Badge>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="text-center p-3 bg-background/50 rounded-lg">
            <p className="text-2xl font-bold text-foreground">{completedTrips.length}</p>
            <p className="text-xs text-muted-foreground">Trips Completed</p>
          </div>
          <div className="text-center p-3 bg-background/50 rounded-lg">
            <p className="text-2xl font-bold text-foreground">{regionsVisited.size}</p>
            <p className="text-xs text-muted-foreground">Regions Explored</p>
          </div>
          <div className="text-center p-3 bg-background/50 rounded-lg">
            <p className="text-2xl font-bold text-foreground">{upcomingTrips.length}</p>
            <p className="text-xs text-muted-foreground">Upcoming</p>
          </div>
        </div>
      </div>

      {/* Map Visualization */}
      <div className="p-6">
        {trips.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <Globe className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground mb-2">Your passport is waiting</p>
            <p className="text-sm text-muted-foreground">
              Start planning trips to fill your travel map
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Passport Stamps Grid */}
            {completedTrips.length > 0 && (
              <div>
                <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Collected Stamps
                </h4>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-3">
                  {completedTrips.map((trip, i) => (
                    <motion.div
                      key={trip.id}
                      initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="aspect-square rounded-lg bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-900/20 dark:to-orange-900/20 border-2 border-amber-200 dark:border-amber-800 flex flex-col items-center justify-center p-2 hover:scale-105 transition-transform cursor-default"
                      title={trip.destination}
                    >
                      <span className="text-2xl">
                        {PASSPORT_STAMPS.find(s => 
                          trip.destination.toLowerCase().includes(s.city.toLowerCase())
                        )?.emoji || '📍'}
                      </span>
                      <span className="text-[10px] text-amber-800 dark:text-amber-300 font-medium truncate w-full text-center mt-1">
                        {trip.destination.split(',')[0]}
                      </span>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Upcoming Trips */}
            {upcomingTrips.length > 0 && (
              <div>
                <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
                  <Plane className="h-4 w-4 text-primary" />
                  Coming Up
                </h4>
                <div className="space-y-2">
                  {upcomingTrips.slice(0, 3).map((trip, i) => (
                    <motion.div
                      key={trip.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <MapPin className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">
                          {trip.destination}
                        </p>
                        {trip.start_date && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(trip.start_date), 'MMM d, yyyy')}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className="shrink-0">
                        <Clock className="h-3 w-3 mr-1" />
                        {trip.start_date ? 
                          `${Math.ceil((new Date(trip.start_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))} days` 
                          : 'TBD'}
                      </Badge>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 pt-4 border-t border-border">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span>Visited</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span>Upcoming</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-3 h-3 rounded-full bg-muted-foreground/30" />
                <span>Bucket List</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}