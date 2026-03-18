import { Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface DayUndoButtonProps {
  onClick: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  className?: string;
  showLabel?: boolean;
  label?: string;
}

export function DayUndoButton({
  onClick,
  isLoading = false,
  disabled = false,
  className,
  showLabel = false,
  label,
}: DayUndoButtonProps) {
  const button = (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cn('gap-2', className)}
    >
      <Undo2 className={cn('h-4 w-4', isLoading && 'animate-pulse')} />
      {showLabel && (
        <span className="hidden sm:inline">
          {isLoading ? 'Restoring...' : (label || 'Undo')}
        </span>
      )}
    </Button>
  );

  if (showLabel) {
    return button;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent>
          <p>{isLoading ? 'Restoring previous version...' : 'Undo last change'}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default DayUndoButton;
