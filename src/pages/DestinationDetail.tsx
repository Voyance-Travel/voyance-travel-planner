import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, 
  MapPin, 
  Clock, 
  Globe, 
  ArrowRight, 
  Star,
  Heart,
  Share2,
  Calendar,
  Thermometer,
  Wallet,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Info
} from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ActivityModal } from '@/components/ActivityModal';
import { getDestinationById, getActivitiesByDestination, type Activity } from '@/lib/destinations';
import { useAuth } from '@/contexts/AuthContext';
import { formatEnumDisplay } from '@/utils/textFormatting';

export default function DestinationDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  
  const destination = getDestinationById(slug || '');
  const activities = getActivitiesByDestination(slug || '');

  if (!destination) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h1 className="font-serif text-2xl mb-4">Destination not found</h1>
            <Link to="/explore">
              <Button>Back to Explore</Button>
            </Link>
          </div>
        </div>
      </MainLayout>
    );
  }

  const handleStartTrip = () => {
    // Pass city name for better UX - the Start page can work with city names directly
    const destinationParam = encodeURIComponent(destination.city);
    if (isAuthenticated) {
      navigate(`/planner?destination=${destinationParam}`);
    } else {
      navigate('/signin', { state: { from: `/planner?destination=${destinationParam}` } });
    }
  };

  // Get unique categories from activities
  const categories = ['all', ...new Set(activities.map(a => a.category))];
  
  // Filter activities by category
  const filteredActivities = activeCategory === 'all' 
    ? activities 
    : activities.filter(a => a.category === activeCategory);


  // Best months to visit - use destination data or fallback
  const bestMonths = destination.bestMonths || ['Mar', 'Apr', 'May', 'Oct', 'Nov'];
  
  // Climate - use destination data or generate contextual fallback
  const climateText = destination.climate || `Pleasant year-round. Check local weather forecasts before your visit.`;
  
  // Getting around - use destination data or fallback
  const gettingAroundText = destination.gettingAround || `Various transport options available. Walking-friendly in central areas.`;
  
  // Local tips - use destination data or generate contextual fallback
  const localTips = destination.localTips || [
    `Carry local currency (${destination.currency}) for small purchases`,
    'Be respectful of local customs and traditions',
    'Book popular attractions in advance during peak season',
  ];

  return (
    <MainLayout>
      <Head 
        title={`${destination.city}, ${destination.country} | Voyance`}
        description={destination.description}
      />
      
      {/* Hero Section with Parallax Effect */}
      <section className="relative h-[70vh] min-h-[500px] overflow-hidden">
        <motion.div
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          transition={{ duration: 1.5 }}
          className="absolute inset-0"
        >
          <img 
            src={destination.imageUrl} 
            alt={destination.city}
            className="w-full h-full object-cover"
          />
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        
        {/* Floating Action Buttons */}
        <div className="absolute top-24 right-6 flex flex-col gap-3 z-10">
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            onClick={() => setIsSaved(!isSaved)}
            className={`w-12 h-12 rounded-full backdrop-blur-md flex items-center justify-center transition-colors ${
              isSaved ? 'bg-accent text-accent-foreground' : 'bg-white/20 text-white hover:bg-white/30'
            }`}
          >
            <Heart className={`h-5 w-5 ${isSaved ? 'fill-current' : ''}`} />
          </motion.button>
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md text-white flex items-center justify-center hover:bg-white/30 transition-colors"
          >
            <Share2 className="h-5 w-5" />
          </motion.button>
        </div>
        
        {/* Hero Content */}
        <div className="absolute inset-0 flex items-end">
          <div className="container mx-auto px-6 pb-12">
            <Link 
              to="/explore" 
              className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-6 transition-colors text-sm"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Explore
            </Link>
            
            <motion.div 
              initial={{ opacity: 0, y: 30 }} 
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <p className="text-white/70 uppercase tracking-widest text-sm mb-3">
                {destination.country} · {destination.region}
              </p>
              <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-semibold text-white mb-4">
                {destination.city}
              </h1>
              <p className="text-xl text-white/90 max-w-2xl mb-6">
                {destination.tagline}
              </p>
              
              {/* Quick Stats Bar */}
              <div className="flex flex-wrap items-center gap-6 text-white/90">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  <span>{destination.timezone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  <span>{destination.currency}</span>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Photo Gallery */}
      <section className="py-8 bg-muted/30">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-4 gap-2 h-48 md:h-64">
            {destination.images.slice(0, 4).map((image, index) => (
              <motion.button
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => {
                  setLightboxIndex(index);
                  setIsLightboxOpen(true);
                }}
                className="relative overflow-hidden rounded-lg group cursor-pointer"
              >
                <img 
                  src={image} 
                  alt={`${destination.city} ${index + 1}`}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                {index === 3 && destination.images.length > 4 && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <span className="text-white font-medium">+{destination.images.length - 4} more</span>
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        </div>
      </section>

      <main className="py-16">
        <div className="container mx-auto px-6">
          {/* Main Content Grid */}
          <div className="grid lg:grid-cols-3 gap-12">
            {/* Left Column - Content */}
            <div className="lg:col-span-2 space-y-16">
              {/* About Section */}
              <section>
                <h2 className="font-serif text-2xl font-semibold mb-4">About {destination.city}</h2>
                <p className="text-muted-foreground text-lg leading-relaxed">{destination.description}</p>
              </section>

              {/* Why Visit Section */}
              <section>
                <h2 className="font-serif text-2xl font-semibold mb-6">Why Visit {destination.city}</h2>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="p-5 bg-card rounded-xl border border-border">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                        <Calendar className="h-5 w-5 text-accent" />
                      </div>
                      <h3 className="font-medium">Best Time to Visit</h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {bestMonths.map(month => (
                        <Badge key={month} variant="secondary">{month}</Badge>
                      ))}
                    </div>
                  </div>
                  
                  <div className="p-5 bg-card rounded-xl border border-border">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Thermometer className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="font-medium">Climate</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {climateText}
                    </p>
                  </div>
                  
                  <div className="p-5 bg-card rounded-xl border border-border">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-secondary/50 flex items-center justify-center">
                        <MapPin className="h-5 w-5 text-secondary-foreground" />
                      </div>
                      <h3 className="font-medium">Getting Around</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {gettingAroundText}
                    </p>
                  </div>
                  
                  <div className="p-5 bg-card rounded-xl border border-border sm:col-span-2">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                        <Info className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <h3 className="font-medium">Local Tips</h3>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1.5">
                      {localTips.map((tip, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="text-accent mt-1">•</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>

              {/* Activities Section */}
              {activities.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-serif text-2xl font-semibold">Top Experiences</h2>
                    <span className="text-sm text-muted-foreground">{activities.length} experiences</span>
                  </div>
                  
                  {/* Category Filter */}
                  <div className="flex flex-wrap gap-2 mb-6">
                    {categories.map((category) => (
                      <button
                        key={category}
                        onClick={() => setActiveCategory(category)}
                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                          activeCategory === category
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80'
                        }`}
                      >
                        {category === 'all' ? 'All' : category.charAt(0).toUpperCase() + category.slice(1)}
                      </button>
                    ))}
                  </div>
                  
                  <div className="grid sm:grid-cols-2 gap-4">
                    <AnimatePresence mode="popLayout">
                      {filteredActivities.map((activity, index) => (
                        <motion.button
                          key={activity.id}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ delay: index * 0.05 }}
                          onClick={() => setSelectedActivity(activity)}
                          className="text-left p-5 bg-card rounded-xl border border-border hover:border-accent/50 hover:shadow-md transition-all group"
                        >
                          <div className="flex items-start justify-between mb-3">
                            <Badge variant="secondary" className="text-xs">
                              {formatEnumDisplay(activity.category)}
                            </Badge>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              {activity.duration && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {activity.duration}
                                </span>
                              )}
                              {activity.priceTier && (
                                <span className="font-medium">
                                  {activity.priceTier === 'budget' ? '$' : activity.priceTier === 'moderate' ? '$$' : activity.priceTier === 'premium' ? '$$$' : '$$$$'}
                                </span>
                              )}
                            </div>
                          </div>
                          <h4 className="font-medium mb-1 group-hover:text-primary transition-colors">
                            {activity.title}
                          </h4>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                            {activity.description}
                          </p>
                          {activity.neighborhood && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {activity.neighborhood}
                            </p>
                          )}
                        </motion.button>
                      ))}
                    </AnimatePresence>
                  </div>
                </section>
              )}
            </div>

            {/* Right Column - Sticky CTA */}
            <div className="lg:col-span-1">
              <div className="sticky top-24 space-y-6">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-card p-6 rounded-2xl border border-border shadow-lg"
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="h-5 w-5 text-accent" />
                    <span className="text-sm font-medium text-accent">AI-Powered Planning</span>
                  </div>
                  
                  <h3 className="font-serif text-xl font-semibold mb-2">
                    Plan your trip to {destination.city}
                  </h3>
                  <p className="text-muted-foreground text-sm mb-6">
                    Get a personalized, time-optimized itinerary with explainable recommendations tailored to your preferences.
                  </p>
                  
                  <div className="space-y-3 mb-6">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                      Curated experiences matched to you
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                      Optimized daily itineraries
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                      Flight & hotel recommendations
                    </div>
                  </div>

                  <Button 
                    variant="accent" 
                    size="lg" 
                    className="w-full gap-2" 
                    onClick={handleStartTrip}
                  >
                    Start Planning
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Activity Modal */}
      <ActivityModal
        activity={selectedActivity}
        isOpen={!!selectedActivity}
        onClose={() => setSelectedActivity(null)}
        destinationImage={destination.imageUrl}
      />

      {/* Lightbox */}
      <AnimatePresence>
        {isLightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
            onClick={() => setIsLightboxOpen(false)}
          >
            <button 
              className="absolute top-6 right-6 text-white/80 hover:text-white transition-colors"
              onClick={() => setIsLightboxOpen(false)}
            >
              <X className="h-8 w-8" />
            </button>
            
            <button 
              className="absolute left-6 text-white/80 hover:text-white transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(prev => prev === 0 ? destination.images.length - 1 : prev - 1);
              }}
            >
              <ChevronLeft className="h-10 w-10" />
            </button>
            
            <motion.img
              key={lightboxIndex}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              src={destination.images[lightboxIndex]}
              alt={`${destination.city} ${lightboxIndex + 1}`}
              className="max-w-[90vw] max-h-[85vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            
            <button 
              className="absolute right-6 text-white/80 hover:text-white transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex(prev => prev === destination.images.length - 1 ? 0 : prev + 1);
              }}
            >
              <ChevronRight className="h-10 w-10" />
            </button>
            
            <div className="absolute bottom-6 text-white/60 text-sm">
              {lightboxIndex + 1} / {destination.images.length}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </MainLayout>
  );
}
