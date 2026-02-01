/**
 * EmptyState - Simple empty states without chatty companion notes
 * Just clear, helpful information
 */

import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { 
  Briefcase, 
  Heart, 
  Search, 
  Map, 
  Calendar,
  Sparkles,
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
  | 'custom';

interface EmptyStateConfig {
  icon: LucideIcon;
  headline: string;
  body: string;
  cta?: {
    label: string;
    href: string;
  };
}

const presets: Record<Exclude<EmptyStateType, 'custom'>, EmptyStateConfig> = {
  'no-trips': {
    icon: Briefcase,
    headline: 'No trips yet',
    body: 'Plan your first trip to get started.',
    cta: { label: 'Plan a trip', href: '/start' },
  },
  'no-results': {
    icon: Search,
    headline: 'No results',
    body: 'Try adjusting your search.',
  },
  'no-favorites': {
    icon: Heart,
    headline: 'No favorites',
    body: 'Save destinations you like to see them here.',
    cta: { label: 'Explore', href: '/destinations' },
  },
  'no-destinations': {
    icon: Map,
    headline: 'No destinations',
    body: 'Browse destinations to find your next trip.',
    cta: { label: 'Browse', href: '/destinations' },
  },
  'no-upcoming': {
    icon: Calendar,
    headline: 'No upcoming trips',
    body: 'Plan something new?',
    cta: { label: 'Start planning', href: '/start' },
  },
};

interface EmptyStateProps {
  type: EmptyStateType;
  icon?: LucideIcon;
  headline?: string;
  body?: string;
  cta?: { label: string; href: string } | null;
  illustration?: ReactNode;
  className?: string;
}

export function EmptyState({
  type,
  icon: customIcon,
  headline: customHeadline,
  body: customBody,
  cta: customCta,
  illustration,
  className,
}: EmptyStateProps) {
  const preset = type !== 'custom' ? presets[type] : null;
  
  const Icon = customIcon || preset?.icon || Sparkles;
  const headline = customHeadline || preset?.headline || 'Nothing here';
  const body = customBody || preset?.body || '';
  const cta = customCta === null ? undefined : (customCta || preset?.cta);

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-16 text-center px-4',
        className
      )}
    >
      {/* Icon/Illustration */}
      <div className="mb-6">
        {illustration || (
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
            <Icon className="w-6 h-6 text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Content */}
      <h3 className="text-base font-medium text-foreground mb-1">
        {headline}
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-6">
        {body}
      </p>

      {/* CTA */}
      {cta && (
        <Button asChild size="sm" variant="outline">
          <Link to={cta.href}>
            {cta.label}
          </Link>
        </Button>
      )}
    </div>
  );
}
