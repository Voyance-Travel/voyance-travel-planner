import { useState, useEffect } from 'react';
import { Loader2, Youtube, Instagram, Facebook, Linkedin, Globe, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchSocialLinks,
  saveSocialLinks,
  validateSocialUrl,
  type SocialPlatform,
  type SocialLink,
} from '@/services/socialLinksAPI';

interface PlatformConfig {
  key: SocialPlatform;
  label: string;
  icon: React.ReactNode;
  placeholder: string;
}

const PLATFORMS: PlatformConfig[] = [
  { key: 'youtube', label: 'YouTube', icon: <Youtube className="w-4 h-4" />, placeholder: 'https://youtube.com/@yourchannel' },
  { key: 'instagram', label: 'Instagram', icon: <Instagram className="w-4 h-4" />, placeholder: 'https://instagram.com/yourhandle' },
  { key: 'tiktok', label: 'TikTok', icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.78a8.18 8.18 0 004.76 1.52v-3.4a4.85 4.85 0 01-1-.21z"/></svg>, placeholder: 'https://tiktok.com/@yourhandle' },
  { key: 'facebook', label: 'Facebook', icon: <Facebook className="w-4 h-4" />, placeholder: 'https://facebook.com/yourpage' },
  { key: 'twitter', label: 'Twitter / X', icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>, placeholder: 'https://x.com/yourhandle' },
  { key: 'linkedin', label: 'LinkedIn', icon: <Linkedin className="w-4 h-4" />, placeholder: 'https://linkedin.com/in/yourprofile' },
  { key: 'blog', label: 'Blog / Website', icon: <Globe className="w-4 h-4" />, placeholder: 'https://yourblog.com' },
];

export default function SocialLinksEditor() {
  const { user } = useAuth();
  const [values, setValues] = useState<Record<SocialPlatform, string>>(() => {
    const init: Record<string, string> = {};
    PLATFORMS.forEach(p => { init[p.key] = ''; });
    return init as Record<SocialPlatform, string>;
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user?.id) return;
    fetchSocialLinks(user.id)
      .then(links => {
        const updated = { ...values };
        links.forEach(l => { updated[l.platform] = l.url; });
        setValues(updated);
      })
      .catch(() => toast.error('Failed to load social links'))
      .finally(() => setLoading(false));
  }, [user?.id]);

  const handleChange = (platform: SocialPlatform, value: string) => {
    setValues(prev => ({ ...prev, [platform]: value }));
    // Clear error on edit
    if (errors[platform]) {
      setErrors(prev => { const n = { ...prev }; delete n[platform]; return n; });
    }
  };

  const handleSave = async () => {
    if (!user?.id) return;

    // Validate all
    const newErrors: Record<string, string> = {};
    const validLinks: SocialLink[] = [];

    for (const p of PLATFORMS) {
      const raw = values[p.key];
      if (!raw.trim()) continue; // skip empty

      const result = validateSocialUrl(p.key, raw);
      if (result.error) {
        newErrors[p.key] = result.error;
      } else if (result.url) {
        validLinks.push({ platform: p.key, url: result.url });
        // Update displayed value with sanitized URL
        setValues(prev => ({ ...prev, [p.key]: result.url! }));
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSaving(true);
    try {
      await saveSocialLinks(user.id, validLinks);
      toast.success('Social links saved');
      setErrors({});
    } catch {
      toast.error('Failed to save social links');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <ExternalLink className="w-5 h-5 text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Your Social Links</CardTitle>
            <CardDescription>These appear on your published travel guides</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {PLATFORMS.map(p => (
          <div key={p.key} className="space-y-1.5">
            <Label htmlFor={`social-${p.key}`} className="text-sm flex items-center gap-2">
              {p.icon}
              {p.label}
            </Label>
            <Input
              id={`social-${p.key}`}
              value={values[p.key]}
              onChange={e => handleChange(p.key, e.target.value)}
              placeholder={p.placeholder}
              className={errors[p.key] ? 'border-destructive' : ''}
            />
            {errors[p.key] && (
              <p className="text-xs text-destructive">{errors[p.key]}</p>
            )}
          </div>
        ))}

        <Button onClick={handleSave} disabled={saving} className="mt-2">
          {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Saving...</> : 'Save Social Links'}
        </Button>
      </CardContent>
    </Card>
  );
}
