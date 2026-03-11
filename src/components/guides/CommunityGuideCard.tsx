import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { MapPin, Heart, Eye, ArrowRight, BookOpen, User } from 'lucide-react';
import SafeImage from '@/components/SafeImage';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import type { CommunityGuideListItem } from '@/hooks/useCommunityGuidesList';

function archetypeLabel(archetype: string | null): string | null {
  if (!archetype) return null;
  return archetype.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function getItemCount(content: Record<string, any> | null): number {
  if (!content) return 0;
  const activities = content.activities || [];
  return Array.isArray(activities) ? activities.length : 0;
}

interface Props {
  guide: CommunityGuideListItem;
  index?: number;
}

export default function CommunityGuideCard({ guide, index = 0 }: Props) {
  const itemCount = getItemCount(guide.content);

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="group bg-card rounded-2xl overflow-hidden border border-border hover:border-primary/40 hover:shadow-lg transition-all"
    >
      <Link to={guide.slug ? `/community-guide/${guide.slug}` : '#'}>
        {/* Cover image */}
        <div className="aspect-[16/10] overflow-hidden relative bg-muted">
          {guide.cover_image_url ? (
            <SafeImage
              src={guide.cover_image_url}
              alt={guide.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <BookOpen className="h-10 w-10 text-muted-foreground/30" />
            </div>
          )}
          {guide.destination && (
            <div className="absolute top-3 left-3">
              <Badge className="bg-background/90 backdrop-blur-sm text-foreground border-0 text-[10px]">
                <MapPin className="h-3 w-3 mr-1" />
                {guide.destination}
                {guide.destination_country ? `, ${guide.destination_country}` : ''}
              </Badge>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-5 space-y-2.5">
          <h3 className="text-base font-semibold leading-snug group-hover:text-primary transition-colors line-clamp-2">
            {guide.title}
          </h3>
          {guide.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
              {guide.description}
            </p>
          )}

          {/* Creator info */}
          <div className="flex items-center gap-2">
            {guide.creator_avatar ? (
              <img src={guide.creator_avatar} alt="" className="w-4 h-4 rounded-full object-cover" />
            ) : (
              <User className="w-4 h-4 text-muted-foreground" />
            )}
            <span className="text-xs text-foreground font-medium truncate">
              {guide.creator_name || 'Traveler'}
            </span>
            {guide.creator_archetype && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium whitespace-nowrap">
                {archetypeLabel(guide.creator_archetype)}
              </span>
            )}
          </div>

          {/* Tags */}
          {guide.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {guide.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Stats footer */}
          <div className="flex items-center justify-between pt-1 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-3">
              {itemCount > 0 && (
                <span>{itemCount} spot{itemCount !== 1 ? 's' : ''}</span>
              )}
              {guide.published_at && (
                <span>{format(new Date(guide.published_at), 'MMM d, yyyy')}</span>
              )}
              {guide.view_count > 0 && (
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" /> {guide.view_count}
                </span>
              )}
              {guide.like_count > 0 && (
                <span className="flex items-center gap-1">
                  <Heart className="h-3 w-3" /> {guide.like_count}
                </span>
              )}
            </div>
            <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </Link>
    </motion.article>
  );
}
