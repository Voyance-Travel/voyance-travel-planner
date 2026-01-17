import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Plane, 
  Calendar, 
  MapPin, 
  Users, 
  Clock, 
  ChevronRight,
  Sparkles,
  Globe,
  CheckCircle,
  Edit3
} from 'lucide-react';

import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { destinations } from '@/lib/destinations';
import type { Trip } from '@/lib/trips';
import { formatDate, isPriceLockActive, getPriceLockRemaining } from '@/lib/trips';

// Mock trips data for demonstration
const mockTrips: Trip[] = [
  {
    id: 'trip-1',
    userId: 'user-1',
    destinationId: 'kyoto',
    startDate: '2025-03-15',
    endDate: '2025-03-22',
    travelersCount: 2,
    departureCity: 'San Francisco',
    status: 'BOOKED',
    createdAt: '2024-12-01',
    updatedAt: '2024-12-15',
  },
  {
    id: 'trip-2',
    userId: 'user-1',
    destinationId: 'lisbon',
    startDate: '2025-06-10',
    endDate: '2025-06-18',
    travelersCount: 4,
    departureCity: 'New York',
    status: 'SAVED',
    priceLockExpiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
    createdAt: '2024-12-10',
    updatedAt: '2024-12-20',
  },
  {
    id: 'trip-3',
    userId: 'user-1',
    destinationId: 'barcelona',
    startDate: '2025-09-01',
    endDate: '2025-09-08',
    travelersCount: 2,
    departureCity: 'Los Angeles',
    status: 'DRAFT',
    createdAt: '2024-12-18',
    updatedAt: '2024-12-18',
  },
];

type TabValue = 'all' | 'upcoming' | 'drafts' | 'completed';

const statusConfig = {
  DRAFT: {
    label: 'Draft',
    color: 'bg-muted text-muted-foreground',
    icon: Edit3,
  },
  SAVED: {
    label: 'Price Locked',
    color: 'bg-accent/20 text-accent-foreground border border-accent/30',
    icon: Clock,
  },
  BOOKED: {
    label: 'Confirmed',
    color: 'bg-primary/20 text-primary border border-primary/30',
    icon: CheckCircle,
  },
};

function TripCard({ trip, index = 0 }: { trip: Trip; index?: number }) {
  const navigate = useNavigate();
  const destination = destinations.find(d => d.id === trip.destinationId);
  const [priceLockTime, setPriceLockTime] = useState<number>(0);
  
  useEffect(() => {
    if (trip.priceLockExpiresAt && isPriceLockActive(trip.priceLockExpiresAt)) {
      setPriceLockTime(getPriceLockRemaining(trip.priceLockExpiresAt));
      const interval = setInterval(() => {
        const remaining = getPriceLockRemaining(trip.priceLockExpiresAt);
        setPriceLockTime(remaining);
        if (remaining <= 0) clearInterval(interval);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [trip.priceLockExpiresAt]);

  if (!destination) return null;

  const status = statusConfig[trip.status];
  const StatusIcon = status.icon;
  
  const formatPriceLockTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m ${secs}s`;
  };

  const handleCardClick = () => {
    if (trip.status === 'BOOKED') {
      navigate(`/itinerary/${trip.id}`);
    } else {
      navigate(`/trip/${trip.id}`);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      onClick={handleCardClick}
      className="group relative bg-card rounded-2xl overflow-hidden border border-border shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer"
    >
      {/* Image Section */}
      <div className="relative h-48 overflow-hidden">
        <img 
          src={destination.imageUrl} 
          alt={destination.city}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        
        {/* Status Badge */}
        <Badge className={`absolute top-4 right-4 ${status.color} gap-1.5`}>
          <StatusIcon className="h-3 w-3" />
          {status.label}
        </Badge>
        
        {/* Price Lock Timer */}
        {trip.status === 'SAVED' && priceLockTime > 0 && (
          <div className="absolute bottom-4 left-4 bg-accent/90 backdrop-blur-sm text-accent-foreground px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 animate-pulse" />
            {formatPriceLockTime(priceLockTime)} remaining
          </div>
        )}
        
        {/* Destination Name Overlay */}
        <div className="absolute bottom-4 left-4 right-4">
          {!priceLockTime && (
            <h3 className="font-serif text-2xl font-semibold text-white drop-shadow-md">
              {destination.city}
            </h3>
          )}
        </div>
      </div>

      {/* Content Section */}
      <div className="p-5 space-y-4">
        {/* Title (visible if not shown on image) */}
        {priceLockTime > 0 && (
          <h3 className="font-serif text-xl font-semibold text-foreground">
            {destination.city}, {destination.country}
          </h3>
        )}
        
        {/* Trip Details */}
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            <span>{formatDate(trip.startDate)} – {formatDate(trip.endDate)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            <span>{trip.travelersCount} traveler{trip.travelersCount > 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Plane className="h-4 w-4" />
            <span>From {trip.departureCity}</span>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          {trip.status === 'BOOKED' ? (
            <Button variant="outline" className="w-full group/btn">
              View Itinerary
              <ChevronRight className="h-4 w-4 ml-1 group-hover/btn:translate-x-1 transition-transform" />
            </Button>
          ) : trip.status === 'SAVED' ? (
            <Button variant="accent" className="w-full">
              Complete Booking
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button variant="default" className="w-full">
              Continue Planning
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function EmptyState({ tab }: { tab: TabValue }) {
  const navigate = useNavigate();
  
  const content = {
    all: {
      icon: Globe,
      title: 'No trips yet',
      description: 'Start planning your first adventure. We\'ll help you create the perfect itinerary.',
      cta: 'Start Planning',
    },
    upcoming: {
      icon: Plane,
      title: 'No upcoming trips',
      description: 'Your next adventure awaits. Book a trip to see it here.',
      cta: 'Explore Destinations',
    },
    drafts: {
      icon: Edit3,
      title: 'No drafts',
      description: 'Start planning a trip and save it as a draft to continue later.',
      cta: 'Start New Trip',
    },
    completed: {
      icon: MapPin,
      title: 'No past trips',
      description: 'Once you\'ve traveled, your completed trips will appear here.',
      cta: 'Plan Your First Trip',
    },
  };

  const { icon: Icon, title, description, cta } = content[tab];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
    >
      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6">
        <Icon className="h-10 w-10 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-md mb-8">{description}</p>
      <Button onClick={() => navigate('/explore')} size="lg" className="gap-2">
        <Sparkles className="h-4 w-4" />
        {cta}
      </Button>
    </motion.div>
  );
}

export default function TripDashboard() {
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const [trips] = useState<Trip[]>(mockTrips);
  const navigate = useNavigate();

  const filterTrips = (tab: TabValue): Trip[] => {
    const now = new Date();
    switch (tab) {
      case 'upcoming':
        return trips.filter(t => t.status === 'BOOKED' && new Date(t.startDate) > now);
      case 'drafts':
        return trips.filter(t => t.status === 'DRAFT' || t.status === 'SAVED');
      case 'completed':
        return trips.filter(t => t.status === 'BOOKED' && new Date(t.endDate) < now);
      default:
        return trips;
    }
  };

  const filteredTrips = filterTrips(activeTab);
  const upcomingCount = filterTrips('upcoming').length;
  const draftsCount = filterTrips('drafts').length;

  return (
    <MainLayout>
      <Head title="My Trips | Voyance" />
      
      <section className="pt-24 pb-16 min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8"
          >
            <div>
              <h1 className="font-serif text-3xl sm:text-4xl font-bold text-foreground mb-2">
                My Trips
              </h1>
              <p className="text-muted-foreground">
                Manage your upcoming adventures and continue planning saved trips.
              </p>
            </div>
            <Button 
              onClick={() => navigate('/start')}
              size="lg" 
              className="gap-2 shrink-0"
            >
              <Plus className="h-5 w-5" />
              New Trip
            </Button>
          </motion.div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="space-y-8">
            <TabsList className="grid grid-cols-4 w-full max-w-lg">
              <TabsTrigger value="all" className="gap-2">
                All
                <Badge variant="secondary" className="ml-1 text-xs">
                  {trips.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="gap-2">
                Upcoming
                {upcomingCount > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {upcomingCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="drafts" className="gap-2">
                Drafts
                {draftsCount > 0 && (
                  <Badge variant="secondary" className="ml-1 text-xs">
                    {draftsCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="completed">Past</TabsTrigger>
            </TabsList>

            <AnimatePresence mode="wait">
              {['all', 'upcoming', 'drafts', 'completed'].map((tab) => (
                <TabsContent key={tab} value={tab} className="mt-0">
                  {filteredTrips.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredTrips.map((trip, index) => (
                        <TripCard key={trip.id} trip={trip} index={index} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState tab={activeTab} />
                  )}
                </TabsContent>
              ))}
            </AnimatePresence>
          </Tabs>

          {/* Quick Actions */}
          {trips.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="mt-16 text-center"
            >
              <p className="text-muted-foreground mb-4">
                Looking for inspiration?
              </p>
              <Link to="/explore">
                <Button variant="outline" className="gap-2">
                  <Globe className="h-4 w-4" />
                  Explore Destinations
                </Button>
              </Link>
            </motion.div>
          )}
        </div>
      </section>
    </MainLayout>
  );
}
