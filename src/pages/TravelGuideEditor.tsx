/**
 * Travel Guide Editor
 * Edit AI-generated guide content, add social links, publish
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Save, Globe, Eye, EyeOff, Loader2,
  Instagram, Youtube, Link as LinkIcon, ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getTravelGuide, updateTravelGuide, publishTravelGuide, type TravelGuide } from '@/services/travelGuideService';
import { getAppUrl } from '@/utils/getAppUrl';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

export default function TravelGuideEditor() {
  const { tripId, guideId } = useParams<{ tripId: string; guideId: string }>();
  const navigate = useNavigate();

  const [guide, setGuide] = useState<TravelGuide | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
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

  useEffect(() => {
    if (!guideId) return;
    async function load() {
      try {
        const data = await getTravelGuide(guideId!);
        if (data) {
          setGuide(data);
          setTitle(data.title);
          setContent(data.content);
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

  async function handleSave() {
    if (!guideId) return;
    setSaving(true);
    try {
      await updateTravelGuide(guideId, {
        title,
        content,
        social_links: socialLinks,
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
      // Save first
      await updateTravelGuide(guideId, { title, content, social_links: socialLinks });
      await publishTravelGuide(guideId);
      toast.success('Guide published!');
      setGuide(prev => prev ? { ...prev, status: 'published' } : prev);
    } catch (err) {
      toast.error('Failed to publish');
    } finally {
      setPublishing(false);
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
        <div className="max-w-3xl mx-auto flex gap-3">
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
      </div>
    </div>
  );
}
