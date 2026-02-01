/**
 * JourneyAwareCTA - Simple CTA that adapts based on user's journey stage
 * No urgency styling, no nagging - just the right next step
 */

import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
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
  /** Additional className */
  className?: string;
  /** Button variant */
  variant?: 'default' | 'outline' | 'ghost' | 'hero';
}

export function JourneyAwareCTA({
  magnetic = false,
  size = 'default',
  overrideHref,
  overrideLabel,
  showArrow = false,
  className,
  variant = 'default',
}: JourneyAwareCTAProps) {
  const getSuggestedNextStep = useJourneyStore(state => state.getSuggestedNextStep);
  const nextStep = getSuggestedNextStep();

  const href = overrideHref || nextStep.href;
  const label = overrideLabel || nextStep.label;

  const ButtonComponent = magnetic ? MagneticButton : Button;

  return (
    <ButtonComponent
      asChild
      variant={variant}
      size={size}
      className={cn('gap-2', className)}
    >
      <Link to={href}>
        {label}
        {showArrow && <ArrowRight className="h-4 w-4" />}
      </Link>
    </ButtonComponent>
  );
}

// Inline version for nav
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
      </Link>
    </Button>
  );
}
