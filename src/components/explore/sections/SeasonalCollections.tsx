import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const collections = [
  {
    id: 'spring',
    title: 'Spring',
    subtitle: 'Cherry blossoms & renewal',
    image: 'https://images.unsplash.com/photo-1522383225653-ed111181a951?w=600',
  },
  {
    id: 'summer',
    title: 'Summer',
    subtitle: 'Coastal escapes & long days',
    image: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600',
  },
  {
    id: 'autumn',
    title: 'Autumn',
    subtitle: 'Harvest & golden light',
    image: 'https://images.unsplash.com/photo-1476820865390-c52aeebb9891?w=600',
  },
  {
    id: 'winter',
    title: 'Winter',
    subtitle: 'Alpine retreats & northern lights',
    image: 'https://images.unsplash.com/photo-1483921020237-2ff51e8e4b22?w=600',
  },
];

export default function SeasonalCollections() {
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
          {collections.map((collection, index) => (
            <motion.div
              key={collection.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Link
                to={`/explore?season=${collection.id}`}
                className="group block relative aspect-[3/4] rounded-lg overflow-hidden"
              >
                <img
                  src={collection.image}
                  alt={collection.title}
                  className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-5">
                  <h3 className="text-xl font-display font-medium text-white mb-1">
                    {collection.title}
                  </h3>
                  <p className="text-sm text-white/70">
                    {collection.subtitle}
                  </p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
