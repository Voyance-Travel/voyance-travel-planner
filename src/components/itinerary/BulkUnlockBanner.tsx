/**
 * BulkUnlockBanner — Shown when 3+ days are locked.
 * Offers a discounted bulk unlock using the group_unlock tiers.
 */

import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CREDIT_COSTS } from '@/config/pricing';

interface BulkUnlockBannerProps {
  lockedDayCount: number;
  totalDays: number;
  destination?: string;
  unlockedCount: number;
  onBulkUnlock: () => void;
  isUnlocking?: boolean;
  className?: string;
}

export function getBulkUnlockCost(lockedDays: number): number {
  if (lockedDays >= 7) return 500;
  if (lockedDays >= 4) return 300;
  return 150; // 2-3 days
}

export function BulkUnlockBanner({
  lockedDayCount,
  totalDays,
  destination,
  unlockedCount,
  onBulkUnlock,
  isUnlocking = false,
  className,
}: BulkUnlockBannerProps) {
  if (lockedDayCount < 2) return null;

  const bulkCost = getBulkUnlockCost(lockedDayCount);
  const individualCost = lockedDayCount * CREDIT_COSTS.UNLOCK_DAY;
  const savings = individualCost - bulkCost;

  return (
    <div className={cn(
      "flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 rounded-xl border border-teal-500/30 bg-teal-500/5",
      className,
    )}>
      <div className="flex flex-col gap-0.5 text-center sm:text-left">
        <p className="text-sm font-medium text-foreground">
          {destination && `${destination} · `}{totalDays} Days · {unlockedCount} Unlocked · {lockedDayCount} Locked
        </p>
        {savings > 0 && (
          <p className="text-xs text-muted-foreground">
            Save {savings} credits vs unlocking individually
          </p>
        )}
      </div>
      <Button
        onClick={onBulkUnlock}
        disabled={isUnlocking}
        className="gap-2 bg-teal-600 hover:bg-teal-700 text-white shrink-0"
        size="sm"
      >
        {isUnlocking ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
        Unlock All Remaining - {bulkCost} credits
      </Button>
    </div>
  );
}
