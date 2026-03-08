import { motion } from 'framer-motion';
import { MapPin, ExternalLink, Utensils, Camera, Music, ShoppingBag, Landmark, Waves, TreePine, Youtube, Instagram, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { GuideContentLink } from '@/services/guideContentLinksAPI';

interface Activity {
  id?: string;
  name?: string;
  title?: string;
  description?: string;
  category?: string;
  note?: string;
  image_url?: string;
  url?: string;
  external_url?: string;
  is_manual?: boolean;
  location?: { lat?: number; lng?: number; name?: string; address?: string };
  day_number?: number;
  start_time?: string;
}

interface Props {
  activity: Activity;
  index: number;
  contentLinks?: GuideContentLink[];
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  dining: <Utensils className="w-3.5 h-3.5" />,
  food: <Utensils className="w-3.5 h-3.5" />,
  restaurant: <Utensils className="w-3.5 h-3.5" />,
  sightseeing: <Camera className="w-3.5 h-3.5" />,
  entertainment: <Music className="w-3.5 h-3.5" />,
  nightlife: <Music className="w-3.5 h-3.5" />,
  shopping: <ShoppingBag className="w-3.5 h-3.5" />,
  cultural: <Landmark className="w-3.5 h-3.5" />,
  museum: <Landmark className="w-3.5 h-3.5" />,
  beach: <Waves className="w-3.5 h-3.5" />,
  nature: <TreePine className="w-3.5 h-3.5" />,
  outdoor: <TreePine className="w-3.5 h-3.5" />,
};

const CONTENT_PLATFORM_LABELS: Record<string, { icon: React.ReactNode; label: string }> = {
  youtube: { icon: <Youtube className="w-3 h-3" />, label: 'Watch on YouTube' },
  instagram: { icon: <Instagram className="w-3 h-3" />, label: 'See on Instagram' },
};

export default function CommunityGuideActivityCard({ activity, index, contentLinks }: Props) {
  const name = activity.name || activity.title || 'Activity';
  const categoryIcon = activity.category
    ? CATEGORY_ICONS[activity.category.toLowerCase()] || null
    : null;
  const linkUrl = activity.url || activity.external_url;

  return (
    <motion.div
      id={activity.id ? `guide-activity-${activity.id}` : undefined}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="flex gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/20 transition-colors scroll-mt-20"
    >
      {activity.image_url && (
        <img
          src={activity.image_url}
          alt={name}
          className="w-20 h-20 rounded-lg object-cover shrink-0"
        />
      )}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold text-sm text-foreground">{name}</h3>
          <div className="flex items-center gap-1.5 shrink-0">
            {activity.is_manual && (
              <Badge className="text-[10px] bg-accent text-accent-foreground border-0">
                Personal Rec
              </Badge>
            )}
            {activity.category && (
              <Badge variant="outline" className="text-[10px] gap-1">
                {categoryIcon}
                {activity.category}
              </Badge>
            )}
          </div>
        </div>

        {activity.description && (
          <p className="text-xs text-muted-foreground line-clamp-3">{activity.description}</p>
        )}

        {activity.note && (
          <p className="text-xs italic text-primary/80">"{activity.note}"</p>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          {activity.location?.name && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {activity.location.name}
            </span>
          )}
          {linkUrl && (
            <a
              href={linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-primary hover:underline flex items-center gap-1"
            >
              Visit
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        {/* Inline content links tied to this activity */}
        {contentLinks && contentLinks.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {contentLinks.map((cl) => {
              const config = CONTENT_PLATFORM_LABELS[cl.platform] || {
                icon: <Globe className="w-3 h-3" />,
                label: `View on ${cl.platform}`,
              };
              return (
                <a
                  key={cl.id}
                  href={cl.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
                >
                  {config.icon}
                  {config.label}
                  <ExternalLink className="w-2.5 h-2.5 opacity-50" />
                </a>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}
