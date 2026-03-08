import { motion } from 'framer-motion';
import { Trash2, Pencil, ExternalLink, MapPin, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { GuideItem } from '@/hooks/useCommunityGuide';

interface Props {
  item: GuideItem;
  index: number;
  onDelete: (id: string, type: 'favorite' | 'manual') => void;
  onEditNote?: (id: string, currentNote: string | null) => void;
}

export default function GuideActivityCard({ item, index, onDelete, onEditNote }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card group"
    >
      {item.image_url && (
        <img
          src={item.image_url}
          alt={item.name}
          className="w-14 h-14 rounded-lg object-cover shrink-0"
        />
      )}

      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium truncate">{item.name}</p>
          <div className="flex items-center gap-1 shrink-0">
            {item.type === 'manual' && (
              <Badge className="text-[10px] bg-accent text-accent-foreground border-0">
                Personal Rec
              </Badge>
            )}
            {item.category && (
              <Badge variant="outline" className="text-[10px]">{item.category}</Badge>
            )}
          </div>
        </div>

        {item.start_time && (
          <p className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {item.start_time}
          </p>
        )}

        {item.note && (
          <p className="text-xs text-primary/80 italic">"{item.note}"</p>
        )}

        {item.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
        )}

        {item.external_url && (
          <a
            href={item.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-primary hover:underline flex items-center gap-1 mt-1"
          >
            Visit link
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {item.type === 'favorite' && onEditNote && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={() => onEditNote(item.id, item.note)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(item.id, item.type)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </motion.div>
  );
}
