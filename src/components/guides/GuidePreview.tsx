import { MapPin, Calendar, BookOpen, ExternalLink } from 'lucide-react';
import SafeImage from '@/components/SafeImage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import type { GuideItem } from '@/hooks/useCommunityGuide';

interface Props {
  title: string;
  description: string;
  destination: string | null;
  destinationCountry: string | null;
  tags: string[];
  dayGroups: Map<number, GuideItem[]>;
}

export default function GuidePreview({ title, description, destination, destinationCountry, tags, dayGroups }: Props) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        {destination && (
          <Badge variant="secondary" className="gap-1">
            <MapPin className="h-3 w-3" />
            {destination}
            {destinationCountry ? `, ${destinationCountry}` : ''}
          </Badge>
        )}
        <h2 className="text-2xl font-serif font-bold text-foreground">{title || 'Untitled Guide'}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">{tag}</Badge>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      {dayGroups.size > 0 ? (
        [...dayGroups.entries()].map(([day, items]) => (
          <div key={day} className="space-y-3">
            {day > 0 && (
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5" />
                Day {day}
              </h3>
            )}
            {items.map((item) => (
              <div
                key={item.id}
                className="flex gap-3 p-3 rounded-xl border border-border bg-card"
              >
                {item.image_url && (
                  <SafeImage src={item.image_url} alt={item.name} className="w-14 h-14 rounded-lg object-cover shrink-0" fallbackCategory={item.category} />
                )}
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">{item.name}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.type === 'manual' && (
                        <Badge className="text-[10px] bg-accent text-accent-foreground border-0">Personal Rec</Badge>
                      )}
                      {item.category && (
                        <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
                      )}
                    </div>
                  </div>
                  {item.note && <p className="text-xs text-primary/80 italic">"{item.note}"</p>}
                  {item.description && <p className="text-xs text-muted-foreground line-clamp-3">{item.description}</p>}
                  {item.external_url && (
                    <a href={item.external_url} target="_blank" rel="noopener noreferrer" className="text-[11px] text-primary hover:underline flex items-center gap-1">
                      Visit <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ))
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <BookOpen className="h-8 w-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No items in this guide yet.</p>
        </div>
      )}
    </div>
  );
}
