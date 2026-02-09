/**
 * LockedField — compact inline placeholder for gated premium fields
 * (addresses, tips, reviews, booking links).
 */

import { Lock, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LockedFieldProps {
  icon?: LucideIcon;
  label: string;
  className?: string;
}

export function LockedField({ icon: Icon, label, className }: LockedFieldProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs text-muted-foreground/60 italic",
        className
      )}
    >
      <Lock className="h-3 w-3 shrink-0" />
      {Icon && <Icon className="h-3 w-3 shrink-0" />}
      <span>{label}</span>
    </div>
  );
}
