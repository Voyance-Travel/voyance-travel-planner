/**
 * AddContentLinkModal — Add YouTube/Instagram/etc. links to a guide.
 * Platform domain validation reuses the same allowlist as social links.
 */
import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Youtube, Instagram, Globe } from 'lucide-react';

const PLATFORMS = [
  { value: 'youtube', label: 'YouTube' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'twitter', label: 'Twitter / X' },
  { value: 'patreon', label: 'Patreon' },
  { value: 'blog', label: 'Blog / Podcast' },
  { value: 'other', label: 'Other' },
] as const;

const PLATFORM_DOMAINS: Record<string, string[]> = {
  youtube: ['youtube.com', 'youtu.be'],
  instagram: ['instagram.com'],
  tiktok: ['tiktok.com'],
  facebook: ['facebook.com'],
  twitter: ['twitter.com', 'x.com'],
  patreon: ['patreon.com'],
  blog: [],
  other: [],
};

interface ActivityOption {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    platform: string;
    url: string;
    title: string;
    description?: string;
    day_number?: number | null;
    activity_id?: string | null;
    activity_name?: string | null;
  }) => Promise<void>;
  isPending: boolean;
  dayNumbers: number[];
  activities: ActivityOption[];
}

function validateUrl(platform: string, raw: string): { url?: string; error?: string } {
  let url = raw.trim();
  if (!url) return { error: 'URL is required' };

  const lower = url.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('ftp:')) {
    return { error: 'Invalid URL protocol' };
  }
  if (lower.startsWith('http://')) url = 'https://' + url.slice(7);
  if (!url.startsWith('https://')) url = 'https://' + url;

  try { new URL(url); } catch { return { error: 'Please enter a valid URL' }; }

  const domains = PLATFORM_DOMAINS[platform] || [];
  if (domains.length > 0 && !domains.some(d => url.toLowerCase().includes(d))) {
    return { error: `URL must be a ${platform} link` };
  }
  return { url };
}

export default function AddContentLinkModal({ open, onOpenChange, onSubmit, isPending, dayNumbers, activities }: Props) {
  const [platform, setPlatform] = useState('youtube');
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dayNumber, setDayNumber] = useState<string>('');
  const [activityId, setActivityId] = useState<string>('');
  const [urlError, setUrlError] = useState('');

  const reset = () => {
    setPlatform('youtube');
    setUrl('');
    setTitle('');
    setDescription('');
    setDayNumber('');
    setActivityId('');
    setUrlError('');
  };

  const handleSubmit = async () => {
    const result = validateUrl(platform, url);
    if (result.error) { setUrlError(result.error); return; }

    const selectedActivity = activities.find(a => a.id === activityId);
    await onSubmit({
      platform,
      url: result.url!,
      title: title.trim(),
      description: description.trim() || undefined,
      day_number: dayNumber ? Number(dayNumber) : null,
      activity_id: activityId || null,
      activity_name: selectedActivity?.name || null,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Content Link</DialogTitle>
          <DialogDescription>
            Link a YouTube video, Instagram post, or other content to this guide.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Platform */}
          <div className="space-y-1.5">
            <Label>Platform</Label>
            <Select value={platform} onValueChange={(v) => { setPlatform(v); setUrlError(''); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PLATFORMS.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* URL */}
          <div className="space-y-1.5">
            <Label>URL *</Label>
            <Input
              value={url}
              onChange={e => { setUrl(e.target.value); setUrlError(''); }}
              placeholder="https://..."
              className={urlError ? 'border-destructive' : ''}
            />
            {urlError && <p className="text-xs text-destructive">{urlError}</p>}
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <Label>Title *</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value.slice(0, 120))}
              placeholder="Day 2: Street Food Tour in Mong Kok"
              maxLength={120}
            />
            <p className="text-xs text-muted-foreground text-right">{title.length}/120</p>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label>Description (optional)</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value.slice(0, 300))}
              placeholder="I tried 8 dishes under $5 each"
              maxLength={300}
              rows={2}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right">{description.length}/300</p>
          </div>

          {/* Link to day */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Link to Day</Label>
              <Select value={dayNumber} onValueChange={setDayNumber}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {dayNumbers.map(d => (
                    <SelectItem key={d} value={String(d)}>Day {d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Link to activity */}
            <div className="space-y-1.5">
              <Label>Link to Activity</Label>
              <Select value={activityId} onValueChange={setActivityId}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {activities.map(a => (
                    <SelectItem key={a.id} value={a.id}>
                      <span className="truncate">{a.name}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isPending || !title.trim() || !url.trim()}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Add Link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
