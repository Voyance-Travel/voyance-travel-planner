/**
 * CreatorContentSection — Renders guide_content_links as cards.
 * YouTube links show thumbnail images. Hidden if no links.
 */
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Youtube, Instagram, Globe, Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { fetchGuideContentLinks, extractYouTubeVideoId, getYouTubeThumbnail, type GuideContentLink } from '@/services/guideContentLinksAPI';

interface Props {
  guideId: string;
}

const PLATFORM_CONFIG: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  youtube: { icon: <Youtube className="w-4 h-4" />, label: 'YouTube', color: 'text-red-500' },
  instagram: { icon: <Instagram className="w-4 h-4" />, label: 'Instagram', color: 'text-pink-500' },
  tiktok: {
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.78a8.18 8.18 0 004.76 1.52v-3.4a4.85 4.85 0 01-1-.21z" />
      </svg>
    ),
    label: 'TikTok',
    color: 'text-foreground',
  },
  patreon: { icon: <Globe className="w-4 h-4" />, label: 'Patreon', color: 'text-orange-500' },
  blog: { icon: <Globe className="w-4 h-4" />, label: 'Blog', color: 'text-muted-foreground' },
};

function ContentLinkCard({ link }: { link: GuideContentLink }) {
  const config = PLATFORM_CONFIG[link.platform] || { icon: <Globe className="w-4 h-4" />, label: link.platform, color: 'text-muted-foreground' };
  const youtubeId = link.platform === 'youtube' ? extractYouTubeVideoId(link.url) : null;

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-xl border border-border bg-card hover:border-primary/20 transition-colors overflow-hidden group"
    >
      {/* YouTube thumbnail */}
      {youtubeId && (
        <div className="relative aspect-video bg-muted">
          <img
            src={getYouTubeThumbnail(youtubeId)}
            alt={link.title || 'Video thumbnail'}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
            <div className="w-12 h-12 rounded-full bg-red-600 flex items-center justify-center">
              <Play className="w-5 h-5 text-white fill-white ml-0.5" />
            </div>
          </div>
        </div>
      )}

      <div className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <span className={config.color}>{config.icon}</span>
          <span className="text-xs font-medium text-muted-foreground">{config.label}</span>
          <ExternalLink className="w-3 h-3 text-muted-foreground/50 ml-auto" />
        </div>

        {link.title && (
          <p className="text-sm font-medium text-foreground line-clamp-2">{link.title}</p>
        )}
        {link.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{link.description}</p>
        )}

        <div className="flex flex-wrap gap-1.5">
          {link.day_number && (
            <Badge variant="secondary" className="text-[10px]">Day {link.day_number}</Badge>
          )}
          {link.activity_name && (
            <Badge variant="outline" className="text-[10px]">{link.activity_name}</Badge>
          )}
        </div>
      </div>
    </a>
  );
}

export default function CreatorContentSection({ guideId }: Props) {
  const { data: links = [] } = useQuery({
    queryKey: ['guide-content-links', guideId],
    queryFn: () => fetchGuideContentLinks(guideId),
  });

  if (links.length === 0) return null;

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Creator's Content
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        {links.map((link) => (
          <ContentLinkCard key={link.id} link={link} />
        ))}
      </div>
    </div>
  );
}
