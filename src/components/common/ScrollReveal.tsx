/**
 * ScrollReveal - Progressive content appearance on scroll
 * Wraps content to animate in as user scrolls into view
 */

import { useRef, ReactNode } from 'react';
import { motion, useInView, Variants } from 'framer-motion';

interface ScrollRevealProps {
  children: ReactNode;
  /** Delay in seconds before animation starts */
  delay?: number;
  /** Animation direction - 'up' slides from below, 'down' from above, 'fade' just fades */
  direction?: 'up' | 'down' | 'fade' | 'left' | 'right';
  /** Distance to travel in pixels */
  distance?: number;
  /** Animation duration in seconds */
  duration?: number;
  /** Only animate once (default true) */
  once?: boolean;
  /** Custom className for the wrapper */
  className?: string;
}

const getVariants = (direction: string, distance: number): Variants => {
  const directions: Record<string, { x: number; y: number }> = {
    up: { x: 0, y: distance },
    down: { x: 0, y: -distance },
    left: { x: distance, y: 0 },
    right: { x: -distance, y: 0 },
    fade: { x: 0, y: 0 },
  };

  const { x, y } = directions[direction] || directions.up;

  return {
    hidden: { 
      opacity: 0, 
      x, 
      y,
    },
    visible: { 
      opacity: 1, 
      x: 0, 
      y: 0,
    },
  };
};

export default function ScrollReveal({
  children,
  delay = 0,
  direction = 'up',
  distance = 30,
  duration = 0.6,
  once = true,
  className = '',
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once, margin: '-100px 0px' });

  const variants = getVariants(direction, distance);

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? 'visible' : 'hidden'}
      variants={variants}
      transition={{
        duration,
        delay,
        ease: [0.25, 0.1, 0.25, 1], // Custom easing for smooth feel
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// Staggered children variant for lists/grids
export function ScrollRevealGroup({
  children,
  staggerDelay = 0.1,
  ...props
}: ScrollRevealProps & { staggerDelay?: number; children: ReactNode[] }) {
  return (
    <div className={props.className}>
      {Array.isArray(children) ? children.map((child, index) => (
        <ScrollReveal
          key={index}
          {...props}
          delay={(props.delay || 0) + index * staggerDelay}
          className=""
        >
          {child}
        </ScrollReveal>
      )) : children}
    </div>
  );
}
