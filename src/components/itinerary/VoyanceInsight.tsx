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
  
  // Split tip into preview (first sentence) and rest
  const firstSentenceMatch = tip.match(/^[^.!?]+[.!?]/);
  const preview = firstSentenceMatch ? firstSentenceMatch[0] : tip;
  const hasMore = tip.length > preview.length;

  return (
    <div 
      className={cn(
        "mt-2 rounded-lg border border-primary/20 bg-gradient-to-r from-primary/5 to-transparent overflow-hidden transition-all",
        className
      )}
    >
      <button
        type="button"
        onClick={() => hasMore && setIsExpanded(!isExpanded)}
        className={cn(
          "w-full flex items-start gap-2 p-2.5 text-left",
          hasMore && "cursor-pointer hover:bg-primary/5"
        )}
      >
        <Lightbulb className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-primary">
              Voyance Insight
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {isExpanded ? tip : preview}
            {!isExpanded && hasMore && (
              <span className="text-primary/70 ml-1">...</span>
            )}
          </p>
        </div>
        {hasMore && (
          <motion.div
            animate={{ rotate: isExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="shrink-0 text-primary/60"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </motion.div>
        )}
      </button>
    </div>
  );
}

export default VoyanceInsight;
