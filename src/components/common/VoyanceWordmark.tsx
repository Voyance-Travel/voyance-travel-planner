import { forwardRef } from 'react';
import { cn } from '@/lib/utils';

interface VoyanceWordmarkProps {
  variant?: 'default' | 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Creative VOYANCE wordmark with:
 * - Accent on the V (larger, serif, primary color)
 * - Mixed typography (V is serif display, rest is elegant sans)
 * - Stylized letter spacing for luxury magazine feel
 */
export const VoyanceWordmark = forwardRef<HTMLSpanElement, VoyanceWordmarkProps>(
  function VoyanceWordmark({ 
    variant = 'default', 
    size = 'md',
    className 
  }, ref) {
    const sizeClasses = {
      sm: {
        v: 'text-xl',
        rest: 'text-sm tracking-[0.25em]',
        gap: 'gap-0.5'
      },
      md: {
        v: 'text-2xl',
        rest: 'text-base tracking-[0.2em]',
        gap: 'gap-1'
      },
      lg: {
        v: 'text-4xl',
        rest: 'text-xl tracking-[0.25em]',
        gap: 'gap-1.5'
      }
    };

    const variantClasses = {
      default: {
        v: 'text-primary',
        rest: 'text-foreground'
      },
      light: {
        v: 'text-white',
        rest: 'text-white/90'
      },
      dark: {
        v: 'text-primary',
        rest: 'text-foreground'
      }
    };

    const { v: vSize, rest: restSize, gap } = sizeClasses[size];
    const { v: vColor, rest: restColor } = variantClasses[variant];

    return (
      <span ref={ref} className={cn('inline-flex items-baseline', gap, className)}>
        {/* Accent V - Serif, larger, primary color */}
        <span 
          className={cn(
            'font-serif font-bold leading-none transition-colors',
            vSize,
            vColor
          )}
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          V
        </span>
        {/* OYANCE - Elegant sans, spaced, lighter weight */}
        <span 
          className={cn(
            'font-display font-medium uppercase leading-none transition-colors',
            restSize,
            restColor
          )}
        >
          oyance
        </span>
      </span>
    );
  }
);

export default VoyanceWordmark;
