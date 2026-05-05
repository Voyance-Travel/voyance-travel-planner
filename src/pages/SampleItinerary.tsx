import { useState, useEffect } from 'react';
import SafeImage from '@/components/SafeImage';
// Local hero images for sample destinations
import denverHero from '@/assets/destinations/denver-hero.jpg';
import nolaHero from '@/assets/destinations/new-orleans-1.jpg';
import baliHero from '@/assets/destinations/bali-hero.jpg';
import romeHero from '@/assets/destinations/rome-hero.jpg';
import tokyoHero from '@/assets/destinations/tokyo-hero.jpg';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, MapPin, Clock, Star, 
  Calendar,
  Utensils, Camera, Palmtree, Users, ArrowRight, Plane, Hotel
} from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { sanitizeActivityText } from '@/utils/activityNameSanitizer';
import { getItineraryBySlug } from '@/data/sampleItineraries';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { ItineraryActivity, DayItinerary, ActivityType } from '@/types/itinerary';

// Helper to format time to 12-hour format
function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
}

// Activity type styling - muted editorial colors
const activityStyles: Record<ActivityType, { icon: React.ReactNode; label: string }> = {
  transportation: { icon: <Plane className="h-4 w-4" />, label: 'Transport' },
  accommodation: { icon: <Hotel className="h-4 w-4" />, label: 'Stay' },
  dining: { icon: <Utensils className="h-4 w-4" />, label: 'Dining' },
  cultural: { icon: <Camera className="h-4 w-4" />, label: 'Culture' },
  activity: { icon: <Camera className="h-4 w-4" />, label: 'Activity' },
  relaxation: { icon: <Palmtree className="h-4 w-4" />, label: 'Wellness' },
  shopping: { icon: <MapPin className="h-4 w-4" />, label: 'Shopping' },
};

// Sample destination images for carousel
const destinationImages: Record<string, string[]> = {
  'Bali, Indonesia': [
    baliHero,
    'https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=1200',
    'https://images.unsplash.com/photo-1552733407-5d5c46c3bb3b?w=1200',
    'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=1200',
  ],
  'Denver, Colorado': [
    denverHero,
    'https://images.unsplash.com/photo-1546156929-a4c0ac411f47?w=1200',
    'https://images.unsplash.com/photo-1619856699906-09e1f4ef2cf4?w=1200',
  ],
  'New Orleans, Louisiana': [
    nolaHero,
    'https://images.unsplash.com/photo-1568402102990-bc541580b59f?w=1200',
    'https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9?w=1200',
  ],
  'Rome, Italy': [
    romeHero,
    'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=1200',
    'https://images.unsplash.com/photo-1555992336-03a23c7b20ee?w=1200',
  ],
  'Kyoto, Japan': [
    'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1200',
    'https://images.unsplash.com/photo-1528360983277-13d401cdc186?w=1200',
    'https://images.unsplash.com/photo-1478436127897-769e1b3f0f36?w=1200',
    'https://images.unsplash.com/photo-1545569341-9eb8b30979d9?w=1200',
  ],
  'Santorini, Greece': [
    'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=1200',
    'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=1200',
    'https://images.unsplash.com/photo-1533105079780-92b9be482077?w=1200',
    'https://images.unsplash.com/photo-1601581875039-e899893d520c?w=1200',
  ],
  'Reykjavik, Iceland': [
    'https://images.unsplash.com/photo-1520769945061-0a448c463865?w=1200',
    'https://images.unsplash.com/photo-1504829857797-ddff29c27927?w=1200',
    'https://images.unsplash.com/photo-1490726486817-f92820e65d98?w=1200',
    'https://images.unsplash.com/photo-1483921020237-2ff51e8e4b22?w=1200',
  ],
  'Tokyo, Japan': [
    tokyoHero,
    'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?w=1200',
    'https://images.unsplash.com/photo-1536098561742-ca998e48cbcc?w=1200',
    'https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=1200',
  ],
};

export default function SampleItinerary() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [itineraryData, setItineraryData] = useState<ReturnType<typeof getItineraryBySlug> | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'tips' | 'itinerary'>('itinerary');
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [expandedDays, setExpandedDays] = useState<number[]>([1]);

  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const slug = searchParams.get('id') || searchParams.get('destination') || 'bali-wellness';
    const data = getItineraryBySlug(slug);
    setItineraryData(data);
    setIsLoading(false);
  }, [searchParams]);

  // Image carousel auto-advance
  useEffect(() => {
    const images = itineraryData ? destinationImages[itineraryData.destination] || [] : [];
    if (images.length > 1) {
      const interval = setInterval(() => {
        setCurrentImageIndex((prev) => (prev + 1) % images.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [itineraryData]);

  const handleSaveItinerary = () => {
    if (!user) {
      toast.info('Sign in to save and customize this itinerary');
      navigate('/signin?redirect=/sample-itinerary');
      return;
    }
    navigate('/start');
  };

  const toggleDay = (dayNumber: number) => {
    setExpandedDays(prev =>
      prev.includes(dayNumber)
        ? prev.filter(d => d !== dayNumber)
        : [...prev, dayNumber]
    );
  };

  if (isLoading || !itineraryData) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
        </div>
      </MainLayout>
    );
  }

  const images = destinationImages[itineraryData.destination] || [baliHero];

  const dailyCosts = itineraryData.days.reduce((sum, day) => sum + day.totalCost, 0);
  const totalCost = dailyCosts + itineraryData.flightCost + itineraryData.hotelCost;

  return (
    <MainLayout>
      <Head 
        title={`${itineraryData.destination} Itinerary | Voyance`}
        description={`See what a personalized Voyance travel itinerary looks like. ${itineraryData.days.length} days in ${itineraryData.destination}.`}
      />

      {/* Hero Section with Image Carousel */}
      <section className="relative h-[70vh] min-h-[500px] overflow-hidden">
        {/* Image Carousel */}
        <AnimatePresence mode="wait">
          <motion.img
            key={currentImageIndex}
            src={images[currentImageIndex]}
            alt={itineraryData.destination}
            className="absolute inset-0 w-full h-full object-cover"
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8 }}
          />
        </AnimatePresence>
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/60" />

        {/* Carousel Controls */}
        {images.length > 1 && (
          <>
            <button
              onClick={() => setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length)}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors"
            >
              <ChevronLeft className="h-6 w-6 text-white" />
            </button>
            <button
              onClick={() => setCurrentImageIndex((prev) => (prev + 1) % images.length)}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/20 backdrop-blur-sm hover:bg-white/30 transition-colors"
            >
              <ChevronRight className="h-6 w-6 text-white" />
            </button>
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2">
              {images.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentImageIndex(i)}
                  className={cn(
                    "w-2 h-2 rounded-full transition-all",
                    i === currentImageIndex ? "bg-white w-6" : "bg-white/50"
                  )}
                />
              ))}
            </div>
          </>
        )}

        {/* Hero Content */}
        <div className="absolute bottom-0 left-0 right-0 p-8 md:p-16">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-white"
            >
              <div className="flex items-center gap-3 mb-4">
                <Badge className="bg-white/20 text-white border-0 backdrop-blur-sm">
                  Sample Itinerary
                </Badge>
                <span className="text-sm text-white/70">{itineraryData.days.length} Days</span>
              </div>
              <h1 className="text-5xl md:text-7xl font-serif font-normal mb-4">
                {itineraryData.destination}
              </h1>
              <p className="text-lg text-white/80 max-w-xl font-sans font-light">
                {itineraryData.destinationInfo.overview}
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-8 md:px-16">
        {/* Trip Summary Bar */}
        <div className="py-8 border-b border-border">
          <div className="flex flex-wrap items-center gap-8 text-sm">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Duration:</span>
              <span className="font-medium">{itineraryData.days.length} Days</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Travelers:</span>
              <span className="font-medium">2 Guests</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Style:</span>
              <span className="font-medium capitalize">{itineraryData.style}</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Pace:</span>
              <span className="font-medium capitalize">{itineraryData.pace}</span>
            </div>
            <div className="ml-auto">
              <span className="text-muted-foreground">Estimated Total:</span>
              <span className="text-2xl font-serif ml-2">${totalCost.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="py-6 border-b border-border">
          <div className="flex gap-1">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'tips', label: 'Cultural Tips' },
              { id: 'itinerary', label: 'Itinerary' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={cn(
                  "px-6 py-3 text-sm font-sans tracking-wide transition-colors relative",
                  activeTab === tab.id 
                    ? "text-foreground" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeItineraryTab"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="grid lg:grid-cols-12 gap-12 py-12">
          {/* Main Content Area */}
          <div className="lg:col-span-8">
            <AnimatePresence mode="wait">
              {activeTab === 'overview' && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-8"
                >
                  <div>
                    <h2 className="text-3xl font-serif mb-4">About {itineraryData.destination}</h2>
                    <p className="text-muted-foreground font-sans leading-relaxed">
                      {itineraryData.destinationInfo.overview}
                    </p>
                  </div>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="p-6 bg-secondary/30 rounded-lg">
                      <span className="text-xs tracking-[0.15em] uppercase text-muted-foreground">Best Time to Visit</span>
                      <p className="mt-2 font-sans">{itineraryData.destinationInfo.bestTime}</p>
                    </div>
                    <div className="p-6 bg-secondary/30 rounded-lg">
                      <span className="text-xs tracking-[0.15em] uppercase text-muted-foreground">Currency</span>
                      <p className="mt-2 font-sans">{itineraryData.destinationInfo.currency}</p>
                    </div>
                    <div className="p-6 bg-secondary/30 rounded-lg">
                      <span className="text-xs tracking-[0.15em] uppercase text-muted-foreground">Language</span>
                      <p className="mt-2 font-sans">{itineraryData.destinationInfo.language}</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === 'tips' && (
                <motion.div
                  key="tips"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-8"
                >
                  <div>
                    <h2 className="text-3xl font-serif mb-4">Cultural Notes</h2>
                    <p className="text-muted-foreground font-sans leading-relaxed">
                      {itineraryData.destinationInfo.culturalNotes}
                    </p>
                  </div>
                  <div>
                    <h3 className="text-xl font-serif mb-3">Travel Tips</h3>
                    <p className="text-muted-foreground font-sans leading-relaxed">
                      {itineraryData.destinationInfo.tips}
                    </p>
                  </div>
                </motion.div>
              )}

              {activeTab === 'itinerary' && (
                <motion.div
                  key="itinerary"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="space-y-6"
                >
                  {/* Sample banner */}
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 text-center">
                    <p className="text-sm text-muted-foreground">
                      This is a <span className="font-semibold text-foreground">sample itinerary</span>. Create your own trip to unlock editing, swapping, hotel search, and all interactive features!
                    </p>
                  </div>
                  {itineraryData.days.map((day) => (
                    <DayCard
                      key={day.dayNumber}
                      day={day}
                      isExpanded={expandedDays.includes(day.dayNumber)}
                      onToggle={() => toggleDay(day.dayNumber)}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            {/* Booking Card */}
            <div className="sticky top-24 space-y-6">
              {/* Flight Info */}
              <div className="bg-card border border-border p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Plane className="h-4 w-4 text-primary" />
                  <span className="text-xs tracking-[0.15em] uppercase text-muted-foreground">Flight</span>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Outbound</span>
                    <span className="font-medium">{itineraryData.flightInfo.outbound.departure.date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Return</span>
                    <span className="font-medium">{itineraryData.flightInfo.return.departure.date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Class</span>
                    <span className="font-medium">{itineraryData.flightInfo.outbound.class}</span>
                  </div>
                  <div className="pt-3 border-t border-border flex justify-between">
                    <span className="font-medium">Flight Total</span>
                    <span className="font-serif text-lg">${itineraryData.flightCost.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Hotel Info - Read-only for sample */}
              <div 
                className="bg-card border border-border overflow-hidden"
              >
                {itineraryData.hotelInfo.images[0] && (
                  <div className="relative overflow-hidden">
                    <SafeImage
                      src={itineraryData.hotelInfo.images[0]}
                      alt={itineraryData.hotelInfo.name}
                      className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300"
                      fallbackCategory="accommodation"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                  </div>
                )}
                <div className="p-6">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Hotel className="h-4 w-4 text-primary" />
                      <span className="text-xs tracking-[0.15em] uppercase text-muted-foreground">Accommodation</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <h3 className="font-serif text-lg mb-1 group-hover:text-primary transition-colors">{itineraryData.hotelInfo.name}</h3>
                  <p className="text-sm text-muted-foreground mb-3">{itineraryData.hotelInfo.type}</p>
                  <div className="flex items-center gap-2 mb-4">
                    <Star className="h-4 w-4 text-amber-500 fill-current" />
                    <span className="font-medium">{itineraryData.hotelInfo.rating}</span>
                    <span className="text-sm text-muted-foreground">({itineraryData.hotelInfo.reviewCount} reviews)</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Check-in</span>
                      <span>{itineraryData.hotelInfo.checkIn}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Check-out</span>
                      <span>{itineraryData.hotelInfo.checkOut}</span>
                    </div>
                  </div>
                  
                  {/* Recent Reviews */}
                  {itineraryData.hotelInfo.recentReviews.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <span className="text-xs tracking-[0.1em] uppercase text-muted-foreground">Recent Reviews</span>
                      <div className="mt-3 space-y-3">
                        {itineraryData.hotelInfo.recentReviews.slice(0, 2).map((review, i) => (
                          <div key={i} className="text-sm">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{review.author}</span>
                              <span className="text-muted-foreground text-xs">{review.date}</span>
                            </div>
                            <p className="text-muted-foreground text-xs line-clamp-2">{review.comment}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className="pt-4 mt-4 border-t border-border flex justify-between">
                    <span className="font-medium">Hotel Total</span>
                    <span className="font-serif text-lg">${itineraryData.hotelCost.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* CTA */}
              <Button 
                size="lg" 
                className="w-full font-sans"
                onClick={handleSaveItinerary}
              >
                {user ? 'Customize This Trip' : 'Sign In to Customize'}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}

// ============================================================================
// DAY CARD COMPONENT — Read-only for sample itinerary
// ============================================================================

interface DayCardProps {
  day: DayItinerary;
  isExpanded: boolean;
  onToggle: () => void;
}

function DayCard({ day, isExpanded, onToggle }: DayCardProps) {
  return (
    <div className="border border-border bg-card overflow-hidden">
      {/* Day Header */}
      <div className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-4xl font-serif text-muted/30">{String(day.dayNumber).padStart(2, '0')}</span>
              <div>
                <h3 className="font-serif text-xl">{day.theme}</h3>
                <p className="text-sm text-muted-foreground">{day.description}</p>
              </div>
            </div>
          </div>
          
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-8 w-8"
            title={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Activities */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="border-t border-border">
              {day.activities.map((activity, activityIndex) => (
                <ActivityRow
                  key={activity.id}
                  activity={activity}
                  isLast={activityIndex === day.activities.length - 1}
                />
              ))}
            </div>
            
            {/* Day Footer */}
            <div className="px-6 py-4 bg-secondary/20 border-t border-border">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-6">
                  <span>Walking: {day.estimatedWalkingTime}</span>
                  <span>Distance: {day.estimatedDistance}</span>
                </div>
                <span className="font-medium text-foreground">Day Total: ${day.totalCost}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// ACTIVITY ROW COMPONENT — Read-only for sample itinerary
// ============================================================================

interface ActivityRowProps {
  activity: ItineraryActivity;
  isLast: boolean;
}

function ActivityRow({ activity, isLast }: ActivityRowProps) {
  const style = activityStyles[activity.type];
  const showPhoto = activity.type !== 'transportation' && activity.photos?.[0];

  return (
    <div className={cn(
      "flex items-stretch",
      !isLast && "border-b border-border"
    )}>
      {/* Time Column */}
      <div className="w-24 shrink-0 p-4 border-r border-border bg-secondary/10">
        <span className="text-sm font-sans">{formatTime(activity.time)}</span>
        <p className="text-xs text-muted-foreground mt-0.5">{activity.duration}</p>
      </div>

      {/* Photo Column (if available) */}
      {showPhoto && (
        <div className="w-24 h-24 shrink-0 border-r border-border">
          <SafeImage
            src={activity.photos![0]}
            alt={activity.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-muted-foreground">{style.icon}</span>
              <span className="text-xs text-muted-foreground uppercase tracking-wide">{style.label}</span>
              {activity.rating && (
                <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 fill-current text-amber-500" />
                  {activity.rating}
                </span>
              )}
            </div>
            <h4 className="font-medium text-foreground">{activity.title}</h4>
            <p className="text-sm text-muted-foreground mt-1">{activity.description}</p>
            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {typeof activity.location === 'string' 
                ? activity.location 
                : activity.location?.name || activity.location?.address || ''}
            </div>
          </div>

          {/* Cost only — no actions */}
          {activity.cost > 0 && (
            <span className="font-medium ml-4">${activity.cost}</span>
          )}
        </div>
      </div>
    </div>
  );
}