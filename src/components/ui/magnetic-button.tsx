/**
 * MagneticButton - Button that subtly moves toward cursor on hover
 * Creates a feeling that the UI is alive and responsive
 */

import { useRef, useState, ReactNode, MouseEvent } from 'react';
import { motion } from 'framer-motion';
import { Button, ButtonProps } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MagneticButtonProps extends ButtonProps {
  children: ReactNode;
  /** How much the button moves toward cursor (0-1, default 0.15) */
  strength?: number;
  /** Disable magnetic effect but keep button functional */
  disableMagnetic?: boolean;
}

export function MagneticButton({
  children,
  strength = 0.15,
  disableMagnetic = false,
  className,
  ...props
}: MagneticButtonProps) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  // Check for reduced motion preference
  const prefersReducedMotion = typeof window !== 'undefined' 
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches 
    : false;

  const handleMouseMove = (e: MouseEvent<HTMLButtonElement>) => {
    if (disableMagnetic || prefersReducedMotion) return;
    
    const button = buttonRef.current;
    if (!button) return;

    const rect = button.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    // Calculate distance from center and apply strength
    const deltaX = (e.clientX - centerX) * strength;
    const deltaY = (e.clientY - centerY) * strength;

    setPosition({ x: deltaX, y: deltaY });
  };

  const handleMouseEnter = () => {
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setPosition({ x: 0, y: 0 });
  };

  // If magnetic is disabled or reduced motion, render normal button
  if (disableMagnetic || prefersReducedMotion) {
    return (
      <Button className={className} {...props}>
        {children}
      </Button>
    );
  }

  return (
    <motion.div
      animate={{ x: position.x, y: position.y }}
      transition={{ 
        type: 'spring', 
        stiffness: 350, 
        damping: 20,
        mass: 0.5,
      }}
      className="inline-block"
    >
      <Button
        ref={buttonRef}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={cn(
          'transition-shadow duration-200',
          isHovered && 'shadow-lg',
          className
        )}
        {...props}
      >
        {children}
      </Button>
    </motion.div>
  );
}
