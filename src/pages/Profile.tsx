import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  Sparkles,
  Plane,
  CheckCircle,
  Building2,
} from 'lucide-react';
import TopNav from '@/components/common/TopNav';
import Footer from '@/components/common/Footer';
import Head from '@/components/common/Head';
import heroItineraryImage from '@/assets/hero-itinerary.jpg';
import heroHotelImage from '@/assets/hero-hotel.jpg';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/config/routes';
import { STRIPE_PRODUCTS } from '@/config/pricing';
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
import CreditBalanceCard from '@/components/profile/CreditBalanceCard';
import FollowingTab from '@/components/profile/FollowingTab';
import FavoritePlaces from '@/components/profile/FavoritePlaces';
import ProfileHotelSearchModal from '@/components/profile/ProfileHotelSearchModal';
import CreditPacksGrid from '@/components/profile/CreditPacksGrid';
import { CreditEarningChecklist } from '@/components/common/CreditEarningChecklist';
import { useCredits, useRefreshCredits } from '@/hooks/useCredits';
import { getTripStats, TripStats } from '@/services/userAPI';
import { getArchetypeNarrative } from '@/data/archetypeNarratives';
type TabType = 'overview' | 'trips' | 'friends' | 'following' | 'subscription' | 'preferences' | 'agent';

// Use the centralized pricing config from src/config/pricing.ts
// New pricing model: Day-based packages (Essential/Complete)


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
  progressLabel?: string;
  progressColor?: string;
  rating?: number;
}

// Use centralized curated image utility
import { getDestinationImage as getCuratedDestinationImage } from '@/utils/destinationImages';
import { parseLocalDate } from '@/utils/dateUtils';

function getDestinationImage(destination: string): string {
  return getCuratedDestinationImage(destination);
}

// Compute real trip progress from itinerary state
function computeTripProgress(trip: any): { progress?: number; label?: string; color?: string } {
  const itineraryStatus = trip.itinerary_status as string | null;
  const itineraryData = trip.itinerary_data as any;
  const startDate = trip.start_date ? parseLocalDate(trip.start_date) : null;
  const now = new Date();

  // Failed generation
  if (itineraryStatus === 'failed') {
    return { progress: 0, label: 'Generation failed. Try again', color: 'bg-destructive' };
  }

  // Currently generating
  if (itineraryStatus === 'generating' || itineraryStatus === 'queued') {
    return { progress: 15, label: 'Generating…', color: 'bg-primary' };
  }

  // No itinerary data at all
  const days = itineraryData?.days as any[] | undefined;
  if (!days || days.length === 0) {
    return { progress: 0, label: 'Not started', color: 'bg-muted-foreground' };
  }

  // Has itinerary — compute based on days with activities
  const totalDays = days.length;
  const daysWithActivities = days.filter(
    (d: any) => d.activities && d.activities.length > 0
  ).length;

  if (daysWithActivities === 0) {
    return { progress: 0, label: 'Empty itinerary', color: 'bg-muted-foreground' };
  }

  // Days until departure
  if (startDate && startDate > now) {
    const daysUntil = Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const pct = Math.round((daysWithActivities / totalDays) * 100);
    if (pct >= 100) {
      return { progress: 100, label: `Ready! ${daysUntil}d until departure`, color: 'bg-primary' };
    }
    return { progress: pct, label: `${daysWithActivities}/${totalDays} days planned`, color: 'bg-primary' };
  }

  // Completed or past trips
  const pct = Math.round((daysWithActivities / totalDays) * 100);
  if (pct >= 100) {
    return { progress: 100, label: 'Fully planned', color: 'bg-primary' };
  }
  return { progress: pct, label: `${daysWithActivities}/${totalDays} days planned`, color: 'bg-primary' };
}

// Transform API trip to display format
function transformTrip(trip: any): DisplayTrip {
  const startDate = trip.start_date ? parseLocalDate(trip.start_date) : null;
  const endDate = trip.end_date ? parseLocalDate(trip.end_date) : null;
  const now = new Date();
  
  let dates = 'Planning...';
  if (startDate && endDate) {
    dates = `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`;
  }
  
  // Determine status based on dates AND explicit status
  let status: 'upcoming' | 'completed' | 'draft' = 'draft';
  if (trip.status === 'completed') {
    status = 'completed';
  } else if (endDate && endDate < now) {
    status = 'completed';
  } else if (trip.status === 'booked' || (endDate && endDate >= now)) {
    status = 'upcoming';
  }
  
  const { progress, label: progressLabel, color: progressColor } = computeTripProgress(trip);

  return {
    id: trip.id,
    destination: trip.destination || 'Unknown Destination',
    dates,
    status,
    image:
      (typeof trip?.metadata?.hero_image === 'string' && trip.metadata.hero_image.length > 0)
        ? trip.metadata.hero_image
        : (typeof trip?.metadata?.imageUrl === 'string' && trip.metadata.imageUrl.length > 0)
          ? trip.metadata.imageUrl
          : getDestinationImage(trip.destination || ''),
    progress,
    progressLabel,
    progressColor,
    rating: status === 'completed' ? 4 : undefined,
  };
}

export default function Profile() {
  const { user, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [trips, setTrips] = useState<DisplayTrip[]>([]);
  const [isLoadingTrips, setIsLoadingTrips] = useState(true);
  const { data: creditData, refetch: refetchCredits } = useCredits();
  const [tripStats, setTripStats] = useState<TripStats | null>(null);
  const [hotelModalOpen, setHotelModalOpen] = useState(false);
  // Redirect if not authenticated (only after auth loading completes)
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate(ROUTES.SIGNIN);
    }
  }, [isLoading, isAuthenticated, navigate]);

  // Load actual Travel DNA from database — uses React Query so invalidateQueries(['travel-dna']) works
  const { data: travelDNAData } = useQuery({
    queryKey: ['travel-dna', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('travel_dna_profiles')
        .select('primary_archetype_name')
        .eq('user_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });
  const actualTravelDNA = travelDNAData?.primary_archetype_name
    ? { archetype: travelDNAData.primary_archetype_name }
    : null;

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
        if (data) setTrips(data.map(transformTrip));
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

  const [searchParams] = useSearchParams();
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [isLoadingSubscription, setIsLoadingSubscription] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState<string | null>(null);

  // Handle URL query params for tab selection and success states
  useEffect(() => {
    // Handle tab query param
    const tabParam = searchParams.get('tab');
    if (tabParam && ['overview', 'trips', 'friends', 'following', 'subscription', 'preferences'].includes(tabParam)) {
      setActiveTab(tabParam as TabType);
    }
    
    // Handle success/cancel query params
    if (searchParams.get('success') === 'true') {
      toast.success('Subscription activated successfully!');
      setActiveTab('subscription');
      checkSubscription();
    } else if (searchParams.get('canceled') === 'true') {
      toast.info('Checkout canceled');
    } else if (searchParams.get('credits_added') === 'true') {
      toast.success('Credits added to your balance!');
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
        // No valid session - skip subscription check silently
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
      
      
      
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { priceId, mode },
      });
      
      
      
      if (error) {
        console.error('[Checkout] Function error:', error);
        throw error;
      }
      if (data?.error) {
        console.error('[Checkout] Data error:', data.error);
        throw new Error(data.error);
      }
      if (data?.url) {
        // Opening Stripe checkout in new tab
        // Use location.href for more reliable redirect, fallback to window.open
        window.location.href = data.url;
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
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error('Portal error:', error);
      toast.error(error.message || 'Failed to open billing portal');
    }
  };

  // Get current tier (check credit packs)
  const getCurrentTier = () => {
    if (!subscription?.product_id) return null;
    const products = [STRIPE_PRODUCTS.FLEX_100, STRIPE_PRODUCTS.FLEX_300, STRIPE_PRODUCTS.FLEX_500, STRIPE_PRODUCTS.VOYAGER, STRIPE_PRODUCTS.EXPLORER, STRIPE_PRODUCTS.ADVENTURER];
    return products.find(p => p.productId === subscription.product_id);
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

  // Use actual Travel DNA from database - format properly using narrative lookup

  // Use actual Travel DNA from database - format properly using narrative lookup
  const displayArchetype = actualTravelDNA?.archetype 
    ? getArchetypeNarrative(actualTravelDNA.archetype).name 
    : (user?.preferences ? (
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
    { id: 'following' as const, label: 'Following' },
    { id: 'subscription' as const, label: 'Credits' },
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
      <section className="relative">
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
              {displayArchetype && (
                <p className="text-sm text-primary font-medium mt-1">
                  {displayArchetype}
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
      <section className="border-b border-border mt-8 overflow-x-auto scrollbar-hide">
        <div className="max-w-5xl mx-auto px-4">
          <nav className="flex gap-4 sm:gap-8 min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap shrink-0',
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
              {/* Full Trip Planning Card */}
              {/* Find My Hotel Card - Cool blue tones */}
              <div className="group relative overflow-hidden rounded-2xl border-2 border-sky-200/50 bg-gradient-to-br from-card to-sky-50/30">
                <div className="absolute inset-0">
                  <img 
                    src={heroHotelImage}
                    alt="Find your hotel"
                    className="w-full h-full object-cover opacity-20 group-hover:opacity-30 group-hover:scale-105 transition-all duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/90 to-sky-50/40" />
                </div>
                <div className="relative p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] tracking-widest uppercase font-medium text-sky-600 bg-sky-100 px-2 py-0.5 rounded">
                      Need a Hotel
                    </span>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-500 to-blue-600 flex items-center justify-center mb-4">
                    <Building2 className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">Find My Hotel</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    We'll find the perfect accommodation and build your itinerary around it.
                  </p>
                  <Button 
                    onClick={() => setHotelModalOpen(true)}
                    className="bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700"
                  >
                    <Building2 className="h-4 w-4 mr-2" />
                    Search Hotels
                  </Button>
                </div>
              </div>

              {/* Build My Itinerary Card - Warm amber tones */}
              <div className="group relative overflow-hidden rounded-2xl border-2 border-amber-200/50 bg-gradient-to-br from-card to-amber-50/30">
                <div className="absolute inset-0">
                  <img 
                    src={heroItineraryImage}
                    alt="Build your itinerary"
                    className="w-full h-full object-cover opacity-20 group-hover:opacity-30 group-hover:scale-105 transition-all duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-card via-card/90 to-amber-50/40" />
                </div>
                <div className="relative p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] tracking-widest uppercase font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded">
                      Trip Booked
                    </span>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center mb-4">
                    <Sparkles className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">Build My Itinerary</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Already have your hotel? We'll craft the perfect daily activities.
                  </p>
                  <Button asChild className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600">
                    <Link to="/start?mode=itinerary">
                      <Sparkles className="h-4 w-4 mr-2" />
                      Build Itinerary
                    </Link>
                  </Button>
                </div>
              </div>
            </div>

            {/* Surprise Trip Card */}
            <SurpriseTripCard />

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
                            {trip.progress !== undefined && (
                              <div className="hidden sm:flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${trip.progressColor || 'bg-primary'}`}
                                    style={{ width: `${Math.max(trip.progress, 5)}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground truncate max-w-[120px]">{trip.progressLabel}</span>
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

            {/* Favorite Places */}
            <FavoritePlaces />

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
                            {trip.progress !== undefined && (
                              <div className="flex items-center gap-2 mt-2">
                                <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all ${trip.progressColor || 'bg-primary'}`}
                                    style={{ width: `${Math.max(trip.progress, 5)}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground">{trip.progressLabel}</span>
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
            className="space-y-8"
          >
            {/* Credit Balance Card - Primary Focus */}
            <CreditBalanceCard />

            {/* Earn Free Credits Checklist */}
            <CreditEarningChecklist />

            {/* Credit Packs Purchase Grid */}
            <div className="bg-card rounded-xl border border-border p-6">
              <div className="text-center mb-6">
                <h3 className="text-lg font-serif font-medium text-foreground mb-1">
                  Get Credits
                </h3>
                <p className="text-sm text-muted-foreground">
                  Unlock days, swap activities, and get AI recommendations
                </p>
              </div>
              <CreditPacksGrid returnPath="/profile?payment=success" />
            </div>

            {/* Billing Portal (for legacy subscribers) */}
            {subscription?.subscribed && (
              <div className="border-t border-border pt-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 rounded-lg bg-muted/30">
                  <div>
                    <h4 className="text-sm font-medium text-foreground mb-1">Billing & Invoices</h4>
                    <p className="text-sm text-muted-foreground">
                      Update payment methods or download invoices
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

            {/* Support Link */}
            <div className="text-center pt-4">
              <p className="text-xs text-muted-foreground">
                Questions?{' '}
                <a href="mailto:support@voyance.travel" className="underline underline-offset-2 hover:text-foreground transition-colors">
                  Contact support
                </a>
              </p>
            </div>
          </motion.div>
        )}

        {activeTab === 'following' && (
          <FollowingTab />
        )}

        {activeTab === 'preferences' && (
          <EditorialPreferencesView />
        )}
      </main>

      <Footer />

      <ProfileHotelSearchModal open={hotelModalOpen} onOpenChange={setHotelModalOpen} />
    </div>
  );
}

// Helper Components
function TripCard({ trip }: { trip: { id: string; destination: string; dates: string; image: string; status: string; progress?: number; progressLabel?: string; progressColor?: string; rating?: number } }) {
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
        {trip.progress !== undefined && (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 bg-muted rounded-full overflow-hidden flex-1">
              <div className={`h-full rounded-full ${trip.progressColor || 'bg-primary'}`} style={{ width: `${Math.max(trip.progress, 5)}%` }} />
            </div>
            {trip.progressLabel && <span className="text-xs text-muted-foreground whitespace-nowrap">{trip.progressLabel}</span>}
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

