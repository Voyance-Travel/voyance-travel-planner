import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StarRatingProps {
  value: number | null;
  onChange?: (rating: number) => void;
  readonly?: boolean;
  size?: 'sm' | 'md';
}

export default function StarRating({ value, onChange, readonly = false, size = 'md' }: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  const starSize = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const displayValue = hoverValue ?? value ?? 0;

  return (
    <div
      className={cn('flex items-center gap-0.5', !readonly && 'cursor-pointer')}
      onMouseLeave={() => !readonly && setHoverValue(null)}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readonly}
          className={cn(
            'transition-colors focus:outline-none disabled:cursor-default',
            star <= displayValue
              ? 'text-gold'
              : 'text-muted-foreground/30'
          )}
          onClick={() => onChange?.(star)}
          onMouseEnter={() => !readonly && setHoverValue(star)}
        >
          <Star
            className={cn(starSize, star <= displayValue && 'fill-current')}
          />
        </button>
      ))}
    </div>
  );
}
