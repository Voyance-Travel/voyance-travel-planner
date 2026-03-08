import { useCallback } from 'react';
import { motion } from 'framer-motion';
import { Clock, ArrowRight, Users, BookOpen, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getFeaturedGuides, guides as allGuides } from '@/data/guides';
import { useCommunityGuidesList } from '@/hooks/useCommunityGuidesList';

export default function VoyanceGuides() {
  const handleImgError = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    img.onerror = null;
    img.style.display = 'none';
    img.parentElement?.classList.add('bg-gradient-to-br', 'from-muted', 'to-muted-foreground/20');
  }, []);

  const featuredGuides = getFeaturedGuides();
  const displayGuides = featuredGuides.length > 0 ? featuredGuides.slice(0, 3) : allGuides.slice(0, 3);
  const { data: communityGuides = [] } = useCommunityGuidesList(3);

  return (
    <section className="py-16 bg-muted/30">
      <div className="max-w-7xl mx-auto px-4">
        {/* Voyance Guides */}
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
            className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
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
                    onError={handleImgError}
                  />
                  <div className="absolute top-3 left-3">
                    <span className="px-2 py-1 bg-background/90 backdrop-blur-sm rounded-full text-xs font-medium text-foreground">
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

        {/* Community Guides Row */}
        {communityGuides.length > 0 && (
          <>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="flex items-end justify-between mt-16 mb-10"
            >
              <div>
                <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-2 flex items-center gap-2">
                  <Users className="h-6 w-6 text-primary" />
                  Community Guides
                </h2>
                <p className="text-muted-foreground">
                  Curated recommendations from fellow travelers
                </p>
              </div>
              <Link
                to="/guides?tab=community"
                className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              >
                See all
                <ArrowRight className="h-4 w-4" />
              </Link>
            </motion.div>

            <div className="grid md:grid-cols-3 gap-6">
              {communityGuides.map((guide, index) => (
                <motion.article
                  key={guide.id}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                  className="group"
                >
                  <Link to={guide.slug ? `/community-guide/${guide.slug}` : '#'} className="block">
                    <div className="relative aspect-[16/10] rounded-xl overflow-hidden mb-4 bg-muted">
                      {guide.cover_image_url ? (
                        <img
                          src={guide.cover_image_url}
                          alt={guide.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <BookOpen className="h-8 w-8 text-muted-foreground/30" />
                        </div>
                      )}
                      {guide.destination && (
                        <div className="absolute top-3 left-3">
                          <span className="px-2 py-1 bg-background/90 backdrop-blur-sm rounded-full text-[10px] font-medium text-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {guide.destination}
                          </span>
                        </div>
                      )}
                    </div>
                    <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-1 line-clamp-2">
                      {guide.title}
                    </h3>
                    {guide.creator_name && (
                      <p className="text-xs text-muted-foreground mb-2">
                        by {guide.creator_name}
                      </p>
                    )}
                    {guide.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {guide.description}
                      </p>
                    )}
                  </Link>
                </motion.article>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
