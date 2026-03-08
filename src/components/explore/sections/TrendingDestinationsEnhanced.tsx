import { motion } from 'framer-motion';
import { MapPin, Star, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { buildRoute } from '@/config/routes';
import { toSiteImageUrlFromPhotoId } from '@/utils/unsplash';
import nolaHero1 from '@/assets/destinations/new-orleans-1.jpg';
import DestinationCardActions from '@/components/explore/DestinationCardActions';

// Unique images for each destination to avoid duplicates across site
const destinations = [
  {
    slug: 'austin',
    name: 'Austin',
    country: 'USA',
    image: toSiteImageUrlFromPhotoId('photo-1531218150217-54595bc2b934'),
    rating: 4.7,
    category: 'Urban',
  },
  {
    slug: 'lisbon',
    name: 'Lisbon',
    country: 'Portugal',
    image: toSiteImageUrlFromPhotoId('photo-1585208798174-6cedd86e019a'),
    rating: 4.8,
    category: 'Culture',
  },
  {
    slug: 'bali',
    name: 'Bali',
    country: 'Indonesia',
    image: toSiteImageUrlFromPhotoId('photo-1573790387438-4da905039392'),
    rating: 4.7,
    category: 'Wellness',
  },
  {
    slug: 'cape-town',
    name: 'Cape Town',
    country: 'South Africa',
    image: toSiteImageUrlFromPhotoId('photo-1580060839134-75a5edca2e99'),
    rating: 4.8,
    category: 'Adventure',
  },
  {
    slug: 'marrakech',
    name: 'Marrakech',
    country: 'Morocco',
    image: toSiteImageUrlFromPhotoId('photo-1597212618440-806262de4f6b'),
    rating: 4.6,
    category: 'Adventure',
  },
  {
    slug: 'new-orleans',
    name: 'New Orleans',
    country: 'USA',
    image: nolaHero1,
    rating: 4.7,
    category: 'Culinary',
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
              Featured Destinations
            </h2>
            <p className="text-muted-foreground">
              Handpicked places worth exploring
            </p>
          </div>
          <Link
            to="/destinations"
            className="hidden md:flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Featured Destinations
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
                  <DestinationCardActions
                    itemId={destination.slug}
                    city={destination.name}
                    country={destination.country}
                    imageUrl={typeof destination.image === 'string' ? destination.image : undefined}
                  />
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
            Featured Destinations
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
