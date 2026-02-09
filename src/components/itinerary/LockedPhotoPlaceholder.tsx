/**
 * LockedPhotoPlaceholder — shown in place of activity photos
 * when the user hasn't unlocked premium content for that day.
 */

import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LockedPhotoPlaceholderProps {
  className?: string;
}

export function LockedPhotoPlaceholder({ className }: LockedPhotoPlaceholderProps) {
  return (
    <div
      className={cn(
        "w-full h-full flex flex-col items-center justify-center",
        "bg-gradient-to-br from-muted/80 to-muted/40 text-muted-foreground/50",
        className
      )}
    >
      <Lock className="h-4 w-4 mb-0.5" />
      <span className="text-[10px] font-medium leading-tight">Premium</span>
    </div>
  );
}
