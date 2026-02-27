/**
 * DayActionToolbar — Fixed bottom toolbar for itinerary day actions.
 * Appears on ALL itinerary views across all creation flows.
 * Actions: Add, Discover, Import, Refresh Day, Day Total.
 */

import { Plus, Compass, ClipboardPaste, RefreshCw, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface DayActionToolbarProps {
  onAdd: () => void;
  onDiscover: () => void;
  onImport: () => void;
  onRefreshDay: () => void;
  isRefreshing?: boolean;
  dayTotal: string;
  isEditable?: boolean;
  className?: string;
}

export function DayActionToolbar({
  onAdd,
  onDiscover,
  onImport,
  onRefreshDay,
  isRefreshing = false,
  dayTotal,
  isEditable = true,
  className,
}: DayActionToolbarProps) {
  if (!isEditable) return null;

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={cn(
        'sticky bottom-0 left-0 right-0 z-40',
        className
      )}
    >
      <div className="bg-card/95 backdrop-blur-xl border-t border-border px-3 py-2.5 flex items-center justify-between gap-1.5 sm:gap-2 max-w-3xl mx-auto">
        {/* Action buttons */}
        <div className="flex items-center gap-1 sm:gap-1.5 overflow-x-auto scrollbar-hide">
          <Button
            variant="ghost"
            size="sm"
            onClick={onAdd}
            className="gap-1.5 text-xs shrink-0 hover:bg-primary/10 hover:text-primary"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden xs:inline">Add</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onDiscover}
            className="gap-1.5 text-xs shrink-0 hover:bg-accent/10 hover:text-accent"
          >
            <Compass className="h-4 w-4" />
            <span className="hidden xs:inline">Discover</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onImport}
            className="gap-1.5 text-xs shrink-0 hover:bg-primary/10 hover:text-primary"
          >
            <ClipboardPaste className="h-4 w-4" />
            <span className="hidden xs:inline">Import</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onRefreshDay}
            disabled={isRefreshing}
            className="gap-1.5 text-xs shrink-0 hover:bg-accent/10 hover:text-accent"
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            <span className="hidden xs:inline">{isRefreshing ? 'Validating…' : 'Refresh'}</span>
          </Button>
        </div>

        {/* Day total */}
        <div className="flex items-center gap-1.5 shrink-0 pl-2 border-l border-border/50">
          <Wallet className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-semibold text-primary whitespace-nowrap">
            {dayTotal}
          </span>
        </div>
      </div>
    </motion.div>
  );
}

export default DayActionToolbar;
