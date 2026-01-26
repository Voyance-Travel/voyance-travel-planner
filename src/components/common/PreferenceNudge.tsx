/**
 * PreferenceNudge - Encourages users to complete preferences for better personalization
 * 
 * Three variants:
 * - banner: Collapsible banner for trip/profile pages
 * - card: Full card with progress ring for pre-generation
 * - inline: Compact inline notice
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, 
  ChevronRight, 
  ChevronDown, 
  AlertCircle, 
  CheckCircle2, 
  Target,
  Utensils,
  Compass,
  Wallet,
  Zap,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useNavigate } from 'react-router-dom';
import { usePreferenceCompletion, MissingItem, PreferenceStatus } from '@/hooks/usePreferenceCompletion';
import { cn } from '@/lib/utils';

interface PreferenceNudgeProps {
  variant?: 'banner' | 'card' | 'inline';
  onDismiss?: () => void;
  onProceedAnyway?: () => void;
  showProceedButton?: boolean;
  className?: string;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  quiz: <Target className="h-4 w-4" />,
  dietary: <Utensils className="h-4 w-4" />,
  pace: <Zap className="h-4 w-4" />,
  interests: <Compass className="h-4 w-4" />,
  budget: <Wallet className="h-4 w-4" />,
};

const LEVEL_CONFIG = {
  none: {
    color: 'text-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    label: 'No personalization',
    description: 'Your itinerary will be generic. Complete the quiz for personalized recommendations.',
  },
  basic: {
    color: 'text-amber-600',
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800',
    label: 'Basic personalization',
    description: 'Add more preferences to unlock better recommendations.',
  },
  good: {
    color: 'text-blue-600',
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800',
    label: 'Good personalization',
    description: 'Your itinerary will reflect your travel style.',
  },
  excellent: {
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800',
    label: 'Excellent personalization',
    description: 'You\'ll get the most tailored experience possible!',
  },
};

function ConfidenceRing({ confidence, size = 64 }: { confidence: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (confidence / 100) * circumference;
  
  const getColor = () => {
    if (confidence >= 70) return 'text-emerald-500';
    if (confidence >= 50) return 'text-blue-500';
    if (confidence >= 30) return 'text-amber-500';
    return 'text-red-500';
  };

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90" width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          className="text-muted/20"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - progress}
          className={cn('transition-all duration-700', getColor())}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn('text-sm font-semibold', getColor())}>
          {confidence}%
        </span>
      </div>
    </div>
  );
}

function MissingItemRow({ item, onClick }: { item: MissingItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/60 transition-colors text-left group border border-transparent hover:border-border"
    >
      <div className={cn(
        'p-2 rounded-md',
        item.impact === 'high' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
        'bg-primary/10 text-primary'
      )}>
        {ICON_MAP[item.id] || <Target className="h-4 w-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.label}</p>
        <p className="text-xs text-muted-foreground truncate">{item.description}</p>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all flex-shrink-0" />
    </button>
  );
}

export function PreferenceNudge({ 
  variant = 'card', 
  onDismiss, 
  onProceedAnyway,
  showProceedButton = false,
  className 
}: PreferenceNudgeProps) {
  const navigate = useNavigate();
  const { data: status, isLoading } = usePreferenceCompletion();
  const [isExpanded, setIsExpanded] = useState(variant === 'card');
  const [isDismissed, setIsDismissed] = useState(false);

  if (isLoading || !status) return null;
  
  // Don't show if excellent personalization or dismissed
  if (status.personalizationLevel === 'excellent' || isDismissed) return null;

  const config = LEVEL_CONFIG[status.personalizationLevel];
  const highImpactItems = status.missingItems.filter(i => i.impact === 'high');

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  const handleItemClick = (item: MissingItem) => {
    navigate(item.action);
  };

  // Inline variant - minimal
  if (variant === 'inline') {
    if (status.personalizationLevel === 'good') return null;
    
    return (
      <div className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm',
        config.bg,
        config.border,
        'border',
        className
      )}>
        <AlertCircle className={cn('h-4 w-4 flex-shrink-0', config.color)} />
        <span className="text-muted-foreground">
          {highImpactItems[0] ? (
            <>
              <button 
                onClick={() => handleItemClick(highImpactItems[0])}
                className={cn('font-medium hover:underline', config.color)}
              >
                Add {highImpactItems[0].label.toLowerCase()}
              </button>
              {' '}for better recommendations
            </>
          ) : (
            config.description
          )}
        </span>
      </div>
    );
  }

  // Banner variant - collapsible
  if (variant === 'banner') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn(
          'rounded-xl border overflow-hidden',
          config.bg,
          config.border,
          className
        )}
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center gap-3 p-4 text-left"
        >
          <div className={cn('p-2 rounded-lg', config.bg)}>
            <Sparkles className={cn('h-5 w-5', config.color)} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className={cn('font-medium', config.color)}>{config.label}</span>
              <Badge variant="outline" className="text-xs">
                {status.confidence}% confidence
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {status.missingItems.length > 0 
                ? `${status.missingItems.length} item${status.missingItems.length > 1 ? 's' : ''} to complete`
                : config.description
              }
            </p>
          </div>
          <ChevronDown className={cn(
            'h-5 w-5 text-muted-foreground transition-transform',
            isExpanded && 'rotate-180'
          )} />
          {onDismiss && (
            <button 
              onClick={(e) => { e.stopPropagation(); handleDismiss(); }}
              className="p-1 hover:bg-muted/50 rounded"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </button>

        <AnimatePresence>
          {isExpanded && status.missingItems.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-1">
                {status.missingItems.slice(0, 3).map(item => (
                  <MissingItemRow 
                    key={item.id} 
                    item={item} 
                    onClick={() => handleItemClick(item)} 
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  // Card variant - full with confidence ring (for pre-generation)
  return (
    <Card className={cn('overflow-hidden', config.border, className)}>
      <CardContent className="p-6">
        <div className="flex items-start gap-6">
          {/* Personalization Ring - shows completion percent */}
          <div className="flex-shrink-0">
            <ConfidenceRing confidence={status.completionPercent} size={72} />
            <p className="text-xs text-center text-muted-foreground mt-1">
              Personalization
            </p>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {status.personalizationLevel === 'none' || status.personalizationLevel === 'basic' ? (
                <AlertCircle className={cn('h-5 w-5', config.color)} />
              ) : (
                <CheckCircle2 className={cn('h-5 w-5', config.color)} />
              )}
              <h3 className={cn('font-semibold', config.color)}>{config.label}</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              {config.description}
            </p>

            {/* Missing items */}
            {status.missingItems.length > 0 && (
              <div className="space-y-1 mb-4">
                {status.missingItems.slice(0, 3).map(item => (
                  <MissingItemRow 
                    key={item.id} 
                    item={item} 
                    onClick={() => handleItemClick(item)} 
                  />
                ))}
              </div>
            )}

            {/* Progress bar */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Profile completion</span>
                <span>{status.completionPercent}%</span>
              </div>
              <Progress value={status.completionPercent} className="h-1.5" />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-3">
              {highImpactItems[0] && (
                <Button 
                  size="sm"
                  onClick={() => handleItemClick(highImpactItems[0])}
                  className="gap-2"
                >
                  <Sparkles className="h-4 w-4" />
                  {highImpactItems[0].id === 'quiz' ? 'Take Quiz' : `Add ${highImpactItems[0].label}`}
                </Button>
              )}
              {showProceedButton && onProceedAnyway && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={onProceedAnyway}
                  className="text-muted-foreground"
                >
                  Proceed anyway
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export { usePreferenceCompletion };
export type { PreferenceStatus, MissingItem };
