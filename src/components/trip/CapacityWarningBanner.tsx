import { useState } from 'react';
import { Info, X } from 'lucide-react';

/**
 * CapacityWarningBanner — renders the honest over-capacity soft-warn the backend
 * stamps at `trip.metadata.quality.capacity_warning` when a trip genuinely could
 * not fit every must-do (e.g. 6 must-dos in a 3-day trip). Instead of silently
 * dropping a priority, we tell the traveler what didn't fit and how to get it in.
 *
 * Self-contained: owns its own dismiss state (persisted per-trip in localStorage)
 * so it can be dropped into the trip page with a single line and no new page state.
 */
export interface CapacityWarning {
  unmet?: string[];
  message?: string;
}

export function CapacityWarningBanner({
  warning,
  tripId,
}: {
  warning?: CapacityWarning | null;
  tripId?: string;
}) {
  const message = warning?.message?.trim();
  const storageKey = tripId ? `voyance:capacityWarn:dismissed:${tripId}` : '';
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return !!storageKey && localStorage.getItem(storageKey) === '1';
    } catch {
      return false;
    }
  });

  if (!message || dismissed) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      if (storageKey) localStorage.setItem(storageKey, '1');
    } catch {
      /* localStorage unavailable — dismiss for this session only */
    }
  };

  return (
    <div className="mb-4 rounded-lg border border-sky-500/30 bg-sky-500/5 p-4 flex items-start gap-3">
      <Info className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">A heads-up on your priorities</p>
        <p className="text-xs text-muted-foreground mt-0.5">{message}</p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="text-muted-foreground hover:text-foreground shrink-0"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
