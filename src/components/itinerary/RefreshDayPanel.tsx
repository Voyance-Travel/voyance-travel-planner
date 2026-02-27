/**
 * RefreshDayPanel — Displays validation results from a day refresh.
 * Shows issues, transit estimates, and fix suggestions.
 */

import { AlertTriangle, CheckCircle, X, Footprints, Train, Car, ChevronRight, ArrowRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { RefreshIssue, RefreshTransitEstimate } from '@/hooks/useRefreshDay';

interface RefreshDayPanelProps {
  issues: RefreshIssue[];
  transitEstimates: RefreshTransitEstimate[];
  onDismiss: () => void;
  onApplySuggestion?: (issue: RefreshIssue) => void;
  className?: string;
}

const transitIcons: Record<string, React.ReactNode> = {
  walking: <Footprints className="h-3.5 w-3.5" />,
  transit: <Train className="h-3.5 w-3.5" />,
  taxi: <Car className="h-3.5 w-3.5" />,
};

export function RefreshDayPanel({ issues, transitEstimates, onDismiss, onApplySuggestion, className }: RefreshDayPanelProps) {
  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');
  const hasIssues = issues.length > 0;

  return (
    <div className={cn(
      "rounded-lg border p-4 space-y-3 animate-in slide-in-from-top-2 duration-300",
      hasIssues
        ? "bg-destructive/5 border-destructive/20"
        : "bg-primary/5 border-primary/20",
      className
    )}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasIssues ? (
            <AlertTriangle className="h-4 w-4 text-destructive" />
          ) : (
            <CheckCircle className="h-4 w-4 text-primary" />
          )}
          <span className="text-sm font-medium text-foreground">
            {hasIssues
              ? `${errors.length} error${errors.length !== 1 ? 's' : ''}, ${warnings.length} warning${warnings.length !== 1 ? 's' : ''} found`
              : 'Day looks good! No issues found.'}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={onDismiss} className="h-6 w-6 p-0">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Issues */}
      {hasIssues && (
        <div className="space-y-2">
          {[...errors, ...warnings].map((issue, i) => (
            <div
              key={`${issue.activityId}-${i}`}
              className={cn(
                "flex items-start gap-2 p-2.5 rounded-md text-xs",
                issue.severity === 'error'
                  ? "bg-destructive/10 border border-destructive/20"
                  : "bg-accent/10 border border-accent/20"
              )}
            >
              <AlertTriangle className={cn(
                "h-3.5 w-3.5 shrink-0 mt-0.5",
                issue.severity === 'error' ? "text-destructive" : "text-accent"
              )} />
              <div className="flex-1 min-w-0 space-y-1">
                <p className="text-foreground leading-relaxed">{issue.message}</p>
                {issue.suggestion && (
                  <div className="flex items-center gap-2">
                    <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                    <p className="text-muted-foreground italic">{issue.suggestion}</p>
                    {onApplySuggestion && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-2 text-[10px] font-medium text-primary hover:text-primary"
                        onClick={() => onApplySuggestion(issue)}
                      >
                        Apply
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Transit summary */}
      {transitEstimates.length > 0 && (
        <div className="space-y-1.5 pt-1 border-t border-border/50">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Transit Between Activities</p>
          <div className="flex flex-wrap gap-2">
            {transitEstimates.map((te, i) => (
              <div
                key={`${te.fromId}-${te.toId}`}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary/50 border border-border/30 text-xs text-muted-foreground"
              >
                {transitIcons[te.method] || <Clock className="h-3 w-3" />}
                <span className="capitalize">{te.method}</span>
                <ArrowRight className="h-2.5 w-2.5" />
                <span>{te.durationMinutes} min</span>
                <span className="text-muted-foreground/50">({te.distance})</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default RefreshDayPanel;
