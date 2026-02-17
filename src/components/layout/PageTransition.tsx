/**
 * PageTransition - Renders route content directly without opacity animations
 * Previous fade animation caused elements to get stuck at partial opacity
 */

import { ReactNode, forwardRef } from 'react';

interface PageTransitionProps {
  children: ReactNode;
  variant?: 'fade' | 'slide';
  duration?: number;
}

export const PageTransition = forwardRef<HTMLDivElement, PageTransitionProps>(function PageTransition(
  { children }: PageTransitionProps,
  ref
) {
  return <div ref={ref}>{children}</div>;
});

// Provider component for wrapping the entire routes section
export function PageTransitionProvider({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      {children}
    </div>
  );
}
