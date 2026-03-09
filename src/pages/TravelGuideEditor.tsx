/**
 * Travel Guide Editor
 * Edit AI-generated guide content, add social links, publish
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, Globe, Eye, EyeOff, Loader2,
  Instagram, Youtube, Link as LinkIcon, ExternalLink, Trash2, Upload, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getTravelGuide, updateTravelGuide, publishTravelGuide, deleteGuide, type TravelGuide } from '@/services/travelGuideService';
import { getAppUrl } from '@/utils/getAppUrl';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import { supabase } from '@/integrations/supabase/client';

export default function TravelGuideEditor() {
  const { tripId, guideId } = useParams<{ tripId: string; guideId: string }>();
  const navigate = useNavigate();

  const [guide, setGuide] = useState<TravelGuide | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState<string | null>(null);
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const [socialLinks, setSocialLinks] = useState<Record<string, string>>({
    instagram: '',
    tiktok: '',
    youtube: '',
    blog: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [editorTab, setEditorTab] = useState<string>('edit');

  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!guideId) return;
    async function load() {
      try {
        const data = await getTravelGuide(guideId);
        if (data) {
          setGuide(data);
          setTitle(data.title);
          setContent(data.content);
          setCoverImageUrl(data.cover_image_url);
          setSelectedPhotos(Array.isArray(data.selected_photos) ? data.selected_photos : []);
          if (data.social_links && typeof data.social_links === 'object') {
            setSocialLinks(prev => ({ ...prev, ...(data.social_links as Record<string, string>) }));
          }
        }
      } catch (err) {
        console.error('Failed to load guide:', err);
        toast.error('Failed to load guide');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [guideId]);

  async function uploadImageToGuide(file: File, filePath: string): Promise<string | null> {
    const { error: uploadError } = await supabase.storage
      .from('trip-photos')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return null;
    }

    const { data } = supabase.storage
      .from('trip-photos')
      .getPublicUrl(filePath);

    return data.publicUrl;
  }

  async function handleCoverUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !guideId) return;

    const fileExt = file.name.split('.').pop() || 'jpg';
    const filePath = `guide-covers/${guideId}-cover.${fileExt}`;

    const publicUrl = await uploadImageToGuide(file, filePath);
    if (!publicUrl) {
      toast.error('Failed to upload cover photo');
      return;
    }

    setCoverImageUrl(publicUrl);
    toast.success('Cover photo uploaded');
    e.target.value = '';
  }

  async function handleTripPhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (!files.length || !guideId) return;

    const uploadedUrls: string[] = [];

    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const filePath = `guide-photos/${guideId}/${Date.now()}-${safeName}`;
      const publicUrl = await uploadImageToGuide(file, filePath);
      if (publicUrl) uploadedUrls.push(publicUrl);
    }

    if (!uploadedUrls.length) {
      toast.error('Failed to upload photos');
      return;
    }

    setSelectedPhotos(prev => [...prev, ...uploadedUrls]);
    toast.success(`${uploadedUrls.length} photo${uploadedUrls.length > 1 ? 's' : ''} uploaded`);
    e.target.value = '';
  }

  async function handleSave() {
    if (!guideId) return;
    setSaving(true);
    try {
      await updateTravelGuide(guideId, {
        title,
        content,
        social_links: socialLinks,
        cover_image_url: coverImageUrl,
        selected_photos: selectedPhotos,
      });
      toast.success('Guide saved');
    } catch (err) {
      toast.error('Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!guideId) return;
    setPublishing(true);
    try {
      await updateTravelGuide(guideId, {
        title,
        content,
        social_links: socialLinks,
        cover_image_url: coverImageUrl,
        selected_photos: selectedPhotos,
      });
      await publishTravelGuide(guideId);
      toast.success('Guide published!');
      setGuide(prev => prev ? { ...prev, status: 'published' } : prev);
    } catch (err) {
      toast.error('Failed to publish');
    } finally {
      setPublishing(false);
    }
  }

  async function handleDeleteGuide() {
    if (!guideId) return;
    if (!confirm('Delete this guide? This cannot be undone.')) return;

    try {
      await deleteGuide(guideId);
      toast.success('Guide deleted');
      navigate(`/trip/${tripId}`);
    } catch (err) {
      toast.error('Failed to delete guide');
    }
  }

  function copyPublicLink() {
    if (!guide?.slug) return;
    const url = `${getAppUrl()}/guide/${guide.slug}`;
    navigator.clipboard.writeText(url);
    toast.success('Public link copied!');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading guide...</div>
      </div>
    );
  }

  if (!guide) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h2 className="text-xl font-semibold mb-2">Guide not found</h2>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  const isPublished = guide.status === 'published';

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Edit Travel Guide</h1>
            <p className="text-xs text-muted-foreground">
              {isPublished ? '✅ Published' : '📝 Draft'} · {guide.destination}
            </p>
          </div>
          {isPublished && (
            <Button variant="outline" size="sm" onClick={copyPublicLink}>
              <LinkIcon className="h-4 w-4 mr-1" />
              Copy Link
            </Button>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {/* Cover Photo */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">Cover Photo</label>
          <input
            ref={coverInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleCoverUpload}
          />
          {coverImageUrl ? (
            <div className="mt-2 rounded-lg overflow-hidden border border-border bg-muted/20">
              <img src={coverImageUrl} alt="Guide cover" className="w-full h-48 object-cover" />
              <div className="p-3">
                <Button variant="outline" size="sm" onClick={() => setCoverImageUrl(null)}>
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              className="w-full mt-2 border-2 border-dashed border-border rounded-lg p-6 text-center hover:bg-muted/30 transition-colors"
            >
              <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Click to upload a cover photo</p>
            </button>
          )}
        </div>

        {/* Title */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">Title</label>
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="text-lg font-semibold mt-1"
            placeholder="My Travel Guide"
          />
        </div>

        {/* Content Editor with Preview Toggle */}
        <div>
          <Tabs value={editorTab} onValueChange={setEditorTab}>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-muted-foreground">Content</label>
              <TabsList className="h-8">
                <TabsTrigger value="edit" className="text-xs px-3 h-7">
                  <EyeOff className="h-3 w-3 mr-1" /> Edit
                </TabsTrigger>
                <TabsTrigger value="preview" className="text-xs px-3 h-7">
                  <Eye className="h-3 w-3 mr-1" /> Preview
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="edit" className="mt-0">
              <Textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                className="min-h-[400px] font-mono text-sm"
                placeholder="Your guide content in markdown..."
              />
            </TabsContent>

            <TabsContent value="preview" className="mt-0">
              <div className="border rounded-md p-6 min-h-[400px] prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{content}</ReactMarkdown>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Trip Photos */}
        <div>
          <div className="mb-2">
            <h3 className="text-sm font-medium text-muted-foreground">Trip Photos</h3>
            <p className="text-xs text-muted-foreground mt-1">Add photos from your trip. These will appear in your published guide.</p>
          </div>

          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handleTripPhotoUpload}
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
            {selectedPhotos.map((url: string, idx: number) => (
              <div key={`${url}-${idx}`} className="relative rounded-lg overflow-hidden border border-border bg-muted/20">
                <img src={url} alt={`Guide photo ${idx + 1}`} className="w-full h-28 object-cover" />
                <button
                  type="button"
                  onClick={() => setSelectedPhotos(prev => prev.filter((_, i) => i !== idx))}
                  className="absolute top-2 right-2 rounded-full p-1 bg-background/80 hover:bg-background transition-colors"
                  aria-label="Remove photo"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <Button type="button" variant="outline" onClick={() => photoInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Photos
          </Button>
        </div>

        {/* Social Links */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-muted-foreground">Social Media Links (optional)</label>
          <div className="grid gap-3">
            <div className="flex items-center gap-2">
              <Instagram className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="Instagram post URL"
                value={socialLinks.instagram}
                onChange={e => setSocialLinks(prev => ({ ...prev, instagram: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm shrink-0 w-4 text-center">🎵</span>
              <Input
                placeholder="TikTok video URL"
                value={socialLinks.tiktok}
                onChange={e => setSocialLinks(prev => ({ ...prev, tiktok: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <Youtube className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="YouTube video URL"
                value={socialLinks.youtube}
                onChange={e => setSocialLinks(prev => ({ ...prev, youtube: e.target.value }))}
              />
            </div>
            <div className="flex items-center gap-2">
              <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
              <Input
                placeholder="Blog post URL"
                value={socialLinks.blog}
                onChange={e => setSocialLinks(prev => ({ ...prev, blog: e.target.value }))}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t p-4">
        <div className="max-w-3xl mx-auto space-y-3">
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Save Draft
            </Button>
            <Button
              className="flex-1"
              onClick={handlePublish}
              disabled={publishing}
            >
              {publishing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Globe className="h-4 w-4 mr-2" />}
              {isPublished ? 'Update & Republish' : 'Publish Guide'}
            </Button>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={handleDeleteGuide}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete Guide
          </Button>
        </div>
      </div>
    </div>
  );
}
