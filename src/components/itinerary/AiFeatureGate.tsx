/**
 * AiFeatureGate — Shows a lock overlay when AI features are gated
 * for manually built/imported trips that haven't purchased Smart Finish.
 */

import { Lock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AiFeatureGateProps {
  feature: string;
  className?: string;
}

export function AiFeatureGate({ feature, className }: AiFeatureGateProps) {
  return (
    <div className={cn(
      "flex items-center gap-2 px-3 py-2 rounded-lg text-xs",
      "bg-muted/60 border border-border text-muted-foreground",
      className
    )}>
      <Lock className="h-3.5 w-3.5 shrink-0" />
      <span>
        Unlock <span className="font-medium">{feature}</span> with credits
      </span>
      <Sparkles className="h-3 w-3 text-amber-500 shrink-0" />
    </div>
  );
}
