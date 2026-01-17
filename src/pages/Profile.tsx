import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { 
  MapPin, 
  Calendar, 
  Globe, 
  Settings, 
  Camera,
  ChevronRight,
  Plus,
  Compass,
  Star,
  Clock,
  Loader2
} from 'lucide-react';
import TopNav from '@/components/common/TopNav';
import Footer from '@/components/common/Footer';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';
import { tripsApi, Trip } from '@/services/neonDb';
import { format } from 'date-fns';

type TabType = 'overview' | 'trips' | 'preferences';

interface DisplayTrip {
  id: string;
  destination: string;
  dates: string;
  status: 'upcoming' | 'completed' | 'draft';
  image: string;
  progress?: number;
  rating?: number;
}

// Helper to get destination image
function getDestinationImage(destination: string): string {
  const images: Record<string, string> = {
    'japan': 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400',
    'kyoto': 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400',
    'tokyo': 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400',
    'paris': 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400',
    'france': 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400',
    'italy': 'https://images.unsplash.com/photo-1534445867742-43195f401b6c?w=400',
    'rome': 'https://images.unsplash.com/photo-1534445867742-43195f401b6c?w=400',
    'greece': 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=400',
    'santorini': 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=400',
    'spain': 'https://images.unsplash.com/photo-1583422409516-2895a77efded?w=400',
    'barcelona': 'https://images.unsplash.com/photo-1583422409516-2895a77efded?w=400',
    'iceland': 'https://images.unsplash.com/photo-1520769945061-0a448c463865?w=400',
  };
  
  const lower = destination.toLowerCase();
  for (const [key, url] of Object.entries(images)) {
    if (lower.includes(key)) return url;
  }
  return 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400';
}

// Transform API trip to display format
function transformTrip(trip: Trip): DisplayTrip {
  const startDate = trip.start_date ? new Date(trip.start_date) : null;
  const endDate = trip.end_date ? new Date(trip.end_date) : null;
  
  let dates = 'Planning...';
  if (startDate && endDate) {
    dates = `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`;
  }
  
  let status: 'upcoming' | 'completed' | 'draft' = 'draft';
  if (trip.status === 'completed') {
    status = 'completed';
  } else if (trip.status === 'booked' || (startDate && startDate > new Date())) {
    status = 'upcoming';
  }
  
  return {
    id: trip.id,
    destination: trip.destination || 'Unknown Destination',
    dates,
    status,
    image: getDestinationImage(trip.destination || ''),
    progress: status === 'upcoming' ? 75 : undefined,
    rating: status === 'completed' ? 4 : undefined,
  };
}

export default function Profile() {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [trips, setTrips] = useState<DisplayTrip[]>([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(true);

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate(ROUTES.SIGNIN);
    }
  }, [isAuthenticated, navigate]);

  // Load trips from Neon
  useEffect(() => {
    async function loadTrips() {
      if (!user?.id) return;
      
      setIsLoadingTrips(true);
      try {
        const result = await tripsApi.list(user.id);
        if (result.data) {
          setTrips(result.data.map(transformTrip));
        }
      } catch (error) {
        console.error('Failed to load trips:', error);
      } finally {
        setIsLoadingTrips(false);
      }
    }
    
    loadTrips();
  }, [user?.id]);

  if (!isAuthenticated) {
    return null;
  }

  // Compute stats from real trips
  const upcomingTrips = trips.filter(t => t.status === 'upcoming');
  const completedTrips = trips.filter(t => t.status === 'completed');
  const savedTrips = trips.filter(t => t.status === 'draft');

  const stats = {
    tripsCompleted: completedTrips.length,
    countriesVisited: completedTrips.length, // Simplified - would need real country data
    daysOnTheRoad: completedTrips.length * 7, // Estimate
    upcomingTrips: upcomingTrips.length,
  };

  const travelDNA = user?.preferences ? {
    archetype: user.preferences.style === 'luxury' ? 'Refined Explorer' 
             : user.preferences.style === 'adventure' ? 'Bold Adventurer'
             : user.preferences.style === 'cultural' ? 'Culture Seeker'
             : 'Mindful Traveler',
    traits: [
      user.preferences.style,
      user.preferences.pace,
      user.preferences.budget,
    ].filter(Boolean),
    interests: user.preferences.interests || [],
  } : null;

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'trips' as const, label: 'My Trips' },
    { id: 'preferences' as const, label: 'Preferences' },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Head
        title={`${user?.name || 'Profile'} | Voyance`}
        description="Your travel profile, preferences, and trip history."
      />
      <TopNav />

      {/* Hero Header */}
      <section className="relative pt-20">
        {/* Cover Image */}
        <div className="h-64 md:h-80 relative overflow-hidden">
          <img
            src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1920"
            alt="Cover"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent" />
        </div>

        {/* Profile Info */}
        <div className="max-w-5xl mx-auto px-4 -mt-20 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end gap-6">
            {/* Avatar */}
            <div className="relative">
              <div className="w-32 h-32 md:w-40 md:h-40 rounded-full border-4 border-background bg-muted flex items-center justify-center overflow-hidden">
                {user?.avatar ? (
                  <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="text-4xl md:text-5xl font-display font-medium text-muted-foreground">
                    {user?.name?.charAt(0) || user?.email?.charAt(0) || 'V'}
                  </span>
                )}
              </div>
              <button className="absolute bottom-2 right-2 p-2 bg-background border border-border rounded-full shadow-sm hover:bg-muted transition-colors">
                <Camera className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {/* Name & Handle */}
            <div className="flex-1 pb-2">
              <h1 className="text-2xl md:text-3xl font-display font-semibold text-foreground">
                {user?.name || 'Traveler'}
              </h1>
              <p className="text-muted-foreground">{user?.email}</p>
              {travelDNA && (
                <p className="text-sm text-primary font-medium mt-1">
                  {travelDNA.archetype}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pb-2">
              <Button variant="outline" size="sm" asChild>
                <Link to={ROUTES.PROFILE.EDIT}>
                  <Settings className="h-4 w-4 mr-2" />
                  Edit Profile
                </Link>
              </Button>
              <Button size="sm" asChild>
                <Link to={ROUTES.START}>
                  <Plus className="h-4 w-4 mr-2" />
                  Plan Trip
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Tab Navigation */}
      <section className="border-b border-border mt-8">
        <div className="max-w-5xl mx-auto px-4">
          <nav className="flex gap-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'py-4 text-sm font-medium border-b-2 transition-colors',
                  activeTab === tab.id
                    ? 'border-foreground text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </section>

      {/* Content */}
      <main className="max-w-5xl mx-auto px-4 py-12">
        {activeTab === 'overview' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-12"
          >
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Trips Completed', value: stats.tripsCompleted, icon: Compass },
                { label: 'Countries Visited', value: stats.countriesVisited, icon: Globe },
                { label: 'Days Traveling', value: stats.daysOnTheRoad, icon: Calendar },
                { label: 'Upcoming Trips', value: stats.upcomingTrips, icon: MapPin },
              ].map((stat) => (
                <div key={stat.label} className="p-6 bg-muted/30 rounded-lg">
                  <stat.icon className="h-5 w-5 text-muted-foreground mb-3" />
                  <p className="text-3xl font-display font-semibold text-foreground">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Travel DNA */}
            {travelDNA && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-4">Your Travel DNA</h2>
                <div className="p-6 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Compass className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{travelDNA.archetype}</h3>
                      <p className="text-sm text-muted-foreground">Your travel personality</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {travelDNA.traits.map((trait) => (
                      <span key={trait} className="px-3 py-1 bg-background rounded-full text-sm text-muted-foreground capitalize">
                        {trait}
                      </span>
                    ))}
                  </div>
                  {travelDNA.interests.length > 0 && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Interests</p>
                      <div className="flex flex-wrap gap-2">
                        {travelDNA.interests.map((interest) => (
                          <span key={interest} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm capitalize">
                            {interest}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <Button variant="ghost" size="sm" className="mt-4" asChild>
                    <Link to={ROUTES.QUIZ}>
                      Retake Quiz
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Link>
                  </Button>
                </div>
              </div>
            )}

            {/* Upcoming Trips */}
            {upcomingTrips.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-foreground">Upcoming Trip</h2>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('trips')}>
                    View all
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
                <div className="grid gap-4">
                  {upcomingTrips.map((trip) => (
                    <Link
                      key={trip.id}
                      to={`/trip/${trip.id}`}
                      className="group flex gap-4 p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
                        <img src={trip.image} alt={trip.destination} className="w-full h-full object-cover" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                          {trip.destination}
                        </h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <Calendar className="h-3 w-3" />
                          {trip.dates}
                        </p>
                        {trip.progress && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                              <span>Planning progress</span>
                              <span>{trip.progress}%</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${trip.progress}%` }}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Trips */}
            {completedTrips.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-foreground mb-4">Recent Adventures</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  {completedTrips.map((trip) => (
                    <Link
                      key={trip.id}
                      to={`/trip/${trip.id}`}
                      className="group block"
                    >
                      <div className="aspect-[16/10] rounded-lg overflow-hidden mb-3">
                        <img 
                          src={trip.image} 
                          alt={trip.destination} 
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                      <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
                        {trip.destination}
                      </h3>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {trip.dates}
                        </span>
                        {trip.rating && (
                          <span className="flex items-center gap-1">
                            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                            {trip.rating}
                          </span>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'trips' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-10"
          >
            {/* Loading state */}
            {isLoadingTrips && (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isLoadingTrips && (
              <>
                {/* Upcoming */}
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-4">Upcoming</h2>
                  {upcomingTrips.length > 0 ? (
                    <div className="grid gap-4">
                      {upcomingTrips.map((trip) => (
                        <TripCard key={trip.id} trip={trip} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState message="No upcoming trips" action="Plan a Trip" />
                  )}
                </div>

                {/* Completed */}
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-4">Completed</h2>
                  {completedTrips.length > 0 ? (
                    <div className="grid sm:grid-cols-2 gap-4">
                      {completedTrips.map((trip) => (
                        <TripCard key={trip.id} trip={trip} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState message="No completed trips yet" />
                  )}
                </div>

                {/* Saved */}
                <div>
                  <h2 className="text-lg font-semibold text-foreground mb-4">Saved Ideas</h2>
                  {savedTrips.length > 0 ? (
                    <div className="grid sm:grid-cols-2 gap-4">
                      {savedTrips.map((trip) => (
                        <TripCard key={trip.id} trip={trip} />
                      ))}
                    </div>
                  ) : (
                    <EmptyState message="No saved trips" />
                  )}
                </div>
              </>
            )}
          </motion.div>
        )}

        {activeTab === 'preferences' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            <PreferenceSection
              title="Travel Style"
              items={[
                { label: 'Primary Style', value: user?.preferences?.style || 'Not set' },
                { label: 'Travel Pace', value: user?.preferences?.pace || 'Not set' },
                { label: 'Budget Level', value: user?.preferences?.budget || 'Not set' },
              ]}
            />
            <PreferenceSection
              title="Accommodation"
              items={[
                { label: 'Preferred Type', value: user?.preferences?.accommodation || 'Not set' },
              ]}
            />
            <PreferenceSection
              title="Interests"
              items={user?.preferences?.interests?.map(i => ({ label: i, value: '' })) || []}
              isTags
            />
            <div className="pt-4">
              <Button variant="outline" asChild>
                <Link to={ROUTES.QUIZ}>
                  Update Preferences
                </Link>
              </Button>
            </div>
          </motion.div>
        )}
      </main>

      <Footer />
    </div>
  );
}

// Helper Components
function TripCard({ trip }: { trip: { id: string; destination: string; dates: string; image: string; status: string; progress?: number; rating?: number } }) {
  return (
    <Link
      to={`/trip/${trip.id}`}
      className="group flex gap-4 p-4 bg-muted/30 rounded-lg hover:bg-muted/50 transition-colors"
    >
      <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
        <img src={trip.image} alt={trip.destination} className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
          {trip.destination}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">{trip.dates}</p>
        {trip.status === 'upcoming' && trip.progress !== undefined && (
          <div className="mt-2">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full" style={{ width: `${trip.progress}%` }} />
            </div>
          </div>
        )}
        {trip.status === 'completed' && trip.rating && (
          <div className="flex items-center gap-1 mt-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className={cn('h-3 w-3', i < trip.rating! ? 'fill-amber-400 text-amber-400' : 'text-muted')} />
            ))}
          </div>
        )}
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground self-center" />
    </Link>
  );
}

function EmptyState({ message, action }: { message: string; action?: string }) {
  return (
    <div className="text-center py-12 bg-muted/20 rounded-lg">
      <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
      <p className="text-muted-foreground mb-4">{message}</p>
      {action && (
        <Button asChild>
          <Link to={ROUTES.START}>
            <Plus className="h-4 w-4 mr-2" />
            {action}
          </Link>
        </Button>
      )}
    </div>
  );
}

function PreferenceSection({ title, items, isTags }: { title: string; items: { label: string; value: string }[]; isTags?: boolean }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">{title}</h3>
      {isTags ? (
        <div className="flex flex-wrap gap-2">
          {items.map((item) => (
            <span key={item.label} className="px-3 py-1.5 bg-muted rounded-full text-sm capitalize">
              {item.label}
            </span>
          ))}
          {items.length === 0 && <span className="text-muted-foreground text-sm">None set</span>}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.label} className="flex justify-between items-center py-2 border-b border-border">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="text-foreground capitalize">{item.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
