/**
 * DNA Match Badge Component
 * 
 * Displays a visual indicator of how well a hotel matches the user's Travel DNA.
 * Shows match percentage with color coding and expandable match reasons.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dna, ChevronDown, Check, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

interface DNAMatchBadgeProps {
  matchScore: number; // 0-100
  reasons: string[];
  isPersonalized: boolean;
  compact?: boolean;
  showTooltip?: boolean;
  className?: string;
}

function getMatchColor(score: number): {
  bg: string;
  text: string;
  border: string;
  icon: string;
} {
  if (score >= 80) {
    return {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-600 dark:text-emerald-400',
      border: 'border-emerald-500/30',
      icon: 'text-emerald-500',
    };
  }
  if (score >= 60) {
    return {
      bg: 'bg-amber-500/10',
      text: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-500/30',
      icon: 'text-amber-500',
    };
  }
  return {
    bg: 'bg-muted',
    text: 'text-muted-foreground',
    border: 'border-border',
    icon: 'text-muted-foreground',
  };
}

function getMatchLabel(score: number): string {
  if (score >= 90) return 'Excellent Match';
  if (score >= 80) return 'Great Match';
  if (score >= 70) return 'Good Match';
  if (score >= 60) return 'Fair Match';
  return 'Match';
}

export default function DNAMatchBadge({
  matchScore,
  reasons,
  isPersonalized,
  compact = false,
  showTooltip = true,
  className,
}: DNAMatchBadgeProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const colors = getMatchColor(matchScore);
  
  // If not personalized, show a prompt to take the quiz
  if (!isPersonalized) {
    if (compact) return null;
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant="outline" 
              className={cn(
                'gap-1 cursor-help text-muted-foreground border-dashed',
                className
              )}
            >
              <Dna className="h-3 w-3" />
              <span className="text-xs">Personalize</span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[200px]">
            <p className="text-xs">
              Take the Travel DNA quiz to see personalized hotel matches
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  const badgeContent = (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-md border transition-colors',
        colors.bg,
        colors.border,
        colors.text,
        !compact && 'cursor-pointer hover:opacity-90',
        className
      )}
      onClick={() => !compact && setIsExpanded(!isExpanded)}
    >
      <Dna className={cn('h-3.5 w-3.5', colors.icon)} />
      <span className="text-sm font-semibold">{matchScore}%</span>
      {!compact && (
        <>
          <span className="text-xs opacity-80">{getMatchLabel(matchScore)}</span>
          <ChevronDown 
            className={cn(
              'h-3 w-3 transition-transform opacity-60',
              isExpanded && 'rotate-180'
            )} 
          />
        </>
      )}
    </div>
  );
  
  // Compact version with tooltip
  if (compact && showTooltip) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {badgeContent}
          </TooltipTrigger>
          <TooltipContent side="top" className="max-w-[250px]">
            <div className="space-y-2">
              <p className="text-xs font-medium">
                {getMatchLabel(matchScore)} based on your Travel DNA
              </p>
              {reasons.length > 0 && (
                <ul className="space-y-1">
                  {reasons.slice(0, 3).map((reason, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-xs">
                      <Check className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  
  // Compact without tooltip
  if (compact) {
    return badgeContent;
  }
  
  // Full version with expandable reasons
  return (
    <div className="inline-block">
      {badgeContent}
      
      <AnimatePresence>
        {isExpanded && reasons.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className={cn(
              'mt-2 p-3 rounded-lg border',
              colors.bg,
              colors.border
            )}>
              <p className="text-xs font-medium mb-2 flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" />
                Why this matches your style
              </p>
              <ul className="space-y-1.5">
                {reasons.map((reason, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className={cn('h-4 w-4 shrink-0 mt-0.5', colors.icon)} />
                    <span className="text-foreground">{reason}</span>
                  </li>
                ))}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Compact Badge Variant
// ============================================================================

export function DNAMatchBadgeCompact({
  matchScore,
  reasons,
  isPersonalized,
  className,
}: Omit<DNAMatchBadgeProps, 'compact' | 'showTooltip'>) {
  return (
    <DNAMatchBadge
      matchScore={matchScore}
      reasons={reasons}
      isPersonalized={isPersonalized}
      compact
      showTooltip
      className={className}
    />
  );
}
