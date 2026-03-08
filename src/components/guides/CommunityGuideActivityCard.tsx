import { motion } from 'framer-motion';
import { MapPin, ExternalLink, Utensils, Camera, Music, ShoppingBag, Landmark, Waves, TreePine } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Activity {
  id?: string;
  name?: string;
  title?: string;
  description?: string;
  category?: string;
  note?: string;
  image_url?: string;
  url?: string;
  is_manual?: boolean;
  location?: { name?: string; address?: string };
  day_number?: number;
}

interface Props {
  activity: Activity;
  index: number;
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

export default function CommunityGuideActivityCard({ activity, index }: Props) {
  const name = activity.name || activity.title || 'Activity';
  const categoryIcon = activity.category
    ? CATEGORY_ICONS[activity.category.toLowerCase()] || null
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="flex gap-4 p-4 rounded-xl border border-border bg-card hover:border-primary/20 transition-colors"
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
          {activity.url && (
            <a
              href={activity.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-primary hover:underline flex items-center gap-1"
            >
              Visit
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
}
