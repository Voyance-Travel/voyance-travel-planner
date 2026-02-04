/**
 * Credit Nudge Tooltip
 * Contextual tooltip showing credit earning opportunity
 */

import { ReactNode } from 'react';
import { Gift } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useBonusCredits, BONUS_INFO, BonusType } from '@/hooks/useBonusCredits';
import { cn } from '@/lib/utils';

interface CreditNudgeTooltipProps {
  children: ReactNode;
  bonusType: BonusType;
  className?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}

export function CreditNudgeTooltip({
  children,
  bonusType,
  className,
  side = 'top',
}: CreditNudgeTooltipProps) {
  const { hasClaimedBonus } = useBonusCredits();

  // Don't show nudge if already claimed
  if (hasClaimedBonus(bonusType)) {
    return <>{children}</>;
  }

  const info = BONUS_INFO[bonusType];

  return (
    <TooltipProvider>
      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <div className={cn('relative', className)}>
            {children}
            {/* Small badge indicator */}
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-accent flex items-center justify-center animate-pulse">
              <Gift className="h-2.5 w-2.5 text-accent-foreground" />
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent 
          side={side}
          className="bg-card border-accent/20 shadow-lg"
        >
          <div className="flex items-center gap-2 p-1">
            <span className="text-lg">{info.icon}</span>
            <div>
              <p className="font-medium text-sm">Earn +{info.credits} credits</p>
              <p className="text-xs text-muted-foreground">{info.description}</p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default CreditNudgeTooltip;
