/**
 * StoryProgress - Right-side scroll progress indicator
 * Shows section dots with labels, highlights current section
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface Section {
  id: string;
  label: string;
}

interface StoryProgressProps {
  sections: Section[];
  className?: string;
}

export function StoryProgress({ sections, className }: StoryProgressProps) {
  const [currentSection, setCurrentSection] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Track scroll position and determine current section
  const handleScroll = useCallback(() => {
    const scrollPosition = window.scrollY + window.innerHeight / 3;
    
    for (let i = sections.length - 1; i >= 0; i--) {
      const element = document.getElementById(sections[i].id);
      if (element) {
        const { offsetTop } = element;
        if (scrollPosition >= offsetTop) {
          setCurrentSection(i);
          break;
        }
      }
    }
  }, [sections]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  const scrollToSection = (index: number) => {
    const element = document.getElementById(sections[index].id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Hide on mobile
  if (typeof window !== 'undefined' && window.innerWidth < 1024) {
    return null;
  }

  return (
    <div 
      className={cn(
        'fixed right-6 top-1/2 -translate-y-1/2 z-40',
        'hidden lg:flex flex-col items-end gap-3',
        className
      )}
    >
      {sections.map((section, index) => {
        const isActive = index === currentSection;
        const isHovered = index === hoveredIndex;
        const isPast = index < currentSection;

        return (
          <button
            key={section.id}
            onClick={() => scrollToSection(index)}
            onMouseEnter={() => setHoveredIndex(index)}
            onMouseLeave={() => setHoveredIndex(null)}
            className={cn(
              'flex items-center gap-2 transition-all duration-200',
              isActive ? 'opacity-100' : 'opacity-40 hover:opacity-70'
            )}
            aria-label={`Jump to ${section.label}`}
          >
            {/* Label - shows on hover */}
            <AnimatePresence>
              {isHovered && (
                <motion.span
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  transition={{ duration: 0.15 }}
                  className={cn(
                    'text-xs font-medium whitespace-nowrap',
                    isActive ? 'text-primary' : 'text-muted-foreground'
                  )}
                >
                  {section.label}
                </motion.span>
              )}
            </AnimatePresence>

            {/* Dot */}
            <motion.div
              className={cn(
                'rounded-full transition-all duration-200',
                isActive 
                  ? 'w-2.5 h-2.5 bg-primary' 
                  : isPast 
                    ? 'w-2 h-2 bg-primary/50' 
                    : 'w-2 h-2 bg-muted-foreground/30'
              )}
              animate={isActive ? { scale: [1, 1.2, 1] } : { scale: 1 }}
              transition={{ duration: 0.3 }}
            />
          </button>
        );
      })}
    </div>
  );
}
