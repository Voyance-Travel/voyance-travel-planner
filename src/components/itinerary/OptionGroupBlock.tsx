/**
 * OptionGroupBlock — renders either/or activity options as a radio-style selector.
 * Used when parsed trip data contains isOption=true activities sharing an optionGroup.
 */

import { useState } from 'react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, Coins } from 'lucide-react';
import { cn } from '@/lib/utils';
import { sanitizeActivityName } from '@/utils/activityNameSanitizer';
import type { EditorialActivity } from './EditorialItinerary';

interface OptionGroupBlockProps {
  /** All activities in this option group */
  options: EditorialActivity[];
  /** Callback when user selects an option */
  onSelect: (selectedId: string) => void;
  /** Currently selected activity ID (defaults to first) */
  selectedId?: string;
  /** Trip currency for cost display */
  currency?: string;
}

export function OptionGroupBlock({ options, onSelect, selectedId, currency = 'USD' }: OptionGroupBlockProps) {
  const [selected, setSelected] = useState(selectedId || options[0]?.id || '');

  const handleChange = (value: string) => {
    setSelected(value);
    onSelect(value);
  };

  // Infer the meal/activity label from the first option's category or time
  const groupLabel = inferGroupLabel(options[0]);

  return (
    <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Badge variant="secondary" className="text-xs font-medium gap-1">
          Choose one
        </Badge>
        {groupLabel && (
          <span className="text-sm text-muted-foreground font-medium">{groupLabel}</span>
        )}
      </div>

      <RadioGroup value={selected} onValueChange={handleChange} className="space-y-2">
        {options.map((option) => {
          const title = sanitizeActivityName(option.title || (option as any).name);
          const isActive = selected === option.id;
          const cost = option.cost?.amount;
          const time = option.startTime || option.time;
          const location = option.location?.name || option.location?.address;

          return (
            <label
              key={option.id}
              className={cn(
                "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                isActive
                  ? "border-primary bg-primary/10 shadow-sm"
                  : "border-border bg-card hover:border-primary/40 hover:bg-primary/5"
              )}
            >
              <RadioGroupItem value={option.id} className="mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "font-medium text-sm",
                  isActive ? "text-foreground" : "text-foreground/80"
                )}>
                  {title}
                </p>
                {option.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {option.description}
                  </p>
                )}
                {option.tips && (
                  <p className="text-xs text-muted-foreground mt-0.5 italic">
                    {option.tips}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                  {time && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {time}
                    </span>
                  )}
                  {location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate max-w-[140px]">{location}</span>
                    </span>
                  )}
                  {cost !== undefined && cost > 0 && (
                    <span className="flex items-center gap-1">
                      <Coins className="h-3 w-3" />
                      {cost.toLocaleString()} {currency}
                    </span>
                  )}
                </div>
              </div>
            </label>
          );
        })}
      </RadioGroup>
    </div>
  );
}

function inferGroupLabel(activity?: EditorialActivity): string | null {
  if (!activity) return null;
  const cat = (activity.category || activity.type || '').toLowerCase();
  if (['dining', 'dinner', 'lunch', 'breakfast', 'brunch'].includes(cat)) {
    return cat.charAt(0).toUpperCase() + cat.slice(1);
  }
  if (cat === 'activity' || cat === 'sightseeing' || cat === 'cultural') {
    return 'Activity';
  }
  return null;
}
