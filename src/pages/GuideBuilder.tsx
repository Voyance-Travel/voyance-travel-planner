/**
 * Guide Builder Page
 * Lets users compile their guide_favorites into a community_guide.
 * Protected route — requires auth.
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import {
  BookOpen, ArrowLeft, Sparkles, GripVertical, Trash2, Save,
  Globe, Loader2, MapPin, Eye, Pencil,
} from 'lucide-react';
import { toast } from 'sonner';

interface GuideFavorite {
  id: string;
  activity_id: string;
  note: string | null;
  sort_order: number;
  activity?: {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    image_url: string | null;
    location: Record<string, any> | null;
  };
}

interface GuideFormState {
  title: string;
  description: string;
  tags: string[];
  tagInput: string;
}

function useGuideFavorites(tripId: string | undefined) {
  return useQuery({
    queryKey: ['guide-favorites-full', tripId],
    queryFn: async () => {
      if (!tripId) return [];
      // @ts-ignore - joined select
      const { data, error } = await supabase
        .from('guide_favorites')
        .select('id, activity_id, note, sort_order, activity:trip_activities(id, name, description, category, image_url, location)')
        .eq('trip_id', tripId)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as GuideFavorite[];
    },
    enabled: !!tripId,
  });
}

function useTripBasics(tripId: string | undefined) {
  return useQuery({
    queryKey: ['trip-basics-guide', tripId],
    queryFn: async () => {
      if (!tripId) return null;
      const { data } = await supabase
        .from('trips')
        .select('id, name, destination, destination_country')
        .eq('id', tripId)
        .maybeSingle();
      return data;
    },
    enabled: !!tripId,
  });
}

function useExistingGuide(tripId: string | undefined) {
  return useQuery({
    queryKey: ['community-guide-trip', tripId],
    queryFn: async () => {
      if (!tripId) return null;
      const { data } = await supabase
        .from('community_guides')
        .select('*')
        .eq('trip_id', tripId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!tripId,
  });
}

export default function GuideBuilder() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: trip, isLoading: tripLoading } = useTripBasics(tripId);
  const { data: favorites = [], isLoading: favsLoading } = useGuideFavorites(tripId);
  const { data: existingGuide, isLoading: guideLoading } = useExistingGuide(tripId);

  const [form, setForm] = useState<GuideFormState>({
    title: '',
    description: '',
    tags: [],
    tagInput: '',
  });

  // Seed form from existing guide or trip
  useEffect(() => {
    if (existingGuide) {
      setForm({
        title: existingGuide.title || '',
        description: existingGuide.description || '',
        tags: (existingGuide.tags as string[]) || [],
        tagInput: '',
      });
    } else if (trip && !form.title) {
      setForm(prev => ({
        ...prev,
        title: `${trip.destination} Travel Guide`,
      }));
    }
  }, [existingGuide, trip]);

  const saveMutation = useMutation({
    mutationFn: async (publish: boolean) => {
      if (!tripId || !user) throw new Error('Missing trip or user');

      const slug = form.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 80)
        + '-' + tripId.slice(0, 8);

      const content = {
        activities: favorites.map(f => ({
          id: f.activity_id,
          name: f.activity?.name,
          description: f.activity?.description,
          category: f.activity?.category,
          image_url: f.activity?.image_url,
          location: f.activity?.location,
          note: f.note,
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
        published_at: publish ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      if (existingGuide) {
        const { error } = await supabase
          .from('community_guides')
          .update(payload)
          .eq('id', existingGuide.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('community_guides')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: (_, publish) => {
      queryClient.invalidateQueries({ queryKey: ['community-guide-trip', tripId] });
      queryClient.invalidateQueries({ queryKey: ['community-guides-published'] });
      toast.success(publish ? 'Guide published!' : 'Draft saved');
      if (publish) {
        navigate(`/trip/${tripId}`);
      }
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to save guide');
    },
  });

  const addTag = () => {
    const tag = form.tagInput.trim();
    if (tag && !form.tags.includes(tag) && form.tags.length < 8) {
      setForm(prev => ({ ...prev, tags: [...prev.tags, tag], tagInput: '' }));
    }
  };

  const removeTag = (tag: string) => {
    setForm(prev => ({ ...prev, tags: prev.tags.filter(t => t !== tag) }));
  };

  const isLoading = tripLoading || favsLoading || guideLoading;

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
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" />
              {trip.destination}
              {trip.destination_country ? `, ${trip.destination_country}` : ''}
            </p>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium">Title</label>
            <Input
              value={form.title}
              onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))}
              placeholder="My Tokyo Travel Guide"
              className="text-sm"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="A brief description of your guide…"
              rows={3}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
            />
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
              <Button size="sm" variant="outline" onClick={addTag} className="h-8 text-xs">
                Add
              </Button>
            </div>
          </div>
        </div>

        {/* Favorites list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">
              Included Activities ({favorites.length})
            </h2>
          </div>

          {favorites.length === 0 ? (
            <div className="text-center py-10 border border-dashed border-border rounded-xl">
              <BookOpen className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No favorites yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Go back to your trip and bookmark activities to include them here.
              </p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate(`/trip/${tripId}`)}>
                Back to Trip
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {favorites.map((fav, i) => (
                <motion.div
                  key={fav.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card"
                >
                  <div className="shrink-0 text-muted-foreground/40 pt-1">
                    <GripVertical className="h-4 w-4" />
                  </div>
                  {fav.activity?.image_url && (
                    <img
                      src={fav.activity.image_url}
                      alt={fav.activity.name || ''}
                      className="w-14 h-14 rounded-lg object-cover shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-sm font-medium truncate">
                      {fav.activity?.name || 'Activity'}
                    </p>
                    {fav.activity?.category && (
                      <Badge variant="outline" className="text-[10px]">{fav.activity.category}</Badge>
                    )}
                    {fav.note && (
                      <p className="text-xs text-primary/80 italic mt-1">"{fav.note}"</p>
                    )}
                    {fav.activity?.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{fav.activity.description}</p>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        {favorites.length > 0 && (
          <div className="flex gap-3 pt-4 border-t border-border">
            <Button
              variant="outline"
              className="gap-2 flex-1"
              disabled={saveMutation.isPending || !form.title.trim()}
              onClick={() => saveMutation.mutate(false)}
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save Draft
            </Button>
            <Button
              className="gap-2 flex-1"
              disabled={saveMutation.isPending || !form.title.trim()}
              onClick={() => saveMutation.mutate(true)}
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Globe className="h-4 w-4" />}
              Publish Guide
            </Button>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
