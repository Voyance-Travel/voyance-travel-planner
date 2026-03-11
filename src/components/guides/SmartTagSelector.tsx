import { useMemo } from 'react';
import { X, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface SmartTagSelectorProps {
  tags: string[];
  tagInput: string;
  onTagsChange: (tags: string[]) => void;
  onTagInputChange: (val: string) => void;
  destination?: string | null;
  destinationCountry?: string | null;
  activityCategories?: string[];
  travelDnaType?: string | null;
  travelerCount?: number | null;
  maxTags?: number;
}

export default function SmartTagSelector({
  tags,
  tagInput,
  onTagsChange,
  onTagInputChange,
  destination,
  destinationCountry,
  activityCategories = [],
  travelDnaType,
  travelerCount,
  maxTags = 10,
}: SmartTagSelectorProps) {
  const suggestions = useMemo(() => {
    const s: string[] = [];

    // Destination tags
    if (destination) s.push(destination);
    if (destinationCountry) s.push(destinationCountry);

    // Activity category tags
    const uniqueCats = [...new Set(activityCategories.map((c) => c.toLowerCase()))];
    uniqueCats.forEach((cat) => {
      if (cat && !s.some((t) => t.toLowerCase() === cat)) {
        s.push(cat.charAt(0).toUpperCase() + cat.slice(1));
      }
    });

    // Travel DNA
    if (travelDnaType) s.push(travelDnaType);

    // Trip type based on traveler count
    if (travelerCount !== null && travelerCount !== undefined) {
      if (travelerCount === 1) s.push('Solo Trip');
      else if (travelerCount === 2) s.push('Couples Trip');
      else if (travelerCount <= 5) s.push('Group Trip');
      else s.push('Large Group');
    }

    // Filter out already-added tags
    return s.filter((t) => !tags.some((existing) => existing.toLowerCase() === t.toLowerCase()));
  }, [destination, destinationCountry, activityCategories, travelDnaType, travelerCount, tags]);

  const addTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.some((t) => t.toLowerCase() === trimmed.toLowerCase()) && tags.length < maxTags) {
      onTagsChange([...tags, trimmed]);
      onTagInputChange('');
    }
  };

  const removeTag = (tag: string) => {
    onTagsChange(tags.filter((t) => t !== tag));
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Tags</label>

      {/* Current tags */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 text-xs">
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                className="hover:text-destructive"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addTag(s)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
            >
              <Plus className="h-3 w-3" />
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Custom tag input */}
      <div className="flex gap-2">
        <Input
          value={tagInput}
          onChange={(e) => onTagInputChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTag(tagInput);
            }
          }}
          placeholder="Add a custom tag…"
          className="text-xs h-8 flex-1"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => addTag(tagInput)}
          className="h-8 text-xs"
          disabled={!tagInput.trim()}
        >
          Add
        </Button>
      </div>

      {tags.length >= maxTags && (
        <p className="text-[10px] text-muted-foreground">Maximum {maxTags} tags reached</p>
      )}
    </div>
  );
}
