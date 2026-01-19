import { useState, useEffect } from 'react';
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
  Loader2
} from 'lucide-react';

import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { getDestinationImage } from '@/utils/destinationImages';

type TabValue = 'all' | 'upcoming' | 'drafts' | 'completed';
type TripStatus = 'draft' | 'planning' | 'booked' | 'completed' | 'cancelled';
type DisplayStatus = 'draft' | 'upcoming' | 'completed' | 'canceled';

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
}

function mapToDisplayStatus(status: TripStatus): DisplayStatus {
  if (['booked', 'planning'].includes(status)) return 'upcoming';
  if (status === 'completed') return 'completed';
  if (status === 'cancelled') return 'canceled';
  return 'draft';
}

const statusConfig: Record<DisplayStatus, { label: string; color: string; icon: typeof Edit3 }> = {
  draft: { label: 'Draft', color: 'bg-amber-500/20 text-amber-700 border border-amber-500/30', icon: Edit3 },
  upcoming: { label: 'Upcoming', color: 'bg-primary/20 text-primary border border-primary/30', icon: Clock },
  completed: { label: 'Completed', color: 'bg-green-500/20 text-green-700 border border-green-500/30', icon: CheckCircle },
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
  const displayStatus = mapToDisplayStatus(trip.status);
  const status = statusConfig[displayStatus];
  const StatusIcon = status.icon;
  
  // Use curated destination images
  const imageUrl = getDestinationImage(trip.destination);
  
  // Check for booking status - use direct properties or metadata
  const hasItinerary = !!trip.metadata?.itinerary || trip.metadata?.itineraryGenerationStatus === 'completed';
  const hasFlight = !!trip.flightSelection;
  const hasHotel = !!trip.hotelSelection;
  const travelersCount = typeof trip.travelers === 'number' ? trip.travelers : 1;

  const handleCardClick = () => {
    if (displayStatus === 'upcoming' || displayStatus === 'completed') {
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
              <span>From {trip.departureCity}</span>
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
          {displayStatus === 'upcoming' || displayStatus === 'completed' ? (
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
              {!hasItinerary && (
                <Button 
                  onClick={() => navigate(`/trip/${trip.id}/itinerary`)} 
                  variant="outline" 
                  size="icon"
                  title="Generate Itinerary"
                >
                  <Sparkles className="h-4 w-4" />
                </Button>
              )}
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
            : tab === 'upcoming' 
            ? "No Upcoming Trips Yet"
            : tab === 'drafts'
            ? "No Draft Trips"
            : "No Past Adventures"}
        </h2>
        
        <p className="text-muted-foreground text-lg mb-8 max-w-md mx-auto">
          {tab === 'all' 
            ? "Start planning your dream vacation with personalized itineraries crafted just for you."
            : tab === 'upcoming'
            ? "Your confirmed trips will appear here. Start planning your next getaway!"
            : tab === 'drafts'
            ? "Trips you're working on will be saved here. Begin planning today!"
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
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();

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

  const filterTrips = (tab: TabValue): Trip[] => {
    const now = new Date();
    switch (tab) {
      case 'upcoming': 
        return trips.filter(t => 
          ['booked', 'confirmed', 'planning'].includes(t.status) && 
          t.startDate && new Date(t.startDate) > now
        );
      case 'drafts': 
        return trips.filter(t => t.status === 'draft');
      case 'completed': 
        return trips.filter(t => 
          t.status === 'completed' || 
          (t.status === 'booked' && t.endDate && new Date(t.endDate) < now)
        );
      default: 
        return trips;
    }
  };

  const filteredTrips = filterTrips(activeTab);
  const upcomingCount = filterTrips('upcoming').length;
  const draftsCount = filterTrips('drafts').length;
  const completedCount = filterTrips('completed').length;

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
                <TabsTrigger value="upcoming" className="gap-2 px-4 py-2.5">
                  <Clock className="h-4 w-4" />
                  Upcoming
                  {upcomingCount > 0 && (
                    <Badge variant="secondary" className="text-xs">{upcomingCount}</Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="drafts" className="gap-2 px-4 py-2.5">
                  <Edit3 className="h-4 w-4" />
                  Drafts
                  {draftsCount > 0 && (
                    <Badge variant="secondary" className="text-xs">{draftsCount}</Badge>
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
                <TabsContent key={activeTab} value={activeTab} className="mt-0">
                  {filteredTrips.length > 0 ? (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
                    >
                      {filteredTrips.map((trip, i) => (
                        <TripCard key={trip.id} trip={trip} index={i} />
                      ))}
                    </motion.div>
                  ) : (
                    <EmptyState tab={activeTab} />
                  )}
                </TabsContent>
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
