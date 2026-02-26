/**
 * Contextual Tips Popover
 * Lightweight info icon that reveals typed tips on demand — never clutters the default view.
 */

import { useState } from 'react';
import { 
  Lightbulb, Clock, Ticket, PiggyBank, TrainFront, 
  Globe2, ShieldAlert, Gem, CloudSun, Info
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type TipType = 
  | 'timing' 
  | 'booking' 
  | 'money_saving' 
  | 'transit' 
  | 'cultural' 
  | 'safety' 
  | 'hidden_gem' 
  | 'weather' 
  | 'general';

export interface ContextualTip {
  type: TipType;
  text: string;
}

interface ContextualTipsPopoverProps {
  tips: ContextualTip[];
  className?: string;
}

const tipConfig: Record<TipType, { icon: React.ReactNode; label: string; color: string }> = {
  timing:      { icon: <Clock className="h-3 w-3" />,        label: 'Timing',       color: 'text-blue-500' },
  booking:     { icon: <Ticket className="h-3 w-3" />,       label: 'Booking',      color: 'text-accent' },
  money_saving:{ icon: <PiggyBank className="h-3 w-3" />,    label: 'Save Money',   color: 'text-emerald-500' },
  transit:     { icon: <TrainFront className="h-3 w-3" />,    label: 'Transit',      color: 'text-indigo-500' },
  cultural:    { icon: <Globe2 className="h-3 w-3" />,        label: 'Cultural',     color: 'text-amber-600' },
  safety:      { icon: <ShieldAlert className="h-3 w-3" />,   label: 'Practical',    color: 'text-rose-500' },
  hidden_gem:  { icon: <Gem className="h-3 w-3" />,           label: 'Hidden Gem',   color: 'text-purple-500' },
  weather:     { icon: <CloudSun className="h-3 w-3" />,      label: 'Weather',      color: 'text-sky-500' },
  general:     { icon: <Lightbulb className="h-3 w-3" />,     label: 'Tip',          color: 'text-primary' },
};

export function ContextualTipsPopover({ tips, className }: ContextualTipsPopoverProps) {
  const [open, setOpen] = useState(false);

  if (!tips || tips.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors rounded-full px-1.5 py-0.5 hover:bg-primary/5",
            className
          )}
          aria-label={`${tips.length} tip${tips.length > 1 ? 's' : ''} available`}
        >
          <Info className="h-3 w-3" />
          <span className="hidden sm:inline">{tips.length} tip{tips.length > 1 ? 's' : ''}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent 
        side="bottom" 
        align="start" 
        className="w-80 p-0 overflow-hidden"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <div className="px-3 py-2 border-b border-border bg-muted/30">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Did you know?
          </h4>
        </div>
        <div className="divide-y divide-border max-h-72 overflow-y-auto">
          {tips.map((tip, i) => {
            const config = tipConfig[tip.type] || tipConfig.general;
            return (
              <div key={i} className="flex items-start gap-2.5 px-3 py-2.5">
                <div className={cn("mt-0.5 shrink-0", config.color)}>
                  {config.icon}
                </div>
                <div className="min-w-0">
                  <span className={cn("text-[10px] font-semibold uppercase tracking-wider", config.color)}>
                    {config.label}
                  </span>
                  <p className="text-xs text-foreground leading-relaxed mt-0.5">
                    {tip.text}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default ContextualTipsPopover;
