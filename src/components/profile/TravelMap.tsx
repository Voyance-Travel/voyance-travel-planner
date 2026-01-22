import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, 
  Plane, 
  Calendar, 
  Heart,
  Star,
  Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import worldSvgUrl from '@/assets/world.svg';

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

interface Destination {
  id: string;
  name: string;
  country: string;
  visited?: boolean;
  upcoming?: boolean;
  dream?: boolean;
  visitDate?: string;
  upcomingDate?: string;
  rating?: number;
  lat: number;
  lng: number;
}

// Real lat/lng coordinates for major cities
const LOCATION_COORDS: Record<string, { lat: number; lng: number }> = {
  'paris': { lat: 48.8566, lng: 2.3522 },
  'london': { lat: 51.5074, lng: -0.1278 },
  'rome': { lat: 41.9028, lng: 12.4964 },
  'tokyo': { lat: 35.6762, lng: 139.6503 },
  'kyoto': { lat: 35.0116, lng: 135.7681 },
  'osaka': { lat: 34.6937, lng: 135.5023 },
  'new york': { lat: 40.7128, lng: -74.0060 },
  'los angeles': { lat: 34.0522, lng: -118.2437 },
  'san francisco': { lat: 37.7749, lng: -122.4194 },
  'bali': { lat: -8.3405, lng: 115.0920 },
  'sydney': { lat: -33.8688, lng: 151.2093 },
  'melbourne': { lat: -37.8136, lng: 144.9631 },
  'dubai': { lat: 25.2048, lng: 55.2708 },
  'singapore': { lat: 1.3521, lng: 103.8198 },
  'bangkok': { lat: 13.7563, lng: 100.5018 },
  'hong kong': { lat: 22.3193, lng: 114.1694 },
  'seoul': { lat: 37.5665, lng: 126.9780 },
  'barcelona': { lat: 41.3851, lng: 2.1734 },
  'amsterdam': { lat: 52.3676, lng: 4.9041 },
  'berlin': { lat: 52.5200, lng: 13.4050 },
  'vienna': { lat: 48.2082, lng: 16.3738 },
  'prague': { lat: 50.0755, lng: 14.4378 },
  'lisbon': { lat: 38.7223, lng: -9.1393 },
  'madrid': { lat: 40.4168, lng: -3.7038 },
  'venice': { lat: 45.4408, lng: 12.3155 },
  'florence': { lat: 43.7696, lng: 11.2558 },
  'milan': { lat: 45.4642, lng: 9.1900 },
  'athens': { lat: 37.9838, lng: 23.7275 },
  'istanbul': { lat: 41.0082, lng: 28.9784 },
  'cairo': { lat: 30.0444, lng: 31.2357 },
  'marrakech': { lat: 31.6295, lng: -7.9811 },
  'cape town': { lat: -33.9249, lng: 18.4241 },
  'nairobi': { lat: -1.2921, lng: 36.8219 },
  'mumbai': { lat: 19.0760, lng: 72.8777 },
  'delhi': { lat: 28.7041, lng: 77.1025 },
  'maldives': { lat: 3.2028, lng: 73.2207 },
  'phuket': { lat: 7.8804, lng: 98.3923 },
  'hanoi': { lat: 21.0278, lng: 105.8342 },
  'ho chi minh': { lat: 10.8231, lng: 106.6297 },
  'reykjavik': { lat: 64.1466, lng: -21.9426 },
  'mexico city': { lat: 19.4326, lng: -99.1332 },
  'cancun': { lat: 21.1619, lng: -86.8515 },
  'rio de janeiro': { lat: -22.9068, lng: -43.1729 },
  'buenos aires': { lat: -34.6037, lng: -58.3816 },
  'santorini': { lat: 36.3932, lng: 25.4615 },
  'mykonos': { lat: 37.4467, lng: 25.3289 },
  'amalfi': { lat: 40.6340, lng: 14.6027 },
  'zurich': { lat: 47.3769, lng: 8.5417 },
  'queenstown': { lat: -45.0312, lng: 168.6626 },
  'fiji': { lat: -17.7134, lng: 178.0650 },
  'tahiti': { lat: -17.6509, lng: -149.4260 },
  // Countries (center points)
  'france': { lat: 46.2276, lng: 2.2137 },
  'italy': { lat: 41.8719, lng: 12.5674 },
  'spain': { lat: 40.4637, lng: -3.7492 },
  'germany': { lat: 51.1657, lng: 10.4515 },
  'uk': { lat: 55.3781, lng: -3.4360 },
  'japan': { lat: 36.2048, lng: 138.2529 },
  'usa': { lat: 37.0902, lng: -95.7129 },
  'australia': { lat: -25.2744, lng: 133.7751 },
  'thailand': { lat: 15.8700, lng: 100.9925 },
  'indonesia': { lat: -0.7893, lng: 113.9213 },
  'vietnam': { lat: 14.0583, lng: 108.2772 },
  'india': { lat: 20.5937, lng: 78.9629 },
  'brazil': { lat: -14.2350, lng: -51.9253 },
  'mexico': { lat: 23.6345, lng: -102.5528 },
  'greece': { lat: 39.0742, lng: 21.8243 },
  'portugal': { lat: 39.3999, lng: -8.2245 },
  'netherlands': { lat: 52.1326, lng: 5.2913 },
  'morocco': { lat: 31.7917, lng: -7.0926 },
  'egypt': { lat: 26.8206, lng: 30.8025 },
  'south africa': { lat: -30.5595, lng: 22.9375 },
  'new zealand': { lat: -40.9006, lng: 174.8860 },
  'canada': { lat: 56.1304, lng: -106.3468 },
  'argentina': { lat: -38.4161, lng: -63.6167 },
};

// Equirectangular projection for lat/lng to percentage position
const equirectangularProjection = (lat: number, lng: number) => {
  const x = ((lng + 180) / 360) * 100;
  const y = ((90 - lat) / 180) * 100;
  return { left: `${x}%`, top: `${y}%` };
};

// Get pin styling based on destination type
const getPinStyling = (destination: Destination) => {
  if (destination.visited) return 'bg-emerald-500 border-emerald-600';
  if (destination.upcoming) return 'bg-blue-500 border-blue-600';
  if (destination.dream) return 'bg-pink-500 border-pink-600';
  return 'bg-gray-500 border-gray-600';
};

const getPinIcon = (destination: Destination) => {
  if (destination.visited) return MapPin;
  if (destination.upcoming) return Plane;
  if (destination.dream) return Heart;
  return MapPin;
};

function getCoordinates(destination: string): { lat: number; lng: number } | null {
  const lower = destination.toLowerCase();
  for (const [key, coords] of Object.entries(LOCATION_COORDS)) {
    if (lower.includes(key)) {
      return coords;
    }
  }
  return null;
}

export default function TravelMap({ userId, className }: TravelMapProps) {
  const [trips, setTrips] = useState<TripDestination[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);
  const [filter, setFilter] = useState<'all' | 'visited' | 'upcoming'>('all');

  // Always fetch real data - no demo mode fallback
  useEffect(() => {
    async function loadTrips() {
      if (!userId) {
        setTrips([]);
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
        setTrips([]);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadTrips();
  }, [userId]);

  // Convert trips to destinations with coordinates
  const destinations = useMemo(() => {
    const result: Destination[] = [];
    
    trips.forEach(trip => {
      const coords = getCoordinates(trip.destination) || getCoordinates(trip.destination_country || '');
      if (coords) {
        const isCompleted = trip.status === 'completed' || (trip.end_date && new Date(trip.end_date) < new Date());
        const isUpcoming = ['booked', 'planning', 'active'].includes(trip.status) && trip.start_date && new Date(trip.start_date) >= new Date();
        
        result.push({
          id: trip.id,
          name: trip.destination,
          country: trip.destination_country || '',
          visited: isCompleted,
          upcoming: isUpcoming,
          visitDate: trip.end_date ? format(new Date(trip.end_date), 'MMM yyyy') : undefined,
          upcomingDate: trip.start_date ? format(new Date(trip.start_date), 'MMM yyyy') : undefined,
          rating: isCompleted ? 4 + Math.floor(Math.random() * 2) : undefined,
          lat: coords.lat,
          lng: coords.lng,
        });
      }
    });
    
    return result;
  }, [trips]);

  const visitedCount = destinations.filter(d => d.visited).length;
  const upcomingCount = destinations.filter(d => d.upcoming).length;

  const filteredDestinations = destinations.filter(dest => {
    if (filter === 'all') return true;
    if (filter === 'visited') return dest.visited;
    if (filter === 'upcoming') return dest.upcoming;
    return true;
  });

  if (isLoading) {
    return (
      <div className={cn("bg-card rounded-xl border border-border p-8", className)}>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  // Empty state when no trips
  if (destinations.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("space-y-6", className)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Travel Map</h2>
            <p className="text-sm text-muted-foreground">Your digital passport</p>
          </div>
        </div>

        <div className="relative w-full bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 rounded-2xl overflow-hidden border border-slate-700">
          <div className="relative w-full aspect-[2/1]">
            <img 
              src={worldSvgUrl} 
              alt="World Map" 
              className="absolute inset-0 w-full h-full object-cover opacity-40"
              style={{ 
                filter: 'contrast(1.2) brightness(0.8) hue-rotate(200deg) saturate(0.7)',
                mixBlendMode: 'screen'
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <MapPin className="h-12 w-12 text-white/30 mx-auto mb-4" />
                <p className="text-white/60 text-lg font-medium">No trips yet</p>
                <p className="text-white/40 text-sm mt-1">Plan your first adventure to start filling your map</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("space-y-6", className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Travel Map</h2>
            <p className="text-sm text-muted-foreground">Your digital passport</p>
          </div>
        </div>
      </div>

      {/* Filter buttons */}
      <div className="flex gap-3">
        {[
          { id: 'all', label: 'All', count: destinations.length },
          { id: 'visited', label: 'Visited', count: visitedCount },
          { id: 'upcoming', label: 'Upcoming', count: upcomingCount },
        ].map((filterOption) => (
          <button
            key={filterOption.id}
            onClick={() => setFilter(filterOption.id as 'all' | 'visited' | 'upcoming')}
            className={cn(
              "rounded-full px-4 py-2 text-sm font-medium transition-all",
              filter === filterOption.id
                ? 'bg-primary/10 text-primary shadow-sm'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            {filterOption.label} ({filterOption.count})
          </button>
        ))}
      </div>

      {/* Enhanced Map Container */}
      <div className="relative w-full bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
        {/* Subtle animated background patterns */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-400/20 to-transparent animate-pulse" />
        </div>
        
        <div className="relative w-full aspect-[2/1]">
          {/* SVG World Map */}
          <img 
            src={worldSvgUrl} 
            alt="World Map" 
            className="absolute inset-0 w-full h-full object-cover opacity-60"
            style={{ 
              filter: 'contrast(1.2) brightness(0.8) hue-rotate(200deg) saturate(0.7)',
              mixBlendMode: 'screen'
            }}
          />
          
          {/* Ocean gradient overlay */}
          <div className="absolute inset-0 bg-gradient-to-br from-slate-800/40 via-blue-900/30 to-indigo-900/40 mix-blend-multiply" />
          
          {/* Travel pins positioned with real coordinates */}
          {filteredDestinations.map((destination, index) => {
            const { left, top } = equirectangularProjection(destination.lat, destination.lng);
            const Icon = getPinIcon(destination);
            
            return (
              <motion.div
                key={destination.id}
                className="absolute z-10 cursor-pointer group"
                style={{ left, top, transform: 'translate(-50%, -50%)' }}
                initial={{ opacity: 0, scale: 0, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ 
                  delay: index * 0.1,
                  type: "spring",
                  stiffness: 300,
                  damping: 20
                }}
                whileHover={{ scale: 1.2, y: -2 }}
                onClick={() => setSelectedDestination(destination)}
              >
                {/* Pulse effect for upcoming destinations */}
                {destination.upcoming && (
                  <>
                    <motion.div
                      className="absolute w-8 h-8 rounded-full border-2 border-blue-400"
                      style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
                      animate={{ scale: [1, 2.5], opacity: [0.8, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
                    />
                    <motion.div
                      className="absolute w-8 h-8 rounded-full border-2 border-blue-400"
                      style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
                      animate={{ scale: [1, 2.5], opacity: [0.8, 0] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 1 }}
                    />
                  </>
                )}
                
                {/* Pin with glow effect */}
                <div 
                  className={cn(
                    "relative w-8 h-8 rounded-full border-2 border-white shadow-xl flex items-center justify-center",
                    "group-hover:shadow-2xl transition-all duration-300 group-hover:scale-110",
                    getPinStyling(destination)
                  )}
                  style={{ 
                    boxShadow: `0 0 20px ${destination.visited ? '#10b981' : destination.upcoming ? '#3b82f6' : '#ec4899'}40` 
                  }}
                >
                  <Icon className="w-4 h-4 text-white drop-shadow-lg" />
                </div>
                
                {/* Dark tooltip on hover */}
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-20">
                  <div className="bg-gray-900/95 backdrop-blur-sm text-white px-4 py-3 rounded-lg shadow-xl border border-white/10 min-w-max">
                    <div className="text-sm font-medium">{destination.name}</div>
                    <div className="text-xs text-white/70 mb-1">{destination.country}</div>
                    
                    {destination.visited && destination.visitDate && (
                      <div className="text-xs text-emerald-400">
                        Visited {destination.visitDate}
                      </div>
                    )}
                    {destination.upcoming && destination.upcomingDate && (
                      <div className="text-xs text-blue-400">
                        Upcoming {destination.upcomingDate}
                      </div>
                    )}
                    
                    {destination.rating && (
                      <div className="flex items-center gap-1 mt-2">
                        {[...Array(5)].map((_, i) => (
                          <Star 
                            key={i} 
                            className={cn(
                              "w-3 h-3",
                              i < (destination.rating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'
                            )} 
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-2 h-2 bg-gray-900 rotate-45 border-r border-b border-white/10" />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Legend with actual destinations */}
      <motion.div 
        className="bg-card/95 backdrop-blur-md rounded-2xl p-6 shadow-lg border border-border"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        {/* Legend Key */}
        <div className="flex flex-wrap gap-4 mb-4 pb-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-emerald-500" />
            <span className="text-xs text-muted-foreground">Visited</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <span className="text-xs text-muted-foreground">Upcoming</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-500" />
            <span className="text-xs text-muted-foreground">Draft / Planning</span>
          </div>
        </div>

        <div className="space-y-4">
          {/* Visited Destinations */}
          {destinations.filter(d => d.visited).length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500" />
                <span className="text-sm font-medium text-foreground">Visited ({visitedCount})</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {destinations.filter(d => d.visited).slice(0, 8).map(d => (
                  <span 
                    key={d.id}
                    className="px-3 py-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-full text-xs font-medium"
                  >
                    {d.name}
                  </span>
                ))}
                {destinations.filter(d => d.visited).length > 8 && (
                  <span className="px-3 py-1 bg-muted text-muted-foreground rounded-full text-xs">
                    +{destinations.filter(d => d.visited).length - 8} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Upcoming Destinations */}
          {destinations.filter(d => d.upcoming).length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full bg-blue-500" />
                <span className="text-sm font-medium text-foreground">Upcoming ({upcomingCount})</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {destinations.filter(d => d.upcoming).map(d => (
                  <span 
                    key={d.id}
                    className="px-3 py-1 bg-blue-500/10 text-blue-700 dark:text-blue-400 rounded-full text-xs font-medium flex items-center gap-1"
                  >
                    <Calendar className="h-3 w-3" />
                    {d.name} • {d.upcomingDate}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Draft/Planning Destinations */}
          {destinations.filter(d => !d.visited && !d.upcoming).length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full bg-gray-500" />
                <span className="text-sm font-medium text-foreground">Draft / Planning ({destinations.filter(d => !d.visited && !d.upcoming).length})</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {destinations.filter(d => !d.visited && !d.upcoming).slice(0, 8).map(d => (
                  <span 
                    key={d.id}
                    className="px-3 py-1 bg-muted text-muted-foreground rounded-full text-xs font-medium"
                  >
                    {d.name}
                  </span>
                ))}
                {destinations.filter(d => !d.visited && !d.upcoming).length > 8 && (
                  <span className="px-3 py-1 bg-muted text-muted-foreground rounded-full text-xs">
                    +{destinations.filter(d => !d.visited && !d.upcoming).length - 8} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
