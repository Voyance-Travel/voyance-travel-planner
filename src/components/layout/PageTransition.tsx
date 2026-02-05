/**
 * PageTransition - Smooth fade/slide transitions between routes
 * Wraps route content to provide enter/exit animations
 */

import { ReactNode, forwardRef } from 'react';
import { motion } from 'framer-motion';

interface PageTransitionProps {
  children: ReactNode;
  /** Animation variant - 'fade' is subtle, 'slide' adds vertical movement */
  variant?: 'fade' | 'slide';
  /** Animation duration in seconds */
  duration?: number;
}

const variants = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slide: {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -8 },
  },
};

// NOTE: AnimatePresence attaches a ref to its direct children.
// Exporting PageTransition as a forwardRef component prevents React "function components cannot be given refs" warnings.
export const PageTransition = forwardRef<HTMLDivElement, PageTransitionProps>(function PageTransition(
  {
    children,
    variant = 'fade', // Changed default to 'fade' for better performance
    duration = 0.2, // Reduced duration for snappier feel
  }: PageTransitionProps,
  ref
) {
  const motionVariant = variants[variant];

  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  if (prefersReducedMotion) {
    return <div ref={ref}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      initial={motionVariant.initial}
      animate={motionVariant.animate}
      exit={motionVariant.exit}
      transition={{
        duration,
        ease: 'easeOut',
      }}
    >
      {children}
    </motion.div>
  );
});

// Provider component for wrapping the entire routes section
export function PageTransitionProvider({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}
