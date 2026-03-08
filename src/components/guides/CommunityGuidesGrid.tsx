/**
 * Community Guides Grid
 * Displays published community_guides from the database.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Globe, MapPin, Heart, Eye, ArrowRight, BookOpen } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface CommunityGuide {
  id: string;
  title: string;
  description: string | null;
  destination: string | null;
  destination_country: string | null;
  cover_image_url: string | null;
  slug: string | null;
  tags: string[];
  view_count: number;
  like_count: number;
  published_at: string | null;
}

function usePublishedCommunityGuides() {
  return useQuery({
    queryKey: ['community-guides-published'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('community_guides')
        .select('id, title, description, destination, destination_country, cover_image_url, slug, tags, view_count, like_count, published_at')
        .eq('status', 'published')
        .order('published_at', { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data || []) as CommunityGuide[];
    },
    staleTime: 60_000,
  });
}

export function CommunityGuidesGrid() {
  const { data: guides = [], isLoading } = usePublishedCommunityGuides();

  if (isLoading) {
    return (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card overflow-hidden animate-pulse">
            <div className="aspect-[16/10] bg-muted" />
            <div className="p-5 space-y-3">
              <div className="h-5 bg-muted rounded w-3/4" />
              <div className="h-3 bg-muted rounded w-full" />
              <div className="h-3 bg-muted rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (guides.length === 0) {
    return (
      <div className="text-center py-16 space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto">
          <Globe className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">No community guides yet</h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Be the first to publish a travel guide! After a trip, bookmark your favorite activities and compile them into a shareable guide.
        </p>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      {guides.map((guide, index) => (
        <motion.article
          key={guide.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.04 }}
          className="group bg-card rounded-2xl overflow-hidden border border-border hover:border-primary/40 hover:shadow-lg transition-all"
        >
          <Link to={guide.slug ? `/community-guide/${guide.slug}` : '#'}>
            {/* Cover image */}
            <div className="aspect-[16/10] overflow-hidden relative bg-muted">
              {guide.cover_image_url ? (
                <img
                  src={guide.cover_image_url}
                  alt={guide.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <BookOpen className="h-10 w-10 text-muted-foreground/30" />
                </div>
              )}
              {guide.destination && (
                <div className="absolute top-3 left-3">
                  <Badge className="bg-background/90 backdrop-blur-sm text-foreground border-0 text-[10px]">
                    <MapPin className="h-3 w-3 mr-1" />
                    {guide.destination}
                    {guide.destination_country ? `, ${guide.destination_country}` : ''}
                  </Badge>
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-5 space-y-2.5">
              <h3 className="text-base font-semibold leading-snug group-hover:text-primary transition-colors line-clamp-2">
                {guide.title}
              </h3>
              {guide.description && (
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {guide.description}
                </p>
              )}

              {/* Tags */}
              {guide.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {guide.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Stats footer */}
              <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-3">
                  {guide.view_count > 0 && (
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      {guide.view_count}
                    </span>
                  )}
                  {guide.like_count > 0 && (
                    <span className="flex items-center gap-1">
                      <Heart className="h-3 w-3" />
                      {guide.like_count}
                    </span>
                  )}
                </div>
                <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>
        </motion.article>
      ))}
    </div>
  );
}
