/**
 * Guide Builder Page
 * Compiles guide_favorites + manual entries into a community_guide.
 * Protected route — requires auth.
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { motion } from 'framer-motion';
import {
  BookOpen, ArrowLeft, Trash2, Save, Globe, Loader2, MapPin,
  Copy, ExternalLink, EyeOff, PartyPopper, Plus, Eye, Calendar, Clock, Link2,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import PublishConfirmModal from '@/components/guides/PublishConfirmModal';
import GuideActivityCard from '@/components/guides/GuideActivityCard';
import AddRecommendationModal from '@/components/guides/AddRecommendationModal';
import AddContentLinkModal from '@/components/guides/AddContentLinkModal';
import ContentLinkCard from '@/components/guides/ContentLinkCard';
import GuidePreview from '@/components/guides/GuidePreview';
import { useGuideContentLinks } from '@/hooks/useGuideContentLinks';
import {
  useGuideFavorites,
  useManualEntries,
  useTripForGuide,
  useExistingGuide,
  mergeGuideItems,
  groupByDay,
} from '@/hooks/useCommunityGuide';
import {
  deleteGuideFavorite,
  deleteManualEntry,
  updateFavoriteNote,
  createManualEntry,
} from '@/services/communityGuidesAPI';

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
  const { data: favorites = [], isLoading: favsLoading } = useGuideFavorites(tripId);
  const { data: manualEntries = [], isLoading: manualsLoading } = useManualEntries(tripId);
  const { data: existingGuide, isLoading: guideLoading } = useExistingGuide(tripId);

  const [form, setForm] = useState<GuideFormState>({
    title: '',
    description: '',
    tags: [],
    tagInput: '',
  });

  const [publishModalOpen, setPublishModalOpen] = useState(false);
  const [justPublished, setJustPublished] = useState(false);
  const [addRecModalOpen, setAddRecModalOpen] = useState(false);
  const [addRecDayNumber, setAddRecDayNumber] = useState(1);
  const [addContentLinkOpen, setAddContentLinkOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editNoteValue, setEditNoteValue] = useState('');

  // Content links (only available after guide is saved)
  const { contentLinks, addLink, deleteLink, isAdding: isAddingLink, isDeleting: isDeletingLink } = useGuideContentLinks(existingGuide?.id);

  const isPublished = existingGuide?.status === 'published';
  const guideUrl = existingGuide
    ? `${window.location.origin}/community-guides/${existingGuide.id}`
    : '';

  // Merge favorites + manual entries
  const allItems = mergeGuideItems(favorites, manualEntries);
  const dayGroups = groupByDay(allItems);
  const itemCount = allItems.length;
  const canPublish = form.title.trim().length > 0 && itemCount >= 3;

  // Trip duration
  const durationDays = trip?.start_date && trip?.end_date
    ? Math.ceil((new Date(trip.end_date).getTime() - new Date(trip.start_date).getTime()) / 86400000) + 1
    : null;

  // Seed form
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

  // Save / publish mutation
  const saveMutation = useMutation({
    mutationFn: async (publish: boolean) => {
      if (!tripId || !user) throw new Error('Missing trip or user');

      const slug = form.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80) + '-' + tripId.slice(0, 8);

      const content = {
        activities: allItems.map(item => ({
          id: item.id,
          name: item.name,
          description: item.description,
          category: item.category,
          image_url: item.image_url,
          note: item.note,
          external_url: item.external_url,
          is_manual: item.type === 'manual',
          day_number: item.day_number,
          start_time: item.start_time,
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
        status: publish ? 'published' : 'draft',
        published_at: publish ? new Date().toISOString() : (existingGuide?.published_at || null),
        updated_at: new Date().toISOString(),
      };

      if (existingGuide) {
        const { error } = await supabase.from('community_guides').update(payload).eq('id', existingGuide.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('community_guides').insert(payload);
        if (error) throw error;
      }
      return publish;
    },
    onSuccess: (didPublish) => {
      queryClient.invalidateQueries({ queryKey: ['community-guide-trip', tripId] });
      queryClient.invalidateQueries({ queryKey: ['community-guides-published'] });
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

  // Delete item
  const handleDelete = useCallback(async (id: string, type: 'favorite' | 'manual') => {
    try {
      if (type === 'favorite') {
        await deleteGuideFavorite(id);
        queryClient.invalidateQueries({ queryKey: ['guide-favorites-full', tripId] });
      } else {
        await deleteManualEntry(id);
        queryClient.invalidateQueries({ queryKey: ['guide-manual-entries', tripId] });
      }
      toast.success('Removed from guide');
    } catch {
      toast.error('Failed to remove item');
    }
  }, [tripId, queryClient]);

  // Edit note inline
  const handleStartEditNote = (id: string, currentNote: string | null) => {
    setEditingNoteId(id);
    setEditNoteValue(currentNote || '');
  };

  const handleSaveNote = useCallback(async () => {
    if (!editingNoteId) return;
    try {
      await updateFavoriteNote(editingNoteId, editNoteValue.trim() || null);
      queryClient.invalidateQueries({ queryKey: ['guide-favorites-full', tripId] });
      setEditingNoteId(null);
      toast.success('Note updated');
    } catch {
      toast.error('Failed to update note');
    }
  }, [editingNoteId, editNoteValue, tripId, queryClient]);

  // Add manual entry
  const addRecMutation = useMutation({
    mutationFn: async (entry: {
      name: string; category: string; description: string; external_url: string; day_number: number;
    }) => {
      if (!tripId || !user) throw new Error('Missing data');
      return createManualEntry({
        trip_id: tripId,
        user_id: user.id,
        name: entry.name,
        category: entry.category,
        description: entry.description || null,
        external_url: entry.external_url || null,
        day_number: entry.day_number,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guide-manual-entries', tripId] });
      setAddRecModalOpen(false);
      toast.success('Recommendation added!');
    },
    onError: () => toast.error('Failed to add recommendation'),
  });

  // Tags
  const addTag = () => {
    const tag = form.tagInput.trim();
    if (tag && !form.tags.includes(tag) && form.tags.length < 8) {
      setForm(prev => ({ ...prev, tags: [...prev.tags, tag], tagInput: '' }));
    }
  };
  const removeTag = (tag: string) => setForm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));

  const copyUrl = () => {
    navigator.clipboard.writeText(guideUrl);
    toast.success('Link copied!');
  };

  const isLoading = tripLoading || favsLoading || manualsLoading || guideLoading;

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
        <Head title={`Guide — ${trip.destination} | Voyance`} />
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
        </div>
      </MainLayout>
    );
  }

  // ── Preview mode ──
  if (showPreview) {
    return (
      <MainLayout>
        <Head title={`Preview Guide — ${trip.destination} | Voyance`} />
        <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" className="gap-2" onClick={() => setShowPreview(false)}>
              <ArrowLeft className="h-4 w-4" /> Back to Editor
            </Button>
            <Badge variant="secondary" className="gap-1">
              <Eye className="h-3 w-3" /> Preview
            </Badge>
          </div>
          <GuidePreview
            title={form.title}
            description={form.description}
            destination={trip.destination}
            destinationCountry={trip.destination_country}
            tags={form.tags}
            dayGroups={dayGroups}
          />
        </div>
      </MainLayout>
    );
  }

  // ── Editor ──
  return (
    <MainLayout>
      <Head title={`Build Guide — ${trip.destination} | Voyance`} />

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

          <div className="space-y-2">
            <label className="text-sm font-medium">Tags</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.tags.map(tag => (
                <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                  {tag}
                  <button onClick={() => removeTag(tag)} className="hover:text-destructive">
                    <Trash2 className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={form.tagInput}
                onChange={e => setForm(prev => ({ ...prev, tagInput: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="Add a tag…"
                className="text-xs h-8 flex-1"
              />
              <Button size="sm" variant="outline" onClick={addTag} className="h-8 text-xs">Add</Button>
            </div>
          </div>
        </div>

        {/* Content grouped by day */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Guide Content ({itemCount} item{itemCount !== 1 ? 's' : ''})
            </h2>
          </div>

          {itemCount === 0 ? (
            <div className="text-center py-10 border border-dashed border-border rounded-xl">
              <BookOpen className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No items yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Bookmark activities from your trip or add personal recommendations.
              </p>
              <div className="flex gap-2 justify-center mt-4">
                <Button variant="outline" size="sm" onClick={() => navigate(`/trip/${tripId}`)}>
                  Back to Trip
                </Button>
                <Button size="sm" onClick={() => { setAddRecDayNumber(1); setAddRecModalOpen(true); }} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Add Recommendation
                </Button>
              </div>
            </div>
          ) : (
            [...dayGroups.entries()].map(([day, items]) => (
              <div key={day} className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5" />
                    {day > 0 ? `Day ${day}` : 'General'}
                  </h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1 text-muted-foreground"
                    onClick={() => { setAddRecDayNumber(day || 1); setAddRecModalOpen(true); }}
                  >
                    <Plus className="h-3 w-3" /> Add Rec
                  </Button>
                </div>

                {items.map((item, i) => (
                  editingNoteId === item.id && item.type === 'favorite' ? (
                    <div key={item.id} className="flex gap-2 p-3 rounded-xl border border-primary/30 bg-card">
                      <Input
                        value={editNoteValue}
                        onChange={e => setEditNoteValue(e.target.value)}
                        placeholder="Add your note…"
                        className="text-xs flex-1"
                        autoFocus
                        onKeyDown={e => e.key === 'Enter' && handleSaveNote()}
                      />
                      <Button size="sm" onClick={handleSaveNote}>Save</Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingNoteId(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <GuideActivityCard
                      key={item.id}
                      item={item}
                      index={i}
                      onDelete={handleDelete}
                      onEditNote={item.type === 'favorite' ? handleStartEditNote : undefined}
                    />
                  )
                ))}
              </div>
            ))
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
            variant="outline"
            className="gap-2"
            onClick={() => setShowPreview(true)}
            disabled={itemCount === 0}
          >
            <Eye className="h-4 w-4" /> Preview
          </Button>
          <Button
            className="gap-2 flex-1 min-w-[140px]"
            disabled={saveMutation.isPending || !canPublish}
            onClick={() => setPublishModalOpen(true)}
          >
            <Globe className="h-4 w-4" /> Publish Guide
          </Button>
        </div>

        {!canPublish && itemCount > 0 && itemCount < 3 && (
          <p className="text-xs text-muted-foreground text-center">
            You need at least 3 items to publish. Currently: {itemCount}.
          </p>
        )}
      </div>

      <PublishConfirmModal
        open={publishModalOpen}
        onOpenChange={setPublishModalOpen}
        onConfirm={() => saveMutation.mutate(true)}
        isPending={saveMutation.isPending}
        title={form.title}
        itemCount={itemCount}
      />

      <AddRecommendationModal
        open={addRecModalOpen}
        onOpenChange={setAddRecModalOpen}
        onSubmit={entry => addRecMutation.mutate(entry)}
        isPending={addRecMutation.isPending}
        defaultDayNumber={addRecDayNumber}
      />
    </MainLayout>
  );
}
