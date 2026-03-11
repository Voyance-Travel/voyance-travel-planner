import { cn } from '@/lib/utils';
import type { TripViewMode } from '@/hooks/useTripViewMode';

interface TripViewModeToggleProps {
  mode: TripViewMode;
  onModeChange: (mode: TripViewMode) => void;
  className?: string;
}

/**
 * Segmented control for switching between Edit and Preview modes.
 * Pill shape, teal active state, clean text labels.
 */
export function TripViewModeToggle({ mode, onModeChange, className }: TripViewModeToggleProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border border-border bg-background p-0.5 shadow-sm',
        className
      )}
    >
      <button
        type="button"
        onClick={() => onModeChange('edit')}
        className={cn(
          'px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          mode === 'edit'
            ? 'bg-[hsl(var(--primary))] text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Edit
      </button>
      <button
        type="button"
        onClick={() => onModeChange('preview')}
        className={cn(
          'px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          mode === 'preview'
            ? 'bg-[hsl(var(--primary))] text-primary-foreground shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Preview
      </button>
    </div>
  );
}
