import { useState, useMemo, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
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
  Info,
  Loader2,
  Train,
  Bus,
  Car,
  CheckCircle2
} from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ActivityModal } from '@/components/ActivityModal';
import ReviewsDrawer from '@/components/reviews/ReviewsDrawer';
import { getDestinationById, getActivitiesByDestination, type Activity, type Destination } from '@/lib/destinations';
import { getDestinationByCity } from '@/services/supabase/destinations';
import { getAttractionsByDestination } from '@/services/supabase/attractions';
import { getActivitiesByDestination as getDbActivities } from '@/services/supabase/activities';
import { useAuth } from '@/contexts/AuthContext';
import { useIsSaved, useToggleSaveDestination } from '@/hooks/useSaveDestination';
import { toast } from 'sonner';
import { formatEnumDisplay } from '@/utils/textFormatting';
import { handleImageError } from '@/utils/imageFallback';
import { useCachedDestinationImage } from '@/hooks/useCachedImage';
import { useDestinationEnrichment } from '@/hooks/useDestinationEnrichment';
import { Skeleton } from '@/components/ui/skeleton';

export default function DestinationDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const destinationId = slug || '';
  const { data: isSaved } = useIsSaved(destinationId);
  const toggleSaveMutation = useToggleSaveDestination();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  
  // Reviews drawer state
  const [reviewsDrawerOpen, setReviewsDrawerOpen] = useState(false);
  const [reviewsTarget, setReviewsTarget] = useState<{
    placeName: string;
    placeType: 'restaurant' | 'attraction' | 'hotel' | 'activity';
  } | null>(null);
  
  // First try static destinations
  const staticDestination = getDestinationById(slug || '');
  const staticActivities = getActivitiesByDestination(slug || '');
  
  // If not found in static, try database (by city name from slug)
  const cityName = slug?.replace(/-/g, ' ') || '';
  const { data: dbDestination, isLoading: isLoadingDb } = useQuery({
    queryKey: ['destination-by-city', cityName],
    queryFn: () => getDestinationByCity(cityName),
    enabled: !staticDestination && !!slug,
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
  });
  
  // Fetch database attractions when we have a DB destination
  const { data: dbAttractions } = useQuery({
    queryKey: ['attractions-by-destination', dbDestination?.id],
    queryFn: () => getAttractionsByDestination(dbDestination!.id, 50),
    enabled: !!dbDestination?.id && !staticDestination,
    staleTime: 1000 * 60 * 10,
  });
  
  // Fetch database activities when we have a DB destination
  const { data: dbActivities } = useQuery({
    queryKey: ['activities-by-destination', dbDestination?.id],
    queryFn: () => getDbActivities(dbDestination!.id, 50),
    enabled: !!dbDestination?.id && !staticDestination,
    staleTime: 1000 * 60 * 10,
  });
  
  // Convert database destination to match static format with all available fields
  const destination: Destination | undefined = useMemo(() => {
    if (staticDestination) return staticDestination;
    if (!dbDestination) return undefined;
    
    // Parse transport modes if available
    const transportModes = dbDestination.default_transport_modes as Array<{
      mode: string;
      recommended: boolean;
      notes: string;
      appName?: string;
      estimatedCost?: string;
    }> | null;
    
    // Store structured transport data instead of building a text string
    const transportData = transportModes && Array.isArray(transportModes) && transportModes.length > 0
      ? transportModes
      : null;
    
    // Parse best time to visit - handle both formats "April to September" and "Apr, May, Jun"
    let bestMonths: string[] | undefined;
    if (dbDestination.best_time_to_visit) {
      const btv = dbDestination.best_time_to_visit;
      if (btv.includes(' to ')) {
        // Range format - just display as-is in the description
        bestMonths = [btv];
      } else {
        // Comma-separated months
        bestMonths = btv.split(',').map((m: string) => m.trim());
      }
    }
    
    // Build climate text from temperature range and seasonality
    let climateText = '';
    if (dbDestination.temperature_range) {
      climateText = `Temperature: ${dbDestination.temperature_range}. `;
    }
    if (dbDestination.seasonality) {
      climateText += dbDestination.seasonality;
    }
    
    // Parse local knowledge fields from DB
    const dbLocalTips = (dbDestination as any).local_tips as string[] | null;
    const dbSafetyTips = (dbDestination as any).safety_tips as string[] | null;
    const dbCommonScams = (dbDestination as any).common_scams as string[] | null;
    const dbBestNeighborhoods = (dbDestination as any).best_neighborhoods as string[] | null;

    return {
      id: dbDestination.id,
      city: dbDestination.city,
      country: dbDestination.country || '',
      region: dbDestination.region || '',
      tagline: dbDestination.description || `Discover ${dbDestination.city}`,
      description: dbDestination.description || '',
      timezone: dbDestination.timezone || '',
      currency: dbDestination.currency_code || '',
      imageUrl: dbDestination.stock_image_url || '',
      images: dbDestination.stock_image_url ? [dbDestination.stock_image_url] : [],
      climate: climateText || undefined,
      bestMonths,
      gettingAround: (dbDestination as any).getting_around || undefined,
      transportData,
      localTips: dbLocalTips && dbLocalTips.length > 0 ? dbLocalTips : undefined,
      safetyTips: dbSafetyTips && dbSafetyTips.length > 0 ? dbSafetyTips : undefined,
      commonScams: dbCommonScams && dbCommonScams.length > 0 ? dbCommonScams : undefined,
      foodScene: (dbDestination as any).food_scene || undefined,
      tippingCustom: (dbDestination as any).tipping_custom || undefined,
      dressCode: (dbDestination as any).dress_code || undefined,
      nightlifeInfo: (dbDestination as any).nightlife_info || undefined,
      bestNeighborhoods: dbBestNeighborhoods && dbBestNeighborhoods.length > 0 ? dbBestNeighborhoods : undefined,
      emergencyNumbers: (dbDestination as any).emergency_numbers || undefined,
    };
  }, [staticDestination, dbDestination]);
  
  // Combine activities: use static if available, else convert DB attractions + activities
  const activities: Activity[] = useMemo(() => {
    // If we have static activities, use those
    if (staticActivities.length > 0) return staticActivities;
    
    // Convert DB attractions to Activity format
    const attractionsAsActivities: Activity[] = (dbAttractions || []).map(attr => ({
      id: attr.id,
      destinationId: attr.destination_id,
      title: attr.name,
      description: attr.description || '',
      category: (attr.category?.toLowerCase() || 'culture') as Activity['category'],
      duration: attr.visit_duration_mins ? `${Math.round(attr.visit_duration_mins / 60)}h` : undefined,
      priceTier: 'moderate' as const, // Default since attractions don't have price_level
      neighborhood: attr.address || undefined,
    }));
    
    // Convert DB activities to Activity format
    const activitiesAsActivities: Activity[] = (dbActivities || []).map(act => ({
      id: act.id,
      destinationId: act.destination_id,
      title: act.name,
      description: act.description || '',
      category: (act.category?.toLowerCase() || 'culture') as Activity['category'],
      duration: act.duration_minutes ? `${Math.round(act.duration_minutes / 60)}h` : undefined,
      priceTier: 'moderate' as const,
    }));
    
    // Merge and deduplicate by title
    const seen = new Set<string>();
    const combined: Activity[] = [];
    
    for (const act of [...attractionsAsActivities, ...activitiesAsActivities]) {
      const key = act.title.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        combined.push(act);
      }
    }
    
    return combined;
  }, [staticActivities, dbAttractions, dbActivities]);
  
  // Cache destination hero image in our storage so we don't rely on external URLs
  const { data: cachedHeroUrl } = useCachedDestinationImage(
    slug,
    destination?.imageUrl
  );
  
  // Use cached storage URL if available, otherwise original
  const heroImageUrl = cachedHeroUrl || destination?.imageUrl || '';

  // Auto-enrich thin database destinations
  const { isEnriching } = useDestinationEnrichment(
    dbDestination as any,
    !!staticDestination,
    activities.length > 0
  );

  // Loading state for database fetch
  if (!staticDestination && isLoadingDb) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading destination...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

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
    // Navigate to the unified start flow with destination pre-filled (city + country for search)
    const destinationParam = encodeURIComponent(`${destination.city}, ${destination.country}`);
    navigate(`/start?destination=${destinationParam}`);
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
  
  // Getting around - use structured transport data or fallback text
  const transportData = destination.transportData || null;
  
  // Local tips - use destination data, hide generic fallbacks
  const hasRealTips = destination.localTips && destination.localTips.length > 0;
  const localTips = destination.localTips || [];
  
  // Helper to get transport icon
  const getTransportIcon = (mode: string) => {
    const modeLower = mode.toLowerCase();
    if (modeLower.includes('metro') || modeLower.includes('train') || modeLower.includes('subway')) {
      return Train;
    }
    if (modeLower.includes('bus')) {
      return Bus;
    }
    return Car;
  };

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
            src={heroImageUrl} 
            alt={destination.city}
            className="w-full h-full object-cover"
            onError={handleImageError}
          />
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        
        {/* Floating Action Buttons */}
        <div className="absolute top-24 right-6 flex flex-col gap-3 z-10">
          <motion.button
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 }}
            onClick={() => {
              if (!destination) return;
              toggleSaveMutation.mutate({
                itemId: destinationId,
                data: {
                  city: destination.city,
                  country: destination.country,
                  region: destination.region,
                  tagline: destination.tagline,
                  imageUrl: destination.imageUrl,
                },
              });
            }}
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
            onClick={async () => {
              const url = `${window.location.origin}/destination/${destinationId}`;
              const shareData = { title: `${destination?.city}, ${destination?.country}`, url };
              if (navigator.share) {
                try { await navigator.share(shareData); } catch { /* cancelled */ }
              } else {
                await navigator.clipboard.writeText(url);
                toast.success('Link copied to clipboard');
              }
            }}
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
                  onError={handleImageError}
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
                        <Train className="h-5 w-5 text-secondary-foreground" />
                      </div>
                      <h3 className="font-medium">Getting Around</h3>
                    </div>
                    
                    {transportData && transportData.length > 0 ? (
                      <div className="space-y-3">
                        {/* Getting around summary */}
                        {destination.gettingAround && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {destination.gettingAround}
                          </p>
                        )}

                        {/* Recommended transport options */}
                        {transportData.filter(t => t.recommended).map((transport, idx) => {
                          const Icon = getTransportIcon(transport.mode);
                          return (
                            <div key={idx} className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <Icon className="h-4 w-4 text-primary" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-foreground">
                                    {transport.mode}
                                    {transport.appName && <span className="text-muted-foreground font-normal"> ({transport.appName})</span>}
                                  </span>
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                                </div>
                                {transport.estimatedCost && (
                                  <p className="text-xs text-muted-foreground mt-0.5">{transport.estimatedCost}</p>
                                )}
                                {transport.notes && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{transport.notes}</p>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        
                        {/* Not recommended (shown smaller) */}
                        {transportData.filter(t => !t.recommended).length > 0 && (
                          <div className="pt-2 border-t border-border">
                            <p className="text-xs text-muted-foreground mb-2">Less recommended:</p>
                            <div className="flex flex-wrap gap-2">
                              {transportData.filter(t => !t.recommended).map((transport, idx) => (
                                <span key={idx} className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground" title={transport.notes}>
                                  {transport.mode}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {destination.gettingAround || 'Various transport options available. Walking-friendly in central areas.'}
                      </p>
                    )}
                  </div>
                  
                  {/* Local Tips — only show if we have real data or enriching */}
                  {(hasRealTips || isEnriching) && (
                    <div className="p-5 bg-card rounded-xl border border-border">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <Info className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <h3 className="font-medium">Local Tips</h3>
                      </div>
                      {isEnriching && !hasRealTips ? (
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-5/6" />
                          <Skeleton className="h-4 w-4/6" />
                          <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Enhancing destination info...
                          </p>
                        </div>
                      ) : (
                        <ul className="text-sm text-muted-foreground space-y-1.5">
                          {localTips.map((tip, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="text-accent mt-1">•</span>
                              <span>{tip}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Customs & Etiquette — only show if we have real data */}
                  {(destination.tippingCustom || destination.dressCode) && (
                    <div className="p-5 bg-card rounded-xl border border-border">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                          <Wallet className="h-5 w-5 text-accent" />
                        </div>
                        <h3 className="font-medium">Customs & Etiquette</h3>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-2">
                        {destination.tippingCustom && (
                          <p><span className="font-medium text-foreground">Tipping:</span> {destination.tippingCustom}</p>
                        )}
                        {destination.dressCode && (
                          <p><span className="font-medium text-foreground">Dress code:</span> {destination.dressCode}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Food Scene — only show if we have real data */}
                  {destination.foodScene && (
                    <div className="p-5 bg-card rounded-xl border border-border">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                          <span className="text-lg">🍜</span>
                        </div>
                        <h3 className="font-medium">Food & Dining</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">{destination.foodScene}</p>
                    </div>
                  )}

                  {/* Safety & Scams — only show if we have real data */}
                  {((destination.safetyTips && destination.safetyTips.length > 0) || (destination.commonScams && destination.commonScams.length > 0)) && (
                    <div className="p-5 bg-card rounded-xl border border-border">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center">
                          <span className="text-lg">🛡️</span>
                        </div>
                        <h3 className="font-medium">Safety & Awareness</h3>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-3">
                        {destination.safetyTips && destination.safetyTips.length > 0 && (
                          <ul className="space-y-1.5">
                            {destination.safetyTips.map((tip, index) => (
                              <li key={index} className="flex items-start gap-2">
                                <span className="text-amber-500 mt-1">⚠</span>
                                <span>{tip}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                        {destination.commonScams && destination.commonScams.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-foreground mb-1.5">Common scams to watch for:</p>
                            <ul className="space-y-1">
                              {destination.commonScams.map((scam, index) => (
                                <li key={index} className="flex items-start gap-2 text-xs">
                                  <span className="text-red-400 mt-0.5">•</span>
                                  <span>{scam}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              {/* Activities Section */}
              {(activities.length > 0 || isEnriching) && (
                <section>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-serif text-2xl font-semibold">Top Experiences</h2>
                    {activities.length > 0 && (
                      <span className="text-sm text-muted-foreground">{activities.length} experiences</span>
                    )}
                  </div>
                  
                  {isEnriching && activities.length === 0 ? (
                    <div className="grid sm:grid-cols-2 gap-4">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="p-5 bg-card rounded-xl border border-border space-y-3">
                          <Skeleton className="h-5 w-20" />
                          <Skeleton className="h-5 w-3/4" />
                          <Skeleton className="h-4 w-full" />
                          <Skeleton className="h-4 w-5/6" />
                        </div>
                      ))}
                      <p className="col-span-2 text-xs text-muted-foreground flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Discovering top experiences...
                      </p>
                    </div>
                  ) : (
                  <>
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
                    <span className="text-sm font-medium text-accent">Personalized Planning</span>
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
        destinationImage={heroImageUrl}
        destinationName={`${destination.city}, ${destination.country}`}
        onViewReviews={(activityName, category) => {
          let placeType: 'restaurant' | 'attraction' | 'hotel' | 'activity' = 'activity';
          if (['food', 'dining', 'restaurant'].includes(category.toLowerCase())) {
            placeType = 'restaurant';
          } else if (['culture', 'sightseeing', 'entertainment', 'nature'].includes(category.toLowerCase())) {
            placeType = 'attraction';
          }
          setReviewsTarget({ placeName: activityName, placeType });
          setReviewsDrawerOpen(true);
          setSelectedActivity(null);
        }}
      />

      {/* Reviews Drawer */}
      <ReviewsDrawer
        open={reviewsDrawerOpen}
        onClose={() => {
          setReviewsDrawerOpen(false);
          setReviewsTarget(null);
        }}
        placeName={reviewsTarget?.placeName || ''}
        destination={`${destination.city}, ${destination.country}`}
        placeType={reviewsTarget?.placeType}
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
              onError={handleImageError}
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
