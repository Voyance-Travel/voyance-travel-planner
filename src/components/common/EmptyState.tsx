/**
 * EmptyState - Warm, characterful empty states with optional animation
 * Replaces cold "no data" messages with personality
 */

import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Briefcase, 
  Heart, 
  Search, 
  Map, 
  Compass,
  Sparkles,
  Calendar,
  type LucideIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type EmptyStateType = 
  | 'no-trips' 
  | 'no-results' 
  | 'no-favorites' 
  | 'no-destinations'
  | 'no-upcoming'
  | 'quiz-incomplete'
  | 'custom';

interface EmptyStateConfig {
  icon: LucideIcon;
  headline: string;
  body: string;
  companionNote?: string;
  cta?: {
    label: string;
    href: string;
  };
}

const presets: Record<Exclude<EmptyStateType, 'custom'>, EmptyStateConfig> = {
  'no-trips': {
    icon: Briefcase,
    headline: 'No trips yet',
    body: 'Your travel story starts with the first one.',
    companionNote: "We're ready when you are.",
    cta: { label: 'Plan your first trip', href: '/start' },
  },
  'no-results': {
    icon: Search,
    headline: 'Nothing here',
    body: 'Try different search terms?',
    companionNote: 'The good stuff is out there.',
  },
  'no-favorites': {
    icon: Heart,
    headline: 'No favorites yet',
    body: 'When you find something you love, save it here.',
    companionNote: 'Start exploring.',
    cta: { label: 'Explore destinations', href: '/destinations' },
  },
  'no-destinations': {
    icon: Map,
    headline: 'No destinations saved',
    body: 'Your bucket list starts here.',
    companionNote: 'Where do you want to go?',
    cta: { label: 'Browse destinations', href: '/destinations' },
  },
  'no-upcoming': {
    icon: Calendar,
    headline: 'No upcoming trips',
    body: 'Time to plan something?',
    companionNote: "Adventure awaits.",
    cta: { label: 'Start planning', href: '/start' },
  },
  'quiz-incomplete': {
    icon: Compass,
    headline: "We don't know you yet",
    body: 'Take the quiz so we can plan trips that actually fit you.',
    companionNote: '4 minutes. Changes everything.',
    cta: { label: 'Take the quiz', href: '/quiz' },
  },
};

interface EmptyStateProps {
  /** Preset type or 'custom' for full control */
  type: EmptyStateType;
  /** Custom icon (only for type='custom') */
  icon?: LucideIcon;
  /** Custom headline (overrides preset) */
  headline?: string;
  /** Custom body text (overrides preset) */
  body?: string;
  /** Custom companion note (overrides preset) */
  companionNote?: string;
  /** Custom CTA (overrides preset) */
  cta?: { label: string; href: string } | null;
  /** Custom illustration instead of icon */
  illustration?: ReactNode;
  /** Additional className */
  className?: string;
  /** Disable floating animation */
  disableAnimation?: boolean;
}

export function EmptyState({
  type,
  icon: customIcon,
  headline: customHeadline,
  body: customBody,
  companionNote: customCompanionNote,
  cta: customCta,
  illustration,
  className,
  disableAnimation = false,
}: EmptyStateProps) {
  const preset = type !== 'custom' ? presets[type] : null;
  
  const Icon = customIcon || preset?.icon || Sparkles;
  const headline = customHeadline || preset?.headline || 'Nothing here';
  const body = customBody || preset?.body || '';
  const companionNote = customCompanionNote ?? preset?.companionNote;
  const cta = customCta === null ? undefined : (customCta || preset?.cta);

  // Check for reduced motion
  const prefersReducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  const shouldAnimate = !disableAnimation && !prefersReducedMotion;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        'flex flex-col items-center justify-center py-16 text-center px-4',
        className
      )}
    >
      {/* Icon/Illustration */}
      <motion.div
        animate={shouldAnimate ? { y: [0, -8, 0] } : {}}
        transition={{ 
          duration: 3, 
          repeat: Infinity, 
          ease: 'easeInOut' 
        }}
        className="mb-6"
      >
        {illustration || (
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <Icon className="w-8 h-8 text-muted-foreground" />
          </div>
        )}
      </motion.div>

      {/* Content */}
      <h3 className="text-lg font-semibold text-foreground mb-2">
        {headline}
      </h3>
      <p className="text-muted-foreground max-w-sm mb-6">
        {body}
      </p>

      {/* CTA */}
      {cta && (
        <Button asChild className="mb-4">
          <Link to={cta.href}>
            {cta.label}
          </Link>
        </Button>
      )}

      {/* Companion note */}
      {companionNote && (
        <p className="text-sm text-muted-foreground/70 italic">
          {companionNote}
        </p>
      )}
    </motion.div>
  );
}
