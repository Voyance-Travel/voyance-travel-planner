/**
 * DNA Trait Fingerprint - Hero visualization of 8 trait scores
 * Animated horizontal bars showing the user's trait profile at a glance
 */

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface DNATraitFingerprintProps {
  traitScores: Record<string, number> | null | undefined;
  className?: string;
}

const TRAIT_DISPLAY: Record<string, { label: string; low: string; high: string }> = {
  planning: { label: 'Planning', low: 'Spontaneous', high: 'Detailed' },
  social: { label: 'Social', low: 'Solo', high: 'Social' },
  comfort: { label: 'Comfort', low: 'Budget', high: 'Luxury' },
  pace: { label: 'Pace', low: 'Relaxed', high: 'Active' },
  authenticity: { label: 'Authenticity', low: 'Tourist', high: 'Local' },
  adventure: { label: 'Adventure', low: 'Safe', high: 'Bold' },
  budget: { label: 'Spending', low: 'Splurge', high: 'Frugal' },
  transformation: { label: 'Purpose', low: 'Leisure', high: 'Growth' },
};

const TRAIT_ORDER = ['planning', 'social', 'comfort', 'pace', 'authenticity', 'adventure', 'budget', 'transformation'];

export default function DNATraitFingerprint({ traitScores, className }: DNATraitFingerprintProps) {
  if (!traitScores || Object.keys(traitScores).length === 0) return null;

  return (
    <div className={cn("space-y-3", className)}>
      <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
        Your Trait Fingerprint
      </p>
      <div className="space-y-2.5">
        {TRAIT_ORDER.map((trait, i) => {
          const display = TRAIT_DISPLAY[trait];
          const rawScore = typeof traitScores[trait] === 'number' ? traitScores[trait] : 0;
          // Normalize from [-10, 10] to [0, 100]
          const normalizedValue = Math.max(0, Math.min(100, ((rawScore + 10) / 20) * 100));

          if (!display) return null;

          return (
            <motion.div
              key={trait}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.3 }}
              className="group"
            >
              <div className="flex items-center gap-3">
                {/* Labels */}
                <span className="text-[11px] text-muted-foreground w-[72px] text-right truncate hidden sm:block">
                  {display.low}
                </span>

                {/* Bar container */}
                <div className="flex-1 relative h-2 bg-muted/60 rounded-full overflow-hidden">
                  {/* Center marker */}
                  <div className="absolute top-0 left-1/2 w-px h-full bg-border/60 z-10" />
                  {/* Fill */}
                  <motion.div
                    initial={{ width: '50%' }}
                    animate={{ width: `${normalizedValue}%` }}
                    transition={{ duration: 0.6, delay: i * 0.05, ease: [0.25, 0.46, 0.45, 0.94] }}
                    className="absolute top-0 left-0 h-full rounded-full bg-gradient-to-r from-primary/40 to-primary"
                  />
                </div>

                <span className="text-[11px] text-muted-foreground w-[72px] truncate hidden sm:block">
                  {display.high}
                </span>
              </div>

              {/* Mobile: trait label below */}
              <div className="flex justify-between sm:hidden mt-0.5">
                <span className="text-[10px] text-muted-foreground">{display.low}</span>
                <span className="text-[10px] font-medium text-foreground/70">{display.label}</span>
                <span className="text-[10px] text-muted-foreground">{display.high}</span>
              </div>

              {/* Desktop: trait label as center tooltip on hover */}
              <p className="text-center text-[10px] text-muted-foreground/60 hidden sm:block group-hover:text-foreground/60 transition-colors">
                {display.label}
              </p>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
