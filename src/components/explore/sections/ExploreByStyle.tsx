import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { normalizeUnsplashUrl } from '@/utils/unsplash';

const styles = [
  {
    id: 'luxury',
    label: 'Luxury',
    description: 'Five-star experiences',
    image: normalizeUnsplashUrl('https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400')
  },
  {
    id: 'adventure',
    label: 'Adventure',
    description: 'Off the beaten path',
    image: normalizeUnsplashUrl('https://images.unsplash.com/photo-1533130061792-64b345e4a833?w=400')
  },
  {
    id: 'culture',
    label: 'Culture',
    description: 'History & heritage',
    image: normalizeUnsplashUrl('https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400')
  },
  {
    id: 'wellness',
    label: 'Wellness',
    description: 'Rest & renewal',
    image: normalizeUnsplashUrl('https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400')
  },
  {
    id: 'culinary',
    label: 'Culinary',
    description: 'Taste the world',
    image: normalizeUnsplashUrl('https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=400')
  },
  {
    id: 'romantic',
    label: 'Romantic',
    description: 'Escapes for two',
    image: normalizeUnsplashUrl('https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=400')
  },
];

export default function ExploreByStyle() {
  const handleImgError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    img.onerror = null;
    img.style.display = 'none';
    img.parentElement?.classList.add('bg-gradient-to-br', 'from-muted', 'to-muted-foreground/20');
  }, []);

  return (
    <section className="py-20 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-end justify-between mb-12"
        >
          <div>
            <p className="text-sm font-medium tracking-widest text-muted-foreground uppercase mb-3">
              Travel Styles
            </p>
            <h2 className="text-2xl md:text-3xl font-display font-semibold text-foreground">
              Find your way to travel
            </h2>
          </div>
          <Link
            to="/destinations"
            className="hidden md:flex items-center gap-1 text-sm font-medium text-foreground hover:text-primary transition-colors"
          >
            Featured Destinations
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {styles.map((style, index) => (
            <motion.div
              key={style.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.05 }}
            >
              <Link
                to={`/explore?style=${style.id}`}
                className="group block"
              >
                <div className="relative aspect-[4/5] rounded-lg overflow-hidden mb-3">
                  <img
                    src={style.image}
                    alt={style.label}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    onError={handleImgError}
                  />
                  <div className="absolute inset-0 bg-black/30 group-hover:bg-black/40 transition-colors" />
                </div>
                <h3 className="font-medium text-foreground group-hover:text-primary transition-colors">
                  {style.label}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {style.description}
                </p>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
