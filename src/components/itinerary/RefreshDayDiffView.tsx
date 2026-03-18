/**
 * RefreshDayDiffView — Shows proposed changes from a day refresh as a diff.
 * Supports Accept All, Review Each (cherry-pick), and Cancel modes.
 */

import { useState } from 'react';
import { CheckCircle, AlertTriangle, X, ChevronDown, ChevronUp, Clock, Timer, ArrowUpDown, Check, ArrowRight, ArrowRightLeft, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import type { ProposedChange, RefreshIssue, RefreshTransitEstimate } from '@/hooks/useRefreshDay';

// Map icon-name strings from edge function to Lucide components
const iconMap: Record<string, React.ReactNode> = {
  'clock': <Clock className="h-4 w-4" />,
  'alert-triangle': <AlertTriangle className="h-4 w-4" />,
  'timer': <Timer className="h-4 w-4" />,
  'arrow-up-down': <ArrowUpDown className="h-4 w-4" />,
  'arrow-right-left': <ArrowRightLeft className="h-4 w-4" />,
  'check': <Check className="h-4 w-4" />,
};

interface BufferInfo {
  fromId: string;
  fromTitle: string;
  toId: string;
  toTitle: string;
  bufferMinutes: number;
  requiredMinutes: number;
  isInsufficient: boolean;
}

interface RefreshDayDiffViewProps {
  dayNumber: number;
  proposedChanges: ProposedChange[];
  issues: RefreshIssue[];
  transitEstimates: RefreshTransitEstimate[];
  buffers?: BufferInfo[];
  onAcceptAll: (changes: ProposedChange[]) => void;
  onAcceptSelected: (changes: ProposedChange[]) => void;
  onDismiss: () => void;
  onFindAlternative?: (activityId: string, activityTitle: string) => void;
  className?: string;
}

export function RefreshDayDiffView({
  dayNumber,
  proposedChanges,
  issues,
  transitEstimates,
  buffers = [],
  onAcceptAll,
  onAcceptSelected,
  onDismiss,
  onFindAlternative,
  className,
}: RefreshDayDiffViewProps) {
  const actionableChanges = proposedChanges.filter(c => c.type !== 'no_change');
  const unchangedActivities = proposedChanges.filter(c => c.type === 'no_change');
  const hasActionableChanges = actionableChanges.length > 0;
  const hasIssues = hasActionableChanges || issues.length > 0 || buffers.filter(b => b.isInsufficient).length > 0;

  const [mode, setMode] = useState<'summary' | 'review'>('summary');
  const [accepted, setAccepted] = useState<Set<string>>(
    () => new Set(actionableChanges.map(c => c.id))
  );
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [showBuffers, setShowBuffers] = useState(true);

  const toggleChange = (id: string) => {
    setAccepted(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAcceptAll = () => {
    onAcceptAll(actionableChanges);
  };

  const handleAcceptSelected = () => {
    const selected = actionableChanges.filter(c => accepted.has(c.id));
    onAcceptSelected(selected);
  };

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warnCount = issues.filter(i => i.severity === 'warning').length;
  const insufficientBuffers = buffers.filter(b => b.isInsufficient).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className={cn(
        'rounded-xl border p-4 space-y-4',
        hasIssues
          ? 'bg-card border-border shadow-lg'
          : 'bg-primary/5 border-primary/20',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {hasIssues ? (
            <AlertTriangle className="h-4.5 w-4.5 text-destructive shrink-0" />
          ) : (
            <CheckCircle className="h-4.5 w-4.5 text-primary shrink-0" />
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate">
              Day {dayNumber}: {hasIssues ? (hasActionableChanges ? 'Proposed Changes' : 'Issues Found') : 'All Good'}
            </h3>
            {hasActionableChanges && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {actionableChanges.every(c => c.patch) 
                  ? 'All issues can be resolved — review the changes below'
                  : `${actionableChanges.length} change${actionableChanges.length !== 1 ? 's' : ''} suggested`}
                {errorCount > 0 && ` · ${errorCount} error${errorCount !== 1 ? 's' : ''}`}
                {warnCount > 0 && ` · ${warnCount} warning${warnCount !== 1 ? 's' : ''}`}
              </p>
            )}
            {!hasActionableChanges && hasIssues && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {insufficientBuffers > 0 && `${insufficientBuffers} buffer${insufficientBuffers !== 1 ? 's' : ''} too short`}
                {warnCount > 0 && `${insufficientBuffers > 0 ? ' · ' : ''}${warnCount} warning${warnCount !== 1 ? 's' : ''}`}
                {errorCount > 0 && ` · ${errorCount} error${errorCount !== 1 ? 's' : ''}`}
              </p>
            )}
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onDismiss} className="h-7 w-7 p-0 shrink-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* No changes needed */}
      {!hasActionableChanges && (
        <p className="text-sm text-muted-foreground">
          No timing issues or buffer problems detected. Your day looks great!
        </p>
      )}

      {/* Change list */}
      {hasActionableChanges && (
        <div className="space-y-2">
          {actionableChanges.map((change) => (
            <div
              key={change.id}
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg border text-sm transition-colors',
                mode === 'review'
                  ? accepted.has(change.id)
                    ? 'bg-primary/5 border-primary/20'
                    : 'bg-muted/30 border-border/50 opacity-60'
                  : 'bg-secondary/30 border-border/40'
              )}
            >
              {/* Checkbox in review mode */}
              {mode === 'review' && (
                <button
                  onClick={() => toggleChange(change.id)}
                  className={cn(
                    'mt-0.5 h-4.5 w-4.5 rounded border-2 shrink-0 flex items-center justify-center transition-colors',
                    accepted.has(change.id)
                      ? 'bg-primary border-primary'
                      : 'bg-transparent border-muted-foreground/40'
                  )}
                >
                  {accepted.has(change.id) && (
                    <CheckCircle className="h-3 w-3 text-primary-foreground" />
                  )}
                </button>
              )}

              {/* Icon — Lucide component instead of emoji */}
              <span className="shrink-0 mt-0.5 text-muted-foreground">
                {iconMap[change.icon] || <Clock className="h-4 w-4" />}
              </span>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-foreground leading-relaxed">{change.description}</p>
                {change.type === 'replacement' && onFindAlternative ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 h-7 gap-1.5 text-xs border-primary/30 text-primary hover:bg-primary/10"
                    onClick={(e) => {
                      e.stopPropagation();
                      onFindAlternative(change.activityId, change.activityTitle);
                    }}
                  >
                    <Search className="h-3 w-3" />
                    Find Alternative
                  </Button>
                ) : change.oldValue && change.newValue && change.type !== 'no_change' ? (
                  <div className="flex items-center gap-2 mt-1 text-xs">
                    <span className="text-destructive/70 line-through">{change.oldValue}</span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    <span className="text-primary font-medium">{change.newValue}</span>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Buffer summary */}
      {buffers.length > 0 && (
        <div>
          <button
            onClick={() => setShowBuffers(!showBuffers)}
            className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {showBuffers ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            <Timer className="h-3 w-3" />
            Buffers between activities
            {insufficientBuffers > 0 && (
              <span className="text-destructive">({insufficientBuffers} too short)</span>
            )}
          </button>
          <AnimatePresence>
            {showBuffers && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2 space-y-1">
                  {buffers.map((b, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs py-1 px-2">
                      <Clock className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground truncate">{b.fromTitle}</span>
                      <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground truncate">{b.toTitle}</span>
                      <span className={cn(
                        'font-medium ml-auto shrink-0',
                        b.isInsufficient ? 'text-destructive' : 'text-muted-foreground'
                      )}>
                        {b.bufferMinutes} min
                      </span>
                      {b.isInsufficient && (
                        <span className="text-destructive text-[10px] shrink-0">(need {b.requiredMinutes})</span>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Unchanged activities (collapsible) */}
      {unchangedActivities.length > 0 && (
        <div>
          <button
            onClick={() => setShowUnchanged(!showUnchanged)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {showUnchanged ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {unchangedActivities.length} activit{unchangedActivities.length !== 1 ? 'ies' : 'y'} unchanged
          </button>
          <AnimatePresence>
            {showUnchanged && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-2 space-y-1">
                  {unchangedActivities.map((c) => (
                    <div key={c.id} className="flex items-center gap-2 text-xs text-muted-foreground py-1 px-2">
                      <Check className="h-3 w-3 shrink-0" />
                      <span>{c.activityTitle}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Action buttons */}
      {hasActionableChanges && (
        <div className="flex items-center gap-2 pt-1 border-t border-border/50">
          {mode === 'summary' ? (
            <>
              <Button size="sm" onClick={handleAcceptAll} className="text-xs">
                Accept All
              </Button>
              <Button variant="outline" size="sm" onClick={() => setMode('review')} className="text-xs">
                Review Each
              </Button>
              <Button variant="ghost" size="sm" onClick={onDismiss} className="text-xs text-muted-foreground ml-auto">
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" onClick={handleAcceptSelected} disabled={accepted.size === 0} className="text-xs">
                Apply {accepted.size} Change{accepted.size !== 1 ? 's' : ''}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setMode('summary')} className="text-xs">
                Back
              </Button>
              <Button variant="ghost" size="sm" onClick={onDismiss} className="text-xs text-muted-foreground ml-auto">
                Cancel
              </Button>
            </>
          )}
        </div>
      )}
    </motion.div>
  );
}

export default RefreshDayDiffView;
