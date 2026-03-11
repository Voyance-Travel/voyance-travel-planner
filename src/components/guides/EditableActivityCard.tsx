import { motion } from 'framer-motion';
import { Trash2, ThumbsUp, ThumbsDown, Minus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import StarRating from './StarRating';
import PhotoUploadGrid from './PhotoUploadGrid';
import { cn } from '@/lib/utils';

export interface ActivitySectionData {
  id: string;
  sectionType: 'activity' | 'day_overview' | 'custom_tip';
  title: string;
  body: string;
  linkedDayNumber: number;
  linkedActivityId?: string;
  activitySnapshot?: {
    id?: string;
    name?: string;
    title?: string;
    category?: string;
    tips?: string;
    photos?: string[];
  };
  photoUrl?: string;
  sortOrder: number;
  userExperience: string;
  userRating: number | null;
  recommended: 'yes' | 'no' | 'neutral' | null;
  photos: { url: string; caption: string }[];
}

interface EditableActivityCardProps {
  section: ActivitySectionData;
  index: number;
  onChange: (updated: ActivitySectionData) => void;
  onDelete: (id: string) => void;
  userId: string;
  guideId: string;
}

export default function EditableActivityCard({
  section,
  index,
  onChange,
  onDelete,
  userId,
  guideId,
}: EditableActivityCardProps) {
  if (section.sectionType === 'day_overview') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: index * 0.02 }}
        className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/50 border border-border"
      >
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[10px]">Day {section.linkedDayNumber}</Badge>
          <span className="text-sm font-serif font-semibold text-foreground">{section.title}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(section.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </motion.div>
    );
  }

  const category = section.activitySnapshot?.category || '';
  const aiTip = section.activitySnapshot?.tips || section.body || '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.02 }}
      className="rounded-xl border border-border bg-card p-4 space-y-3"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
              {section.sectionType === 'custom_tip' ? 'Custom Tip' : 'Activity'}
            </Badge>
            <span className="text-[10px] text-muted-foreground">Day {section.linkedDayNumber}</span>
            {category && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{category}</Badge>
            )}
          </div>
          <h3 className="text-sm font-semibold text-foreground">{section.title}</h3>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
          onClick={() => onDelete(section.id)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* AI Tip */}
      {aiTip && section.sectionType !== 'custom_tip' && (
        <p className="text-xs text-muted-foreground italic pl-3 border-l-2 border-primary/20">
          Voyance Tip: {aiTip}
        </p>
      )}

      {/* Your Experience */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Your Experience</label>
        <Textarea
          value={section.userExperience}
          onChange={(e) =>
            onChange({ ...section, userExperience: e.target.value.slice(0, 2000) })
          }
          placeholder="Share your experience… What did you love? Any surprises? Tips for others?"
          maxLength={2000}
          rows={3}
          className="text-sm resize-none"
        />
        <p className="text-[10px] text-muted-foreground text-right">
          {section.userExperience.length}/2000
        </p>
      </div>

      {/* Rating */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Your Rating</label>
        <StarRating
          value={section.userRating}
          onChange={(r) => onChange({ ...section, userRating: r })}
        />
      </div>

      {/* Photos */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Photos</label>
        <PhotoUploadGrid
          photos={section.photos}
          onChange={(p) => onChange({ ...section, photos: p })}
          userId={userId}
          guideId={guideId}
          sectionId={section.id}
        />
      </div>

      {/* Would you recommend? */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Would you recommend this?</label>
        <div className="flex gap-2">
          {[
            { value: 'yes' as const, icon: ThumbsUp, label: 'Yes' },
            { value: 'no' as const, icon: ThumbsDown, label: 'No' },
            { value: 'neutral' as const, icon: Minus, label: "It's okay" },
          ].map(({ value, icon: Icon, label }) => (
            <Button
              key={value}
              type="button"
              variant={section.recommended === value ? 'default' : 'outline'}
              size="sm"
              className={cn(
                'gap-1.5 text-xs flex-1',
                section.recommended === value && value === 'yes' && 'bg-sage text-sage-foreground hover:bg-sage/90',
                section.recommended === value && value === 'no' && 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
              )}
              onClick={() =>
                onChange({ ...section, recommended: section.recommended === value ? null : value })
              }
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </Button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
