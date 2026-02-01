/**
 * PageTransition - Smooth fade/slide transitions between routes
 * Wraps route content to provide enter/exit animations
 */

import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useLocation } from 'react-router-dom';

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

export function PageTransition({
  children,
  variant = 'slide',
  duration = 0.3,
}: PageTransitionProps) {
  const location = useLocation();
  const motionVariant = variants[variant];

  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;

  if (prefersReducedMotion) {
    return <>{children}</>;
  }

  return (
    <motion.div
      key={location.pathname}
      initial={motionVariant.initial}
      animate={motionVariant.animate}
      exit={motionVariant.exit}
      transition={{ 
        duration, 
        ease: [0.25, 0.1, 0.25, 1], // Custom easing
      }}
    >
      {children}
    </motion.div>
  );
}

// Provider component for wrapping the entire routes section
export function PageTransitionProvider({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}
