import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Plus, 
  Plane, 
  Calendar, 
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
import { Skeleton } from '@/components/ui/skeleton';
import { 
  useTrips, 
  type Trip, 
  type DisplayStatus,
  mapToDisplayStatus
} from '@/services/tripsEnhancedAPI';
import { useAuth } from '@/contexts/AuthContext';

type TabValue = 'all' | 'upcoming' | 'drafts' | 'completed';

const statusConfig: Record<DisplayStatus, { label: string; color: string; icon: typeof Edit3 }> = {
  draft: { label: 'Draft', color: 'bg-muted text-muted-foreground', icon: Edit3 },
  upcoming: { label: 'Upcoming', color: 'bg-primary/20 text-primary border border-primary/30', icon: Clock },
  completed: { label: 'Completed', color: 'bg-green-500/20 text-green-700 border border-green-500/30', icon: CheckCircle },
  canceled: { label: 'Cancelled', color: 'bg-destructive/20 text-destructive border border-destructive/30', icon: Edit3 },
};

function formatDate(dateString: string | null): string {
  if (!dateString) return 'TBD';
  return new Date(dateString).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function TripCard({ trip, index = 0 }: { trip: Trip; index?: number }) {
  const navigate = useNavigate();
  const displayStatus = mapToDisplayStatus(trip.status);
  const status = statusConfig[displayStatus];
  const StatusIcon = status.icon;
  const imageUrl = (trip.metadata as Record<string, unknown>)?.imageUrl as string || 
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&q=80';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      onClick={() => navigate(displayStatus === 'upcoming' || displayStatus === 'completed' ? `/itinerary/${trip.id}` : `/trip/${trip.id}`)}
      className="group relative bg-card rounded-2xl overflow-hidden border border-border shadow-sm hover:shadow-lg transition-all cursor-pointer"
    >
      <div className="relative h-48 overflow-hidden">
        <img src={imageUrl} alt={trip.destination} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <Badge className={`absolute top-4 right-4 ${status.color} gap-1.5`}>
          <StatusIcon className="h-3 w-3" />{status.label}
        </Badge>
        <h3 className="absolute bottom-4 left-4 font-serif text-2xl font-semibold text-white drop-shadow-md">{trip.destination}</h3>
      </div>
      <div className="p-5 space-y-4">
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5"><Calendar className="h-4 w-4" /><span>{formatDate(trip.startDate)} – {formatDate(trip.endDate)}</span></div>
          {trip.departureCity && <div className="flex items-center gap-1.5"><Plane className="h-4 w-4" /><span>From {trip.departureCity}</span></div>}
        </div>
        <Button variant={displayStatus === 'upcoming' ? 'outline' : 'default'} className="w-full">
          {displayStatus === 'upcoming' || displayStatus === 'completed' ? 'View Itinerary' : 'Continue Planning'}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </motion.div>
  );
}

function EmptyState({ tab }: { tab: TabValue }) {
  const navigate = useNavigate();
  const content = {
    all: { icon: Globe, title: 'No trips yet', description: 'Start planning your first adventure.', cta: 'Start Planning' },
    upcoming: { icon: Plane, title: 'No upcoming trips', description: 'Book a trip to see it here.', cta: 'Explore Destinations' },
    drafts: { icon: Edit3, title: 'No drafts', description: 'Start planning and save as draft.', cta: 'Start New Trip' },
    completed: { icon: CheckCircle, title: 'No past trips', description: 'Completed trips will appear here.', cta: 'Plan Your First Trip' },
  };
  const { icon: Icon, title, description, cta } = content[tab];
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-6"><Icon className="h-10 w-10 text-muted-foreground" /></div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground max-w-md mb-8">{description}</p>
      <Button onClick={() => navigate('/explore')} size="lg" className="gap-2"><Sparkles className="h-4 w-4" />{cta}</Button>
    </motion.div>
  );
}

export default function TripDashboard() {
  const [activeTab, setActiveTab] = useState<TabValue>('all');
  const navigate = useNavigate();
  const { data: tripsData, isLoading, error } = useTrips({ limit: 50, sortBy: 'updatedAt', sortOrder: 'desc' });
  const trips = tripsData?.data || [];

  const filterTrips = (tab: TabValue): Trip[] => {
    const now = new Date();
    switch (tab) {
      case 'upcoming': return trips.filter(t => ['booked', 'confirmed', 'planned'].includes(t.status) && t.startDate && new Date(t.startDate) > now);
      case 'drafts': return trips.filter(t => t.status === 'draft');
      case 'completed': return trips.filter(t => t.status === 'completed' || (t.status === 'booked' && t.endDate && new Date(t.endDate) < now));
      default: return trips;
    }
  };

  const filteredTrips = filterTrips(activeTab);

  return (
    <MainLayout>
      <Head title="My Trips | Voyance" />
      <section className="pt-24 pb-16 min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div><h1 className="font-serif text-3xl sm:text-4xl font-bold mb-2">My Trips</h1><p className="text-muted-foreground">Manage your adventures.</p></div>
            <Button onClick={() => navigate('/start')} size="lg" className="gap-2"><Plus className="h-5 w-5" />New Trip</Button>
          </motion.div>
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)} className="space-y-8">
            <TabsList className="grid grid-cols-4 w-full max-w-lg">
              <TabsTrigger value="all">All<Badge variant="secondary" className="ml-1 text-xs">{trips.length}</Badge></TabsTrigger>
              <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
              <TabsTrigger value="drafts">Drafts</TabsTrigger>
              <TabsTrigger value="completed">Past</TabsTrigger>
            </TabsList>
            <AnimatePresence mode="wait">
              {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-72 rounded-2xl" />)}</div>
              ) : error ? (
                <div className="text-center py-12"><p className="text-muted-foreground mb-4">Failed to load trips</p><Button variant="outline" onClick={() => window.location.reload()}>Try Again</Button></div>
              ) : (
                <TabsContent value={activeTab} className="mt-0">
                  {filteredTrips.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{filteredTrips.map((trip, i) => <TripCard key={trip.id} trip={trip} index={i} />)}</div>
                  ) : <EmptyState tab={activeTab} />}
                </TabsContent>
              )}
            </AnimatePresence>
          </Tabs>
          {trips.length > 0 && <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-16 text-center"><Link to="/explore"><Button variant="outline" className="gap-2"><Globe className="h-4 w-4" />Explore Destinations</Button></Link></motion.div>}
        </div>
      </section>
    </MainLayout>
  );
}
