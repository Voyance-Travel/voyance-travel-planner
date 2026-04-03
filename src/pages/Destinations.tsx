import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Star, TrendingUp, Compass, Sparkles, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import MainLayout from '@/components/layout/MainLayout';
import TrendingDestinationsEnhanced from '@/components/explore/sections/TrendingDestinationsEnhanced';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { buildRoute } from '@/config/routes';
import { Skeleton } from '@/components/ui/skeleton';
import { normalizeUnsplashUrl } from '@/utils/unsplash';
import barcelonaThumb from '@/assets/destinations/barcelona.jpg';

// Hardcoded featured destinations with pre-loaded images
const featuredDestinations = [
  {
    id: 'paris',
    city: 'Paris',
    country: 'France',
    region: 'Europe',
    description: 'The city of lights and eternal romance. World-class museums, café culture, Michelin-starred dining.',
    image: normalizeUnsplashUrl('https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&q=80'),
    tags: ['Culture', 'Romance', 'Food'],
    featured: true,
  },
  {
    id: 'kyoto',
    city: 'Kyoto',
    country: 'Japan',
    region: 'Asia',
    description: 'Ancient temples meet seasonal perfection. Meditative gardens, refined kaiseki dining.',
    image: normalizeUnsplashUrl('https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800&q=80'),
    tags: ['Culture', 'Temples', 'Nature'],
    featured: true,
  },
  {
    id: 'santorini',
    city: 'Santorini',
    country: 'Greece',
    region: 'Europe',
    description: 'Whitewashed dreams above the Aegean. Sunset views that stop conversation.',
    image: normalizeUnsplashUrl('https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=800&q=80'),
    tags: ['Romance', 'Beach', 'Wine'],
    featured: true,
  },
];

const popularDestinations = [
  {
    id: 'bali',
    city: 'Bali',
    country: 'Indonesia',
    image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&q=80',
    trending: true,
  },
  {
    id: 'new-york',
    city: 'New York',
    country: 'United States',
    image: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=400&q=80',
    trending: true,
  },
  {
    id: 'barcelona',
    city: 'Barcelona',
    country: 'Spain',
    image: barcelonaThumb,
    trending: false,
  },
  {
    id: 'marrakech',
    city: 'Marrakech',
    country: 'Morocco',
    image: 'https://images.unsplash.com/photo-1518730518541-d0843268c287?w=400&q=80',
    trending: true,
  },
];




// Image loading component with skeleton
function DestinationImage({ 
  src, 
  alt, 
  className = '' 
}: { 
  src: string; 
  alt: string; 
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  return (
    <div className={`relative ${className}`}>
      {!loaded && !error && (
        <Skeleton className="absolute inset-0 w-full h-full" />
      )}
      <img
        src={src}
        alt={alt}
        className={`w-full h-full object-cover transition-opacity duration-300 ${
          loaded ? 'opacity-100' : 'opacity-0'
        }`}
        onLoad={() => setLoaded(true)}
        onError={() => setError(true)}
        loading="lazy"
      />
      {error && (
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center">
          <MapPin className="h-8 w-8 text-primary/60" />
        </div>
      )}
    </div>
  );
}

export default function Destinations() {
  const navigate = useNavigate();
  

  const handleDestinationClick = (id: string) => {
    navigate(buildRoute.destination(id));
  };

  const heroDestination = featuredDestinations[0];

  return (
    <MainLayout>
      <Head
        title="Destinations | Voyance"
        description="Choose a destination and let our AI build your perfect personalized itinerary. From hidden gems to iconic landmarks."
      />
      
      {/* Hero - Featured Destination */}
      <section className="relative h-[70vh] min-h-[500px]">
        <div className="absolute inset-0">
          <DestinationImage
            src={heroDestination.image}
            alt={heroDestination.city}
            className="w-full h-full"
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
                AI-Crafted Itineraries Available
              </Badge>
              
              <h1 className="font-display text-4xl md:text-6xl font-bold text-white mb-4">
                Build Your {heroDestination.city} Itinerary
              </h1>
              
              <div className="flex items-center gap-2 text-white/80 mb-4">
                <MapPin className="h-4 w-4" />
                <span>{heroDestination.country}</span>
                <span className="mx-2">•</span>
                <span>{heroDestination.region}</span>
              </div>
              
              <p className="text-xl text-white/90 mb-8 max-w-2xl line-clamp-2">
                {heroDestination.description}
              </p>
              
              <div className="flex flex-wrap gap-3">
                <Button 
                  size="lg" 
                  onClick={() => handleDestinationClick(heroDestination.id)}
                >
                  Plan My Trip
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Link to="/explore">
                  <Button size="lg" variant="outline" className="bg-white/10 border-white/30 text-white hover:bg-white/20">
                    <Compass className="mr-2 h-4 w-4" />
                    Browse All Destinations
                  </Button>
                </Link>
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
                Popular places with AI-crafted itineraries ready to personalize
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
                  <DestinationImage
                    src={destination.image}
                    alt={destination.city}
                    className="w-full h-full transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  
                  <div className="absolute top-4 left-4">
                    <Badge className="bg-primary/90">
                      <Sparkles className="h-3 w-3 mr-1" />
                      Build Itinerary
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
                    <p className="text-sm text-white/80 line-clamp-2">
                      {destination.description}
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {destination.tags.map((tag) => (
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
            {popularDestinations.map((destination, index) => (
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
                    <DestinationImage
                      src={destination.image}
                      alt={destination.city}
                      className="w-full h-full group-hover:scale-110 transition-transform duration-300"
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
                    {destination.trending ? 'Trending' : 'Popular'}
                  </Badge>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Trending Destinations */}
      <TrendingDestinationsEnhanced />
      
    </MainLayout>
  );
}
