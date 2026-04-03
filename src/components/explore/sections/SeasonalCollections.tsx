import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Snowflake, Sun, Leaf, Flower } from 'lucide-react';
import { useCallback } from 'react';
import { normalizeUnsplashUrl } from '@/utils/unsplash';

const collections = [
  {
    id: 'spring',
    title: 'Spring',
    subtitle: 'Cherry blossoms & renewal',
    description: 'Kyoto, Paris, Seoul & more',
    image: normalizeUnsplashUrl('https://images.unsplash.com/photo-1522383225653-ed111181a951?w=800&q=80'),
    icon: Flower,
    gradient: 'from-pink-500/20 to-rose-500/10',
  },
  {
    id: 'summer',
    title: 'Summer',
    subtitle: 'Coastal escapes & long days',
    description: 'Santorini, Barcelona, Vancouver',
    image: normalizeUnsplashUrl('https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80'),
    icon: Sun,
    gradient: 'from-amber-500/20 to-orange-500/10',
  },
  {
    id: 'autumn',
    title: 'Autumn',
    subtitle: 'Golden foliage & harvest',
    description: 'New York, Kyoto, Vienna',
    image: 'https://images.unsplash.com/photo-1476820865390-c52aeebb9891?w=800&q=80',
    icon: Leaf,
    gradient: 'from-orange-500/20 to-amber-500/10',
  },
  {
    id: 'winter',
    title: 'Winter',
    subtitle: 'Cozy retreats & adventure',
    description: 'Reykjavik, Singapore, Bali',
    image: 'https://images.unsplash.com/photo-1483921020237-2ff51e8e4b22?w=800&q=80',
    icon: Snowflake,
    gradient: 'from-sky-500/20 to-blue-500/10',
  },
];

export default function SeasonalCollections() {
  const handleImgError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    img.onerror = null;
    img.style.display = 'none';
    img.parentElement?.classList.add('bg-gradient-to-br', 'from-muted', 'to-muted-foreground/20');
  }, []);

  return (
    <section className="py-20 bg-background">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <p className="text-sm font-medium tracking-widest text-muted-foreground uppercase mb-3">
            Seasonal Collections
          </p>
          <h2 className="text-2xl md:text-3xl font-display font-semibold text-foreground">
            Travel in rhythm with the world
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {collections.map((collection, index) => {
            const Icon = collection.icon;
            return (
              <motion.div
                key={collection.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Link
                  to={`/explore?season=${collection.id}`}
                  className="group block relative aspect-[3/4] rounded-xl overflow-hidden shadow-lg hover:shadow-xl transition-shadow"
                >
                  <img
                    src={collection.image}
                    alt={collection.title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                    onError={handleImgError}
                  />
                  <div className={`absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent`} />
                  
                  {/* Icon badge */}
                  <div className={`absolute top-4 right-4 w-10 h-10 rounded-full bg-gradient-to-br ${collection.gradient} backdrop-blur-sm flex items-center justify-center border border-white/20`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <h3 className="text-xl font-display font-medium text-white mb-1">
                      {collection.title}
                    </h3>
                    <p className="text-sm text-white/80 mb-2">
                      {collection.subtitle}
                    </p>
                    <p className="text-xs text-white/60">
                      {collection.description}
                    </p>
                  </div>
                  
                  {/* Hover indicator */}
                  <div className="absolute inset-x-0 bottom-0 h-1 bg-primary scale-x-0 group-hover:scale-x-100 transition-transform origin-left" />
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
