/**
 * Personalization Proof Component
 * 
 * Shows users WHY a specific activity was chosen for THEM,
 * making personalization visible and trustworthy.
 */

import { User, Dna } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PersonalizationProofProps {
  whyThisFits: string;
  matchedInputs?: string[];
  archetype?: string;
  confidence?: number;
  variant?: 'inline' | 'expanded';
  className?: string;
}

export function PersonalizationProof({
  whyThisFits,
  matchedInputs,
  archetype,
  confidence,
  variant = 'inline',
  className,
}: PersonalizationProofProps) {
  if (variant === 'inline') {
    return (
      <div className={cn(
        'flex items-start gap-2 text-xs',
        className
      )}>
        <Dna className="h-3.5 w-3.5 text-violet-500 shrink-0 mt-0.5" />
        <p className="text-muted-foreground">
          <span className="text-violet-600 font-medium">Why for you: </span>
          {whyThisFits}
        </p>
      </div>
    );
  }

  return (
    <div className={cn(
      'p-3 rounded-lg bg-violet-500/5 border border-violet-500/20',
      className
    )}>
      <div className="flex items-start gap-2">
        <div className="w-6 h-6 rounded-full bg-violet-500/10 flex items-center justify-center shrink-0">
          <User className="h-3.5 w-3.5 text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-violet-600 uppercase tracking-wide">
              Why This Is In Your Itinerary
            </span>
            {confidence && confidence > 0.8 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-600">
                High Match
              </span>
            )}
          </div>
          
          <p className="text-xs text-muted-foreground mb-2">
            {whyThisFits}
          </p>

          {/* Matched Inputs */}
          {matchedInputs && matchedInputs.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {matchedInputs.map((input, index) => (
                <span
                  key={index}
                  className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-600"
                >
                  {input}
                </span>
              ))}
            </div>
          )}

          {/* Archetype Context */}
          {archetype && (
            <p className="text-[10px] text-muted-foreground mt-2 italic">
              Matched to your {archetype} travel style
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default PersonalizationProof;
