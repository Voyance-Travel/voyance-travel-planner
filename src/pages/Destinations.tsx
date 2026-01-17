import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Link } from 'react-router-dom';
import { MapPin, Search, Filter } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ROUTES, buildRoute } from '@/config/routes';

// Sample destinations data
const destinations = [
  {
    slug: 'kyoto',
    name: 'Kyoto',
    country: 'Japan',
    image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800',
    description: 'Ancient temples and traditional gardens',
    tags: ['Culture', 'History', 'Nature'],
  },
  {
    slug: 'santorini',
    name: 'Santorini',
    country: 'Greece',
    image: 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=800',
    description: 'Iconic white villages and stunning sunsets',
    tags: ['Romantic', 'Beach', 'Luxury'],
  },
  {
    slug: 'paris',
    name: 'Paris',
    country: 'France',
    image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800',
    description: 'The city of lights and endless charm',
    tags: ['Culture', 'Food', 'Art'],
  },
  {
    slug: 'bali',
    name: 'Bali',
    country: 'Indonesia',
    image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800',
    description: 'Tropical paradise with rich spirituality',
    tags: ['Beach', 'Wellness', 'Adventure'],
  },
  {
    slug: 'marrakech',
    name: 'Marrakech',
    country: 'Morocco',
    image: 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?w=800',
    description: 'Vibrant souks and magical riads',
    tags: ['Culture', 'Adventure', 'Food'],
  },
  {
    slug: 'new-york',
    name: 'New York',
    country: 'USA',
    image: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=800',
    description: 'The city that never sleeps',
    tags: ['Urban', 'Culture', 'Food'],
  },
];

export default function Destinations() {
  return (
    <MainLayout>
      <Head
        title="Destinations | Voyance"
        description="Explore our curated collection of dream destinations around the world."
      />
      
      {/* Hero Section */}
      <section className="pt-24 pb-12 bg-gradient-to-b from-primary/5 to-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4">
              Discover Your Next Adventure
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              From hidden gems to iconic landmarks, find the perfect destination for your travel style.
            </p>
            
            {/* Search Bar */}
            <div className="flex gap-2 max-w-xl mx-auto">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search destinations..."
                  className="pl-10"
                />
              </div>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
      
      {/* Destinations Grid */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {destinations.map((destination, index) => (
              <motion.div
                key={destination.slug}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link
                  to={buildRoute.destination(destination.slug)}
                  className="group block"
                >
                  <div className="relative aspect-[4/3] rounded-xl overflow-hidden mb-4">
                    <img
                      src={destination.image}
                      alt={destination.name}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    <div className="absolute bottom-4 left-4 right-4">
                      <div className="flex items-center gap-1 text-white/80 text-sm mb-1">
                        <MapPin className="h-3 w-3" />
                        <span>{destination.country}</span>
                      </div>
                      <h3 className="text-xl font-semibold text-white">
                        {destination.name}
                      </h3>
                    </div>
                  </div>
                  <p className="text-muted-foreground text-sm mb-2">
                    {destination.description}
                  </p>
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
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
