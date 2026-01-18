import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  MapPin, 
  Calendar, 
  Globe, 
  Settings, 
  ChevronRight,
  Plus,
  Compass,
  Star,
  Clock,
  Loader2,
  CreditCard,
  Check,
  Crown,
  RefreshCw
} from 'lucide-react';
import TopNav from '@/components/common/TopNav';
import Footer from '@/components/common/Footer';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { useAuth, isDemoModeEnabled } from '@/contexts/AuthContext';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { formatEnumDisplay } from '@/utils/textFormatting';
import { toast } from 'sonner';
import AvatarUpload from '@/components/profile/AvatarUpload';
import TravelDNAReveal from '@/components/profile/TravelDNAReveal';
import TravelMap from '@/components/profile/TravelMap';
import SurpriseTripCard from '@/components/profile/SurpriseTripCard';
import RotatingCoverPhoto from '@/components/profile/RotatingCoverPhoto';
import FriendsSection from '@/components/profile/FriendsSection';
import MemoryLane from '@/components/profile/MemoryLane';

type TabType = 'overview' | 'trips' | 'friends' | 'subscription' | 'preferences';

// Subscription tiers config
const SUBSCRIPTION_TIERS = {
  voyage: {
    name: 'Voyage',
    description: 'For travelers who plan regularly',
    price: 15.99,
    priceId: 'price_1RpYVWFYxIg9jcJU4t3JVCy0',
    productId: 'prod_Sl4euoo6l8HCIE',
    features: [
      'Unlimited trip planning',
      'AI-powered itineraries',
      'Flight & hotel recommendations',
      'Email support',
    ],
  },
  wanderlust: {
    name: 'Wanderlust',
    description: 'For digital nomads & frequent travelers',
    price: 119.99,
    priceId: 'price_1RpYWpFYxIg9jcJUPrSLmFsu',
    productId: 'prod_Sl4gxTsm0MDnN6',
    features: [
      'Everything in Voyage',
      'Priority support',
      'Advanced customization',
      'Exclusive deals',
      'Offline access',
    ],
  },
};

interface SubscriptionStatus {
  subscribed: boolean;
  product_id: string | null;
  price_id: string | null;
  subscription_end: string | null;
}

interface DisplayTrip {
  id: string;
  destination: string;
  dates: string;
  status: 'upcoming' | 'completed' | 'draft';
  image: string;
  progress?: number;
  rating?: number;
}

// Use centralized curated image utility
import { getDestinationImage as getCuratedDestinationImage } from '@/utils/destinationImages';

function getDestinationImage(destination: string): string {
  return getCuratedDestinationImage(destination);
}

// Transform API trip to display format
function transformTrip(trip: any): DisplayTrip {
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
  const isDemo = isDemoModeEnabled();

  // Redirect if not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      navigate(ROUTES.SIGNIN);
    }
  }, [isAuthenticated, navigate]);

  // Load trips from Supabase
  useEffect(() => {
    async function loadTrips() {
      if (!user?.id) return;
      
      setIsLoadingTrips(true);
      try {
        const { data, error } = await supabase
          .from('trips')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        if (data) {
          setTrips(data.map(transformTrip));
        }
      } catch (error) {
        console.error('Failed to load trips:', error);
      } finally {
        setIsLoadingTrips(false);
      }
    }
    
    loadTrips();
  }, [user?.id]);

  const [searchParams] = useSearchParams();
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState<string | null>(null);

  // Handle success/cancel query params
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success('Subscription activated successfully!');
      setActiveTab('subscription');
      checkSubscription();
    } else if (searchParams.get('canceled') === 'true') {
      toast.info('Checkout canceled');
    }
  }, [searchParams]);

  // Check subscription status
  const checkSubscription = async () => {
    setIsLoadingSubscription(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (error) throw error;
      setSubscription(data);
    } catch (error) {
      console.error('Failed to check subscription:', error);
    } finally {
      setIsLoadingSubscription(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      checkSubscription();
    }
  }, [isAuthenticated]);

  // Handle checkout
  const handleCheckout = async (priceId: string) => {
    setIsCheckingOut(priceId);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId, mode: 'subscription' },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      console.error('Checkout error:', error);
      toast.error(error.message || 'Failed to start checkout');
    } finally {
      setIsCheckingOut(null);
    }
  };

  // Handle manage subscription
  const handleManageSubscription = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: any) {
      console.error('Portal error:', error);
      toast.error(error.message || 'Failed to open billing portal');
    }
  };

  // Get current tier
  const getCurrentTier = () => {
    if (!subscription?.product_id) return null;
    return Object.values(SUBSCRIPTION_TIERS).find(t => t.productId === subscription.product_id);
  };

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
    { id: 'friends' as const, label: 'Friends' },
    { id: 'subscription' as const, label: 'Subscription' },
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
        {/* Rotating Cover Photo */}
        <RotatingCoverPhoto userId={user?.id} />

        {/* Profile Info */}
        <div className="max-w-5xl mx-auto px-4 -mt-20 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end gap-6">
            {/* Avatar */}
            <AvatarUpload
              currentAvatar={user?.avatar}
              userName={user?.name || user?.email}
              userId={user?.id || ''}
              size="lg"
            />

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

            {/* Travel DNA Reveal */}
            <TravelDNAReveal userId={user?.id || ''} />

            {/* Travel Map */}
            <TravelMap userId={user?.id || ''} />

            {/* Removed from overview - now in its own tab */}

            {/* Surprise Trip Card - show as premium for demo users */}
            <SurpriseTripCard isPremium={isDemo || !!subscription?.subscribed} />

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

            {/* Memory Lane - Past Trip Reviews */}
            <MemoryLane className="mt-12" />
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

        {activeTab === 'friends' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <FriendsSection userId={user?.id || ''} />
          </motion.div>
        )}

        {activeTab === 'subscription' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-8"
          >
            {/* Current Status */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Your Subscription</h2>
                <p className="text-sm text-muted-foreground">
                  {subscription?.subscribed 
                    ? `Active until ${subscription.subscription_end ? format(new Date(subscription.subscription_end), 'MMMM d, yyyy') : 'N/A'}`
                    : 'No active subscription'}
                </p>
              </div>
              {isLoadingSubscription && (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              )}
            </div>

            {/* Subscription Cards */}
            <div className="grid md:grid-cols-2 gap-6">
              {Object.entries(SUBSCRIPTION_TIERS).map(([key, tier]) => {
                const isCurrentPlan = subscription?.product_id === tier.productId;
                return (
                  <div
                    key={key}
                    className={cn(
                      "relative p-6 rounded-xl border-2 transition-all",
                      isCurrentPlan 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:border-muted-foreground/50"
                    )}
                  >
                    {isCurrentPlan && (
                      <div className="absolute -top-3 left-4 px-3 py-1 bg-primary text-primary-foreground text-xs font-medium rounded-full flex items-center gap-1">
                        <Crown className="h-3 w-3" />
                        Current Plan
                      </div>
                    )}
                    <div className="mb-4">
                      <h3 className="text-xl font-semibold text-foreground">{tier.name}</h3>
                      <p className="text-sm text-muted-foreground">{tier.description}</p>
                    </div>
                    <div className="mb-6">
                      <span className="text-3xl font-bold text-foreground">${tier.price}</span>
                      <span className="text-muted-foreground">/month</span>
                    </div>
                    <ul className="space-y-3 mb-6">
                      {tier.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="text-muted-foreground">{feature}</span>
                        </li>
                      ))}
                    </ul>
                    {isCurrentPlan ? (
                      <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={handleManageSubscription}
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        Manage Subscription
                      </Button>
                    ) : (
                      <Button 
                        className="w-full"
                        onClick={() => handleCheckout(tier.priceId)}
                        disabled={isCheckingOut === tier.priceId}
                      >
                        {isCheckingOut === tier.priceId ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Loading...
                          </>
                        ) : (
                          <>Subscribe</>
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Already subscribed - show manage button */}
            {subscription?.subscribed && (
              <div className="text-center pt-4">
                <Button variant="ghost" onClick={handleManageSubscription}>
                  <CreditCard className="h-4 w-4 mr-2" />
                  Manage Billing & Cancel
                </Button>
              </div>
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
              <span className="text-foreground">{formatEnumDisplay(item.value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
