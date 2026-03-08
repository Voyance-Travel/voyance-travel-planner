import { supabase } from '@/integrations/supabase/client';

export type SocialPlatform = 'youtube' | 'instagram' | 'tiktok' | 'facebook' | 'twitter' | 'linkedin' | 'blog';

export interface SocialLink {
  platform: SocialPlatform;
  url: string;
}

/** Fetch all social links for a user (public-safe) */
export async function fetchSocialLinks(userId: string): Promise<SocialLink[]> {
  const { data, error } = await supabase
    .from('user_social_links')
    .select('platform, url')
    .eq('user_id', userId);

  if (error) throw error;
  return (data || []).map(d => ({ platform: d.platform as SocialPlatform, url: d.url }));
}

/** Save social links for the current user. Upserts provided, deletes removed. */
export async function saveSocialLinks(userId: string, links: SocialLink[]): Promise<void> {
  // Delete all existing then upsert — simplest atomic approach
  const { error: deleteError } = await supabase
    .from('user_social_links')
    .delete()
    .eq('user_id', userId);

  if (deleteError) throw deleteError;

  const toInsert = links.filter(l => l.url.trim().length > 0);
  if (toInsert.length === 0) return;

  const { error: insertError } = await supabase
    .from('user_social_links')
    .insert(toInsert.map(l => ({
      user_id: userId,
      platform: l.platform,
      url: l.url.trim(),
    })));

  if (insertError) throw insertError;
}

/** Platform validation rules */
const PLATFORM_DOMAINS: Record<SocialPlatform, string[]> = {
  youtube: ['youtube.com', 'youtu.be'],
  instagram: ['instagram.com'],
  tiktok: ['tiktok.com'],
  facebook: ['facebook.com'],
  twitter: ['twitter.com', 'x.com'],
  linkedin: ['linkedin.com'],
  blog: [], // any https URL
};

/** Validate and sanitize a social link URL. Returns sanitized URL or error string. */
export function validateSocialUrl(platform: SocialPlatform, raw: string): { url?: string; error?: string } {
  let url = raw.trim();
  if (!url) return { url: '' }; // empty = remove

  // Block dangerous protocols
  const lower = url.toLowerCase();
  if (lower.startsWith('javascript:') || lower.startsWith('data:') || lower.startsWith('ftp:')) {
    return { error: 'Invalid URL protocol' };
  }

  // Auto-upgrade http to https
  if (lower.startsWith('http://')) {
    url = 'https://' + url.slice(7);
  }

  // Add https if no protocol
  if (!url.startsWith('https://')) {
    url = 'https://' + url;
  }

  // Basic URL structure check
  try {
    new URL(url);
  } catch {
    return { error: 'Please enter a valid URL' };
  }

  // Platform domain check
  const domains = PLATFORM_DOMAINS[platform];
  if (domains.length > 0) {
    const matches = domains.some(d => url.toLowerCase().includes(d));
    if (!matches) {
      return { error: `URL must be a ${platform === 'twitter' ? 'Twitter/X' : platform} link` };
    }
  }

  return { url };
}
