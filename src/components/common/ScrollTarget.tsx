import { ReactNode } from 'react';

interface ScrollTargetProps {
  id: string;
  className?: string;
  children: ReactNode;
}

/**
 * Scroll target wrapper for smooth scrolling navigation
 */
export default function ScrollTarget({ id, className = '', children }: ScrollTargetProps) {
  return (
    <section id={id} className={className}>
      {children}
    </section>
  );
}
