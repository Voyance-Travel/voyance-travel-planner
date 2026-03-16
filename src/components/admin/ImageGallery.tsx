import { useState, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Ban, Search, Loader2, Upload, ImagePlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import ImageGalleryCard, { type CuratedImage } from './ImageGalleryCard';
import ImageUploadDialog from './ImageUploadDialog';

const PAGE_SIZE = 50;

export default function ImageGallery() {
  const { toast } = useToast();
  const [images, setImages] = useState<CuratedImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [entityType, setEntityType] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [brokenOnly, setBrokenOnly] = useState(false);
  const [sortBy, setSortBy] = useState<string>('newest');

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Broken tracking (client-side)
  const [brokenIds, setBrokenIds] = useState<Set<string>>(new Set());

  // Replace dialog
  const [replaceTarget, setReplaceTarget] = useState<CuratedImage | null>(null);
  const [replaceUrl, setReplaceUrl] = useState('');
  const [replacing, setReplacing] = useState(false);

  // Preview dialog
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Upload dialog
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadPrefill, setUploadPrefill] = useState<{ entityKey?: string; entityType?: string; destination?: string; replaceId?: string } | undefined>();

  // Stats
  const [totalCount, setTotalCount] = useState(0);

  const fetchImages = useCallback(async (pageNum: number, append = false) => {
    setLoading(true);
    try {
      let query = supabase
        .from('curated_images')
        .select('id, image_url, entity_key, entity_type, destination, source, quality_score, vote_score, vote_count, is_blacklisted', { count: 'exact' })
        .eq('is_blacklisted', false);

      if (entityType !== 'all') query = query.eq('entity_type', entityType);
      if (sourceFilter !== 'all') query = query.ilike('source', `%${sourceFilter}%`);
      if (search.trim()) {
        query = query.or(`entity_key.ilike.%${search.trim()}%,destination.ilike.%${search.trim()}%`);
      }

      switch (sortBy) {
        case 'vote_score': query = query.order('vote_score', { ascending: false }); break;
        case 'quality_score': query = query.order('quality_score', { ascending: false, nullsFirst: false }); break;
        case 'unreviewed': query = query.order('vote_count', { ascending: true }); break;
        default: query = query.order('created_at', { ascending: false });
      }

      query = query.range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

      const { data, error, count } = await query;
      if (error) throw error;

      const fetched = (data || []) as CuratedImage[];
      setImages(prev => append ? [...prev, ...fetched] : fetched);
      setHasMore(fetched.length === PAGE_SIZE);
      if (count !== null) setTotalCount(count);
    } catch (err) {
      console.error('Gallery fetch error:', err);
      toast({ title: 'Failed to load images', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [entityType, sourceFilter, search, sortBy, toast]);

  useEffect(() => {
    setPage(0);
    setSelected(new Set());
    fetchImages(0);
  }, [fetchImages]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchImages(next, true);
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Replace image URL
  const handleReplace = async () => {
    if (!replaceTarget || !replaceUrl.trim()) return;
    setReplacing(true);
    try {
      const { error } = await supabase
        .from('curated_images')
        .update({ image_url: replaceUrl.trim(), updated_at: new Date().toISOString() })
        .eq('id', replaceTarget.id);
      if (error) throw error;
      setImages(prev => prev.map(img => img.id === replaceTarget.id ? { ...img, image_url: replaceUrl.trim() } : img));
      toast({ title: 'Image replaced' });
      setReplaceTarget(null);
      setReplaceUrl('');
    } catch (err) {
      console.error(err);
      toast({ title: 'Replace failed', variant: 'destructive' });
    } finally {
      setReplacing(false);
    }
  };

  // Blacklist single
  const handleBlacklist = async (id: string) => {
    try {
      await supabase.from('curated_images').update({ is_blacklisted: true }).eq('id', id);
      setImages(prev => prev.filter(img => img.id !== id));
      toast({ title: 'Image blacklisted' });
    } catch {
      toast({ title: 'Blacklist failed', variant: 'destructive' });
    }
  };

  // Bulk blacklist
  const handleBulkBlacklist = async () => {
    if (selected.size === 0) return;
    try {
      const ids = [...selected];
      await supabase.from('curated_images').update({ is_blacklisted: true }).in('id', ids);
      setImages(prev => prev.filter(img => !selected.has(img.id)));
      setSelected(new Set());
      toast({ title: `${ids.length} images blacklisted` });
    } catch {
      toast({ title: 'Bulk blacklist failed', variant: 'destructive' });
    }
  };

  // Upload replace for a specific image
  const handleUploadReplace = (image: CuratedImage) => {
    setUploadPrefill({
      entityKey: image.entity_key,
      entityType: image.entity_type,
      destination: image.destination || '',
      replaceId: image.id,
    });
    setUploadOpen(true);
  };

  // New upload (no prefill)
  const handleNewUpload = () => {
    setUploadPrefill(undefined);
    setUploadOpen(true);
  };

  // Filter broken images (client-side only)
  const displayImages = brokenOnly ? images.filter(img => brokenIds.has(img.id)) : images;

  return (
    <div className="space-y-4">
      {/* Filters bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search entity or destination..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={entityType} onValueChange={setEntityType}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Entity type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="destination">Destination</SelectItem>
            <SelectItem value="activity">Activity</SelectItem>
            <SelectItem value="hotel">Hotel</SelectItem>
            <SelectItem value="restaurant">Restaurant</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            <SelectItem value="google">Google</SelectItem>
            <SelectItem value="storage">Storage</SelectItem>
            <SelectItem value="curated">Curated</SelectItem>
            <SelectItem value="admin_upload">Admin uploads</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">Newest</SelectItem>
            <SelectItem value="vote_score">Vote score</SelectItem>
            <SelectItem value="quality_score">Quality</SelectItem>
            <SelectItem value="unreviewed">Unreviewed</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Switch id="broken-only" checked={brokenOnly} onCheckedChange={setBrokenOnly} />
          <Label htmlFor="broken-only" className="text-sm">Broken only</Label>
        </div>
      </div>

      {/* Bulk actions & stats */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="secondary">{totalCount} total</Badge>
          {brokenIds.size > 0 && (
            <Badge variant="destructive">{brokenIds.size} broken detected</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleNewUpload}>
            <ImagePlus className="h-3.5 w-3.5 mr-1.5" />
            Upload Image
          </Button>
          {selected.size > 0 && (
            <Button variant="destructive" size="sm" onClick={handleBulkBlacklist}>
              <Ban className="h-3.5 w-3.5 mr-1.5" />
              Blacklist {selected.size} selected
            </Button>
          )}
        </div>
      </div>

      {/* Grid */}
      {loading && images.length === 0 ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : displayImages.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          {brokenOnly ? 'No broken images detected yet. Scroll through the gallery to detect them.' : 'No images match your filters.'}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {displayImages.map(img => (
              <ImageGalleryCard
                key={img.id}
                image={img}
                selected={selected.has(img.id)}
                onSelect={toggleSelect}
                onReplace={setReplaceTarget}
                onBlacklist={handleBlacklist}
                onPreview={setPreviewUrl}
                onUploadReplace={handleUploadReplace}
              />
            ))}
          </div>

          {hasMore && !brokenOnly && (
            <div className="flex justify-center pt-4">
              <Button variant="outline" onClick={loadMore} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Load more
              </Button>
            </div>
          )}
        </>
      )}

      {/* Replace dialog (URL paste) */}
      <Dialog open={!!replaceTarget} onOpenChange={open => !open && setReplaceTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace Image URL</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Replacing image for <strong className="capitalize">{replaceTarget?.entity_key.replace(/_/g, ' ')}</strong>
            </p>
            {replaceTarget && (
              <img src={replaceTarget.image_url} alt="" className="w-full h-32 object-cover rounded-md bg-muted" />
            )}
            <Input
              placeholder="Paste new image URL..."
              value={replaceUrl}
              onChange={e => setReplaceUrl(e.target.value)}
            />
            {replaceUrl && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">Preview:</p>
                <img src={replaceUrl} alt="Preview" className="w-full h-32 object-cover rounded-md bg-muted" />
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => {
                if (replaceTarget) {
                  handleUploadReplace(replaceTarget);
                  setReplaceTarget(null);
                }
              }}
            >
              <Upload className="h-3.5 w-3.5 mr-1.5" />
              Or upload a file instead
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReplaceTarget(null)}>Cancel</Button>
            <Button onClick={handleReplace} disabled={!replaceUrl.trim() || replacing}>
              {replacing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Replace
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={!!previewUrl} onOpenChange={open => !open && setPreviewUrl(null)}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Image Preview</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <img src={previewUrl} alt="Full preview" className="w-full max-h-[70vh] object-contain rounded-md" />
          )}
        </DialogContent>
      </Dialog>

      {/* Upload dialog */}
      <ImageUploadDialog
        open={uploadOpen}
        onClose={() => { setUploadOpen(false); setUploadPrefill(undefined); }}
        onUploaded={() => fetchImages(0)}
        prefill={uploadPrefill}
      />
    </div>
  );
}
