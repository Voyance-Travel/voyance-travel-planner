/**
 * ContentLinkCard — Editable card for a guide content link in the builder.
 */
import { Youtube, Instagram, Globe, ExternalLink, Trash2, Play } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { extractYouTubeVideoId, getYouTubeThumbnail, type GuideContentLink } from '@/services/guideContentLinksAPI';

const PLATFORM_LABEL: Record<string, string> = {
  youtube: 'YouTube',
  instagram: 'Instagram',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  twitter: 'X',
  patreon: 'Patreon',
  blog: 'Blog',
  other: 'Link',
};

const PLATFORM_COLOR: Record<string, string> = {
  youtube: 'text-red-500',
  instagram: 'text-pink-500',
  tiktok: 'text-foreground',
  patreon: 'text-orange-500',
};

function PlatformIcon({ platform }: { platform: string }) {
  if (platform === 'youtube') return <Youtube className="w-4 h-4" />;
  if (platform === 'instagram') return <Instagram className="w-4 h-4" />;
  if (platform === 'tiktok') return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 00-.79-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.78a8.18 8.18 0 004.76 1.52v-3.4a4.85 4.85 0 01-1-.21z" />
    </svg>
  );
  return <Globe className="w-4 h-4" />;
}

interface Props {
  link: GuideContentLink;
  onDelete: (id: string) => void;
  isDeleting?: boolean;
}

export default function ContentLinkCard({ link, onDelete, isDeleting }: Props) {
  const youtubeId = link.platform === 'youtube' ? extractYouTubeVideoId(link.url) : null;
  const color = PLATFORM_COLOR[link.platform] || 'text-muted-foreground';

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden group">
      {/* YouTube thumbnail */}
      {youtubeId && (
        <a href={link.url} target="_blank" rel="noopener noreferrer" className="block relative aspect-video bg-muted">
          <img
            src={getYouTubeThumbnail(youtubeId)}
            alt={link.title || 'Video'}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
            <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center">
              <Play className="w-4 h-4 text-white fill-white ml-0.5" />
            </div>
          </div>
        </a>
      )}

      <div className="p-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className={color}><PlatformIcon platform={link.platform} /></span>
          <span className="text-xs font-medium text-muted-foreground">
            {PLATFORM_LABEL[link.platform] || link.platform}
          </span>
          <div className="ml-auto flex items-center gap-1">
            <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground/50 hover:text-foreground">
              <ExternalLink className="w-3 h-3" />
            </a>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground/50 hover:text-destructive"
              onClick={() => onDelete(link.id)}
              disabled={isDeleting}
            >
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
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
    </div>
  );
}
