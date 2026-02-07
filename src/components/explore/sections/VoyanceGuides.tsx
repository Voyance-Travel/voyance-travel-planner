import { motion } from 'framer-motion';
import { Clock, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getFeaturedGuides, guides as allGuides } from '@/data/guides';

export default function VoyanceGuides() {
  // Use featured guides, or first 3 if none featured
  const featuredGuides = getFeaturedGuides();
  const displayGuides = featuredGuides.length > 0 ? featuredGuides.slice(0, 3) : allGuides.slice(0, 3);

  return (
    <section className="py-16 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-end justify-between mb-10"
        >
          <div>
            <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-2">
              Voyance Guides
            </h2>
            <p className="text-muted-foreground">
              Expert tips and inspiration for your next trip
            </p>
          </div>
          <Link
            to="/guides"
            className="hidden md:flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            All guides
            <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {displayGuides.map((guide, index) => (
            <motion.article
              key={guide.slug}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="group"
            >
              <Link to={`/guides/${guide.slug}`} className="block">
                <div className="relative aspect-[16/10] rounded-xl overflow-hidden mb-4">
                  <img
                    src={guide.coverImage}
                    alt={guide.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute top-3 left-3">
                    <span className="px-2 py-1 bg-white/90 backdrop-blur-sm rounded-full text-xs font-medium">
                      {guide.category}
                    </span>
                  </div>
                </div>
                <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-2 line-clamp-2">
                  {guide.title}
                </h3>
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                  {guide.summary}
                </p>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {guide.readTime}
                </div>
              </Link>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}
