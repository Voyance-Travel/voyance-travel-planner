/**
 * Community Guide Detail Page — Blog-Style Layout
 * Public route — no auth required.
 * /community-guides/:guideId
 */
import { lazy, Suspense, useMemo, useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import SafeImage from '@/components/SafeImage';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion } from 'framer-motion';
import { BookOpen, MapPin, Calendar, ArrowLeft, ArrowRight, Clock, Loader2, Trash2, Star, ThumbsUp, ThumbsDown, Minus, Lightbulb } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { toast } from 'sonner';
import CreatorCard from '@/components/guides/CreatorCard';
import ReportGuideModal from '@/components/guides/ReportGuideModal';
import CreatorContentSection from '@/components/guides/CreatorContentSection';
import EditorialRenderer from '@/components/guides/EditorialRenderer';
import type { EditorialContent } from '@/types/editorial';

const GuideTripMap = lazy(() => import('@/components/guides/GuideTripMap'));

interface GuideData {
  id: string;
  title: string;
  description: string | null;
  destination: string | null;
  destination_country: string | null;
  cover_image_url: string | null;
  content: Record<string, any> | null;
  tags: string[] | null;
  view_count: number | null;
  like_count: number | null;
  published_at: string | null;
  created_at: string;
  user_id: string;
  status: string;
  trip_id: string;
  editorial_content: Record<string, any> | null;
  editorial_version: number | null;
}

interface Activity {
  id?: string;
  name?: string;
  title?: string;
  description?: string;
  category?: string;
  note?: string;
  image_url?: string;
  url?: string;
  external_url?: string;
  is_manual?: boolean;
  location?: { lat?: number; lng?: number; name?: string; address?: string };
  day_number?: number;
  start_time?: string;
  user_rating?: number | null;
  recommended?: string | null;
  photos?: { url: string; caption: string }[];
}

function useGuideById(guideId: string | undefined) {
  return useQuery({
    queryKey: ['community-guide-by-id', guideId],
    queryFn: async () => {
      if (!guideId) return null;
      const { data, error } = await supabase
        .from('community_guides')
        .select('*')
        .eq('id', guideId)
        .maybeSingle();
      if (error) throw error;
      return data as GuideData | null;
    },
    enabled: !!guideId,
  });
}

function useTripDuration(tripId: string | undefined) {
  return useQuery({
    queryKey: ['trip-duration', tripId],
    queryFn: async () => {
      if (!tripId) return null;
      const { data } = await supabase
        .from('trips')
        .select('start_date, end_date, travelers')
        .eq('id', tripId)
        .maybeSingle();
      return data;
    },
    enabled: !!tripId,
  });
}

function groupByDay(activities: Activity[]): Map<number, Activity[]> {
  const groups = new Map<number, Activity[]>();
  for (const a of activities) {
    const day = a.day_number ?? 0;
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(a);
  }
  return new Map([...groups.entries()].sort((a, b) => a[0] - b[0]));
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-3.5 w-3.5 ${s <= rating ? 'text-gold fill-current' : 'text-muted-foreground/20'}`}
        />
      ))}
    </div>
  );
}

function RecommendBadge({ value }: { value: string }) {
  if (value === 'yes') return (
    <Badge className="bg-sage text-sage-foreground border-0 gap-1 text-[10px]">
      <ThumbsUp className="h-3 w-3" /> Recommended
    </Badge>
  );
  if (value === 'no') return (
    <Badge variant="destructive" className="gap-1 text-[10px]">
      <ThumbsDown className="h-3 w-3" /> Not Recommended
    </Badge>
  );
  return (
    <Badge variant="secondary" className="gap-1 text-[10px]">
      <Minus className="h-3 w-3" /> It's Okay
    </Badge>
  );
}

export default function CommunityGuideDetail() {
  const { guideId } = useParams<{ guideId: string }>();
  const navigate = useNavigate();
  const { data: guide, isLoading } = useGuideById(guideId);
  const { data: tripInfo } = useTripDuration(guide?.trip_id);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null);
    });
  }, []);

  const is404 = !isLoading && (!guide || guide.status !== 'published');

  const activities = useMemo(() => {
    return (guide?.content?.activities || []) as Activity[];
  }, [guide]);

  // Filter to only show activities with user content (experience, rating, photos, or recommendation)
  const enrichedActivities = useMemo(() => {
    return activities.filter(a =>
      a.note || a.user_rating || a.recommended || (a.photos && a.photos.length > 0)
    );
  }, [activities]);

  const customTips = useMemo(() => {
    return activities.filter(a => a.is_manual);
  }, [activities]);

  const regularActivities = useMemo(() => {
    return enrichedActivities.filter(a => !a.is_manual);
  }, [enrichedActivities]);

  const dayGroups = useMemo(() => groupByDay(regularActivities), [regularActivities]);

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (is404) {
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

  const durationDays =
    tripInfo?.start_date && tripInfo?.end_date
      ? Math.ceil(
          (new Date(tripInfo.end_date).getTime() - new Date(tripInfo.start_date).getTime()) /
            (1000 * 60 * 60 * 24)
        ) + 1
      : null;

  const heroImage = guide!.cover_image_url ||
    activities.find(a => a.photos && a.photos.length > 0)?.photos?.[0]?.url ||
    activities.find(a => a.image_url)?.image_url ||
    undefined;

  const ogTitle = `${guide!.title} | Voyance Community Guide`;
  const ogDesc =
    guide!.description || `A community travel guide for ${guide!.destination || 'an amazing destination'}.`;

  return (
    <MainLayout>
      <Head
        title={ogTitle}
        description={ogDesc}
        ogImage={heroImage}
      />

      {/* Hero */}
      <section className="relative">
        <div className="aspect-[21/9] sm:aspect-[3/1] w-full overflow-hidden bg-muted">
          {heroImage ? (
            <SafeImage
              src={heroImage}
              alt={guide!.title}
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
              <div className="flex flex-wrap items-center gap-2 mb-3">
                {guide!.destination && (
                  <Badge className="bg-primary/80 text-primary-foreground border-0">
                    <MapPin className="h-3 w-3 mr-1" />
                    {guide!.destination}
                    {guide!.destination_country ? `, ${guide!.destination_country}` : ''}
                  </Badge>
                )}
                {durationDays && (
                  <Badge variant="secondary" className="gap-1">
                    <Clock className="h-3 w-3" />
                    {durationDays} day{durationDays !== 1 ? 's' : ''}
                  </Badge>
                )}
                {tripInfo?.start_date && (
                  <Badge variant="secondary" className="gap-1">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(tripInfo.start_date), 'MMM yyyy')}
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl sm:text-4xl font-serif font-bold text-foreground drop-shadow-sm">
                {guide!.title}
              </h1>
              {guide!.description && (
                <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-xl italic">
                  "{guide!.description}"
                </p>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Content area */}
      <div className="max-w-3xl mx-auto px-4 py-8 grid md:grid-cols-[1fr_260px] gap-8">
        {/* Main content */}
        <div className="space-y-8 min-w-0">
          {/* Tags */}
          {guide!.tags && guide!.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {guide!.tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="text-xs">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Trip Map */}
          {activities.some((a) => a.location?.lat != null && a.location?.lng != null) && (
            <Suspense
              fallback={
                <div className="h-[320px] rounded-xl bg-muted flex items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              }
            >
              <GuideTripMap activities={activities} />
            </Suspense>
          )}

          {/* Creator's Content */}
          <CreatorContentSection guideId={guide!.id} />

          {/* Day-by-day sections — only activities with user content */}
          {dayGroups.size > 0 ? (
            [...dayGroups.entries()].map(([day, items]) => (
              <div key={day} className="space-y-4">
                {day > 0 && (
                  <h2 className="text-lg font-serif font-bold text-foreground flex items-center gap-2 pt-4 border-t border-border">
                    <Calendar className="h-4 w-4 text-primary" />
                    Day {day}
                  </h2>
                )}
                {day === 0 && dayGroups.size > 1 && (
                  <h2 className="text-lg font-serif font-bold text-foreground pt-4 border-t border-border">
                    General
                  </h2>
                )}

                {items.map((activity, i) => (
                  <ActivityBlogCard key={activity.id || `${day}-${i}`} activity={activity} />
                ))}
              </div>
            ))
          ) : enrichedActivities.length === 0 && customTips.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">This guide doesn't have any personal reviews yet.</p>
            </div>
          ) : null}

          {/* Custom Tips Section */}
          {customTips.length > 0 && (
            <div className="space-y-4 pt-4 border-t border-border">
              <h2 className="text-lg font-serif font-bold text-foreground flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-gold" />
                Custom Tips
              </h2>
              {customTips.map((tip, i) => (
                <ActivityBlogCard key={tip.id || `tip-${i}`} activity={tip} />
              ))}
            </div>
          )}

          {/* Bottom CTA */}
          <div className="pt-8 border-t border-border text-center space-y-4">
            <p className="text-lg font-serif font-semibold text-foreground">
              Plan your own trip to {guide!.destination || 'this destination'}
            </p>
            <Button asChild size="lg">
              <Link to="/start">
                Start Planning
                <ArrowRight className="h-4 w-4 ml-2" />
              </Link>
            </Button>
          </div>

          {/* Delete (owner only) */}
          {currentUserId && guide!.user_id === currentUserId && (
            <div className="pt-4 border-t border-border flex justify-center">
              <Button
                variant="destructive"
                size="sm"
                className="gap-2"
                disabled={deleting}
                onClick={async () => {
                  if (!confirm('Delete this guide? This cannot be undone.')) return;
                  setDeleting(true);
                  try {
                    await supabase.from('guide_sections').delete().eq('guide_id', guide!.id);
                    const { error } = await supabase.from('community_guides').delete().eq('id', guide!.id);
                    if (error) throw error;
                    toast.success('Guide deleted');
                    navigate('/guides?tab=community');
                  } catch {
                    toast.error('Failed to delete guide');
                    setDeleting(false);
                  }
                }}
              >
                {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                Delete Guide
              </Button>
            </div>
          )}

          {/* Report */}
          <div className="flex justify-center pt-4">
            <ReportGuideModal guideId={guide!.id} />
          </div>
        </div>

        {/* Sidebar */}
        <aside className="space-y-4 order-first md:order-last">
          <CreatorCard userId={guide!.user_id} />

          {guide!.published_at && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Published {format(new Date(guide!.published_at), 'MMM d, yyyy')}
            </p>
          )}
        </aside>
      </div>
    </MainLayout>
  );
}

/** Blog-style activity card for the published view */
function ActivityBlogCard({ activity }: { activity: Activity }) {
  const name = activity.name || activity.title || 'Activity';
  const photos = activity.photos || [];
  const hasPhotos = photos.length > 0;
  const experience = activity.note || '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border bg-card p-5 space-y-3"
    >
      {/* Header with name, rating, recommend */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <h3 className="font-serif font-semibold text-foreground">{name}</h3>
          {activity.category && (
            <span className="text-xs text-muted-foreground">{activity.category}</span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {activity.user_rating && <StarDisplay rating={activity.user_rating} />}
          {activity.recommended && <RecommendBadge value={activity.recommended} />}
        </div>
      </div>

      {/* Photo grid */}
      {hasPhotos && (
        <div className={`grid gap-2 ${photos.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {photos.slice(0, 4).map((photo, i) => (
            <div
              key={i}
              className={`rounded-lg overflow-hidden bg-muted ${
                photos.length === 1 ? 'aspect-video' : 'aspect-square'
              }`}
            >
              <SafeImage
                src={photo.url}
                alt={photo.caption || `${name} photo ${i + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            </div>
          ))}
        </div>
      )}

      {/* Fallback to existing image_url if no uploaded photos */}
      {!hasPhotos && activity.image_url && (
        <SafeImage
          src={activity.image_url}
          alt={name}
          className="w-full rounded-lg object-cover aspect-video"
          loading="lazy"
        />
      )}

      {/* User experience text */}
      {experience && (
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">
          {experience}
        </p>
      )}

      {/* Description (AI-generated) shown only if no user experience */}
      {!experience && activity.description && (
        <div className="pl-3 border-l-2 border-primary/20">
          <p className="text-xs text-muted-foreground italic">
            <span className="font-medium text-primary/60">Voyance Tip:</span>{' '}
            {activity.description}
          </p>
        </div>
      )}
    </motion.div>
  );
}
