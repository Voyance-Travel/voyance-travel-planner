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
  RefreshCw,
  Sparkles,
  Zap,
  Plane,
  CheckCircle
} from 'lucide-react';
import TopNav from '@/components/common/TopNav';
import Footer from '@/components/common/Footer';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/config/routes';
import { STRIPE_PRODUCTS, PLAN_FEATURES } from '@/config/pricing';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { toast } from 'sonner';
import AvatarUpload from '@/components/profile/AvatarUpload';
import TravelDNAReveal from '@/components/profile/TravelDNAReveal';
import TravelMap from '@/components/profile/TravelMap';
import SurpriseTripCard from '@/components/profile/SurpriseTripCard';
import RotatingCoverPhoto from '@/components/profile/RotatingCoverPhoto';
import FriendsSection from '@/components/profile/FriendsSection';
import MemoryLane from '@/components/profile/MemoryLane';
import EditorialPreferencesView from '@/components/profile/EditorialPreferencesView';
import ClientAgentPortal from '@/components/profile/ClientAgentPortal';
import { AddCreditsModal } from '@/components/checkout';
import { useUserCredits, formatCredits } from '@/hooks/useUserCredits';
import { Wallet } from 'lucide-react';
import { getTripStats, TripStats } from '@/services/userAPI';
import { calculateEvolutionPath, TRAVELER_STAGES } from '@/data/evolutionData';
type TabType = 'overview' | 'trips' | 'friends' | 'subscription' | 'preferences' | 'agent';

// Use the centralized pricing config from src/config/pricing.ts
// STRIPE_PRODUCTS contains:
// - TRIP_PASS: $12.99 one-time (price_1SrKykFYxIg9jcJUblEmckuq)
// - MONTHLY: $15.99/mo (price_1SrKz2FYxIg9jcJUVbrbOfFl)
// - YEARLY: $129/year (price_1SrKz4FYxIg9jcJU8kMbZDSk)

// Legacy mappings for backwards compatibility with UI
const SUBSCRIPTION_TIERS = {
  monthly: {
    name: PLAN_FEATURES.MONTHLY.name,
    description: PLAN_FEATURES.MONTHLY.subheadline,
    price: STRIPE_PRODUCTS.MONTHLY.price,
    interval: 'month',
    priceId: STRIPE_PRODUCTS.MONTHLY.priceId,
    productId: STRIPE_PRODUCTS.MONTHLY.productId,
    features: PLAN_FEATURES.MONTHLY.features.slice(0, 4),
  },
  yearly: {
    name: PLAN_FEATURES.YEARLY.name,
    description: PLAN_FEATURES.YEARLY.subheadline,
    price: STRIPE_PRODUCTS.YEARLY.price,
    interval: 'year',
    priceId: STRIPE_PRODUCTS.YEARLY.priceId,
    productId: STRIPE_PRODUCTS.YEARLY.productId,
    features: PLAN_FEATURES.YEARLY.features,
  },
};

const ONE_TIME_PURCHASE = {
  tripPass: {
    name: PLAN_FEATURES.TRIP_PASS.name,
    description: PLAN_FEATURES.TRIP_PASS.subheadline,
    price: STRIPE_PRODUCTS.TRIP_PASS.price,
    priceId: STRIPE_PRODUCTS.TRIP_PASS.priceId,
    productId: STRIPE_PRODUCTS.TRIP_PASS.productId,
    features: PLAN_FEATURES.TRIP_PASS.features.slice(0, 4),
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
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const { data: userCredits, refetch: refetchCredits } = useUserCredits();
  const [tripStats, setTripStats] = useState<TripStats | null>(null);
  const [actualTravelDNA, setActualTravelDNA] = useState<{ archetype: string; category?: string } | null>(null);
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

  // Load trip stats from userAPI (countries, days, etc.)
  useEffect(() => {
    async function loadTripStats() {
      if (!user?.id) return;
      try {
        const stats = await getTripStats();
        setTripStats(stats);
      } catch (error) {
        console.error('Failed to load trip stats:', error);
      }
    }
    loadTripStats();
  }, [user?.id]);

  // Load actual Travel DNA from database
  useEffect(() => {
    async function loadTravelDNA() {
      if (!user?.id) return;
      try {
        const { data, error } = await supabase
          .from('travel_dna_profiles')
          .select('primary_archetype_name')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (!error && data?.primary_archetype_name) {
          setActualTravelDNA({
            archetype: data.primary_archetype_name,
          });
        }
      } catch (error) {
        console.error('Failed to load travel DNA:', error);
      }
    }
    loadTravelDNA();
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
    } else if (searchParams.get('credits_added') === 'true') {
      const amount = searchParams.get('amount');
      toast.success(amount ? `$${(parseInt(amount) / 100).toFixed(2)} added to your wallet!` : 'Credits added!');
      setActiveTab('subscription');
      refetchCredits();
    }
  }, [searchParams, refetchCredits]);

  // Check subscription status
  const checkSubscription = async () => {
    if (!isAuthenticated || !user) {
      setSubscription(null);
      return;
    }
    
    
    setIsLoadingSubscription(true);
    try {
      // Ensure we have a valid session before making the call
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) {
        console.log('[Subscription] No valid session token, skipping check');
        setSubscription({ subscribed: false, product_id: null, price_id: null, subscription_end: null });
        return;
      }
      
      const { data, error } = await supabase.functions.invoke('check-subscription');
      if (error) {
        console.error('Subscription check error:', error);
        // Don't show error toast for auth issues - just set as not subscribed
        setSubscription({ subscribed: false, product_id: null, price_id: null, subscription_end: null });
        return;
      }
      if (data?.error) {
        console.error('Subscription check error:', data.error);
        setSubscription({ subscribed: false, product_id: null, price_id: null, subscription_end: null });
        return;
      }
      setSubscription(data);
    } catch (error) {
      console.error('Failed to check subscription:', error);
      setSubscription({ subscribed: false, product_id: null, price_id: null, subscription_end: null });
    } finally {
      setIsLoadingSubscription(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      checkSubscription();
    }
  }, [isAuthenticated]);

  // Handle checkout - supports both subscription and one-time payments
  const handleCheckout = async (priceId: string, mode: 'subscription' | 'payment' = 'subscription') => {
    if (!isAuthenticated || !user) {
      toast.error('Please sign in to continue');
      navigate(ROUTES.SIGNIN);
      return;
    }
    
    
    setIsCheckingOut(priceId);
    try {
      // Get fresh session to ensure we have a valid token
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) {
        toast.error('Your session has expired. Please sign in again.');
        navigate(ROUTES.SIGNIN);
        return;
      }
      
      console.log('[Checkout] Starting checkout for price:', priceId, 'mode:', mode);
      
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId, mode },
      });
      
      console.log('[Checkout] Response:', { data, error });
      
      if (error) {
        console.error('[Checkout] Function error:', error);
        throw error;
      }
      if (data?.error) {
        console.error('[Checkout] Data error:', data.error);
        throw new Error(data.error);
      }
      if (data?.url) {
        console.log('[Checkout] Opening Stripe checkout:', data.url);
        // Use location.href for more reliable redirect, fallback to window.open
        window.open(data.url, '_blank');
      } else {
        throw new Error('No checkout URL received from Stripe');
      }
    } catch (error: any) {
      console.error('[Checkout] Error:', error);
      const message = error.message || 'Failed to start checkout. Please try again.';
      toast.error(message);
    } finally {
      setIsCheckingOut(null);
    }
  };

  // Handle manage subscription
  const handleManageSubscription = async () => {
    
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session?.access_token) {
        toast.error('Your session has expired. Please sign in again.');
        navigate(ROUTES.SIGNIN);
        return;
      }
      
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

  // Compute stats from real trips (local filter for tab display)
  const upcomingTrips = trips.filter(t => t.status === 'upcoming');
  const completedTrips = trips.filter(t => t.status === 'completed');
  const savedTrips = trips.filter(t => t.status === 'draft');

  // Use fetched tripStats for accurate stats, fallback to local calculation
  const stats = {
    tripsCompleted: tripStats?.completedTrips ?? completedTrips.length,
    countriesVisited: tripStats?.totalCountries ?? 0,
    daysOnTheRoad: tripStats?.totalDaysAbroad ?? 0,
    upcomingTrips: tripStats?.upcomingTrips ?? upcomingTrips.length,
  };

  // Calculate traveler status using the evolution system
  const evolution = calculateEvolutionPath(
    stats.tripsCompleted,
    actualTravelDNA?.category || 'EXPLORER',
    {
      quizCompleted: user?.quizCompleted,
    }
  );
  const travelerStatus = TRAVELER_STAGES[evolution.currentStage]?.name || 'Traveler';

  // Use actual Travel DNA from database, fallback to preference-based archetype
  const displayArchetype = actualTravelDNA?.archetype || (user?.preferences ? (
    user.preferences.style === 'luxury' ? 'Refined Explorer' 
    : user.preferences.style === 'adventure' ? 'Bold Adventurer'
    : user.preferences.style === 'cultural' ? 'Culture Seeker'
    : 'Mindful Traveler'
  ) : null);

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'trips' as const, label: 'My Trips' },
    // { id: 'agent' as const, label: 'My Agent' }, // Agent feature disabled
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
              {(displayArchetype || travelerStatus) && (
                <p className="text-sm text-primary font-medium mt-1">
                  {displayArchetype || travelerStatus}
                  {displayArchetype && travelerStatus && displayArchetype !== travelerStatus && (
                    <span className="text-muted-foreground font-normal"> • {travelerStatus}</span>
                  )}
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

            {/* Quick Actions with Images */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Plan Trip Card */}
              <div className="group relative overflow-hidden rounded-2xl border border-border bg-card">
                <div className="absolute inset-0">
                  <img 
                    src="https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800" 
                    alt="Plan your trip"
                    className="w-full h-full object-cover opacity-20 group-hover:opacity-30 group-hover:scale-105 transition-all duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/80 to-transparent" />
                </div>
                <div className="relative p-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center mb-4">
                    <Compass className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">Plan a New Trip</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Find flights, hotels, and build a complete itinerary with AI assistance.
                  </p>
                  <Button asChild>
                    <Link to="/start">
                      <Plus className="h-4 w-4 mr-2" />
                      Start Planning
                    </Link>
                  </Button>
                </div>
              </div>

              {/* Quick Itinerary Card */}
              <div className="group relative overflow-hidden rounded-2xl border border-border bg-card">
                <div className="absolute inset-0">
                  <img 
                    src="https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=800" 
                    alt="Quick itinerary"
                    className="w-full h-full object-cover opacity-20 group-hover:opacity-30 group-hover:scale-105 transition-all duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/80 to-transparent" />
                </div>
                <div className="relative p-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-accent/80 flex items-center justify-center mb-4">
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">Quick Itinerary Builder</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Just want an AI-generated itinerary? Skip the flight & hotel search.
                  </p>
                  <Button asChild variant="secondary">
                    <Link to="/start?mode=itinerary">
                      <Zap className="h-4 w-4 mr-2" />
                      Build Itinerary Only
                    </Link>
                  </Button>
                </div>
              </div>
            </div>

            {/* Surprise Trip Card */}
            <SurpriseTripCard isPremium={!!subscription?.subscribed} />

            {/* Trip Timeline */}
            {(upcomingTrips.length > 0 || completedTrips.length > 0) && (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-foreground">My Trips</h2>
                  <Button variant="ghost" size="sm" onClick={() => setActiveTab('trips')}>
                    View all
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>

                {/* Timeline Container */}
                <div className="relative">
                  {/* Timeline Line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

                  {/* Upcoming Section */}
                  {upcomingTrips.length > 0 && (
                    <div className="mb-8">
                      <div className="flex items-center gap-3 mb-4 relative">
                        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center z-10">
                          <Plane className="h-4 w-4 text-primary-foreground" />
                        </div>
                        <span className="text-sm font-medium text-primary uppercase tracking-wide">Upcoming</span>
                      </div>
                      <div className="pl-12 space-y-3">
                        {upcomingTrips.slice(0, 3).map((trip) => (
                          <Link
                            key={trip.id}
                            to={`/trip/${trip.id}`}
                            className="group flex items-center gap-4 p-3 bg-card border border-border rounded-xl hover:border-primary/50 hover:shadow-md transition-all"
                          >
                            <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                              <img src={trip.image} alt={trip.destination} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                                {trip.destination}
                              </h3>
                              <p className="text-sm text-muted-foreground flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {trip.dates}
                              </p>
                            </div>
                            {trip.progress && (
                              <div className="hidden sm:flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-primary rounded-full"
                                    style={{ width: `${trip.progress}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground">{trip.progress}%</span>
                              </div>
                            )}
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          </Link>
                        ))}
                        {upcomingTrips.length > 3 && (
                          <button
                            onClick={() => setActiveTab('trips')}
                            className="text-sm text-primary hover:underline pl-2"
                          >
                            +{upcomingTrips.length - 3} more upcoming
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Completed Section */}
                  {completedTrips.length > 0 && (
                    <div>
                      <div className="flex items-center gap-3 mb-4 relative">
                        <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center z-10">
                          <CheckCircle className="h-4 w-4 text-white" />
                        </div>
                        <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Completed</span>
                      </div>
                      <div className="pl-12 space-y-3">
                        {completedTrips.slice(0, 3).map((trip) => (
                          <Link
                            key={trip.id}
                            to={`/trip/${trip.id}`}
                            className="group flex items-center gap-4 p-3 bg-card border border-border rounded-xl hover:border-emerald-500/50 hover:shadow-md transition-all"
                          >
                            <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                              <img src={trip.image} alt={trip.destination} className="w-full h-full object-cover" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                                {trip.destination}
                              </h3>
                              <div className="flex items-center gap-3 text-sm text-muted-foreground">
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
                            </div>
                            <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-emerald-500 transition-colors" />
                          </Link>
                        ))}
                        {completedTrips.length > 3 && (
                          <button
                            onClick={() => setActiveTab('trips')}
                            className="text-sm text-emerald-600 dark:text-emerald-400 hover:underline pl-2"
                          >
                            +{completedTrips.length - 3} more completed
                          </button>
                        )}
                      </div>
                    </div>
                  )}
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
            className="space-y-8"
          >
            {/* Loading state */}
            {isLoadingTrips && (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}

            {!isLoadingTrips && trips.length === 0 && (
              <div className="text-center py-16 border border-dashed border-border rounded-lg">
                <MapPin className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">No trips yet</h3>
                <p className="text-muted-foreground mb-6">Start planning your next adventure</p>
                <Button asChild>
                  <Link to={ROUTES.START}>
                    <Plus className="h-4 w-4 mr-2" />
                    Plan a Trip
                  </Link>
                </Button>
              </div>
            )}

            {!isLoadingTrips && trips.length > 0 && (
              <div className="relative">
                {/* Timeline Line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

                {/* Upcoming Section */}
                {upcomingTrips.length > 0 && (
                  <div className="mb-10">
                    <div className="flex items-center gap-3 mb-5 relative">
                      <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center z-10 shadow-sm">
                        <Plane className="h-4 w-4 text-primary-foreground" />
                      </div>
                      <span className="text-sm font-semibold text-primary uppercase tracking-wide">
                        Upcoming ({upcomingTrips.length})
                      </span>
                    </div>
                    <div className="pl-12 space-y-4">
                      {upcomingTrips.map((trip) => (
                        <Link
                          key={trip.id}
                          to={`/trip/${trip.id}`}
                          className="group flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:border-primary/50 hover:shadow-lg transition-all"
                        >
                          <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                            <img src={trip.image} alt={trip.destination} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors truncate">
                              {trip.destination}
                            </h3>
                            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {trip.dates}
                            </p>
                            {trip.progress && (
                              <div className="flex items-center gap-2 mt-2">
                                <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className="h-full bg-primary rounded-full transition-all"
                                    style={{ width: `${trip.progress}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground">{trip.progress}% planned</span>
                              </div>
                            )}
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Completed Section */}
                {completedTrips.length > 0 && (
                  <div className="mb-10">
                    <div className="flex items-center gap-3 mb-5 relative">
                      <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center z-10 shadow-sm">
                        <CheckCircle className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
                        Completed ({completedTrips.length})
                      </span>
                    </div>
                    <div className="pl-12 space-y-4">
                      {completedTrips.map((trip) => (
                        <Link
                          key={trip.id}
                          to={`/trip/${trip.id}`}
                          className="group flex items-center gap-4 p-4 bg-card border border-border rounded-xl hover:border-emerald-500/50 hover:shadow-lg transition-all"
                        >
                          <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0">
                            <img src={trip.image} alt={trip.destination} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-lg text-foreground group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors truncate">
                              {trip.destination}
                            </h3>
                            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                              <span className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                {trip.dates}
                              </span>
                              {trip.rating && (
                                <span className="flex items-center gap-1">
                                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                                  {trip.rating}
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-emerald-500 transition-colors" />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Saved/Draft Section */}
                {savedTrips.length > 0 && (
                  <div>
                    <div className="flex items-center gap-3 mb-5 relative">
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center z-10 shadow-sm">
                        <Compass className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Saved Ideas ({savedTrips.length})
                      </span>
                    </div>
                    <div className="pl-12 space-y-4">
                      {savedTrips.map((trip) => (
                        <Link
                          key={trip.id}
                          to={`/trip/${trip.id}`}
                          className="group flex items-center gap-4 p-4 bg-card border border-dashed border-border rounded-xl hover:border-foreground/30 hover:shadow-md transition-all"
                        >
                          <div className="w-20 h-20 rounded-lg overflow-hidden flex-shrink-0 opacity-80">
                            <img src={trip.image} alt={trip.destination} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-lg text-foreground/80 group-hover:text-foreground transition-colors truncate">
                              {trip.destination}
                            </h3>
                            <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {trip.dates}
                            </p>
                          </div>
                          <Button size="sm" variant="ghost" className="text-xs">
                            Continue
                            <ChevronRight className="h-4 w-4 ml-1" />
                          </Button>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
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
            className="space-y-12"
          >
            {/* Hero Header - Editorial Magazine Style */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate to-slate/90 p-8 md:p-12">
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-white/20 to-transparent rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-gradient-to-tr from-primary/30 to-transparent rounded-full blur-2xl transform -translate-x-1/3 translate-y-1/3" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <Crown className="h-4 w-4 text-gold" />
                  <span className="text-[10px] uppercase tracking-[0.2em] text-slate-foreground/70 font-medium">
                    Premium Membership
                  </span>
                </div>
                <h2 className="text-3xl md:text-4xl font-serif font-medium text-slate-foreground tracking-tight leading-tight mb-3">
                  Travel Without<br />Limits
                </h2>
                <p className="text-slate-foreground/70 max-w-md text-sm leading-relaxed">
                  {subscription?.subscribed 
                    ? `Your membership is active until ${subscription.subscription_end ? format(new Date(subscription.subscription_end), 'MMMM d, yyyy') : 'renewal'}`
                    : 'Unlock AI-powered itineraries, unlimited trips, and exclusive travel intelligence.'}
                </p>
                <div className="mt-6 flex items-center gap-4">
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={checkSubscription}
                    disabled={isLoadingSubscription}
                    className="text-xs text-slate-foreground/60 hover:text-slate-foreground hover:bg-white/10"
                  >
                    {isLoadingSubscription ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                        Refresh Status
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Current Status - Editorial Card */}
            {!subscription?.subscribed && (
              <div className="relative">
                <div className="absolute -left-4 top-0 bottom-0 w-px bg-gradient-to-b from-border via-muted-foreground/30 to-border" />
                <div className="pl-8">
                  <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
                    Current Plan
                  </span>
                  <h3 className="text-xl font-serif text-foreground mt-2 mb-3">Explorer (Free)</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-lg mb-4">
                    You're exploring Voyance with our complimentary tier. Upgrade to unlock the full suite of travel intelligence.
                  </p>
                  <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                      3 trips/month
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                      Basic itineraries
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="w-1 h-1 rounded-full bg-muted-foreground" />
                      Travel DNA quiz
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Credit Wallet Card */}
            <div className="relative">
              <div className="absolute -left-4 top-0 bottom-0 w-px bg-gradient-to-b from-accent/50 via-primary/30 to-transparent" />
              <div className="pl-8">
                <div className="flex items-center gap-2 mb-4">
                  <Wallet className="h-4 w-4 text-accent" />
                  <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
                    Credit Wallet
                  </span>
                </div>
                
                <div className="bg-card rounded-xl border border-border p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Available Balance</p>
                      <p className="text-3xl font-serif font-medium text-foreground">
                        {formatCredits(userCredits?.balance_cents ?? 0)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Use credits for route optimization, day builds, and more
                      </p>
                    </div>
                    <Button 
                      onClick={() => setShowCreditsModal(true)}
                      variant="outline"
                      className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Credits
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* One-Time AI Purchase - Editorial Feature Card */}
            <div className="relative">
              <div className="absolute -left-4 top-0 bottom-0 w-px bg-gradient-to-b from-primary/50 via-accent/30 to-transparent" />
              <div className="pl-8">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="h-4 w-4 text-primary" />
                  <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
                    One-Time Purchase
                  </span>
                </div>
                
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="relative bg-gradient-to-br from-primary/5 via-card to-accent/5 rounded-xl border border-primary/20 overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-2xl transform translate-x-1/3 -translate-y-1/3" />
                  
                  <div className="relative p-6 md:p-8">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="p-2 rounded-lg bg-primary/10">
                            <Sparkles className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h4 className="text-xl font-serif font-medium text-foreground">
                              {ONE_TIME_PURCHASE.tripPass.name}
                            </h4>
                            <p className="text-sm text-muted-foreground">
                              {ONE_TIME_PURCHASE.tripPass.description}
                            </p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-2 mt-4">
                          {ONE_TIME_PURCHASE.tripPass.features.map((feature) => (
                            <span key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Check className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                              {feature}
                            </span>
                          ))}
                        </div>
                      </div>
                      
                      <div className="flex flex-col items-center md:items-end gap-3 shrink-0">
                        <div className="text-center md:text-right">
                          <span className="text-3xl font-serif font-medium text-foreground">
                            ${ONE_TIME_PURCHASE.tripPass.price}
                          </span>
                          <p className="text-xs text-muted-foreground mt-0.5">one-time</p>
                        </div>
                        <Button 
                          onClick={() => handleCheckout(ONE_TIME_PURCHASE.tripPass.priceId, 'payment')}
                          disabled={isCheckingOut === ONE_TIME_PURCHASE.tripPass.priceId}
                          className="bg-primary hover:bg-primary/90 text-primary-foreground px-6"
                        >
                          {isCheckingOut === ONE_TIME_PURCHASE.tripPass.priceId ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Sparkles className="h-4 w-4 mr-2" />
                              Unlock Trip
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Divider */}
            <div className="flex items-center gap-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground uppercase tracking-wider">or subscribe</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Subscription Plans - Editorial Grid */}
            <div>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium block mb-1">
                    Membership Options
                  </span>
                  <h3 className="text-xl font-serif text-foreground">Unlimited AI Access</h3>
                </div>
              </div>
              
              <div className="grid md:grid-cols-2 gap-6">
                {Object.entries(SUBSCRIPTION_TIERS).map(([key, tier]) => {
                  const isCurrentPlan = subscription?.product_id === tier.productId;
                  const isPremium = key === 'yearly';
                  
                  return (
                    <motion.div
                      key={key}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: isPremium ? 0.1 : 0 }}
                      className={cn(
                        "group relative bg-card rounded-lg overflow-hidden transition-all duration-300",
                        isCurrentPlan 
                          ? "ring-2 ring-foreground shadow-elevated" 
                          : "border border-border hover:shadow-medium hover:border-muted-foreground/30"
                      )}
                    >
                      {/* Plan Badge */}
                      {isCurrentPlan && (
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-foreground via-foreground to-foreground/60" />
                      )}
                      
                      {isPremium && !isCurrentPlan && (
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-accent to-primary/60" />
                      )}
                      
                      <div className="p-6 md:p-8">
                        {/* Header */}
                        <div className="flex items-start justify-between mb-6">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              {isCurrentPlan && (
                                <span className="text-[9px] uppercase tracking-wider text-foreground font-semibold px-2 py-0.5 bg-foreground/10 rounded">
                                  Active
                                </span>
                              )}
                              {isPremium && !isCurrentPlan && (
                                <span className="text-[9px] uppercase tracking-wider text-primary font-semibold px-2 py-0.5 bg-primary/10 rounded">
                                  Best Value
                                </span>
                              )}
                            </div>
                            <h4 className="text-2xl font-serif font-medium text-foreground mt-1">
                              {tier.name}
                            </h4>
                            <p className="text-sm text-muted-foreground mt-1">{tier.description}</p>
                          </div>
                        </div>
                        
                        {/* Price - Editorial Display */}
                        <div className="mb-8 pb-6 border-b border-border">
                          <div className="flex items-baseline gap-1">
                            <span className="text-4xl font-serif font-medium text-foreground tracking-tight">
                              ${tier.price}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              /{tier.interval}
                            </span>
                          </div>
                          {isPremium && (
                            <p className="text-xs text-primary mt-2 font-medium">
                              Unlimited access for power travelers
                            </p>
                          )}
                        </div>
                        
                        {/* Features - Clean List */}
                        <ul className="space-y-3 mb-8">
                          {tier.features.map((feature) => (
                            <li key={feature} className="flex items-start gap-3 text-sm">
                              <div className="w-4 h-4 rounded-full border border-muted-foreground/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <Check className="h-2.5 w-2.5 text-foreground" />
                              </div>
                              <span className="text-foreground/80">{feature}</span>
                            </li>
                          ))}
                        </ul>
                        
                        {/* CTA */}
                        {isCurrentPlan ? (
                          <Button 
                            variant="outline" 
                            className="w-full h-11 text-sm font-medium"
                            onClick={handleManageSubscription}
                          >
                            Manage Subscription
                          </Button>
                        ) : (
                          <Button 
                            className={cn(
                              "w-full h-11 text-sm font-medium transition-all",
                              isPremium 
                                ? "bg-gradient-to-r from-slate to-slate/90 hover:from-slate/90 hover:to-slate text-slate-foreground" 
                                : ""
                            )}
                            onClick={() => handleCheckout(tier.priceId, 'subscription')}
                            disabled={isCheckingOut === tier.priceId}
                          >
                            {isCheckingOut === tier.priceId ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>Get {tier.name}</>
                            )}
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Active Subscriber Section */}
            {subscription?.subscribed && (
              <div className="border-t border-border pt-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-lg bg-muted/30">
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-1">Billing & Invoices</h4>
                    <p className="text-sm text-muted-foreground">
                      Update payment methods, download invoices, or manage your subscription
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={handleManageSubscription}
                    className="shrink-0"
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Billing Portal
                  </Button>
                </div>
              </div>
            )}

            {/* FAQ Footer - Editorial */}
            <div className="text-center pt-6">
              <p className="text-xs text-muted-foreground">
                Questions about membership?{' '}
                <a href="mailto:support@voyance.travel" className="underline underline-offset-2 hover:text-foreground transition-colors">
                  Contact our team
                </a>
              </p>
            </div>
          </motion.div>
        )}

        {activeTab === 'preferences' && (
          <EditorialPreferencesView />
        )}
      </main>

      <Footer />

      <AddCreditsModal
        isOpen={showCreditsModal}
        onClose={() => setShowCreditsModal(false)}
        currentBalance={userCredits?.balance_cents ?? 0}
      />
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

