import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { buildRoute } from '@/config/routes';

const collections = [
  {
    id: 'spring',
    emoji: '🌸',
    title: 'Spring Escapes',
    description: 'Cherry blossoms and mild weather',
    destinations: ['kyoto', 'amsterdam', 'washington-dc'],
    color: 'from-pink-400 to-rose-500',
  },
  {
    id: 'summer',
    emoji: '☀️',
    title: 'Summer Adventures',
    description: 'Beach getaways and outdoor thrills',
    destinations: ['santorini', 'bali', 'amalfi'],
    color: 'from-amber-400 to-orange-500',
  },
  {
    id: 'autumn',
    emoji: '🍂',
    title: 'Autumn Colors',
    description: 'Foliage and harvest festivals',
    destinations: ['new-england', 'bavaria', 'quebec'],
    color: 'from-orange-400 to-red-500',
  },
  {
    id: 'winter',
    emoji: '❄️',
    title: 'Winter Wonderlands',
    description: 'Snow-capped mountains and cozy retreats',
    destinations: ['iceland', 'swiss-alps', 'lapland'],
    color: 'from-blue-400 to-cyan-500',
  },
];

export default function SeasonalCollections() {
  return (
    <section className="py-16 bg-background">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-10"
        >
          <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-2">
            Seasonal Collections
          </h2>
          <p className="text-muted-foreground">
            Curated destinations for every time of year
          </p>
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
                className="group block p-6 rounded-2xl bg-card border border-border hover:border-primary/50 hover:shadow-lg transition-all"
              >
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${collection.color} text-2xl mb-4`}>
                  {collection.emoji}
                </div>
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-1">
                  {collection.title}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {collection.description}
                </p>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
