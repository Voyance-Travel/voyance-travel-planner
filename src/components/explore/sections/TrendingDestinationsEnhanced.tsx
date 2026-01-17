import { motion } from 'framer-motion';
import { MapPin, Star, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { buildRoute } from '@/config/routes';

const destinations = [
  {
    slug: 'kyoto',
    name: 'Kyoto',
    country: 'Japan',
    image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600',
    rating: 4.9,
    category: 'Culture',
  },
  {
    slug: 'santorini',
    name: 'Santorini',
    country: 'Greece',
    image: 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=600',
    rating: 4.8,
    category: 'Romance',
  },
  {
    slug: 'bali',
    name: 'Bali',
    country: 'Indonesia',
    image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600',
    rating: 4.7,
    category: 'Wellness',
  },
  {
    slug: 'paris',
    name: 'Paris',
    country: 'France',
    image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600',
    rating: 4.8,
    category: 'Culture',
  },
  {
    slug: 'marrakech',
    name: 'Marrakech',
    country: 'Morocco',
    image: 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?w=600',
    rating: 4.6,
    category: 'Adventure',
  },
  {
    slug: 'new-york',
    name: 'New York',
    country: 'USA',
    image: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=600',
    rating: 4.7,
    category: 'Urban',
  },
];

export default function TrendingDestinationsEnhanced() {
  return (
    <section className="py-16 bg-background">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-end justify-between mb-10"
        >
          <div>
            <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-2">
              Trending Destinations
            </h2>
            <p className="text-muted-foreground">
              Where travelers are heading right now
            </p>
          </div>
          <Link
            to="/destinations"
            className="hidden md:flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            View all
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {destinations.map((destination, index) => (
            <motion.div
              key={destination.slug}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Link
                to={buildRoute.destination(destination.slug)}
                className="group block"
              >
                <div className="relative aspect-[4/3] rounded-xl overflow-hidden mb-3">
                  <img
                    src={destination.image}
                    alt={destination.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                  <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 bg-white/90 backdrop-blur-sm rounded-full text-xs font-medium">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {destination.rating}
                  </div>
                  <div className="absolute bottom-3 left-3">
                    <span className="px-2 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs text-white">
                      {destination.category}
                    </span>
                  </div>
                </div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                      {destination.name}
                    </h3>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {destination.country}
                    </p>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        <div className="mt-8 text-center md:hidden">
          <Link
            to="/destinations"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            View all destinations
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
