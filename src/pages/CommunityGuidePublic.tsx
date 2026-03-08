/**
 * Public Community Guide Page
 * Displays a published community guide — no auth required.
 */
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion } from 'framer-motion';
import { BookOpen, MapPin, Heart, Eye, Calendar, ArrowLeft, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';

interface CommunityGuideDetail {
  id: string;
  title: string;
  description: string | null;
  destination: string | null;
  destination_country: string | null;
  cover_image_url: string | null;
  slug: string | null;
  content: Record<string, any>;
  tags: string[];
  view_count: number;
  like_count: number;
  published_at: string | null;
  created_at: string;
  user_id: string;
}

function useCommunityGuideBySlug(slug: string | undefined) {
  return useQuery({
    queryKey: ['community-guide', slug],
    queryFn: async () => {
      if (!slug) return null;
      const { data, error } = await supabase
        .from('community_guides')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'published')
        .maybeSingle();
      if (error) throw error;
      return data as CommunityGuideDetail | null;
    },
    enabled: !!slug,
  });
}

function useGuideAuthor(userId: string | undefined) {
  return useQuery({
    queryKey: ['guide-author', userId],
    queryFn: async () => {
      if (!userId) return null;
      const { data } = await supabase
        .from('profiles')
        .select('display_name, avatar_url, handle')
        .eq('id', userId)
        .maybeSingle();
      return data;
    },
    enabled: !!userId,
  });
}

export default function CommunityGuidePublic() {
  const { slug } = useParams<{ slug: string }>();
  const { data: guide, isLoading, error } = useCommunityGuideBySlug(slug);
  const { data: author } = useGuideAuthor(guide?.user_id);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!guide) {
    return (
      <MainLayout>
        <Head title="Guide Not Found | Voyance" />
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <BookOpen className="h-12 w-12 text-muted-foreground/30" />
          <h1 className="text-2xl font-serif font-bold">Guide Not Found</h1>
          <p className="text-muted-foreground">This guide may have been removed or is no longer published.</p>
          <Button variant="outline" asChild>
            <Link to="/guides">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Guides
            </Link>
          </Button>
        </div>
      </MainLayout>
    );
  }

  const activities = (guide.content?.activities || []) as Array<{
    id?: string;
    name?: string;
    title?: string;
    description?: string;
    category?: string;
    note?: string;
    image_url?: string;
    location?: { name?: string; address?: string };
  }>;

  return (
    <MainLayout>
      <Head
        title={`${guide.title} | Voyance Community Guide`}
        description={guide.description || `A community travel guide for ${guide.destination || 'an amazing destination'}.`}
      />

      {/* Hero */}
      <section className="relative">
        <div className="aspect-[21/9] sm:aspect-[3/1] w-full overflow-hidden bg-muted">
          {guide.cover_image_url ? (
            <img
              src={guide.cover_image_url}
              alt={guide.title}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary/10 via-accent/5 to-muted flex items-center justify-center">
              <BookOpen className="h-16 w-16 text-muted-foreground/20" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        </div>

        <div className="absolute bottom-0 left-0 right-0 px-4 pb-6 sm:pb-10">
          <div className="max-w-3xl mx-auto">
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
              {guide.destination && (
                <Badge className="mb-3 bg-primary/80 text-primary-foreground border-0">
                  <MapPin className="h-3 w-3 mr-1" />
                  {guide.destination}
                  {guide.destination_country ? `, ${guide.destination_country}` : ''}
                </Badge>
              )}
              <h1 className="text-2xl sm:text-4xl font-serif font-bold text-foreground drop-shadow-sm">
                {guide.title}
              </h1>
              {guide.description && (
                <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-xl">
                  {guide.description}
                </p>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Meta bar */}
      <section className="border-b border-border">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            {author && (
              <div className="flex items-center gap-2">
                {author.avatar_url && (
                  <img src={author.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                )}
                <span className="font-medium text-foreground">
                  {author.display_name || author.handle || 'Traveler'}
                </span>
              </div>
            )}
            {guide.published_at && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(guide.published_at), 'MMM d, yyyy')}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {guide.view_count > 0 && (
              <span className="flex items-center gap-1">
                <Eye className="h-3 w-3" /> {guide.view_count}
              </span>
            )}
            {guide.like_count > 0 && (
              <span className="flex items-center gap-1">
                <Heart className="h-3 w-3" /> {guide.like_count}
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Tags */}
      {guide.tags.length > 0 && (
        <section className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex flex-wrap gap-1.5">
            {guide.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        </section>
      )}

      {/* Activities / Content */}
      <section className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {activities.length > 0 ? (
          activities.map((activity, i) => (
            <motion.div
              key={activity.id || i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/20 transition-colors"
            >
              {activity.image_url && (
                <img
                  src={activity.image_url}
                  alt={activity.name || activity.title || ''}
                  className="w-20 h-20 rounded-lg object-cover shrink-0"
                />
              )}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-sm">
                    {activity.name || activity.title || 'Activity'}
                  </h3>
                  {activity.category && (
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {activity.category}
                    </Badge>
                  )}
                </div>
                {activity.description && (
                  <p className="text-xs text-muted-foreground line-clamp-3">{activity.description}</p>
                )}
                {activity.note && (
                  <p className="text-xs italic text-primary/80">"{activity.note}"</p>
                )}
                {activity.location?.name && (
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {activity.location.name}
                  </p>
                )}
              </div>
            </motion.div>
          ))
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">This guide doesn't have any activities yet.</p>
          </div>
        )}
      </section>

      {/* Back link */}
      <section className="max-w-3xl mx-auto px-4 pb-16">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/guides" className="gap-2">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Guides
          </Link>
        </Button>
      </section>
    </MainLayout>
  );
}
