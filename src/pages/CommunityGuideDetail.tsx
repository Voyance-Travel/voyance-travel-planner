/**
 * Community Guide Detail Page (by ID)
 * Public route — no auth required.
 * /community-guides/:guideId
 */
import { lazy, Suspense, useMemo, useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion } from 'framer-motion';
import { BookOpen, MapPin, Calendar, ArrowLeft, ArrowRight, Clock, Loader2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import CreatorCard from '@/components/guides/CreatorCard';
import ReportGuideModal from '@/components/guides/ReportGuideModal';
import CommunityGuideActivityCard from '@/components/guides/CommunityGuideActivityCard';
import CreatorContentSection from '@/components/guides/CreatorContentSection';
import { fetchGuideContentLinks, type GuideContentLink } from '@/services/guideContentLinksAPI';

// Lazy-load map to avoid SSR issues with leaflet
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

function useContentLinks(guideId: string | undefined) {
  return useQuery({
    queryKey: ['guide-content-links', guideId],
    queryFn: () => fetchGuideContentLinks(guideId!),
    enabled: !!guideId,
  });
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

export default function CommunityGuideDetail() {
  const { guideId } = useParams<{ guideId: string }>();
  const navigate = useNavigate();
  const { data: guide, isLoading } = useGuideById(guideId);
  const { data: tripInfo } = useTripDuration(guide?.trip_id);
  const { data: contentLinks = [] } = useContentLinks(guide?.id);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data.user?.id || null);
    });
  }, []);

  // 404 if not found or unpublished
  const is404 = !isLoading && (!guide || guide.status !== 'published');

  const activities = useMemo(() => {
    return (guide?.content?.activities || []) as Activity[];
  }, [guide]);

  const dayGroups = useMemo(() => groupByDay(activities), [activities]);

  // Build a map of activity_id → content links for that activity
  const activityContentMap = useMemo(() => {
    const map = new Map<string, GuideContentLink[]>();
    for (const link of contentLinks) {
      if (link.activity_id) {
        if (!map.has(link.activity_id)) map.set(link.activity_id, []);
        map.get(link.activity_id)!.push(link);
      }
    }
    return map;
  }, [contentLinks]);

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

  const durationLabel = durationDays
    ? `${durationDays - 1} night${durationDays - 1 !== 1 ? 's' : ''} in ${guide!.destination || 'destination'}`
    : null;

  const ogImage = guide!.cover_image_url || undefined;
  const ogTitle = `${guide!.title} | Voyance Community Guide`;
  const ogDesc =
    guide!.description || `A community travel guide for ${guide!.destination || 'an amazing destination'}.`;

  return (
    <MainLayout>
      <Head
        title={ogTitle}
        description={ogDesc}
        ogImage={ogImage}
      />

      {/* Hero */}
      <section className="relative">
        <div className="aspect-[21/9] sm:aspect-[3/1] w-full overflow-hidden bg-muted">
          {guide!.cover_image_url ? (
            <img
              src={guide!.cover_image_url}
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
                {durationLabel && (
                  <Badge variant="secondary" className="gap-1">
                    <Clock className="h-3 w-3" />
                    {durationLabel}
                  </Badge>
                )}
              </div>
              <h1 className="text-2xl sm:text-4xl font-serif font-bold text-foreground drop-shadow-sm">
                {guide!.title}
              </h1>
              {guide!.description && (
                <p className="mt-2 text-sm sm:text-base text-muted-foreground max-w-xl">
                  {guide!.description}
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

          {/* Activities grouped by day */}
          {dayGroups.size > 0 ? (
            [...dayGroups.entries()].map(([day, items]) => (
              <div key={day} className="space-y-3">
                {day > 0 && (
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    Day {day}
                  </h2>
                )}
                {day === 0 && dayGroups.size > 1 && (
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    General
                  </h2>
                )}
                {items.map((activity, i) => (
                  <CommunityGuideActivityCard
                    key={activity.id || `${day}-${i}`}
                    activity={activity}
                    index={i}
                    contentLinks={activity.id ? activityContentMap.get(activity.id) : undefined}
                  />
                ))}
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">This guide doesn't have any activities yet.</p>
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
