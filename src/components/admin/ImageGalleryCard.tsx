import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Ban, Replace, Maximize2 } from 'lucide-react';

export interface CuratedImage {
  id: string;
  image_url: string;
  entity_key: string;
  entity_type: string;
  destination: string | null;
  source: string;
  quality_score: number | null;
  vote_score: number;
  vote_count: number;
  is_blacklisted: boolean;
}

interface Props {
  image: CuratedImage;
  selected: boolean;
  onSelect: (id: string) => void;
  onReplace: (image: CuratedImage) => void;
  onBlacklist: (id: string) => void;
  onPreview: (url: string) => void;
}

export default function ImageGalleryCard({ image, selected, onSelect, onReplace, onBlacklist, onPreview }: Props) {
  const [broken, setBroken] = useState(false);

  const sourceBadgeColor = (source: string) => {
    if (source.includes('google')) return 'bg-blue-500/20 text-blue-700 dark:text-blue-300';
    if (source.includes('storage') || source.includes('cached')) return 'bg-green-500/20 text-green-700 dark:text-green-300';
    if (source.includes('curated')) return 'bg-amber-500/20 text-amber-700 dark:text-amber-300';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <Card className={`overflow-hidden group relative ${selected ? 'ring-2 ring-primary' : ''} ${broken ? 'ring-2 ring-destructive' : ''}`}>
      {/* Selection checkbox */}
      <div className="absolute top-2 left-2 z-10">
        <Checkbox
          checked={selected}
          onCheckedChange={() => onSelect(image.id)}
          className="bg-background/80 backdrop-blur-sm"
        />
      </div>

      {/* Broken badge */}
      {broken && (
        <div className="absolute top-2 right-2 z-10">
          <Badge variant="destructive" className="text-xs font-bold">BROKEN</Badge>
        </div>
      )}

      {/* Image */}
      <div className="aspect-[4/3] relative bg-muted">
        <img
          src={image.image_url}
          alt={image.entity_key}
          className="w-full h-full object-cover"
          loading="lazy"
          onError={() => setBroken(true)}
        />

        {/* Hover overlay with actions */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => onPreview(image.image_url)}>
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onReplace(image)}>
            <Replace className="h-3.5 w-3.5" />
          </Button>
          <Button size="sm" variant="destructive" onClick={() => onBlacklist(image.id)}>
            <Ban className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Info footer */}
      <div className="p-2.5 space-y-1.5">
        <p className="text-sm font-medium truncate capitalize">
          {image.entity_key.replace(/_/g, ' ')}
        </p>
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            {image.entity_type}
          </Badge>
          <Badge className={`text-[10px] px-1.5 py-0 border-0 ${sourceBadgeColor(image.source)}`}>
            {image.source}
          </Badge>
        </div>
        {image.destination && (
          <p className="text-xs text-muted-foreground truncate">{image.destination}</p>
        )}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span>Score: {image.vote_score ?? 0}</span>
          <span>Quality: {image.quality_score?.toFixed(1) ?? '—'}</span>
        </div>
      </div>
    </Card>
  );
}
