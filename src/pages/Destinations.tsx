import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Star, TrendingUp, Compass, Globe, Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { buildRoute } from '@/config/routes';
import { 
  getDestinations, 
  getFeaturedDestinations, 
  getDestinationRegions,
  type Destination 
} from '@/services/supabase/destinations';
import { getDestinationImage as getCuratedImage } from '@/utils/destinationImages';

// Region images mapping (replacing emojis with photos)
const regionImages: Record<string, string> = {
  'Europe': 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=100&h=100&fit=crop',
  'Asia': 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=100&h=100&fit=crop',
  'North America': 'https://images.unsplash.com/photo-1485738422979-f5c462d49f74?w=100&h=100&fit=crop',
  'South America': 'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=100&h=100&fit=crop',
  'Africa': 'https://images.unsplash.com/photo-1547471080-7cc2caa01a7e?w=100&h=100&fit=crop',
  'Oceania': 'https://images.unsplash.com/photo-1523482580672-f109ba8cb9be?w=100&h=100&fit=crop',
  'Middle East': 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=100&h=100&fit=crop',
  'Caribbean': 'https://images.unsplash.com/photo-1548574505-5e239809ee19?w=100&h=100&fit=crop',
  'Central America': 'https://images.unsplash.com/photo-1518638150340-f706e86654de?w=100&h=100&fit=crop',
  'Antarctica': 'https://images.unsplash.com/photo-1551415923-a2297c7fda79?w=100&h=100&fit=crop',
};

// Use curated Unsplash images - not database images
function getDestinationImage(destination: Destination): string {
  return getCuratedImage(destination.city);
}

function getDestinationSlug(destination: Destination): string {
  return destination.city.toLowerCase().replace(/\s+/g, '-');
}

export default function Destinations() {
  const navigate = useNavigate();
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [featuredDestinations, setFeaturedDestinations] = useState<Destination[]>([]);
  const [allDestinations, setAllDestinations] = useState<Destination[]>([]);
  const [regions, setRegions] = useState<{ id: string; name: string; count: number; image: string }[]>([]);
  const [popularDestinations, setPopularDestinations] = useState<Destination[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        
        // Load featured destinations
        const featured = await getFeaturedDestinations(6);
        setFeaturedDestinations(featured.length > 0 ? featured : []);
        
        // Load all destinations (limited)
        const all = await getDestinations({ limit: 12 });
        setAllDestinations(all);
        
        // Set popular destinations (use first 4 from all)
        setPopularDestinations(all.slice(0, 4));
        
        // Load regions with counts
        const regionNames = await getDestinationRegions();
        const regionData = await Promise.all(
          regionNames.slice(0, 6).map(async (regionName) => {
            const regionDestinations = await getDestinations({ region: regionName, limit: 1 });
            return {
              id: regionName.toLowerCase().replace(/\s+/g, '-'),
              name: regionName,
              count: regionDestinations.length,
              image: regionImages[regionName] || 'https://images.unsplash.com/photo-1488085061387-422e29b40080?w=100&h=100&fit=crop',
            };
          })
        );
        setRegions(regionData);
      } catch (error) {
        console.error('Error loading destinations:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, []);

  const handleDestinationClick = (destination: Destination) => {
    navigate(buildRoute.destination(getDestinationSlug(destination)));
  };

  if (loading) {
    return (
      <MainLayout>
        <Head title="Destinations | Voyance" description="Discover our handpicked collection of extraordinary destinations." />
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  const heroDestination = featuredDestinations[0] || allDestinations[0];

  return (
    <MainLayout>
      <Head
        title="Destinations | Voyance"
        description="Discover our handpicked collection of extraordinary destinations. From hidden gems to iconic landmarks, find your next adventure."
      />
      
      {/* Hero - Featured Destination */}
      {heroDestination && (
        <section className="relative h-[70vh] min-h-[500px]">
          <div className="absolute inset-0">
            <img
              src={getDestinationImage(heroDestination)}
              alt={heroDestination.city}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          </div>
          
          <div className="absolute inset-0 flex items-end">
            <div className="max-w-7xl mx-auto px-4 pb-16 w-full">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
              >
                <Badge className="mb-4 bg-primary/90">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Editor's Pick
                </Badge>
                
                <h1 className="font-display text-4xl md:text-6xl font-bold text-white mb-4">
                  {heroDestination.city}
                </h1>
                
                <div className="flex items-center gap-2 text-white/80 mb-4">
                  <MapPin className="h-4 w-4" />
                  <span>{heroDestination.country}</span>
                  {heroDestination.region && (
                    <>
                      <span className="mx-2">•</span>
                      <span>{heroDestination.region}</span>
                    </>
                  )}
                </div>
                
                {heroDestination.description && (
                  <p className="text-xl text-white/90 mb-8 max-w-2xl line-clamp-2">
                    {heroDestination.description}
                  </p>
                )}
                
                <div className="flex flex-wrap gap-3">
                  <Button 
                    size="lg" 
                    onClick={() => handleDestinationClick(heroDestination)}
                  >
                    Explore {heroDestination.city}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                  <Button size="lg" variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20">
                    <Compass className="mr-2 h-4 w-4" />
                    View All Destinations
                  </Button>
                </div>
              </motion.div>
            </div>
          </div>
        </section>
      )}
      
      {/* Featured Destinations Grid */}
      {featuredDestinations.length > 0 && (
        <section className="py-16 bg-background">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-end justify-between mb-10">
              <div>
                <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-2">
                  Featured Destinations
                </h2>
                <p className="text-muted-foreground">
                  Handpicked places for extraordinary experiences
                </p>
              </div>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              {featuredDestinations.slice(0, 3).map((destination, index) => (
                <motion.div
                  key={destination.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="group cursor-pointer"
                  onClick={() => handleDestinationClick(destination)}
                >
                  <div className="relative aspect-[4/5] rounded-xl overflow-hidden mb-4">
                    <img
                      src={getDestinationImage(destination)}
                      alt={destination.city}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    
                    <div className="absolute top-4 left-4">
                      <Badge className="bg-primary/90">
                        <Star className="h-3 w-3 mr-1" />
                        Featured
                      </Badge>
                    </div>
                    
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="flex items-center gap-1 text-white/80 text-sm mb-2">
                        <MapPin className="h-3 w-3" />
                        <span>{destination.country}</span>
                      </div>
                      <h3 className="text-2xl font-display font-bold text-white mb-2">
                        {destination.city}
                      </h3>
                      {destination.description && (
                        <p className="text-sm text-white/80 line-clamp-2">
                          {destination.description}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {destination.tags && Array.isArray(destination.tags) && (
                    <div className="flex flex-wrap gap-2">
                      {(destination.tags as string[]).slice(0, 3).map((tag: string) => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-1 bg-muted rounded-full text-muted-foreground"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}
      
      {/* Popular Now */}
      {popularDestinations.length > 0 && (
        <section className="py-16 bg-muted/30">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center gap-3 mb-10">
              <TrendingUp className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-display font-bold text-foreground">
                Popular Right Now
              </h2>
            </div>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {popularDestinations.map((destination, index) => (
                <motion.div
                  key={destination.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  className="group cursor-pointer bg-card rounded-xl p-4 hover:shadow-lg transition-all duration-300"
                  onClick={() => handleDestinationClick(destination)}
                >
                  <div className="flex items-center gap-4">
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                      <img
                        src={getDestinationImage(destination)}
                        alt={destination.city}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                        {destination.city}
                      </h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {destination.country}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {destination.tier === 1 ? 'Popular' : 'Trending'}
                    </Badge>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}
      
      {/* Browse by Region */}
      {regions.length > 0 && (
        <section className="py-16 bg-background">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center gap-3 mb-10">
              <Globe className="h-6 w-6 text-primary" />
              <h2 className="text-2xl font-display font-bold text-foreground">
                Browse by Region
              </h2>
            </div>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {regions.map((region, index) => (
                <motion.div
                  key={region.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  className="group cursor-pointer"
                  onMouseEnter={() => setHoveredRegion(region.id)}
                  onMouseLeave={() => setHoveredRegion(null)}
                >
                  <Link 
                    to={`/explore?region=${region.id}`}
                    className="flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all duration-300"
                  >
                    <img src={region.image} alt={region.name} className="w-12 h-12 rounded-lg object-cover" />
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                        {region.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Explore destinations
                      </p>
                    </div>
                    <ArrowRight className={`h-5 w-5 text-muted-foreground transition-all duration-300 ${hoveredRegion === region.id ? 'translate-x-1 text-primary' : ''}`} />
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>
      )}
      
      {/* All Destinations */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-2">
                All Destinations
              </h2>
              <p className="text-muted-foreground">
                Explore our complete collection of destinations
              </p>
            </div>
            <Link 
              to="/explore" 
              className="hidden md:flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              Advanced Search
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {allDestinations.slice(0, 8).map((destination, index) => (
              <motion.div
                key={destination.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.05 }}
                className="group cursor-pointer"
                onClick={() => handleDestinationClick(destination)}
              >
                <div className="relative aspect-[4/3] rounded-xl overflow-hidden mb-3">
                  <img
                    src={getDestinationImage(destination)}
                    alt={destination.city}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-3 right-3">
                    <h3 className="font-semibold text-white">
                      {destination.city}
                    </h3>
                    <p className="text-sm text-white/80">
                      {destination.country}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          
          <div className="text-center mt-10">
            <Link to="/explore">
              <Button size="lg" variant="outline">
                View All Destinations
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
