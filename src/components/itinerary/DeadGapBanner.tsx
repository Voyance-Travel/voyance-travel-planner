import { useState } from 'react';
import { Clock, Sparkles, Loader2, Check, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFillDeadGap, type SuggestedActivity, type FillDeadGapInput } from '@/hooks/useFillDeadGap';
import { formatDeadGap } from './TransitGapIndicator';

interface DeadGapBannerProps {
  /** Gap details from computeDeadGaps */
  gap: {
    beforeIndex: number;
    minutes: number;
    fromTime: string;
    toTime: string;
    fromTitle: string;
    toTitle: string;
  };
  /** Context for the AI suggestion call */
  context: Omit<FillDeadGapInput, 'gap'> & { beforeId?: string; afterId?: string };
  /** Open the manual AddActivity modal at this gap */
  onAddManually: () => void;
  /** Apply an accepted suggestion at the given afterIndex */
  onAcceptSuggestion: (afterIndex: number, activity: SuggestedActivity) => void;
}

const MAX_RETRIES = 3;

export function DeadGapBanner({ gap, context, onAddManually, onAcceptSuggestion }: DeadGapBannerProps) {
  const { fetchSuggestion, loading, reset, attemptCount } = useFillDeadGap();
  const [suggestion, setSuggestion] = useState<SuggestedActivity | null>(null);
  const [errored, setErrored] = useState(false);

  const handleSuggest = async () => {
    setErrored(false);
    const res = await fetchSuggestion({
      ...context,
      gap: {
        startTime: gap.fromTime,
        endTime: gap.toTime,
        beforeId: context.beforeId,
        afterId: context.afterId,
      },
    });
    if (res.proposedChange?.activity) {
      setSuggestion(res.proposedChange.activity);
    } else {
      setErrored(true);
      setSuggestion(null);
    }
  };

  const handleAccept = () => {
    if (!suggestion) return;
    onAcceptSuggestion(gap.beforeIndex, suggestion);
    setSuggestion(null);
    reset();
  };

  const handleTryAnother = () => {
    setSuggestion(null);
    void handleSuggest();
  };

  // Past max retries → fall back to manual
  const exhausted = attemptCount >= MAX_RETRIES && !suggestion && errored;

  // Suggested state — show card
  if (suggestion) {
    return (
      <div className="flex flex-col gap-2 px-4 py-3 border-b border-border/50 bg-amber-50/60 dark:bg-amber-950/20">
        <div className="flex items-start gap-2 min-w-0">
          <Sparkles className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground truncate">{suggestion.title}</p>
            <p className="text-xs text-muted-foreground">
              {suggestion.startTime}–{suggestion.endTime}
              {suggestion.location?.name && ` · ${suggestion.location.name}`}
            </p>
            {suggestion.rationale && (
              <p className="text-xs text-foreground/70 mt-1 italic">{suggestion.rationale}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 justify-end">
          <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => { setSuggestion(null); reset(); }}>
            Dismiss
          </Button>
          {attemptCount < MAX_RETRIES && (
            <Button type="button" variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={handleTryAnother} disabled={loading}>
              <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Try another
            </Button>
          )}
          <Button type="button" size="sm" className="h-8 px-3 text-xs" onClick={handleAccept}>
            <Check className="h-3 w-3 mr-1" aria-hidden="true" />
            Add to day
          </Button>
        </div>
      </div>
    );
  }

  // Idle / loading / errored / exhausted
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-4 py-2 border-b border-border/50 bg-amber-50/60 dark:bg-amber-950/20">
      <div className="flex items-start sm:items-center gap-2 min-w-0 flex-1">
        <Clock className="h-3.5 w-3.5 text-amber-700 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" aria-hidden="true" />
        <p className="text-xs text-foreground/80">
          <span className="font-medium">{formatDeadGap(gap.minutes)} unplanned</span>
          <span className="text-muted-foreground"> between {gap.fromTitle || 'previous activity'} ({gap.fromTime}) and {gap.toTitle || 'next activity'} ({gap.toTime}).</span>
          {errored && !exhausted && (
            <span className="ml-1 text-amber-700 dark:text-amber-400">No match found — try again or add manually.</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
        <button
          type="button"
          onClick={onAddManually}
          className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
          aria-label="Add an activity manually"
        >
          Add manually
        </button>
        {!exhausted && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSuggest}
            disabled={loading}
            className="h-8 px-3 text-xs"
            aria-label="Suggest an activity for this gap"
          >
            {loading ? (
              <><Loader2 className="h-3 w-3 mr-1 animate-spin" aria-hidden="true" />Finding…</>
            ) : (
              <><Sparkles className="h-3 w-3 mr-1" aria-hidden="true" />Suggest something</>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
