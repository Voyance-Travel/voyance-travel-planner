import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Plane, 
  Calendar, 
  Users, 
  Clock, 
  Sparkles,
  Globe,
  CheckCircle,
  Edit3,
  Hotel,
  MapPin,
  Eye,
  ArrowRight,
  Compass,
  Loader2,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Zap
} from 'lucide-react';
import ActiveTripCard from '@/components/trips/ActiveTripCard';

import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { DraftLimitBanner } from '@/components/common/DraftLimitBanner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAuth } from '@/contexts/AuthContext';
import { useDraftLimitCheck } from '@/hooks/useDraftLimitCheck';
import { supabase } from '@/integrations/supabase/client';
import { useTripHeroImage } from '@/hooks/useTripHeroImage';
import { getDestinationImage } from '@/utils/destinationImages';

// Extract base destination name (e.g., "Rome (FCO)" -> "Rome", "Paris, France" -> "Paris")
function getBaseDestination(destination: string): string {
  // Remove parenthetical suffixes like (FCO), (JFK)
  let base = destination.replace(/\s*\([^)]*\)\s*$/, '').trim();
  // Take first part before comma (city name)
  base = base.split(',')[0].trim();
  return base;
}

// Map IATA airport codes to city names for display
const AIRPORT_TO_CITY: Record<string, string> = {
  // United States
  'ATL': 'Atlanta', 'LAX': 'Los Angeles', 'ORD': 'Chicago', 'DFW': 'Dallas',
  'DEN': 'Denver', 'JFK': 'New York', 'SFO': 'San Francisco', 'SEA': 'Seattle',
  'LAS': 'Las Vegas', 'MCO': 'Orlando', 'EWR': 'Newark', 'MIA': 'Miami',
  'PHX': 'Phoenix', 'IAH': 'Houston', 'BOS': 'Boston', 'MSP': 'Minneapolis',
  'DTW': 'Detroit', 'FLL': 'Fort Lauderdale', 'PHL': 'Philadelphia', 'LGA': 'New York',
  'BWI': 'Baltimore', 'SLC': 'Salt Lake City', 'DCA': 'Washington DC', 'IAD': 'Washington DC',
  'SAN': 'San Diego', 'TPA': 'Tampa', 'AUS': 'Austin', 'BNA': 'Nashville',
  // Europe
  'LHR': 'London', 'CDG': 'Paris', 'FCO': 'Rome', 'AMS': 'Amsterdam',
  'FRA': 'Frankfurt', 'MAD': 'Madrid', 'BCN': 'Barcelona', 'MUC': 'Munich',
  'LGW': 'London', 'ORY': 'Paris', 'DUB': 'Dublin', 'ZRH': 'Zurich',
  'VIE': 'Vienna', 'LIS': 'Lisbon', 'CPH': 'Copenhagen', 'OSL': 'Oslo',
  'ARN': 'Stockholm', 'HEL': 'Helsinki', 'PRG': 'Prague', 'BRU': 'Brussels',
  'ATH': 'Athens', 'IST': 'Istanbul', 'MXP': 'Milan', 'VCE': 'Venice',
  'BER': 'Berlin', 'EDI': 'Edinburgh', 'MAN': 'Manchester',
  // Asia Pacific
  'HND': 'Tokyo', 'NRT': 'Tokyo', 'SIN': 'Singapore', 'HKG': 'Hong Kong',
  'ICN': 'Seoul', 'BKK': 'Bangkok', 'KUL': 'Kuala Lumpur', 'SYD': 'Sydney',
  'MEL': 'Melbourne', 'DEL': 'Delhi', 'BOM': 'Mumbai', 'PEK': 'Beijing',
  'PVG': 'Shanghai', 'TPE': 'Taipei', 'MNL': 'Manila', 'CGK': 'Jakarta',
  // Middle East
  'DXB': 'Dubai', 'DOH': 'Doha', 'AUH': 'Abu Dhabi', 'TLV': 'Tel Aviv',
  // Americas
  'YYZ': 'Toronto', 'YVR': 'Vancouver', 'YUL': 'Montreal', 'MEX': 'Mexico City',
  'CUN': 'Cancun', 'GRU': 'São Paulo', 'GIG': 'Rio de Janeiro', 'EZE': 'Buenos Aires',
  'BOG': 'Bogotá', 'LIM': 'Lima', 'SCL': 'Santiago',
};

// Convert airport code or city name to displayable city name
function getDisplayCity(departureCityOrCode: string): string {
  const upper = departureCityOrCode.toUpperCase().trim();
  // Check if it's a 3-letter IATA code
  if (/^[A-Z]{3}$/.test(upper) && AIRPORT_TO_CITY[upper]) {
    return AIRPORT_TO_CITY[upper];
  }
  // Otherwise return as-is (already a city name)
  return departureCityOrCode;
}

// Region mapping for grouping
const REGION_MAP: Record<string, string> = {
  // Europe
  'Paris': 'Europe', 'London': 'Europe', 'Rome': 'Europe', 'Barcelona': 'Europe',
  'Amsterdam': 'Europe', 'Berlin': 'Europe', 'Vienna': 'Europe', 'Prague': 'Europe',
  'Lisbon': 'Europe', 'Madrid': 'Europe', 'Athens': 'Europe', 'Dublin': 'Europe',
  'Munich': 'Europe', 'Venice': 'Europe', 'Florence': 'Europe', 'Milan': 'Europe',
  'Zurich': 'Europe', 'Brussels': 'Europe', 'Copenhagen': 'Europe', 'Stockholm': 'Europe',
  // Asia
  'Tokyo': 'Asia', 'Kyoto': 'Asia', 'Bangkok': 'Asia', 'Singapore': 'Asia',
  'Hong Kong': 'Asia', 'Seoul': 'Asia', 'Bali': 'Asia', 'Dubai': 'Middle East',
  'Mumbai': 'Asia', 'Delhi': 'Asia', 'Shanghai': 'Asia', 'Beijing': 'Asia',
  // Americas
  'New York': 'North America', 'Los Angeles': 'North America', 'Miami': 'North America',
  'San Francisco': 'North America', 'Chicago': 'North America', 'Las Vegas': 'North America',
  'Toronto': 'North America', 'Vancouver': 'North America', 'Mexico City': 'North America',
  'Cancun': 'North America', 'Rio de Janeiro': 'South America', 'Buenos Aires': 'South America',
  // Africa & Oceania
  'Cape Town': 'Africa', 'Marrakech': 'Africa', 'Cairo': 'Africa',
  'Sydney': 'Oceania', 'Melbourne': 'Oceania', 'Auckland': 'Oceania',
};

function getRegion(destination: string): string {
  const base = getBaseDestination(destination);
  return REGION_MAP[base] || 'Other';
}

interface TripGroup {
  key: string;
  label: string;
  trips: Trip[];
  region: string;
}

type TabValue = 'all' | 'active' | 'upcoming' | 'completed';
type TripStatus = 'draft' | 'planning' | 'booked' | 'active' | 'completed' | 'cancelled';
type DisplayStatus = 'upcoming' | 'active' | 'completed' | 'canceled';

interface Trip {
  id: string;
  destination: string;
  name: string;
  startDate: string | null;
  endDate: string | null;
  status: TripStatus;
  travelers: number;
  departureCity: string | null;
  flightSelection: any;
  hotelSelection: any;
  metadata: Record<string, any> | null;
  hasItineraryData: boolean;
}

// Simplified status mapping - no more "draft" display, all future trips are "upcoming"
function mapToDisplayStatus(status: TripStatus, startDate: string | null, endDate: string | null): DisplayStatus {
  const now = new Date();
  
  // Completed or past trips
  if (status === 'completed' || (endDate && new Date(endDate) < now)) {
    return 'completed';
  }
  
  // Cancelled trips
  if (status === 'cancelled') {
    return 'canceled';
  }
  
  // Active trips (currently happening)
  if (status === 'active' || (startDate && endDate && new Date(startDate) <= now && new Date(endDate) >= now)) {
    return 'active';
  }
  
  // Everything else (draft, planning, booked with future dates) = upcoming
  return 'upcoming';
}

const statusConfig: Record<DisplayStatus, { label: string; color: string; icon: typeof Edit3 }> = {
  upcoming: { label: 'Upcoming', color: 'bg-primary/20 text-primary border border-primary/30', icon: Clock },
  active: { label: 'In Progress', color: 'bg-green-500/20 text-green-700 border border-green-500/30', icon: Plane },
  completed: { label: 'Completed', color: 'bg-muted text-muted-foreground border border-border', icon: CheckCircle },
  canceled: { label: 'Cancelled', color: 'bg-destructive/20 text-destructive border border-destructive/30', icon: Edit3 },
};

function formatDate(dateString: string | null): string {
  if (!dateString) return 'TBD';
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateRange(startDate: string | null, endDate: string | null): string {
  if (!startDate && !endDate) return 'Dates not set';
  if (!startDate) return `Until ${formatDate(endDate)}`;
  if (!endDate) return `From ${formatDate(startDate)}`;
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return `${formatDate(startDate)} – ${formatDate(endDate)} (${diffDays} days)`;
}

function TripCard({ trip, index = 0 }: { trip: Trip; index?: number }) {
  const navigate = useNavigate();
  const displayStatus = mapToDisplayStatus(trip.status, trip.startDate, trip.endDate);
  const status = statusConfig[displayStatus];
  const StatusIcon = status.icon;
  
  // Use smart hero image hook with API fallback for uncurated destinations
  const seededHero = (trip.metadata && typeof trip.metadata === 'object')
    ? (trip.metadata as Record<string, unknown>).hero_image
    : null;
  const seededHeroUrl = typeof seededHero === 'string' && seededHero.length > 0 ? seededHero : null;

  const { imageUrl, onError: onImageError } = useTripHeroImage({
    destination: trip.destination,
    seededHeroUrl,
    tripId: trip.id,
  });
  
  // Check for booking status - use direct properties
  const hasItinerary = !!trip.hasItineraryData;
  const hasFlight = !!trip.flightSelection;
  const hasHotel = !!trip.hotelSelection;
  const travelersCount = typeof trip.travelers === 'number' ? trip.travelers : 1;

  const handleCardClick = () => {
    // Only go to itinerary view if there's actual itinerary data
    if (hasItinerary && (displayStatus === 'upcoming' || displayStatus === 'completed')) {
      navigate(`/itinerary/${trip.id}`);
    } else {
      navigate(`/trip/${trip.id}`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.1 }}
      className="group relative bg-card rounded-2xl overflow-hidden border border-border shadow-soft hover:shadow-elevated transition-all duration-500"
    >
      {/* Image Section */}
      <div className="relative h-52 overflow-hidden cursor-pointer" onClick={handleCardClick}>
        <img 
          src={imageUrl} 
          alt={trip.destination} 
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
          onError={onImageError}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        
        {/* Status Badge */}
        <Badge className={`absolute top-4 right-4 ${status.color} gap-1.5 backdrop-blur-sm`}>
          <StatusIcon className="h-3 w-3" />
          {status.label}
        </Badge>
        
        {/* Destination Name */}
        <div className="absolute bottom-4 left-4 right-4">
          <h3 className="font-serif text-2xl font-semibold text-white drop-shadow-lg mb-1">
            {trip.destination}
          </h3>
          {trip.name && trip.name !== trip.destination && (
            <p className="text-white/80 text-sm truncate">{trip.name}</p>
          )}
        </div>
      </div>

      {/* Content Section */}
      <div className="p-5 space-y-4">
        {/* Trip Details */}
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-primary/70" />
            <span>{formatDateRange(trip.startDate, trip.endDate)}</span>
          </div>
          {travelersCount > 0 && (
            <div className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-primary/70" />
              <span>{travelersCount} traveler{travelersCount > 1 ? 's' : ''}</span>
            </div>
          )}
          {trip.departureCity && (
            <div className="flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-primary/70" />
              <span>From {getDisplayCity(trip.departureCity)}</span>
            </div>
          )}
        </div>

        {/* Booking Status Indicators */}
        <div className="flex gap-2 flex-wrap">
          {hasFlight && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <Plane className="h-3 w-3" /> Flight Booked
            </Badge>
          )}
          {hasHotel && (
            <Badge variant="secondary" className="gap-1 text-xs">
              <Hotel className="h-3 w-3" /> Hotel Booked
            </Badge>
          )}
          {hasItinerary && (
            <Badge variant="secondary" className="gap-1 text-xs bg-primary/10 text-primary border-primary/20">
              <Sparkles className="h-3 w-3" /> Itinerary Ready
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {hasItinerary ? (
            <Button 
              onClick={handleCardClick} 
              variant="default" 
              className="flex-1 gap-2"
            >
              <Eye className="h-4 w-4" />
              View Itinerary
            </Button>
          ) : (
            <>
              <Button 
                onClick={handleCardClick} 
                variant="default" 
                className="flex-1 gap-2"
              >
                <Edit3 className="h-4 w-4" />
                Continue Planning
              </Button>
              <Button 
                onClick={() => navigate(`/trip/${trip.id}/itinerary`)} 
                variant="outline" 
                size="icon"
                title="Generate Itinerary"
              >
                <Sparkles className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState({ tab }: { tab: TabValue }) {
  const navigate = useNavigate();
  
  const inspirationDestinations = [
    { name: 'Paris', image: getDestinationImage('paris') },
    { name: 'Tokyo', image: getDestinationImage('tokyo') },
    { name: 'Bali', image: getDestinationImage('bali') },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }}
      className="py-12"
    >
      <div className="max-w-2xl mx-auto text-center mb-12">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-6 mx-auto"
        >
          <Compass className="h-12 w-12 text-primary" />
        </motion.div>
        
        <h2 className="font-serif text-3xl font-bold mb-4">
          {tab === 'all' 
            ? "Your Next Adventure Awaits" 
            : tab === 'active'
            ? "No Active Trips Right Now"
            : tab === 'upcoming' 
            ? "No Upcoming Trips Yet"
            : "No Past Adventures"}
        </h2>
        
        <p className="text-muted-foreground text-lg mb-8 max-w-md mx-auto">
          {tab === 'all' 
            ? "Start planning your dream vacation with personalized itineraries crafted just for you."
            : tab === 'active'
            ? "You're not on a trip at the moment. Plan your next adventure!"
            : tab === 'upcoming'
            ? "All your planned trips will appear here. Start planning your next getaway!"
            : "Completed adventures will be stored here as cherished memories."}
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button 
            onClick={() => navigate('/start')} 
            size="lg" 
            className="gap-2 text-lg px-8"
          >
            <Sparkles className="h-5 w-5" />
            Plan a Trip
          </Button>
          <Button 
            onClick={() => navigate('/explore')} 
            variant="outline" 
            size="lg" 
            className="gap-2"
          >
            <Globe className="h-5 w-5" />
            Explore Destinations
          </Button>
        </div>
      </div>

      {/* Inspiration Section */}
      {tab === 'all' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-16"
        >
          <h3 className="font-serif text-xl font-semibold text-center mb-6">
            Need Inspiration?
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {inspirationDestinations.map((dest, i) => (
              <motion.div
                key={dest.name}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                onClick={() => navigate(`/explore?destination=${encodeURIComponent(dest.name)}`)}
                className="group relative h-48 rounded-2xl overflow-hidden cursor-pointer shadow-soft hover:shadow-elevated transition-all"
              >
                <img 
                  src={dest.image} 
                  alt={dest.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between">
                  <span className="font-serif text-xl text-white font-semibold">{dest.name}</span>
                  <ArrowRight className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transform translate-x-2 group-hover:translate-x-0 transition-all" />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

export default function TripDashboard() {
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  // Fetch trips directly from Supabase
  useEffect(() => {
    async function loadTrips() {
      if (!isAuthenticated || !user?.id) {
        setTrips([]);
        setIsLoading(false);
        return;
      }

      try {
        const { data, error: fetchError } = await supabase
          .from('trips')
          .select('*')
          .eq('user_id', user.id)
          .order('updated_at', { ascending: false })
          .limit(50);

        if (fetchError) throw fetchError;

        const mappedTrips: Trip[] = (data || []).map(row => ({
          id: row.id,
          destination: row.destination,
          name: row.name,
          startDate: row.start_date,
          endDate: row.end_date,
          status: row.status as TripStatus,
          travelers: row.travelers || 1,
          departureCity: row.origin_city,
          flightSelection: row.flight_selection,
          hotelSelection: row.hotel_selection,
          metadata: row.metadata as Record<string, any> | null,
          hasItineraryData: !!row.itinerary_data,
        }));

        setTrips(mappedTrips);
      } catch (err: any) {
        console.error('Failed to load trips:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    }

    loadTrips();
  }, [isAuthenticated, user?.id]);

  // Simplified filtering - drafts are now included in "upcoming"
  const filterTrips = (tab: TabValue): Trip[] => {
    const now = new Date();
    switch (tab) {
      case 'active':
        // Currently happening trips
        return trips.filter(t => {
          if (t.status === 'completed' || t.status === 'cancelled') return false;
          if (!t.startDate || !t.endDate) return false;
          const start = new Date(t.startDate);
          const end = new Date(t.endDate);
          return start <= now && end >= now;
        });
      case 'upcoming': 
        // All future trips regardless of status (draft, planning, booked)
        return trips.filter(t => {
          // Exclude completed/cancelled
          if (t.status === 'completed' || t.status === 'cancelled') return false;
          // Exclude past trips
          if (t.endDate && new Date(t.endDate) < now) return false;
          // Exclude currently active trips (they have their own section)
          if (t.startDate && t.endDate) {
            const start = new Date(t.startDate);
            const end = new Date(t.endDate);
            if (start <= now && end >= now) return false;
          }
          return true;
        });
      case 'completed': 
        return trips.filter(t => 
          t.status === 'completed' || 
          (t.endDate && new Date(t.endDate) < now)
        );
      default: 
        return trips;
    }
  };

  const filteredTrips = filterTrips(activeTab);
  const activeCount = filterTrips('active').length;
  const upcomingCount = filterTrips('upcoming').length;
  const completedCount = filterTrips('completed').length;
  const activeTrips = filterTrips('active');

  // Group trips by destination
  const groupedTrips = useMemo(() => {
    const groups: Record<string, TripGroup> = {};
    
    filteredTrips.forEach(trip => {
      const baseDestination = getBaseDestination(trip.destination);
      const region = getRegion(trip.destination);
      
      if (!groups[baseDestination]) {
        groups[baseDestination] = {
          key: baseDestination,
          label: baseDestination,
          trips: [],
          region,
        };
      }
      groups[baseDestination].trips.push(trip);
    });

    // Sort groups: multi-trip groups first, then alphabetically
    return Object.values(groups).sort((a, b) => {
      if (a.trips.length > 1 && b.trips.length <= 1) return -1;
      if (b.trips.length > 1 && a.trips.length <= 1) return 1;
      return a.label.localeCompare(b.label);
    });
  }, [filteredTrips]);

  // Check if we should show grouped view (when there are destination duplicates)
  const hasMultipleSameDestination = groupedTrips.some(g => g.trips.length > 1);

  // Auto-expand groups with multiple trips on first load
  useEffect(() => {
    if (hasMultipleSameDestination && expandedGroups.size === 0) {
      const multiGroups = groupedTrips.filter(g => g.trips.length > 1).map(g => g.key);
      setExpandedGroups(new Set(multiGroups));
    }
  }, [groupedTrips, hasMultipleSameDestination]);

  return (
    <MainLayout>
      <Head title="My Trips | Voyance" description="Manage your travel adventures and plan new trips." />
      
      <section className="pt-24 pb-20 min-h-screen bg-gradient-to-b from-background to-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 mb-10"
          >
            <div>
              <h1 className="font-serif text-4xl md:text-5xl font-bold mb-2 tracking-tight">
                My Trips
              </h1>
              <p className="text-muted-foreground text-lg">
                {trips.length > 0 
                  ? `${trips.length} adventure${trips.length > 1 ? 's' : ''} in your collection`
                  : 'Your travel adventures start here'}
              </p>
              <DraftLimitBanner compact className="mt-2" />
            </div>
            <Button 
              onClick={() => navigate('/start')} 
              size="lg" 
              className="gap-2 shadow-lg hover:shadow-xl transition-shadow"
            >
              <Plus className="h-5 w-5" />
              New Trip
            </Button>
          </motion.div>

          {/* Free tier limit banner */}
          <DraftLimitBanner className="mb-6" />

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <TabsList className="bg-card border border-border p-1 h-auto flex-wrap">
                <TabsTrigger value="all" className="gap-2 px-4 py-2.5">
                  All
                  {trips.length > 0 && (
                    <Badge variant="secondary" className="text-xs">{trips.length}</Badge>
                  )}
                </TabsTrigger>
                {activeCount > 0 && (
                  <TabsTrigger value="active" className="gap-2 px-4 py-2.5">
                    <Zap className="h-4 w-4 text-green-500" />
                    <span className="text-green-600 font-medium">Live Now</span>
                    <Badge className="bg-green-500 text-white border-0 text-xs">{activeCount}</Badge>
                  </TabsTrigger>
                )}
                <TabsTrigger value="upcoming" className="gap-2 px-4 py-2.5">
                  <Clock className="h-4 w-4" />
                  Upcoming
                  {upcomingCount > 0 && (
                    <Badge variant="secondary" className="text-xs">{upcomingCount}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="completed" className="gap-2 px-4 py-2.5">
                  <CheckCircle className="h-4 w-4" />
                  Past
                  {completedCount > 0 && (
                    <Badge variant="secondary" className="text-xs">{completedCount}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </motion.div>

            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div 
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                >
                  {[...Array(3)].map((_, i) => (
                    <Card key={i} className="overflow-hidden">
                      <Skeleton className="h-52 rounded-none" />
                      <div className="p-5 space-y-3">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-10 w-full" />
                      </div>
                    </Card>
                  ))}
                </motion.div>
              ) : error ? (
                <motion.div 
                  key="error"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="py-2"
                >
                  {/* If trips fail to load (often because user isn't signed in), still show an enticing empty state */}
                  <EmptyState tab="all" />
                </motion.div>
              ) : trips.length === 0 ? (
                <motion.div key="empty-all">
                  <EmptyState tab="all" />
                </motion.div>
              ) : (
                <>
                  {/* Active Trips Section - Prominent display at top when on 'all' tab */}
                  {activeTab === 'all' && activeTrips.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mb-8"
                    >
                      <div className="flex items-center gap-2 mb-4">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                        <h2 className="font-serif text-xl font-semibold">Happening Now</h2>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {activeTrips.map((trip) => (
                          <ActiveTripCard key={trip.id} trip={trip} />
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {/* Active Tab Content - When specifically on 'active' tab */}
                  {activeTab === 'active' && (
                    <TabsContent key="active" value="active" className="mt-0">
                      {activeTrips.length > 0 ? (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="space-y-6"
                        >
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {activeTrips.map((trip) => (
                              <ActiveTripCard key={trip.id} trip={trip} />
                            ))}
                          </div>
                        </motion.div>
                      ) : (
                        <EmptyState tab={activeTab} />
                      )}
                    </TabsContent>
                  )}

                  {/* Regular Tab Content */}
                  {activeTab !== 'active' && (
                    <TabsContent key={activeTab} value={activeTab} className="mt-0">
                      {filteredTrips.length > 0 ? (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="space-y-6"
                        >
                      {hasMultipleSameDestination ? (
                        // Grouped view
                        groupedTrips.map((group, groupIndex) => (
                          group.trips.length > 1 ? (
                            // Collapsible folder for multiple trips
                            <Collapsible
                              key={group.key}
                              open={expandedGroups.has(group.key)}
                              onOpenChange={() => toggleGroup(group.key)}
                            >
                              <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: groupIndex * 0.05 }}
                                className="bg-card border border-border rounded-xl overflow-hidden"
                              >
                                <CollapsibleTrigger asChild>
                                  <button className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                                    <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                                        <FolderOpen className="h-5 w-5 text-primary" />
                                      </div>
                                      <div className="text-left">
                                        <h3 className="font-semibold text-foreground">{group.label}</h3>
                                        <p className="text-sm text-muted-foreground">
                                          {group.trips.length} trips • {group.region}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="secondary" className="text-xs">
                                        {group.trips.length}
                                      </Badge>
                                      {expandedGroups.has(group.key) ? (
                                        <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                      ) : (
                                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                                      )}
                                    </div>
                                  </button>
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <div className="p-4 pt-0 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {group.trips.map((trip, i) => (
                                      <TripCard key={trip.id} trip={trip} index={i} />
                                    ))}
                                  </div>
                                </CollapsibleContent>
                              </motion.div>
                            </Collapsible>
                          ) : (
                            // Single trip - show as regular card
                            <motion.div
                              key={group.key}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: groupIndex * 0.05 }}
                              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                            >
                              <TripCard trip={group.trips[0]} index={0} />
                            </motion.div>
                          )
                        ))
                      ) : (
                        // Flat view when no duplicates
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {filteredTrips.map((trip, i) => (
                            <TripCard key={trip.id} trip={trip} index={i} />
                          ))}
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <EmptyState tab={activeTab} />
                  )}
                </TabsContent>
                  )}
                </>
              )}
            </AnimatePresence>
          </Tabs>

          {/* Bottom CTA for users with trips */}
          {trips.length > 0 && (
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              transition={{ delay: 0.5 }} 
              className="mt-16 text-center"
            >
              <div className="inline-flex items-center gap-4 p-6 rounded-2xl bg-card border border-border">
                <Globe className="h-8 w-8 text-primary" />
                <div className="text-left">
                  <p className="font-medium">Ready for your next adventure?</p>
                  <p className="text-sm text-muted-foreground">Discover new destinations tailored to your style</p>
                </div>
                <Button onClick={() => navigate('/explore')} variant="outline" className="gap-2 ml-4">
                  Explore
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </div>
      </section>
    </MainLayout>
  );
}
