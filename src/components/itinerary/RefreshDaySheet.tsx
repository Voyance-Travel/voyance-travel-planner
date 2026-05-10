/**
 * RefreshDaySheet — Side sheet that surfaces refresh-day diagnostic results.
 * Wraps RefreshDayDiffView so the user gets an unmissable accept/reject UI
 * (replaces the inline diff that used to render below the fold).
 */

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { RefreshDayDiffView } from './RefreshDayDiffView';
import type { RefreshResult, ProposedChange } from '@/hooks/useRefreshDay';

interface RefreshDaySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: RefreshResult | null;
  onAcceptAll: (changes: ProposedChange[]) => void;
  onAcceptSelected: (changes: ProposedChange[]) => void;
  onFindAlternative?: (activityId: string, activityTitle: string) => void;
}

export function RefreshDaySheet({
  open,
  onOpenChange,
  result,
  onAcceptAll,
  onAcceptSelected,
  onFindAlternative,
}: RefreshDaySheetProps) {
  if (!result) return null;

  const errorCount = result.issues.filter((i) => i.severity === 'error').length;
  const warnCount = result.issues.filter((i) => i.severity === 'warning').length;

  const closeAfter = (fn: () => void) => {
    fn();
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg overflow-y-auto p-0"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border">
          <SheetTitle>Day {result.dayNumber} — Timeline check</SheetTitle>
          <SheetDescription>
            {result.issues.length === 0
              ? 'No issues found.'
              : `${errorCount} error${errorCount !== 1 ? 's' : ''}, ${warnCount} warning${warnCount !== 1 ? 's' : ''}. Review and accept the fixes you want.`}
          </SheetDescription>
        </SheetHeader>

        <div className="p-4">
          <RefreshDayDiffView
            dayNumber={result.dayNumber}
            proposedChanges={result.proposedChanges || []}
            issues={result.issues}
            transitEstimates={result.transitEstimates}
            buffers={result.buffers || []}
            onAcceptAll={(changes) => closeAfter(() => onAcceptAll(changes))}
            onAcceptSelected={(changes) => closeAfter(() => onAcceptSelected(changes))}
            onDismiss={() => onOpenChange(false)}
            onFindAlternative={onFindAlternative}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default RefreshDaySheet;
