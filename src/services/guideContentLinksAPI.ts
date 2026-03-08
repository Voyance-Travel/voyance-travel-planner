import { supabase } from '@/integrations/supabase/client';

export interface GuideContentLink {
  id: string;
  guide_id: string;
  user_id: string;
  platform: string;
  url: string;
  title: string | null;
  description: string | null;
  day_number: number | null;
  activity_id: string | null;
  activity_name: string | null;
  sort_order: number;
  created_at: string;
}

/** Fetch content links for a published guide */
export async function fetchGuideContentLinks(guideId: string): Promise<GuideContentLink[]> {
  const { data, error } = await supabase
    .from('guide_content_links')
    .select('*')
    .eq('guide_id', guideId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data || []) as GuideContentLink[];
}

/** Extract YouTube video ID from a URL */
export function extractYouTubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

/** Get YouTube thumbnail URL */
export function getYouTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}
