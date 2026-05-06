import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BudgetRaisedBannerProps {
  currentCents: number;
  originalCents: number;
  originalSetAt?: string;
  tripId: string;
  formatCurrency: (cents: number) => string;
  onReset: () => void | Promise<void>;
}

const dismissKey = (tripId: string) => `budget-raised-banner-dismissed:${tripId}`;

/**
 * Surfaces the gap between the user's original budget and their current one
 * — typically caused by the inline "Raise budget" CTA. Persists across
 * regenerations (which intentionally keep budget changes), so this banner is
 * the only signal users get that their live budget no longer matches their
 * original intent. Dismissal is per-trip + session-only so the banner
 * reappears on a fresh session as long as the values still differ.
 */
export function BudgetRaisedBanner({
  currentCents,
  originalCents,
  originalSetAt,
  tripId,
  formatCurrency,
  onReset,
}: BudgetRaisedBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(dismissKey(tripId)) === '1');
    } catch {
      // sessionStorage may be unavailable; default to showing the banner.
    }
  }, [tripId]);

  if (currentCents === originalCents || dismissed) return null;

  const isRaised = currentCents > originalCents;
  const Icon = isRaised ? TrendingUp : TrendingDown;
  const verb = isRaised ? 'Raised' : 'Lowered';

  const dateLabel = (() => {
    if (!originalSetAt) return null;
    const d = new Date(originalSetAt);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  })();

  const handleDismiss = () => {
    try { sessionStorage.setItem(dismissKey(tripId), '1'); } catch { /* ignore */ }
    setDismissed(true);
  };

  const handleConfirm = async () => {
    setResetting(true);
    try {
      await onReset();
    } finally {
      setResetting(false);
      setConfirming(false);
    }
  };

  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-full bg-background flex items-center justify-center flex-shrink-0">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        {confirming ? (
          <>
            <p className="text-sm font-medium">
              Reset budget to {formatCurrency(originalCents)}?
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your itinerary stays the same — only the budget target changes.
            </p>
            <div className="mt-2 flex gap-2">
              <Button
                size="sm"
                variant="default"
                onClick={handleConfirm}
                disabled={resetting}
              >
                {resetting ? 'Resetting…' : 'Confirm reset'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirming(false)}
                disabled={resetting}
              >
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm font-medium">
              Your budget is {formatCurrency(currentCents)}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {verb} from {formatCurrency(originalCents)}
              {dateLabel ? ` on ${dateLabel}` : ''}. This persists across
              regenerations.
            </p>
            <div className="mt-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirming(true)}
              >
                Reset to original
              </Button>
            </div>
          </>
        )}
      </div>
      {!confirming && (
        <button
          type="button"
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground p-1 -m-1 flex-shrink-0"
          aria-label="Dismiss budget banner"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
