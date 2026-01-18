import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Star, TrendingUp, Compass, Globe, Sparkles, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { destinations as allDestinations } from '@/lib/destinations';
import { buildRoute } from '@/config/routes';

// Featured destinations - curated selections
const featuredDestinations = [
  {
    id: 'kyoto',
    name: 'Kyoto',
    country: 'Japan',
    region: 'Asia',
    image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1200&q=80',
    tagline: 'Ancient temples meet seasonal perfection',
    tags: ['Culture', 'History', 'Nature'],
    featured: true,
  },
  {
    id: 'lisbon',
    name: 'Lisbon',
    country: 'Portugal',
    region: 'Europe',
    image: 'https://images.unsplash.com/photo-1585208798174-6cedd86e019a?w=1200&q=80',
    tagline: 'Golden light, ocean breezes, and timeless charm',
    tags: ['Culture', 'Food', 'Coastal'],
    featured: true,
  },
  {
    id: 'marrakech',
    name: 'Marrakech',
    country: 'Morocco',
    region: 'Africa',
    image: 'https://images.unsplash.com/photo-1518730518541-d0843268c287?w=1200&q=80',
    tagline: 'Sensory immersion in the Red City',
    tags: ['Culture', 'Adventure', 'Food'],
    featured: true,
  },
];

// Popular destinations
const popularDestinations = [
  { id: 'copenhagen', name: 'Copenhagen', country: 'Denmark', badge: 'Hot' },
  { id: 'mexico-city', name: 'Mexico City', country: 'Mexico', badge: 'Popular' },
  { id: 'cape-town', name: 'Cape Town', country: 'South Africa', badge: 'Rising' },
  { id: 'bangkok', name: 'Bangkok', country: 'Thailand', badge: 'Trending' },
];

// Regions for browsing
const regions = [
  { id: 'europe', name: 'Europe', count: 8, icon: '🏰' },
  { id: 'asia', name: 'Asia', count: 6, icon: '🏯' },
  { id: 'north-america', name: 'North America', count: 4, icon: '🗽' },
  { id: 'south-america', name: 'South America', count: 3, icon: '🌄' },
  { id: 'africa', name: 'Africa', count: 2, icon: '🦁' },
  { id: 'oceania', name: 'Oceania', count: 1, icon: '🏝️' },
];

export default function Destinations() {
  const navigate = useNavigate();
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);

  const handleDestinationClick = (destinationId: string) => {
    navigate(buildRoute.destination(destinationId));
  };

  return (
    <MainLayout>
      <Head
        title="Destinations | Voyance"
        description="Discover our handpicked collection of extraordinary destinations. From hidden gems to iconic landmarks, find your next adventure."
      />
      
      {/* Hero - Featured Destination */}
      <section className="relative h-[70vh] min-h-[500px]">
        <div className="absolute inset-0">
          <img
            src={featuredDestinations[0].image}
            alt={featuredDestinations[0].name}
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
                {featuredDestinations[0].name}
              </h1>
              
              <div className="flex items-center gap-2 text-white/80 mb-4">
                <MapPin className="h-4 w-4" />
                <span>{featuredDestinations[0].country}</span>
                <span className="mx-2">•</span>
                <span>{featuredDestinations[0].region}</span>
              </div>
              
              <p className="text-xl text-white/90 mb-8 max-w-2xl">
                {featuredDestinations[0].tagline}
              </p>
              
              <div className="flex flex-wrap gap-3">
                <Button 
                  size="lg" 
                  onClick={() => handleDestinationClick(featuredDestinations[0].id)}
                >
                  Explore {featuredDestinations[0].name}
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
      
      {/* Featured Destinations Grid */}
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
            {featuredDestinations.map((destination, index) => (
              <motion.div
                key={destination.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="group cursor-pointer"
                onClick={() => handleDestinationClick(destination.id)}
              >
                <div className="relative aspect-[4/5] rounded-xl overflow-hidden mb-4">
                  <img
                    src={destination.image}
                    alt={destination.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  
                  {destination.featured && (
                    <div className="absolute top-4 left-4">
                      <Badge className="bg-primary/90">
                        <Star className="h-3 w-3 mr-1" />
                        Featured
                      </Badge>
                    </div>
                  )}
                  
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="flex items-center gap-1 text-white/80 text-sm mb-2">
                      <MapPin className="h-3 w-3" />
                      <span>{destination.country}</span>
                    </div>
                    <h3 className="text-2xl font-display font-bold text-white mb-2">
                      {destination.name}
                    </h3>
                    <p className="text-sm text-white/80 line-clamp-2">
                      {destination.tagline}
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {destination.tags.map(tag => (
                    <span
                      key={tag}
                      className="text-xs px-2 py-1 bg-muted rounded-full text-muted-foreground"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Popular Now */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-3 mb-10">
            <TrendingUp className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-display font-bold text-foreground">
              Popular Right Now
            </h2>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {popularDestinations.map((destination, index) => {
              const fullDest = allDestinations.find(d => d.id === destination.id);
              return (
                <motion.div
                  key={destination.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  className="group cursor-pointer bg-card rounded-xl p-4 hover:shadow-lg transition-all duration-300"
                  onClick={() => handleDestinationClick(destination.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                      <img
                        src={fullDest?.imageUrl || `https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=200&q=80`}
                        alt={destination.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                        {destination.name}
                      </h3>
                      <p className="text-sm text-muted-foreground truncate">
                        {destination.country}
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      {destination.badge}
                    </Badge>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>
      
      {/* Browse by Region */}
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
                  <span className="text-3xl">{region.icon}</span>
                  <div className="flex-1">
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {region.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {region.count} destinations
                    </p>
                  </div>
                  <ArrowRight className={`h-5 w-5 text-muted-foreground transition-all duration-300 ${hoveredRegion === region.id ? 'translate-x-1 text-primary' : ''}`} />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      
      {/* All Destinations */}
      <section className="py-16 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-end justify-between mb-10">
            <div>
              <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-2">
                All Destinations
              </h2>
              <p className="text-muted-foreground">
                Explore our complete collection of {allDestinations.length}+ destinations
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
                onClick={() => handleDestinationClick(destination.id)}
              >
                <div className="relative aspect-[4/3] rounded-xl overflow-hidden mb-3">
                  <img
                    src={destination.imageUrl}
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
