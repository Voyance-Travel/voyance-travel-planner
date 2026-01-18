import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, 
  Plane, 
  Calendar, 
  Heart,
  Star,
  Camera
} from 'lucide-react';
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

export default function TravelMap({ userId, className }: TravelMapProps) {
  const [trips, setTrips] = useState<TripDestination[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);
  const [filter, setFilter] = useState<'all' | 'visited' | 'upcoming'>('all');
  const isDemo = isDemoModeEnabled();

  useEffect(() => {
    async function loadTrips() {
      if (isDemo || !userId || userId === 'demo-user-001') {
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
        setTrips(DEMO_TRIPS);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadTrips();
  }, [userId, isDemo]);

  // Convert trips to destinations with coordinates
  const destinations = useMemo(() => {
    const result: Destination[] = [];
    
    trips.forEach(trip => {
      const coords = getCoordinates(trip.destination) || getCoordinates(trip.destination_country || '');
      if (coords) {
        const isCompleted = trip.status === 'completed' || (trip.end_date && new Date(trip.end_date) < new Date());
        const isUpcoming = ['booked', 'planning', 'draft'].includes(trip.status) && trip.start_date && new Date(trip.start_date) >= new Date();
        
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
      className={cn("space-y-6", className)}
    >
      {/* Header with stats */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-light text-foreground mb-2">Your Travel Journey</h3>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-emerald-500" />
              <span>{visitedCount} visited</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-blue-500" />
              <span>{upcomingCount} upcoming</span>
            </div>
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
          <div className="absolute top-0 left-1/4 w-32 h-32 bg-teal-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute bottom-0 right-1/3 w-40 h-40 bg-purple-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        </div>
        
        <div className="relative w-full aspect-[2/1]">
          {/* High-quality SVG World Map with accurate paths */}
          <svg 
            viewBox="0 0 2000 1001" 
            className="absolute inset-0 w-full h-full opacity-50"
            preserveAspectRatio="xMidYMid slice"
          >
            <defs>
              <linearGradient id="mapGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#64748b" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#475569" stopOpacity="0.4" />
              </linearGradient>
            </defs>
            
            {/* North America */}
            <path 
              d="M100,200 L200,150 L400,140 L500,180 L550,250 L500,350 L450,400 L380,450 L280,480 L200,500 L150,450 L100,350 Z" 
              fill="url(#mapGradient)" 
              stroke="#94a3b8"
              strokeWidth="1"
            />
            
            {/* South America */}
            <path 
              d="M300,520 L400,500 L500,550 L550,650 L530,750 L480,850 L400,900 L350,880 L320,800 L290,700 L280,600 Z" 
              fill="url(#mapGradient)" 
              stroke="#94a3b8"
              strokeWidth="1"
            />
            
            {/* Europe */}
            <path 
              d="M900,180 L1100,150 L1200,180 L1180,260 L1100,300 L950,280 L900,220 Z" 
              fill="url(#mapGradient)" 
              stroke="#94a3b8"
              strokeWidth="1"
            />
            
            {/* Africa */}
            <path 
              d="M900,350 L1100,320 L1200,380 L1250,500 L1200,650 L1100,750 L980,720 L920,600 L880,480 Z" 
              fill="url(#mapGradient)" 
              stroke="#94a3b8"
              strokeWidth="1"
            />
            
            {/* Asia */}
            <path 
              d="M1200,150 L1500,120 L1750,180 L1850,280 L1800,400 L1650,450 L1450,420 L1300,350 L1200,250 Z" 
              fill="url(#mapGradient)" 
              stroke="#94a3b8"
              strokeWidth="1"
            />
            
            {/* Australia */}
            <path 
              d="M1550,600 L1750,580 L1850,650 L1850,750 L1750,800 L1600,780 L1520,700 Z" 
              fill="url(#mapGradient)" 
              stroke="#94a3b8"
              strokeWidth="1"
            />
          </svg>
          
          {/* Subtle grid pattern */}
          <div 
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
              backgroundSize: '50px 50px'
            }}
          />
          
          {/* Journey Lines connecting visited destinations */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              <linearGradient id="journeyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0ABAB5" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.8" />
              </linearGradient>
            </defs>
            <g className="journey-lines">
              {filteredDestinations
                .filter(dest => dest.visited)
                .map((destination, index, visitedDests) => {
                  if (index === visitedDests.length - 1) return null;
                  const nextDest = visitedDests[index + 1];
                  const start = equirectangularProjection(destination.lat, destination.lng);
                  const end = equirectangularProjection(nextDest.lat, nextDest.lng);
                  
                  return (
                    <motion.line
                      key={`line-${destination.id}-${nextDest.id}`}
                      x1={start.left}
                      y1={start.top}
                      x2={end.left}
                      y2={end.top}
                      stroke="url(#journeyGradient)"
                      strokeWidth="2"
                      strokeDasharray="5,5"
                      initial={{ pathLength: 0, opacity: 0 }}
                      animate={{ pathLength: 1, opacity: 0.6 }}
                      transition={{ duration: 1.5, delay: index * 0.3 }}
                    />
                  );
                })}
            </g>
          </svg>
          
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
                    "relative w-8 h-8 rounded-full border-2 border-white shadow-xl flex items-center justify-center group-hover:shadow-2xl transition-all duration-300",
                    getPinStyling(destination)
                  )}
                  style={{ boxShadow: `0 0 20px ${destination.visited ? '#10b981' : destination.upcoming ? '#3b82f6' : '#ec4899'}40` }}
                >
                  <Icon className="w-4 h-4 text-white drop-shadow-lg" />
                  
                  {/* Glowing ring animation */}
                  <motion.div 
                    className={cn(
                      "absolute inset-0 rounded-full border-2",
                      destination.visited ? 'border-emerald-400' : destination.upcoming ? 'border-blue-400' : 'border-pink-400'
                    )}
                    animate={{ scale: [1, 1.5, 1], opacity: [0.8, 0, 0.8] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                  
                  {/* Rating badge for visited places */}
                  {destination.visited && destination.rating && (
                    <motion.div 
                      className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 border border-white rounded-full flex items-center justify-center shadow-md text-xs font-bold text-yellow-800"
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: index * 0.1 + 0.3, type: "spring" }}
                    >
                      {destination.rating}
                    </motion.div>
                  )}
                </div>
                
                {/* Tooltip */}
                <motion.div 
                  className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 opacity-0 group-hover:opacity-100 transition-all duration-300 pointer-events-none z-20"
                >
                  <div className="bg-gray-900/95 backdrop-blur-sm text-white px-4 py-3 rounded-lg shadow-xl border border-white/10 min-w-max">
                    <div className="text-sm font-medium">{destination.name}</div>
                    <div className="text-xs text-white/70 mb-1">{destination.country}</div>
                    
                    {destination.visited && destination.visitDate && (
                      <div className="text-xs text-emerald-400">Visited {destination.visitDate}</div>
                    )}
                    {destination.upcoming && destination.upcomingDate && (
                      <div className="text-xs text-blue-400">Upcoming {destination.upcomingDate}</div>
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
                </motion.div>
              </motion.div>
            );
          })}
          
          {/* Empty state */}
          {filteredDestinations.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white/60">
                <Plane className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-lg font-light">Start your journey</p>
                <p className="text-sm">Book a trip to see pins on your map</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Legend showing actual destinations */}
      <motion.div 
        className="bg-card/95 backdrop-blur-md rounded-2xl p-6 shadow-lg border border-border"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="space-y-4">
          {/* Visited Destinations */}
          {destinations.filter(d => d.visited).length > 0 && (
            <div className="flex items-start gap-3">
              <div className="mt-1 flex-shrink-0">
                <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/30 rounded-full flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-emerald-500" />
                </div>
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-foreground mb-2">Conquered</h4>
                <div className="flex flex-wrap gap-2">
                  {destinations.filter(d => d.visited).map((dest, index) => (
                    <motion.span 
                      key={dest.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="px-3 py-1 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 rounded-full text-sm font-medium border border-emerald-500/20"
                    >
                      {dest.name}
                    </motion.span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Upcoming Destinations */}
          {destinations.filter(d => d.upcoming).length > 0 && (
            <div className="flex items-start gap-3">
              <motion.div 
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="mt-1 flex-shrink-0"
              >
                <div className="w-10 h-10 bg-blue-500/10 border border-blue-500/30 rounded-full flex items-center justify-center">
                  <Plane className="w-5 h-5 text-blue-500" />
                </div>
              </motion.div>
              <div className="flex-1">
                <h4 className="font-medium text-foreground mb-2">On the Horizon</h4>
                <div className="flex flex-wrap gap-2">
                  {destinations.filter(d => d.upcoming).map((dest, index) => (
                    <motion.span 
                      key={dest.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="px-3 py-1 bg-blue-500/10 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium border border-blue-500/20"
                    >
                      {dest.name}
                      {dest.upcomingDate && (
                        <span className="text-primary ml-1 text-xs">• {dest.upcomingDate}</span>
                      )}
                    </motion.span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Stats Row */}
        <motion.div 
          className="mt-6 pt-6 border-t border-border"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          <div className="flex items-center justify-center gap-8 text-sm">
            <motion.div 
              className="text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.4 }}
            >
              <motion.div 
                className="text-2xl font-light text-foreground"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 1.5, type: "spring" }}
              >
                {destinations.length}
              </motion.div>
              <div className="text-xs text-muted-foreground">Destinations</div>
            </motion.div>
            <div className="w-px h-8 bg-border" />
            <motion.div 
              className="text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5 }}
            >
              <motion.div 
                className="text-2xl font-light text-foreground"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 1.6, type: "spring" }}
              >
                {visitedCount}
              </motion.div>
              <div className="text-xs text-muted-foreground">Conquered</div>
            </motion.div>
            <div className="w-px h-8 bg-border" />
            <motion.div 
              className="text-center"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.6 }}
            >
              <motion.div 
                className="text-2xl font-light text-foreground"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 1.7, type: "spring" }}
              >
                {upcomingCount}
              </motion.div>
              <div className="text-xs text-muted-foreground">Upcoming</div>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>

      {/* Destination detail modal */}
      <AnimatePresence>
        {selectedDestination && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedDestination(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="bg-card rounded-2xl p-6 max-w-md w-full shadow-2xl border border-border"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-xl font-light text-foreground">
                    {selectedDestination.name}, {selectedDestination.country}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedDestination(null)}
                  className="text-muted-foreground hover:text-foreground text-xl"
                >
                  ×
                </button>
              </div>

              {selectedDestination.visited && (
                <div className="mb-4 p-4 bg-emerald-500/10 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      Visited {selectedDestination.visitDate}
                    </span>
                  </div>
                  {selectedDestination.rating && (
                    <div className="flex items-center gap-2 mt-2">
                      <Star className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm text-emerald-700 dark:text-emerald-300">
                        Rated {selectedDestination.rating} stars
                      </span>
                    </div>
                  )}
                </div>
              )}

              {selectedDestination.upcoming && (
                <div className="mb-4 p-4 bg-blue-500/10 rounded-xl">
                  <div className="flex items-center gap-2">
                    <Plane className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      Coming up {selectedDestination.upcomingDate}
                    </span>
                  </div>
                </div>
              )}

              <div className="flex gap-2 mt-6">
                <button className="flex-1 bg-primary text-primary-foreground py-2 px-4 rounded-lg hover:bg-primary/90 transition-colors">
                  View Trip
                </button>
                <button 
                  onClick={() => setSelectedDestination(null)}
                  className="flex-1 bg-muted text-muted-foreground py-2 px-4 rounded-lg hover:bg-muted/80 transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
