/**
 * Voyance Insight Component
 * Collapsible local knowledge tip for each activity
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoyanceInsightProps {
  tip: string;
  className?: string;
}

export function VoyanceInsight({ tip, className }: VoyanceInsightProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div 
      className={cn(
        "mt-3 rounded-lg border border-primary/15 bg-primary/[0.03] overflow-hidden transition-all",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-start gap-2 p-2.5 text-left cursor-pointer hover:bg-primary/5 transition-colors"
      >
        <Lightbulb className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-xs text-muted-foreground leading-relaxed",
            !isExpanded && "line-clamp-1"
          )}>
            {tip}
          </p>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="shrink-0 text-primary/50"
        >
          <ChevronDown className="h-3 w-3" />
        </motion.div>
      </button>
    </div>
  );
}

export default VoyanceInsight;
