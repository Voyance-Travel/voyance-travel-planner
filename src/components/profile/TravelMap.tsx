import { useState, useEffect, useMemo } from 'react';
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
import { isDemoModeEnabled } from '@/contexts/AuthContext';

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

// Approximate coordinates for major cities/countries for the world map
const LOCATION_COORDS: Record<string, { x: number; y: number }> = {
  // Cities
  'paris': { x: 48, y: 28 },
  'london': { x: 47, y: 25 },
  'rome': { x: 51, y: 32 },
  'tokyo': { x: 82, y: 35 },
  'kyoto': { x: 81, y: 36 },
  'osaka': { x: 81, y: 37 },
  'new york': { x: 25, y: 32 },
  'los angeles': { x: 12, y: 36 },
  'san francisco': { x: 10, y: 34 },
  'bali': { x: 76, y: 58 },
  'sydney': { x: 88, y: 72 },
  'melbourne': { x: 86, y: 74 },
  'dubai': { x: 62, y: 42 },
  'singapore': { x: 74, y: 52 },
  'bangkok': { x: 72, y: 46 },
  'hong kong': { x: 76, y: 42 },
  'seoul': { x: 80, y: 34 },
  'barcelona': { x: 47, y: 32 },
  'amsterdam': { x: 49, y: 24 },
  'berlin': { x: 52, y: 24 },
  'vienna': { x: 53, y: 28 },
  'prague': { x: 52, y: 26 },
  'lisbon': { x: 43, y: 34 },
  'madrid': { x: 45, y: 32 },
  'venice': { x: 51, y: 30 },
  'florence': { x: 50, y: 32 },
  'milan': { x: 50, y: 30 },
  'athens': { x: 55, y: 36 },
  'istanbul': { x: 58, y: 32 },
  'cairo': { x: 58, y: 42 },
  'marrakech': { x: 44, y: 40 },
  'cape town': { x: 54, y: 72 },
  'nairobi': { x: 60, y: 52 },
  'mumbai': { x: 68, y: 44 },
  'delhi': { x: 68, y: 40 },
  'maldives': { x: 68, y: 52 },
  'phuket': { x: 72, y: 50 },
  'hanoi': { x: 74, y: 44 },
  'ho chi minh': { x: 74, y: 50 },
  'reykjavik': { x: 38, y: 16 },
  'mexico city': { x: 18, y: 44 },
  'cancun': { x: 22, y: 44 },
  'rio de janeiro': { x: 34, y: 64 },
  'buenos aires': { x: 30, y: 72 },
  'santorini': { x: 56, y: 35 },
  'mykonos': { x: 56, y: 34 },
  'amalfi': { x: 52, y: 33 },
  'swiss alps': { x: 50, y: 28 },
  'zurich': { x: 50, y: 28 },
  'queenstown': { x: 92, y: 76 },
  'fiji': { x: 95, y: 60 },
  'tahiti': { x: 5, y: 60 },
  // Countries (center points)
  'france': { x: 47, y: 30 },
  'italy': { x: 51, y: 32 },
  'spain': { x: 45, y: 33 },
  'germany': { x: 51, y: 26 },
  'uk': { x: 46, y: 24 },
  'japan': { x: 82, y: 36 },
  'usa': { x: 20, y: 35 },
  'australia': { x: 85, y: 68 },
  'thailand': { x: 72, y: 48 },
  'indonesia': { x: 76, y: 56 },
  'vietnam': { x: 74, y: 46 },
  'india': { x: 68, y: 44 },
  'brazil': { x: 32, y: 58 },
  'mexico': { x: 18, y: 44 },
  'greece': { x: 55, y: 35 },
  'portugal': { x: 43, y: 34 },
  'netherlands': { x: 49, y: 24 },
  'morocco': { x: 44, y: 40 },
  'egypt': { x: 58, y: 42 },
  'south africa': { x: 56, y: 70 },
  'new zealand': { x: 94, y: 76 },
  'canada': { x: 22, y: 22 },
  'argentina': { x: 28, y: 72 },
  'peru': { x: 24, y: 58 },
  'chile': { x: 26, y: 68 },
  'colombia': { x: 24, y: 50 },
  'costa rica': { x: 22, y: 48 },
  'iceland': { x: 38, y: 16 },
  'norway': { x: 50, y: 18 },
  'sweden': { x: 52, y: 18 },
  'finland': { x: 56, y: 16 },
  'russia': { x: 70, y: 20 },
  'china': { x: 74, y: 36 },
  'korea': { x: 80, y: 34 },
  'malaysia': { x: 74, y: 52 },
  'philippines': { x: 78, y: 48 },
  'uae': { x: 62, y: 42 },
  'israel': { x: 58, y: 40 },
  'jordan': { x: 58, y: 40 },
  'turkey': { x: 58, y: 34 },
  'croatia': { x: 52, y: 30 },
  'kenya': { x: 60, y: 52 },
  'tanzania': { x: 60, y: 56 },
};

function getCoordinates(destination: string): { x: number; y: number } | null {
  const lower = destination.toLowerCase();
  
  // Try exact match first
  for (const [key, coords] of Object.entries(LOCATION_COORDS)) {
    if (lower.includes(key)) {
      return coords;
    }
  }
  
  return null;
}

// Demo trips for preview mode
const DEMO_TRIPS: TripDestination[] = [
  { id: 'demo-1', destination: 'Tokyo', destination_country: 'Japan', status: 'completed', start_date: '2024-03-15', end_date: '2024-03-25' },
  { id: 'demo-2', destination: 'Paris', destination_country: 'France', status: 'completed', start_date: '2024-06-01', end_date: '2024-06-10' },
  { id: 'demo-3', destination: 'Bali', destination_country: 'Indonesia', status: 'completed', start_date: '2024-09-10', end_date: '2024-09-20' },
  { id: 'demo-4', destination: 'Rome', destination_country: 'Italy', status: 'completed', start_date: '2023-11-05', end_date: '2023-11-12' },
  { id: 'demo-5', destination: 'New York', destination_country: 'USA', status: 'completed', start_date: '2023-05-20', end_date: '2023-05-27' },
  { id: 'demo-6', destination: 'Barcelona', destination_country: 'Spain', status: 'booked', start_date: '2026-04-15', end_date: '2026-04-22' },
  { id: 'demo-7', destination: 'Santorini', destination_country: 'Greece', status: 'planning', start_date: '2026-07-01', end_date: '2026-07-08' },
];

const PASSPORT_STAMPS = [
  { emoji: '🗼', city: 'Paris' },
  { emoji: '🗽', city: 'New York' },
  { emoji: '🏯', city: 'Tokyo' },
  { emoji: '🎭', city: 'Venice' },
  { emoji: '🏛️', city: 'Rome' },
  { emoji: '🌴', city: 'Bali' },
  { emoji: '🏔️', city: 'Swiss Alps' },
  { emoji: '🌊', city: 'Maldives' },
  { emoji: '🏖️', city: 'Barcelona' },
  { emoji: '🌅', city: 'Santorini' },
  { emoji: '🎡', city: 'London' },
  { emoji: '⛩️', city: 'Kyoto' },
];

export default function TravelMap({ userId, className }: TravelMapProps) {
  const [trips, setTrips] = useState<TripDestination[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const isDemo = isDemoModeEnabled();

  useEffect(() => {
    async function loadTrips() {
      // Use demo data in demo mode
      if (isDemo) {
        setTrips(DEMO_TRIPS);
        setIsLoading(false);
        return;
      }

      if (!userId || userId === 'demo-user-001') {
        setTrips(DEMO_TRIPS);
        setIsLoading(false);
        return;
      }
      
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
        // Fallback to demo data on error
        setTrips(DEMO_TRIPS);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadTrips();
  }, [userId, isDemo]);

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

  // Get map pins with coordinates
  const mapPins = useMemo(() => {
    const pins: Array<{ trip: TripDestination; coords: { x: number; y: number }; type: 'visited' | 'upcoming' }> = [];
    
    completedTrips.forEach(trip => {
      const coords = getCoordinates(trip.destination) || getCoordinates(trip.destination_country || '');
      if (coords) {
        pins.push({ trip, coords, type: 'visited' });
      }
    });
    
    upcomingTrips.forEach(trip => {
      const coords = getCoordinates(trip.destination) || getCoordinates(trip.destination_country || '');
      if (coords) {
        pins.push({ trip, coords, type: 'upcoming' });
      }
    });
    
    return pins;
  }, [completedTrips, upcomingTrips]);

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
              <Globe className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-serif text-xl font-semibold text-foreground">
                Travel Map
              </h3>
              <p className="text-sm text-muted-foreground">Your journey around the world</p>
            </div>
          </div>
          <Badge variant="secondary" className="gap-1">
            <MapPin className="h-3 w-3" />
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
            <p className="text-2xl font-bold text-foreground">{mapPins.filter(p => p.type === 'visited').length}</p>
            <p className="text-xs text-muted-foreground">Places Visited</p>
          </div>
          <div className="text-center p-3 bg-background/50 rounded-lg">
            <p className="text-2xl font-bold text-foreground">{upcomingTrips.length}</p>
            <p className="text-xs text-muted-foreground">Upcoming</p>
          </div>
        </div>
      </div>

      {/* World Map Visualization */}
      <div className="p-6">
        {/* SVG World Map */}
        <div className="relative w-full aspect-[2/1] bg-gradient-to-b from-blue-50 to-blue-100 dark:from-blue-950/20 dark:to-blue-900/20 rounded-xl overflow-hidden mb-6">
          {/* Simple world map outline using SVG */}
          <svg 
            viewBox="0 0 100 50" 
            className="absolute inset-0 w-full h-full"
            preserveAspectRatio="xMidYMid slice"
          >
            {/* Continents as simplified shapes */}
            <defs>
              <linearGradient id="landGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--muted))" stopOpacity="0.6" />
                <stop offset="100%" stopColor="hsl(var(--muted))" stopOpacity="0.4" />
              </linearGradient>
            </defs>
            
            {/* North America */}
            <path 
              d="M5,15 Q10,10 20,12 Q28,14 30,20 Q32,28 28,35 Q22,42 15,45 Q10,42 8,35 Q4,25 5,15 Z" 
              fill="url(#landGradient)" 
              stroke="hsl(var(--border))" 
              strokeWidth="0.3"
            />
            
            {/* South America */}
            <path 
              d="M22,48 Q28,45 32,50 Q35,58 33,68 Q30,78 25,80 Q20,75 22,65 Q20,55 22,48 Z" 
              fill="url(#landGradient)" 
              stroke="hsl(var(--border))" 
              strokeWidth="0.3"
            />
            
            {/* Europe */}
            <path 
              d="M42,18 Q48,15 55,18 Q58,22 56,28 Q52,32 46,30 Q42,26 42,18 Z" 
              fill="url(#landGradient)" 
              stroke="hsl(var(--border))" 
              strokeWidth="0.3"
            />
            
            {/* Africa */}
            <path 
              d="M45,32 Q52,30 58,35 Q62,42 60,55 Q56,70 50,72 Q44,68 45,55 Q44,42 45,32 Z" 
              fill="url(#landGradient)" 
              stroke="hsl(var(--border))" 
              strokeWidth="0.3"
            />
            
            {/* Asia */}
            <path 
              d="M58,15 Q70,12 82,18 Q90,25 88,35 Q82,42 72,45 Q62,42 58,32 Q56,22 58,15 Z" 
              fill="url(#landGradient)" 
              stroke="hsl(var(--border))" 
              strokeWidth="0.3"
            />
            
            {/* Australia */}
            <path 
              d="M78,55 Q88,52 92,58 Q95,65 92,72 Q85,76 78,72 Q75,65 78,55 Z" 
              fill="url(#landGradient)" 
              stroke="hsl(var(--border))" 
              strokeWidth="0.3"
            />
          </svg>
          
          {/* Map Pins */}
          {mapPins.map((pin, i) => (
            <motion.div
              key={pin.trip.id}
              initial={{ scale: 0, y: -10 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ delay: i * 0.1, type: 'spring', stiffness: 300 }}
              className="absolute group"
              style={{
                left: `${pin.coords.x}%`,
                top: `${pin.coords.y}%`,
                transform: 'translate(-50%, -100%)',
              }}
            >
              {/* Pin */}
              <div className={cn(
                "relative cursor-pointer transition-transform hover:scale-125",
                pin.type === 'visited' ? 'text-green-500' : 'text-primary'
              )}>
                <MapPin className="h-5 w-5 drop-shadow-md" fill="currentColor" />
                
                {/* Pulse effect for upcoming */}
                {pin.type === 'upcoming' && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-primary/30" />
                )}
              </div>
              
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-foreground text-background text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                {pin.trip.destination}
              </div>
            </motion.div>
          ))}
          
          {/* Empty state overlay */}
          {mapPins.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50">
              <p className="text-muted-foreground text-sm">Start traveling to see pins on your map!</p>
            </div>
          )}
        </div>

        {/* Passport Stamps */}
        {completedTrips.length > 0 && (
          <div className="mb-6">
            <h4 className="font-medium text-foreground mb-3 flex items-center gap-2">
              <Stamp className="h-4 w-4 text-amber-600" />
              Passport Stamps
            </h4>
            <div className="flex flex-wrap gap-2">
              {completedTrips.map((trip, i) => {
                const stamp = PASSPORT_STAMPS.find(s => 
                  trip.destination.toLowerCase().includes(s.city.toLowerCase())
                );
                return (
                  <motion.div
                    key={trip.id}
                    initial={{ opacity: 0, rotate: -15, scale: 0.8 }}
                    animate={{ opacity: 1, rotate: 0, scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 border border-amber-300/50 dark:border-amber-700/50"
                  >
                    <span className="text-lg">{stamp?.emoji || '📍'}</span>
                    <span className="text-xs font-medium text-amber-800 dark:text-amber-200">
                      {trip.destination.split(',')[0]}
                    </span>
                  </motion.div>
                );
              })}
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
                      `${Math.max(0, Math.ceil((new Date(trip.start_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days` 
                      : 'TBD'}
                  </Badge>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 pt-4 mt-4 border-t border-border">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 text-green-500" fill="currentColor" />
            <span>Visited</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 text-primary" fill="currentColor" />
            <span>Upcoming</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}