/**
 * MobileTripOverview — Collapsed single-section wrapper for Trip Health + Travel Intel on mobile.
 * Collapsed by default on return visits (localStorage), expanded on first visit.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileTripOverviewProps {
  tripHealthPanel: React.ReactNode;
  travelIntelCards: React.ReactNode;
  daysPlanned: number;
  totalDays: number;
  cityCount: number;
  tripId: string;
}

export function MobileTripOverview({
  tripHealthPanel,
  travelIntelCards,
  daysPlanned,
  totalDays,
  cityCount,
  tripId,
}: MobileTripOverviewProps) {
  const storageKey = `voyance_trip_overview_seen_${tripId}`;
  
  const [isExpanded, setIsExpanded] = useState(() => {
    // Expanded on first visit, collapsed on return
    try {
      return !localStorage.getItem(storageKey);
    } catch {
      return true;
    }
  });

  // Mark as seen after first render
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, '1');
    } catch { /* ignore */ }
  }, [storageKey]);

  // Listen for tour requesting expansion
  useEffect(() => {
    const handleTourExpand = () => setIsExpanded(true);
    window.addEventListener('tour-expand-mobile-overview', handleTourExpand);
    return () => window.removeEventListener('tour-expand-mobile-overview', handleTourExpand);
  }, []);

  const summaryText = [
    `${daysPlanned}/${totalDays} days`,
    cityCount > 1 ? `${cityCount} cities` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-secondary/30 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <ClipboardList className="h-4 w-4 text-primary shrink-0" />
          <div className="text-left">
            <span className="text-sm font-medium text-foreground">Trip Overview</span>
            <span className="text-xs text-muted-foreground ml-2">{summaryText}</span>
          </div>
        </div>
        <ChevronDown className={cn(
          'h-4 w-4 text-muted-foreground transition-transform duration-200',
          isExpanded && 'rotate-180',
        )} />
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
              {tripHealthPanel}
              {travelIntelCards}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
