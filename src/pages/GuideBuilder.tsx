/**
 * Guide Builder Page — Redesigned
 * Editable activity cards with experience, rating, photos, recommend toggle.
 * Protected route — requires auth.
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { motion } from 'framer-motion';
import {
  BookOpen, ArrowLeft, Trash2, Save, Globe, Loader2, MapPin,
  Copy, ExternalLink, EyeOff, PartyPopper, Plus, Eye, Calendar, Clock, Link2,
  CheckSquare, XSquare, Lightbulb,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import PublishConfirmModal from '@/components/guides/PublishConfirmModal';
import EditableActivityCard, { type ActivitySectionData } from '@/components/guides/EditableActivityCard';
import SmartTagSelector from '@/components/guides/SmartTagSelector';
import AddContentLinkModal from '@/components/guides/AddContentLinkModal';
import ContentLinkCard from '@/components/guides/ContentLinkCard';
import { useGuideContentLinks } from '@/hooks/useGuideContentLinks';
import {
  useTripForGuide,
  useExistingGuide,
} from '@/hooks/useCommunityGuide';

interface GuideFormState {
  title: string;
  description: string;
  tags: string[];
  tagInput: string;
}

export default function GuideBuilder() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: trip, isLoading: tripLoading } = useTripForGuide(tripId);
  const { data: existingGuide, isLoading: guideLoading } = useExistingGuide(tripId);

  // Fetch travel DNA for smart tags
  const { data: travelDna } = useQuery({
    queryKey: ['travel-dna-guide', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('travel_dna_profiles')
        .select('primary_archetype_name')
        .eq('user_id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch existing sections from DB if guide exists
  const { data: existingSections } = useQuery({
    queryKey: ['guide-sections-edit', existingGuide?.id],
    queryFn: async () => {
      if (!existingGuide?.id) return [];
      // @ts-ignore - new columns not in generated types yet
      const { data, error } = await supabase
        .from('guide_sections')
        .select('*')
        .eq('guide_id', existingGuide.id)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!existingGuide?.id,
  });

  const [form, setForm] = useState<GuideFormState>({
    title: '',
    description: '',
    tags: [],
    tagInput: '',
  });

  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [justPublished, setJustPublished] = useState(false);
  const [addContentLinkOpen, setAddContentLinkOpen] = useState(false);
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set());
  const [excludedActivities, setExcludedActivities] = useState<Set<string>>(new Set());
  const [sections, setSections] = useState<ActivitySectionData[]>([]);
  const [sectionsLoaded, setSectionsLoaded] = useState(false);

  // Content links (only available after guide is saved)
  const { contentLinks, addLink, deleteLink, isAdding: isAddingLink, isDeleting: isDeletingLink } = useGuideContentLinks(existingGuide?.id);

  const isPublished = existingGuide?.status === 'published';
  const guideUrl = existingGuide
    ? `${window.location.origin}/community-guides/${existingGuide.id}`
    : '';

  // Count sections with content for publish check
  const sectionCount = sections.filter(s => s.sectionType !== 'day_overview').length;
  const canPublish = form.title.trim().length > 0 && sectionCount >= 3;

  // Trip duration
  const durationDays = trip?.start_date && trip?.end_date
    ? Math.ceil((new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / 86400000) + 1
    : null;

  // Extract days and activities from trip itinerary_data
  const tripDays = (() => {
    const itData = trip?.itinerary_data as any;
    const days = itData?.days || [];
    return days.map((d: any) => ({
      dayNumber: d.dayNumber || d.day_number || 0,
      title: d.title || d.theme || `Day ${d.dayNumber || d.day_number}`,
      theme: d.theme || '',
      activities: (d.activities || []).map((a: any, idx: number) => ({
        id: a.id || a.external_id || `day${d.dayNumber || d.day_number}-act${idx}`,
        name: a.title || a.name || 'Activity',
        title: a.title || a.name || 'Activity',
        category: a.category || '',
        tips: a.tips || '',
        photos: a.photos || [],
      })),
    }));
  })();

  const itineraryDayNumbers: number[] = tripDays.map((d: any) => d.dayNumber).filter((n: number) => n > 0).sort((a: number, b: number) => a - b);
  const itineraryActivities: { id: string; name: string }[] = tripDays.flatMap((d: any) =>
    d.activities.map((a: any) => ({ id: a.id, name: `Day ${d.dayNumber}: ${a.name}` }))
  );

  // Activity categories for smart tags
  const activityCategories = tripDays.flatMap((d: any) =>
    d.activities.map((a: any) => a.category).filter(Boolean)
  );

  // Auto-select all days on load
  useEffect(() => {
    if (tripDays.length > 0 && selectedDays.size === 0) {
      setSelectedDays(new Set(tripDays.map((d: any) => d.dayNumber)));
    }
  }, [tripDays.length]);

  // Load existing sections from DB
  useEffect(() => {
    if (existingSections && existingSections.length > 0 && !sectionsLoaded) {
      const loaded: ActivitySectionData[] = existingSections.map((s: any) => ({
        id: s.id,
        sectionType: s.section_type as any,
        title: s.title || '',
        body: s.body || '',
        linkedDayNumber: s.linked_day_number || 0,
        linkedActivityId: s.linked_activity_id || undefined,
        activitySnapshot: s.activity_tips ? {
          tips: s.activity_tips,
          category: s.activity_category,
        } : undefined,
        photoUrl: s.photo_url || undefined,
        sortOrder: s.sort_order || 0,
        userExperience: s.user_experience || '',
        userRating: s.user_rating || null,
        recommended: s.recommended || null,
        photos: s.photos || [],
      }));
      setSections(loaded);
      setSectionsLoaded(true);
    }
  }, [existingSections, sectionsLoaded]);

  // Bulk add selected content to guide sections
  const addSelectedContentToGuide = () => {
    const newSections: ActivitySectionData[] = [];

    Array.from(selectedDays).sort((a, b) => a - b).forEach((dayNum) => {
      const day = tripDays.find((d: any) => d.dayNumber === dayNum);
      if (!day) return;

      // Check if day overview already exists
      const existsDayOverview = sections.some(
        s => s.sectionType === 'day_overview' && s.linkedDayNumber === dayNum
      );

      if (!existsDayOverview) {
        newSections.push({
          id: crypto.randomUUID(),
          sectionType: 'day_overview',
          title: day.title,
          body: day.theme || '',
          linkedDayNumber: dayNum,
          sortOrder: sections.length + newSections.length,
          userExperience: '',
          userRating: null,
          recommended: null,
          photos: [],
        });
      }

      day.activities.forEach((activity: any) => {
        if (excludedActivities.has(activity.id)) return;

        // Check if activity already added
        const existsActivity = sections.some(
          s => s.linkedActivityId === activity.id
        );
        if (existsActivity) return;

        newSections.push({
          id: crypto.randomUUID(),
          sectionType: 'activity',
          title: activity.title,
          body: activity.tips || '',
          linkedDayNumber: dayNum,
          linkedActivityId: activity.id,
          activitySnapshot: activity,
          photoUrl: activity.photos?.[0] || undefined,
          sortOrder: sections.length + newSections.length,
          userExperience: '',
          userRating: null,
          recommended: null,
          photos: [],
        });
      });
    });

    if (newSections.length === 0) {
      toast.info('All selected activities are already in the guide');
      return;
    }

    setSections(prev => [...prev, ...newSections]);
    toast.success(`Added ${newSections.length} sections from ${selectedDays.size} day${selectedDays.size !== 1 ? 's' : ''}`);
  };

  // Add custom tip
  const addCustomTip = () => {
    const newSection: ActivitySectionData = {
      id: crypto.randomUUID(),
      sectionType: 'custom_tip',
      title: '',
      body: '',
      linkedDayNumber: 0,
      sortOrder: sections.length,
      userExperience: '',
      userRating: null,
      recommended: null,
      photos: [],
    };
    setSections(prev => [...prev, newSection]);
  };

  useEffect(() => {
    if (existingGuide) {
      setForm({
        title: existingGuide.title || '',
        description: existingGuide.description || '',
        tags: (existingGuide.tags as string[]) || [],
        tagInput: '',
      });
    } else if (trip && !form.title) {
      const defaultTitle = `${trip.destination} Travel Guide`;
      setForm(prev => ({ ...prev, title: defaultTitle.slice(0, 100) }));
    }
  }, [existingGuide, trip]);

  // Update a section
  const updateSection = useCallback((updated: ActivitySectionData) => {
    setSections(prev => prev.map(s => s.id === updated.id ? updated : s));
  }, []);

  // Delete a section
  const deleteSection = useCallback((id: string) => {
    setSections(prev => prev.filter(s => s.id !== id));
  }, []);

  // Save / publish mutation
  const saveMutation = useMutation({
    mutationFn: async (publish: boolean) => {
      if (!tripId || !user) throw new Error('Missing trip or user');

      let finalPublish = publish;
      let finalStatus: string = publish ? 'published' : 'draft';
      let moderationStatus = 'approved';

      if (publish) {
        // Run moderation check
        const allTexts = [
          form.title,
          form.description,
          ...sections.map(s => `${s.title || ''} ${s.userExperience || ''} ${s.body || ''}`),
        ].filter(Boolean);

        try {
          const { data: modResult, error: modError } = await supabase.functions.invoke(
            'moderate-guide-content',
            { body: { texts: allTexts } }
          );

          if (!modError && modResult) {
            if (!modResult.approved) {
              toast.error('Your guide contains content that needs review. Saved as draft.');
              finalPublish = false;
              finalStatus = 'draft';
              moderationStatus = 'flagged';
            } else if (modResult.warnings?.length > 0) {
              // Warnings — allow but notify
              modResult.warnings.forEach((w: string) => toast.warning(w, { duration: 6000 }));
            }
          }
        } catch {
          // If moderation fails, proceed anyway
          console.warn('Moderation check failed, proceeding');
        }
      }

      const slug = form.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80) + '-' + tripId.slice(0, 8);

      // Build content from sections (for backward compatibility with published view)
      const content = {
        activities: sections
          .filter(s => s.sectionType !== 'day_overview')
          .map(s => ({
            id: s.linkedActivityId || s.id,
            name: s.title,
            description: s.body || s.activitySnapshot?.tips || null,
            category: s.activitySnapshot?.category || null,
            image_url: s.photoUrl || (s.photos[0]?.url) || null,
            note: s.userExperience || null,
            user_rating: s.userRating,
            recommended: s.recommended,
            photos: s.photos,
            is_manual: s.sectionType === 'custom_tip',
            day_number: s.linkedDayNumber,
          })),
      };

      const payload = {
        user_id: user.id,
        trip_id: tripId,
        title: form.title,
        description: form.description,
        destination: trip?.destination || null,
        destination_country: trip?.destination_country || null,
        tags: form.tags,
        content,
        slug,
        status: finalStatus,
        moderation_status: moderationStatus,
        cover_image_url: sections.find(s => s.photos.length > 0)?.photos[0]?.url || existingGuide?.cover_image_url || null,
        published_at: finalPublish ? new Date().toISOString() : (existingGuide?.published_at || null),
        updated_at: new Date().toISOString(),
      };

      let guideId: string;

      if (existingGuide) {
        // @ts-ignore - moderation_status not in generated types yet
        const { error } = await supabase.from('community_guides').update(payload).eq('id', existingGuide.id);
        if (error) throw error;
        guideId = existingGuide.id;
      } else {
        // @ts-ignore - moderation_status not in generated types yet
        const { data, error } = await supabase.from('community_guides').insert(payload).select('id').single();
        if (error) throw error;
        guideId = data.id;
      }

      // Save sections to guide_sections table
      // Delete existing sections and re-insert
      await supabase.from('guide_sections').delete().eq('guide_id', guideId);

      if (sections.length > 0) {
        const sectionRows = sections.map((s, idx) => ({
          guide_id: guideId,
          section_type: s.sectionType,
          title: s.title,
          body: s.body || null,
          linked_day_number: s.linkedDayNumber || null,
          linked_activity_id: s.linkedActivityId || null,
          activity_category: s.activitySnapshot?.category || null,
          activity_tips: s.activitySnapshot?.tips || null,
          photo_url: s.photoUrl || null,
          sort_order: idx,
          user_experience: s.userExperience || null,
          user_rating: s.userRating || null,
          recommended: s.recommended || null,
          photos: s.photos.length > 0 ? s.photos : [],
        }));

        // @ts-ignore - new columns
        const { error: sectError } = await supabase.from('guide_sections').insert(sectionRows);
        if (sectError) throw sectError;
      }

      // If publishing, upsert activity reviews for aggregation
      if (finalPublish && trip?.destination) {
        const reviews = sections
          .filter(s => s.sectionType !== 'day_overview' && (s.userRating || s.userExperience || s.recommended))
          .map(s => ({
            guide_id: guideId,
            user_id: user.id,
            activity_name: s.title,
            activity_category: s.activitySnapshot?.category || null,
            destination_city: trip.destination!,
            rating: s.userRating || null,
            recommended: s.recommended === 'yes' ? true : s.recommended === 'no' ? false : null,
            experience_text: s.userExperience || null,
            photo_count: s.photos.length,
          }));

        if (reviews.length > 0) {
          // Delete existing reviews for this guide, then insert
          // @ts-ignore
          await supabase.from('guide_activity_reviews').delete().eq('guide_id', guideId);
          // @ts-ignore
          await supabase.from('guide_activity_reviews').insert(reviews);
        }
      }

      return finalPublish;
    },
    onSuccess: (didPublish) => {
      queryClient.invalidateQueries({ queryKey: ['community-guide-trip', tripId] });
      queryClient.invalidateQueries({ queryKey: ['community-guides-published'] });
      queryClient.invalidateQueries({ queryKey: ['guide-sections-edit'] });
      if (didPublish) {
        setPublishModalOpen(false);
        setJustPublished(true);
        toast.success('Guide published!');
      } else {
        toast.success('Draft saved');
      }
    },
    onError: (err: any) => toast.error(err.message || 'Failed to save guide'),
  });

  const unpublishMutation = useMutation({
    mutationFn: async () => {
      if (!existingGuide) throw new Error('No guide');
      const { error } = await supabase.from('community_guides')
        .update({ status: 'draft', published_at: null, updated_at: new Date().toISOString() })
        .eq('id', existingGuide.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-guide-trip', tripId] });
      queryClient.invalidateQueries({ queryKey: ['community-guides-published'] });
      setJustPublished(false);
      toast.success('Guide unpublished');
    },
    onError: () => toast.error('Failed to unpublish'),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!existingGuide) throw new Error('No guide to delete');
      await supabase.from('guide_sections').delete().eq('guide_id', existingGuide.id);
      const { error } = await supabase.from('community_guides').delete().eq('id', existingGuide.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-guide-trip', tripId] });
      queryClient.invalidateQueries({ queryKey: ['community-guides-published'] });
      toast.success('Guide deleted');
      navigate(`/trip/${tripId}`);
    },
    onError: () => toast.error('Failed to delete guide'),
  });

  const copyUrl = () => {
    navigator.clipboard.writeText(guideUrl);
    toast.success('Link copied!');
  };

  const isLoading = tripLoading || guideLoading;

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  if (!trip) {
    return (
      <MainLayout>
        <Head title="Guide Builder | Voyance" />
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
          <BookOpen className="h-12 w-12 text-muted-foreground/30" />
          <h1 className="text-xl font-serif font-bold">Trip not found</h1>
          <Button variant="outline" asChild>
            <Link to="/trip/dashboard"><ArrowLeft className="h-4 w-4 mr-2" />Back to Trips</Link>
          </Button>
        </div>
      </MainLayout>
    );
  }

  // ── Published state ──
  if (justPublished || isPublished) {
    return (
      <MainLayout>
        <Head title={`Guide: ${trip.destination} | Voyance`} />
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/trip/${tripId}`)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-serif font-bold truncate">Your Published Guide</h1>
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3" />
                {trip.destination}{trip.destination_country ? `, ${trip.destination_country}` : ''}
              </p>
            </div>
          </div>

          {justPublished && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-xl border border-primary/20 bg-primary/5 p-6 text-center space-y-3"
            >
              <PartyPopper className="h-10 w-10 text-primary mx-auto" />
              <h2 className="text-lg font-serif font-bold text-foreground">Your guide is live!</h2>
              <p className="text-sm text-muted-foreground">
                Share it with friends or anyone planning a trip to {trip.destination}.
              </p>
            </motion.div>
          )}

          <div className="rounded-xl border border-border bg-card p-5 space-y-3">
            <p className="text-sm font-medium text-foreground">Shareable link</p>
            <div className="flex gap-2">
              <Input value={guideUrl} readOnly className="text-xs bg-muted/50 flex-1" />
              <Button variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={copyUrl}>
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
            </div>
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <Link to={`/community-guides/${existingGuide?.id}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5" /> View Published Guide
              </Link>
            </Button>
          </div>

          <div className="flex gap-3 pt-4 border-t border-border">
            <Button variant="outline" className="gap-2" onClick={() => setJustPublished(false)}>
              <Save className="h-4 w-4" /> Edit Guide
            </Button>
            <Button
              variant="ghost"
              className="gap-2 text-destructive hover:text-destructive"
              disabled={unpublishMutation.isPending}
              onClick={() => unpublishMutation.mutate()}
            >
              {unpublishMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <EyeOff className="h-4 w-4" />}
              Unpublish
            </Button>
          </div>
          <Button
            variant="ghost"
            className="gap-2 text-destructive hover:text-destructive"
            disabled={deleteMutation.isPending}
            onClick={() => {
              if (!confirm('Delete this guide permanently? This cannot be undone.')) return;
              deleteMutation.mutate();
            }}
          >
            {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Delete
          </Button>
        </div>
      </MainLayout>
    );
  }

  // ── Editor ──
  return (
    <MainLayout>
      <Head title={`Build Guide: ${trip.destination} | Voyance`} />

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/trip/${tripId}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl font-serif font-bold truncate">
              {existingGuide ? 'Edit Your Guide' : 'Build Your Travel Guide'}
            </h1>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {trip.destination}{trip.destination_country ? `, ${trip.destination_country}` : ''}
              </span>
              {trip.start_date && trip.end_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(trip.start_date), 'MMM d')} – {format(new Date(trip.end_date), 'MMM d, yyyy')}
                </span>
              )}
              {durationDays && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {durationDays} day{durationDays !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <Input
              value={form.title}
              onChange={e => setForm(prev => ({ ...prev, title: e.target.value.slice(0, 100) }))}
              placeholder="My Tokyo Travel Guide"
              maxLength={100}
              className="text-sm"
            />
            <p className="text-xs text-muted-foreground text-right">{form.title.length}/100</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description (optional)</label>
            <Textarea
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value.slice(0, 1000) }))}
              placeholder="A brief description of your guide…"
              maxLength={1000}
              rows={3}
              className="text-sm resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">{form.description.length}/1000</p>
          </div>

          {/* Smart Tags */}
          <SmartTagSelector
            tags={form.tags}
            tagInput={form.tagInput}
            onTagsChange={(tags) => setForm(prev => ({ ...prev, tags }))}
            onTagInputChange={(val) => setForm(prev => ({ ...prev, tagInput: val }))}
            destination={trip.destination}
            destinationCountry={trip.destination_country}
            activityCategories={activityCategories}
            travelDnaType={travelDna?.primary_archetype_name}
            travelerCount={trip.travelers as number | null}
          />
        </div>

        {/* Bulk Content Selection from Trip Itinerary */}
        {tripDays.length > 0 && (
          <Card className="border-primary/20">
            <CardContent className="py-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <CheckSquare className="h-4 w-4 text-primary" />
                  Add Trip Content
                </h3>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      setSelectedDays(new Set(tripDays.map((d: any) => d.dayNumber)));
                      setExcludedActivities(new Set());
                    }}
                  >
                    <CheckSquare className="h-3 w-3" /> Select All
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => setSelectedDays(new Set())}
                  >
                    <XSquare className="h-3 w-3" /> Select None
                  </Button>
                </div>
              </div>

              <div className="space-y-1 max-h-80 overflow-y-auto pr-1">
                {tripDays.map((day: any) => (
                  <div key={day.dayNumber}>
                    <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                      <Checkbox
                        checked={selectedDays.has(day.dayNumber)}
                        onCheckedChange={() => {
                          setSelectedDays(prev => {
                            const next = new Set(prev);
                            if (next.has(day.dayNumber)) next.delete(day.dayNumber);
                            else next.add(day.dayNumber);
                            return next;
                          });
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">Day {day.dayNumber}: {day.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {day.activities.length} activit{day.activities.length !== 1 ? 'ies' : 'y'}
                          {day.theme ? ` · ${day.theme}` : ''}
                        </p>
                      </div>
                    </label>

                    {selectedDays.has(day.dayNumber) && day.activities.length > 0 && (
                      <div className="ml-9 space-y-0.5 mb-1">
                        {day.activities.map((activity: any) => (
                          <label
                            key={activity.id}
                            className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/30 cursor-pointer transition-colors"
                          >
                            <Checkbox
                              checked={!excludedActivities.has(activity.id)}
                              onCheckedChange={() => {
                                setExcludedActivities(prev => {
                                  const next = new Set(prev);
                                  if (next.has(activity.id)) next.delete(activity.id);
                                  else next.add(activity.id);
                                  return next;
                                });
                              }}
                            />
                            <span className="text-sm truncate">{activity.name}</span>
                            {activity.category && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                                {activity.category}
                              </Badge>
                            )}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Button
                size="sm"
                className="w-full mt-3 gap-2"
                disabled={selectedDays.size === 0}
                onClick={addSelectedContentToGuide}
              >
                <Plus className="h-3.5 w-3.5" />
                Add {selectedDays.size} Day{selectedDays.size !== 1 ? 's' : ''} to Guide
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Editable Activity Sections */}
        {sections.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">
                Guide Sections ({sectionCount} activit{sectionCount !== 1 ? 'ies' : 'y'})
              </h2>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-destructive hover:text-destructive gap-1"
                onClick={() => {
                  if (!confirm('Clear all sections?')) return;
                  setSections([]);
                }}
              >
                <Trash2 className="h-3 w-3" /> Clear All
              </Button>
            </div>

            <div className="space-y-3">
              {sections.map((section, i) => (
                <EditableActivityCard
                  key={section.id}
                  section={section}
                  index={i}
                  onChange={updateSection}
                  onDelete={deleteSection}
                  userId={user?.id || ''}
                  guideId={existingGuide?.id || 'draft'}
                />
              ))}
            </div>

            {/* Add Custom Tip button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-1.5"
              onClick={addCustomTip}
            >
              <Lightbulb className="h-3.5 w-3.5" />
              Add Custom Tip
            </Button>
          </div>
        )}

        {sections.length === 0 && (
          <div className="text-center py-10 border border-dashed border-border rounded-xl">
            <BookOpen className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No sections yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Select days above to add activities, or add custom tips.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4 gap-1.5"
              onClick={addCustomTip}
            >
              <Lightbulb className="h-3.5 w-3.5" />
              Add Custom Tip
            </Button>
          </div>
        )}

        {/* ── Content Links ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Link2 className="h-3.5 w-3.5" />
                Link Your Content
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Connect your YouTube videos, Instagram posts, and more
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              onClick={() => {
                if (!existingGuide) {
                  toast.info('Save your guide as a draft first to add content links.');
                  return;
                }
                setAddContentLinkOpen(true);
              }}
            >
              <Plus className="h-3 w-3" /> Add Content Link
            </Button>
          </div>

          {contentLinks.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {contentLinks.map(link => (
                <ContentLinkCard
                  key={link.id}
                  link={link}
                  onDelete={async (id) => {
                    try {
                      await deleteLink(id);
                      toast.success('Content link removed');
                    } catch {
                      toast.error('Failed to remove link');
                    }
                  }}
                  isDeleting={isDeletingLink}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-6 border border-dashed border-border rounded-xl">
              <Link2 className="h-6 w-6 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">
                {existingGuide
                  ? 'No content links yet. Add YouTube videos, blog posts, or social media content.'
                  : 'Save your guide as a draft first, then add content links.'}
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
          <Button
            variant="outline"
            className="gap-2 flex-1 min-w-[140px]"
            disabled={saveMutation.isPending || !form.title.trim()}
            onClick={() => saveMutation.mutate(false)}
          >
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Draft
          </Button>
          <Button
            className="gap-2 flex-1 min-w-[140px]"
            disabled={saveMutation.isPending || !canPublish}
            onClick={() => setPublishModalOpen(true)}
          >
            <Globe className="h-4 w-4" /> Publish Guide
          </Button>
        </div>

        {!canPublish && sectionCount > 0 && sectionCount < 3 && (
          <p className="text-xs text-muted-foreground text-center">
            You need at least 3 activities to publish. Currently: {sectionCount}.
          </p>
        )}
      </div>

      <PublishConfirmModal
        open={publishModalOpen}
        onOpenChange={setPublishModalOpen}
        onConfirm={() => saveMutation.mutate(true)}
        isPending={saveMutation.isPending}
        title={form.title}
        itemCount={sectionCount}
      />

      <AddContentLinkModal
        open={addContentLinkOpen}
        onOpenChange={setAddContentLinkOpen}
        onSubmit={async (data) => {
          try {
            await addLink(data);
            toast.success('Content link added!');
          } catch {
            toast.error('Failed to add content link');
          }
        }}
        isPending={isAddingLink}
        dayNumbers={itineraryDayNumbers.length > 0 ? itineraryDayNumbers : []}
        activities={itineraryActivities.length > 0 ? itineraryActivities : []}
      />
    </MainLayout>
  );
}
