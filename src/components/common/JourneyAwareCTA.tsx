/**
 * JourneyAwareCTA - CTA button that adapts based on user's journey stage
 * Shows contextually appropriate action with urgency styling
 */

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { useJourneyStore } from '@/stores/journey-store';
import { Button } from '@/components/ui/button';
import { MagneticButton } from '@/components/ui/magnetic-button';
import { cn } from '@/lib/utils';

interface JourneyAwareCTAProps {
  /** Use magnetic button effect */
  magnetic?: boolean;
  /** Size variant */
  size?: 'sm' | 'default' | 'lg';
  /** Override the suggested action */
  overrideHref?: string;
  /** Override the label */
  overrideLabel?: string;
  /** Show arrow icon */
  showArrow?: boolean;
  /** Show sparkle icon */
  showSparkle?: boolean;
  /** Additional className */
  className?: string;
  /** Variant for transparent backgrounds */
  isTransparent?: boolean;
}

export function JourneyAwareCTA({
  magnetic = true,
  size = 'default',
  overrideHref,
  overrideLabel,
  showArrow = false,
  showSparkle = true,
  className,
  isTransparent = false,
}: JourneyAwareCTAProps) {
  const getSuggestedNextStep = useJourneyStore(state => state.getSuggestedNextStep);
  const nextStep = getSuggestedNextStep();

  const href = overrideHref || nextStep.href;
  const label = overrideLabel || nextStep.label;
  const priority = nextStep.priority;

  // Priority-based styling
  const priorityStyles = {
    low: 'variant-outline',
    medium: 'variant-default',
    high: 'variant-hero',
  };

  const getVariant = () => {
    if (isTransparent) return 'heroOutline';
    switch (priority) {
      case 'high': return 'hero';
      case 'medium': return 'default';
      case 'low': return 'outline';
      default: return 'default';
    }
  };

  const ButtonComponent = magnetic ? MagneticButton : Button;

  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: magnetic ? 1 : 1.02 }}
      transition={{ duration: 0.2 }}
    >
      <ButtonComponent
        asChild
        variant={getVariant()}
        size={size}
        className={cn(
          'gap-2',
          isTransparent && 'bg-white text-foreground hover:bg-white/90',
          className
        )}
      >
        <Link to={href}>
          {showSparkle && priority === 'high' && (
            <Sparkles className="h-4 w-4" />
          )}
          {label}
          {showArrow && <ArrowRight className="h-4 w-4" />}
        </Link>
      </ButtonComponent>
    </motion.div>
  );
}

// Simpler inline version without motion wrapper
export function JourneyAwareCTASimple({
  className,
  size = 'sm',
}: {
  className?: string;
  size?: 'sm' | 'default' | 'lg';
}) {
  const getSuggestedNextStep = useJourneyStore(state => state.getSuggestedNextStep);
  const nextStep = getSuggestedNextStep();

  return (
    <Button asChild size={size} className={className}>
      <Link to={nextStep.href}>
        {nextStep.label}
        <ArrowRight className="h-4 w-4 ml-1" />
      </Link>
    </Button>
  );
}
