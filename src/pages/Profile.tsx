import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  MapPin, Calendar, Users, Trophy, Settings, CreditCard, 
  ChevronRight, Plus, Globe, Clock, Plane, Star, 
  UserPlus, Mail, Heart, Compass, Check, Sparkles,
  Coffee, Mountain, Sun
} from 'lucide-react';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/auth';
import { useTripStore } from '@/lib/tripStore';
import { getDestinationById } from '@/lib/destinations';

// Seeded trips data
const seededTrips = [
  {
    id: 'trip-1',
    destination: 'London',
    country: 'United Kingdom',
    dates: 'Oct 28, 2026 - Nov 4, 2026',
    duration: '8 days',
    travelers: 2,
    price: 4850,
    status: 'upcoming',
    image: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=600&q=80',
  },
  {
    id: 'trip-2',
    destination: 'Paris',
    country: 'France',
    dates: 'Feb 28, 2026 - Mar 7, 2027',
    duration: '8 days',
    travelers: 2,
    price: 720,
    status: 'upcoming',
    image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=80',
  },
  {
    id: 'trip-3',
    destination: 'London',
    country: 'United Kingdom',
    dates: 'Mar 2, 2025 - Mar 10, 2025',
    duration: '9 days',
    travelers: 1,
    price: 3960,
    status: 'completed',
    image: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=600&q=80',
  },
  {
    id: 'trip-4',
    destination: 'London',
    country: 'United Kingdom',
    dates: 'Mar 4, 2025 - Mar 16, 2025',
    duration: '13 days',
    travelers: 1,
    price: 6795,
    status: 'draft',
    image: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=600&q=80',
  },
  {
    id: 'trip-5',
    destination: 'London',
    country: 'United Kingdom',
    dates: 'Mar 2, 2025 - Mar 16, 2025',
    duration: '15 days',
    travelers: 1,
    price: 6535,
    status: 'draft',
    image: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=600&q=80',
  },
  {
    id: 'trip-6',
    destination: 'London',
    country: 'United Kingdom',
    dates: 'Nov 8, 2025 - Mar 12, 2025',
    duration: '10 days',
    travelers: 1,
    price: 6495,
    status: 'draft',
    image: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=600&q=80',
  },
];

// Achievements data
const achievements = [
  { id: 'first-flight', icon: <Plane className="h-6 w-6" />, title: 'First Flight', desc: 'Book your first trip', unlocked: true },
  { id: 'globetrotter', icon: <Globe className="h-6 w-6" />, title: 'Globetrotter', desc: 'Visit 5+ countries', unlocked: false },
  { id: 'early-bird', icon: <Sun className="h-6 w-6" />, title: 'Early Bird', desc: 'Book 30 days ahead', unlocked: false },
  { id: 'never-say-never', icon: <Heart className="h-6 w-6" />, title: 'Never Say Never', desc: 'Try a new experience', unlocked: false },
];

// Pricing plans
const pricingPlans = [
  {
    id: 'free',
    name: 'Free Explorer',
    price: 'Free',
    features: [
      'Basic AI Travel Chat',
      'Browse Destinations',
      'View trip Itinerary',
      '1 Saved Destination',
      'Email Support',
    ],
    notIncluded: ['AI Trip Planning', 'Unlimited Saves', 'Priority Support'],
    cta: 'Current Plan',
    current: true,
  },
  {
    id: 'monthly',
    name: 'Voyage Monthly',
    price: '$15.00',
    period: '/month',
    features: [
      'Everything in Free',
      'Unlimited Trips',
      'Full AI Itineraries',
      'Unlimited destination saves',
      'Save & Access Anytime',
      'Priority assistance',
      'Access to 7-day free trial',
    ],
    cta: 'Upgrade to Voyage Monthly',
    highlighted: true,
  },
  {
    id: 'annual',
    name: 'Wanderlust Annual',
    price: '$120.00',
    period: '/year',
    badge: 'Best Value',
    features: [
      'Everything in Voyage',
      'VIP Priority Support',
      'Early Curated Lists',
      'Priority Support',
      'Premium Flights',
      'Concierge Assistance',
      'VIP All Access',
    ],
    cta: 'Upgrade to Wanderlust Annual',
  },
];

type TabId = 'overview' | 'trips' | 'companions' | 'achievements' | 'billing' | 'preferences';

export default function Profile() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('trips');
  const [tripFilter, setTripFilter] = useState<'all' | 'upcoming' | 'completed' | 'draft'>('all');
  const [companionEmail, setCompanionEmail] = useState('');
  const [travelStyle, setTravelStyle] = useState('relaxed');
  const [budgetPreference, setbudgetPreference] = useState('Comfort');

  // Mock user stats
  const userStats = {
    countries: 6,
    days: 0,
    saved: 0,
    planning: 'Planning',
  };

  const tabs = [
    { id: 'overview' as TabId, icon: <Compass className="h-4 w-4" />, label: 'Overview' },
    { id: 'trips' as TabId, icon: <MapPin className="h-4 w-4" />, label: 'My Trips' },
    { id: 'companions' as TabId, icon: <Users className="h-4 w-4" />, label: 'Companions' },
    { id: 'achievements' as TabId, icon: <Trophy className="h-4 w-4" />, label: 'Achievements' },
    { id: 'billing' as TabId, icon: <CreditCard className="h-4 w-4" />, label: 'Billing' },
    { id: 'preferences' as TabId, icon: <Settings className="h-4 w-4" />, label: 'Preferences' },
  ];

  const filteredTrips = tripFilter === 'all' 
    ? seededTrips 
    : seededTrips.filter(t => t.status === tripFilter);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-6 max-w-4xl">
          {/* Profile Hero Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative rounded-2xl overflow-hidden mb-6"
          >
            <div className="absolute inset-0">
              <img 
                src="https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1200&q=80" 
                alt="Profile background"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-primary/90 to-primary/70" />
            </div>
            
            <div className="relative p-8">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center text-accent-foreground text-xl font-semibold shrink-0">
                    {user?.email?.charAt(0).toUpperCase() || 'G'}
                  </div>
                  <div className="text-primary-foreground">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs px-2 py-0.5 rounded bg-accent text-accent-foreground font-medium">VOYANCE</span>
                    </div>
                    <h1 className="font-serif text-2xl font-semibold">Graham Lightfoot</h1>
                    <p className="text-primary-foreground/70 text-sm">grahamlightfoot23 • Seasoned Traveler • ✓ Traveler</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="bg-white/10 border-white/30 text-white hover:bg-white/20">
                  Edit Profile
                </Button>
              </div>

              <p className="text-primary-foreground/80 text-sm mt-4 max-w-lg">
                You travel for <span className="text-accent">curiosity</span>, <span className="text-accent">calm</span>, and <span className="text-accent">memorable wellness</span>.
              </p>

              {/* Stats */}
              <div className="flex items-center gap-8 mt-6">
                <div className="text-center">
                  <p className="text-2xl font-semibold text-primary-foreground">{userStats.countries}</p>
                  <p className="text-xs text-primary-foreground/60">Countries</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-semibold text-primary-foreground">{userStats.days}</p>
                  <p className="text-xs text-primary-foreground/60">Days</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-semibold text-primary-foreground">{userStats.saved}</p>
                  <p className="text-xs text-primary-foreground/60">Saved</p>
                </div>
                <div className="text-center">
                  <span className="px-2 py-1 rounded bg-accent text-accent-foreground text-xs font-medium">{userStats.planning}</span>
                  <p className="text-xs text-primary-foreground/60 mt-1">Next Adventure</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-8">
                {/* Travel DNA Banner */}
                <div className="relative rounded-2xl overflow-hidden bg-gradient-to-r from-primary to-primary/80 p-8 text-center">
                  <div className="absolute inset-0 opacity-20">
                    <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1488085061387-422e29b40080?w=1200')] bg-cover bg-center" />
                  </div>
                  <div className="relative">
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-accent text-accent-foreground text-xs font-medium mb-4">
                      <Sparkles className="h-3 w-3" />
                      Discovering Your Travel DNA
                    </span>
                    <h2 className="text-xl font-serif text-primary-foreground mb-2">
                      Welcome to your journey as a <span className="text-accent font-semibold">Explorer</span>
                    </h2>
                    <p className="text-primary-foreground/70 text-sm max-w-md mx-auto mb-4">
                      Your thoughtful responses reveal that you travel for curiosity, new textures, and the thrill of the unknown.
                    </p>
                    <div className="flex items-center justify-center gap-8 text-primary-foreground/80 text-xs">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-accent" />
                        95% Match
                      </span>
                      <span className="flex items-center gap-1">
                        <Globe className="h-3 w-3" />
                        58% Total traveled more than 20 international trips/year
                      </span>
                      <span className="flex items-center gap-1">
                        <Star className="h-3 w-3" />
                        27% Adventurer
                      </span>
                    </div>
                  </div>
                </div>

                {/* Start Your Journey CTA */}
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
                    <MapPin className="h-6 w-6 text-accent" />
                  </div>
                  <h3 className="font-semibold mb-2">Start Your Journey</h3>
                  <p className="text-sm text-muted-foreground mb-4 max-w-xs mx-auto">
                    Begin your unique journey and find this info with Voyance
                  </p>
                  <Link to="/start-planning">
                    <Button variant="accent" size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Plan Your First Trip
                    </Button>
                  </Link>
                </div>

                {/* Your Travel Journey - Map Section */}
                <div className="bg-card rounded-xl border border-border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold">Your Travel Journey</h3>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-green-500" />
                        6 Countries
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-accent" />
                        0 Pending
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 mb-4 text-xs">
                    <button className="px-3 py-1.5 rounded-full bg-accent text-accent-foreground font-medium">
                      Places
                    </button>
                    <button className="px-3 py-1.5 rounded-full bg-secondary text-muted-foreground">
                      Countries
                    </button>
                    <button className="px-3 py-1.5 rounded-full bg-secondary text-muted-foreground">
                      Experiences
                    </button>
                    <button className="px-3 py-1.5 rounded-full bg-secondary text-muted-foreground">
                      Hours Of
                    </button>
                  </div>

                  {/* World Map Visualization */}
                  <div className="relative aspect-[2/1] rounded-lg overflow-hidden mb-6 bg-muted/30">
                    <img 
                      src="https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?w=1200&q=80" 
                      alt="World map"
                      className="w-full h-full object-cover opacity-30"
                    />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center text-muted-foreground text-sm">
                        <Globe className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>Your travel destinations will appear here</p>
                      </div>
                    </div>
                  </div>

                  {/* Journey Stats */}
                  <div className="border-t border-border pt-4">
                    <p className="text-sm text-muted-foreground mb-4">Your Travel Journey</p>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div className="flex items-center gap-3 justify-center">
                        <span className="w-3 h-3 rounded-full bg-accent" />
                        <div className="text-left">
                          <p className="text-xl font-semibold">0</p>
                          <p className="text-xs text-muted-foreground">Total Destinations</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 justify-center">
                        <span className="w-3 h-3 rounded-full bg-green-500" />
                        <div className="text-left">
                          <p className="text-xl font-semibold">27</p>
                          <p className="text-xs text-muted-foreground">No. of Journey</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 justify-center">
                        <span className="w-3 h-3 rounded-full bg-blue-500" />
                        <div className="text-left">
                          <p className="text-xl font-semibold">0</p>
                          <p className="text-xs text-muted-foreground">Upcoming Trips</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Feature Cards */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center p-6">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center mx-auto mb-3">
                      <Sparkles className="h-5 w-5 text-amber-600" />
                    </div>
                    <h4 className="font-medium text-sm mb-1">Jet Surprise</h4>
                    <p className="text-xs text-muted-foreground">Let AI plan your perfect trip</p>
                  </div>
                  <div className="text-center p-6">
                    <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center mx-auto mb-3">
                      <Compass className="h-5 w-5 text-green-600" />
                    </div>
                    <h4 className="font-medium text-sm mb-1">Explore</h4>
                    <p className="text-xs text-muted-foreground">Discover new destinations</p>
                  </div>
                  <div className="text-center p-6">
                    <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center mx-auto mb-3">
                      <Sun className="h-5 w-5 text-blue-600" />
                    </div>
                    <h4 className="font-medium text-sm mb-1">Tropicos</h4>
                    <p className="text-xs text-muted-foreground">Warm weather getaways</p>
                  </div>
                </div>

                {/* Profile Completion */}
                <div className="bg-card rounded-xl border border-border p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                        <Check className="h-4 w-4 text-green-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-sm">Profile Completion</h4>
                        <p className="text-xs text-muted-foreground">Track your account status</p>
                      </div>
                    </div>
                    <span className="text-accent font-semibold">100%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2 mb-4">
                    <div className="bg-accent h-2 rounded-full" style={{ width: '100%' }} />
                  </div>
                  <div className="bg-accent/10 rounded-lg p-4 text-center">
                    <div className="text-3xl mb-2">🎉</div>
                    <p className="font-medium text-sm text-accent">Your profile is complete!</p>
                    <p className="text-xs text-muted-foreground">You're all set to start booking and planning</p>
                  </div>
                </div>
              </div>
            )}

            {/* My Trips Tab */}
            {activeTab === 'trips' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-semibold">Travel Timeline</h2>
                    <p className="text-sm text-muted-foreground">Manage your past and future adventures</p>
                  </div>
                  <Link to="/trip/new">
                    <Button variant="accent" size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Add New Trip
                    </Button>
                  </Link>
                </div>

                {/* Trip Filters */}
                <div className="flex gap-2">
                  {(['all', 'upcoming', 'completed', 'draft'] as const).map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setTripFilter(filter)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        tripFilter === filter
                          ? 'bg-accent text-accent-foreground'
                          : 'bg-secondary text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {filter === 'all' ? 'All Trips' : filter.charAt(0).toUpperCase() + filter.slice(1)} ({
                        filter === 'all' ? seededTrips.length : seededTrips.filter(t => t.status === filter).length
                      })
                    </button>
                  ))}
                </div>

                {/* Trip List */}
                <div className="space-y-4">
                  {filteredTrips.map((trip) => (
                    <div
                      key={trip.id}
                      className="bg-card rounded-xl border border-border overflow-hidden"
                    >
                      <div className="h-24 bg-accent/20 relative">
                        <img 
                          src={trip.image} 
                          alt={trip.destination}
                          className="w-full h-full object-cover"
                        />
                        <span className={`absolute top-3 left-3 px-2 py-0.5 rounded text-xs font-medium ${
                          trip.status === 'upcoming' ? 'bg-accent text-accent-foreground' :
                          trip.status === 'completed' ? 'bg-green-100 text-green-700' :
                          'bg-secondary text-muted-foreground'
                        }`}>
                          {trip.status.charAt(0).toUpperCase() + trip.status.slice(1)}
                        </span>
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold">Trip to {trip.destination}</h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="h-3 w-3" /> {trip.country} • {trip.dates}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {trip.duration}</span>
                          <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {trip.travelers}</span>
                          <span className="flex items-center gap-1 text-accent font-medium">${trip.price.toLocaleString()}</span>
                        </div>
                        <div className="flex gap-2 mt-4">
                          <Button variant="ghost" size="sm" className="text-xs">View Details</Button>
                          <Button variant="ghost" size="sm" className="text-xs text-accent">Book & Reserve</Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Companions Tab */}
            {activeTab === 'companions' && (
              <div className="space-y-6">
                <div className="bg-card rounded-xl border border-border p-6">
                  <h2 className="font-semibold mb-2">Travel Together</h2>
                  <p className="text-sm text-muted-foreground mb-4">
                    Connect with your travel companions to plan unforgettable journeys together.
                  </p>
                  
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Enter email (e.g., jane@email.com)"
                        value={companionEmail}
                        onChange={(e) => setCompanionEmail(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Button variant="accent">
                      <UserPlus className="h-4 w-4 mr-1" />
                      Send Invite
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {[
                    { icon: <Users className="h-6 w-6" />, count: 0, label: 'Travel Buddies' },
                    { icon: <Heart className="h-6 w-6" />, count: 0, label: 'Pending' },
                    { icon: <Sparkles className="h-6 w-6" />, count: 0, label: 'Shared Trips' },
                  ].map((stat, idx) => (
                    <div key={idx} className="text-center p-4">
                      <div className="text-accent mb-2">{stat.icon}</div>
                      <p className="text-lg font-semibold">{stat.count}</p>
                      <p className="text-xs text-muted-foreground">{stat.label}</p>
                    </div>
                  ))}
                </div>

                <div className="bg-card rounded-xl border border-border p-6">
                  <h3 className="font-semibold mb-4">Your Travel Network</h3>
                  <div className="flex items-center justify-center py-8">
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-xl border-2 border-dashed border-accent/30 flex items-center justify-center mx-auto mb-2">
                        <UserPlus className="h-6 w-6 text-accent/50" />
                      </div>
                      <p className="text-sm text-muted-foreground">Invite More Friends</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Achievements Tab */}
            {activeTab === 'achievements' && (
              <div className="space-y-6">
                <div className="bg-card rounded-xl border border-border p-6">
                  <h2 className="font-semibold mb-4">Your Trophy Case</h2>
                  
                  <div className="grid grid-cols-4 gap-4">
                    {achievements.map((achievement) => (
                      <div
                        key={achievement.id}
                        className={`text-center p-4 rounded-xl border ${
                          achievement.unlocked 
                            ? 'border-accent/30 bg-accent/5' 
                            : 'border-border opacity-50'
                        }`}
                      >
                        <div className={`mx-auto mb-2 ${achievement.unlocked ? 'text-accent' : 'text-muted-foreground'}`}>
                          {achievement.icon}
                        </div>
                        <p className="text-sm font-medium">{achievement.title}</p>
                      </div>
                    ))}
                  </div>

                  <div className="text-center py-8 mt-6">
                    <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3">
                      <Trophy className="h-6 w-6 text-accent/50" />
                    </div>
                    <h3 className="font-semibold">Your Journey Begins</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Start traveling to unlock achievements and build your trophy collection!
                    </p>
                    <div className="flex items-center justify-center gap-4 mt-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">🏆 Complete trips</span>
                      <span className="flex items-center gap-1">🌍 Visit new destinations</span>
                      <span className="flex items-center gap-1">⭐ Earn bonus points</span>
                    </div>
                  </div>

                  <div className="bg-accent/10 rounded-lg p-4 flex items-center gap-3">
                    <Sparkles className="h-5 w-5 text-accent" />
                    <div>
                      <p className="font-medium text-sm">What's Next?</p>
                      <p className="text-xs text-muted-foreground">You're close to unlocking these achievements. Keep exploring to earn more trophies!</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Billing Tab */}
            {activeTab === 'billing' && (
              <div className="space-y-6">
                <h2 className="font-semibold">Your Current Plan</h2>
                
                <div className="grid md:grid-cols-3 gap-4">
                  {pricingPlans.map((plan) => (
                    <div
                      key={plan.id}
                      className={`bg-card rounded-xl border p-6 relative ${
                        plan.highlighted ? 'border-accent shadow-md' : 'border-border'
                      }`}
                    >
                      {plan.badge && (
                        <span className="absolute -top-2 right-4 px-2 py-0.5 rounded bg-red-500 text-white text-xs font-medium">
                          {plan.badge}
                        </span>
                      )}
                      {plan.highlighted && (
                        <span className="absolute -top-2 left-4 px-2 py-0.5 rounded bg-accent text-accent-foreground text-xs font-medium">
                          Most Popular
                        </span>
                      )}
                      
                      <h3 className="font-semibold">{plan.name}</h3>
                      <div className="mt-2 mb-4">
                        <span className="text-2xl font-bold">{plan.price}</span>
                        {plan.period && <span className="text-sm text-muted-foreground">{plan.period}</span>}
                      </div>

                      <ul className="space-y-2 mb-6">
                        {plan.features.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                            <span>{feature}</span>
                          </li>
                        ))}
                        {plan.notIncluded?.map((feature, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground line-through">
                            <span className="w-4" />
                            <span>{feature}</span>
                          </li>
                        ))}
                      </ul>

                      <Button
                        variant={plan.current ? 'outline' : plan.highlighted ? 'accent' : 'default'}
                        className="w-full"
                        disabled={plan.current}
                      >
                        {plan.cta}
                        {!plan.current && <ChevronRight className="h-4 w-4 ml-1" />}
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Single Trip Unlock */}
                <div className="bg-card rounded-xl border border-border p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">Single Trip Unlock</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        Perfect for one-time travelers. Get full access for a single trip.
                      </p>
                      <ul className="mt-3 space-y-1 text-sm">
                        <li className="flex items-center gap-2"><Check className="h-3 w-3 text-accent" /> Full AI generated itinerary</li>
                        <li className="flex items-center gap-2"><Check className="h-3 w-3 text-accent" /> Smart booking integration</li>
                        <li className="flex items-center gap-2"><Check className="h-3 w-3 text-accent" /> Save and modify anytime</li>
                        <li className="flex items-center gap-2"><Check className="h-3 w-3 text-accent" /> Visitor feature for trip sharing</li>
                      </ul>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold">$19.99</p>
                      <p className="text-xs text-muted-foreground">one-time payment</p>
                      <Button variant="outline" size="sm" className="mt-3">
                        Unlock Single Trip
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Preferences Tab */}
            {activeTab === 'preferences' && (
              <div className="space-y-6">
                <div className="bg-card rounded-xl border border-border p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="font-semibold">Complete Your Travel Profile</h2>
                      <p className="text-sm text-muted-foreground">Help us personalize your travel recommendations</p>
                    </div>
                    <span className="text-xs text-muted-foreground">65% Done</span>
                  </div>

                  {/* Profile Steps */}
                  <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
                    {[
                      { id: 'style', label: 'Travel Style', icon: <Compass className="h-4 w-4" />, active: true },
                      { id: 'budget', label: 'Budget Preferences', icon: <CreditCard className="h-4 w-4" /> },
                      { id: 'accommodation', label: 'Accommodation', icon: <Coffee className="h-4 w-4" /> },
                      { id: 'food', label: 'Food & Dining', icon: <Coffee className="h-4 w-4" /> },
                      { id: 'accessibility', label: 'Accessibility & Health', icon: <Heart className="h-4 w-4" /> },
                      { id: 'packing', label: 'Packing Style', icon: <Settings className="h-4 w-4" /> },
                    ].map((step) => (
                      <button
                        key={step.id}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm whitespace-nowrap transition-all ${
                          step.active
                            ? 'bg-accent text-accent-foreground'
                            : 'bg-secondary text-muted-foreground'
                        }`}
                      >
                        {step.icon}
                        {step.label}
                      </button>
                    ))}
                  </div>

                  {/* Travel Style Section */}
                  <div className="border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-4">
                      <Compass className="h-5 w-5 text-accent" />
                      <div>
                        <h3 className="font-semibold">Travel Style</h3>
                        <p className="text-xs text-muted-foreground">Tell us how you like to travel</p>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="text-sm text-muted-foreground mb-2 block">What's your travel pace?</label>
                        <div className="grid grid-cols-3 gap-2">
                          {[
                            { id: 'relaxed', icon: <Coffee className="h-4 w-4" />, label: 'Relaxed', desc: 'I like downtime' },
                            { id: 'moderate', icon: <Mountain className="h-4 w-4" />, label: 'Moderate', desc: 'A mix of activities' },
                            { id: 'active', icon: <Sun className="h-4 w-4" />, label: 'Active', desc: 'Go, go, go adventure' },
                          ].map((option) => (
                            <button
                              key={option.id}
                              onClick={() => setTravelStyle(option.id)}
                              className={`p-3 rounded-lg border text-left transition-all ${
                                travelStyle === option.id
                                  ? 'border-accent bg-accent/5'
                                  : 'border-border hover:border-accent/50'
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1">
                                {option.icon}
                                <span className="font-medium text-sm">{option.label}</span>
                              </div>
                              <p className="text-xs text-muted-foreground">{option.desc}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-sm text-muted-foreground mb-2 block">Budget preference</label>
                        <select 
                          value={budgetPreference}
                          onChange={(e) => setbudgetPreference(e.target.value)}
                          className="w-full p-2 border border-border rounded-lg bg-background"
                        >
                          <option>Budget</option>
                          <option>Comfort</option>
                          <option>Luxury</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-sm text-muted-foreground mb-2 block">Estimate daily budget per person</label>
                        <Input placeholder="$ 0 - 500" />
                        <p className="text-xs text-muted-foreground mt-1">This helps us recommend experiences within your budget.</p>
                      </div>

                      <div>
                        <label className="text-sm text-muted-foreground mb-2 block">Planning preference</label>
                        <div className="space-y-2">
                          {[
                            { icon: '📅', label: 'Structured Itinerary' },
                            { icon: '🌊', label: 'Flexible schedule' },
                            { icon: '🎲', label: 'Spontaneous adventure' },
                          ].map((pref) => (
                            <div key={pref.label} className="flex items-center gap-2 p-2 rounded-lg border border-border">
                              <span>{pref.icon}</span>
                              <span className="text-sm">{pref.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-6 pt-4 border-t">
                      <button className="text-sm text-muted-foreground">← Previous</button>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((dot) => (
                          <div key={dot} className={`w-2 h-2 rounded-full ${dot === 1 ? 'bg-accent' : 'bg-border'}`} />
                        ))}
                      </div>
                      <Button variant="accent" size="sm">
                        Next →
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="py-12 bg-primary text-primary-foreground">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-5 gap-8 mb-8">
            <div className="md:col-span-2">
              <span className="font-serif text-xl font-semibold"><span className="text-accent">V</span>oyance</span>
              <p className="text-sm opacity-70 mt-2">Personalized travel experiences powered by research, not influencers.</p>
            </div>
            <div>
              <h4 className="font-medium mb-3">Travel</h4>
              <ul className="space-y-2 text-sm opacity-70">
                <li>How It Works</li>
                <li>Destinations</li>
                <li>Curated</li>
                <li>Trips</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-3">Destinations</h4>
              <ul className="space-y-2 text-sm opacity-70">
                <li>Popular Routes</li>
                <li>Travel Styles</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-3">Help Center</h4>
              <ul className="space-y-2 text-sm opacity-70">
                <li>Contact Us</li>
                <li>FAQ</li>
                <li>Privacy Policy</li>
                <li>Terms of Service</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-primary-foreground/20 pt-8 text-center text-sm opacity-70">
            <p>© 2026 Voyance. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
