/**
 * QuietHelpButton - Simple help button that waits for the user
 * No auto-opening, no nagging - just available when needed
 */

import { useState } from 'react';
import { HelpCircle, X, ExternalLink } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface HelpLink {
  label: string;
  href: string;
  external?: boolean;
}

interface QuietHelpButtonProps {
  /** Page-specific help links */
  links?: HelpLink[];
  /** Position */
  position?: 'bottom-right' | 'bottom-left';
  /** Additional class */
  className?: string;
}

const defaultLinks: HelpLink[] = [
  { label: 'How it works', href: '/how-it-works' },
  { label: 'FAQs', href: '/faq' },
];

export function QuietHelpButton({
  links = defaultLinks,
  position = 'bottom-right',
  className,
}: QuietHelpButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const positionClass = position === 'bottom-right' 
    ? 'right-4 bottom-4' 
    : 'left-4 bottom-4';

  return (
    <div className={cn('fixed z-40', positionClass, className)}>
      {/* Help panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute bottom-14 bg-popover border border-border rounded-lg shadow-lg p-3 min-w-48',
              position === 'bottom-right' ? 'right-0' : 'left-0'
            )}
          >
            <div className="flex items-center justify-between mb-2 pb-2 border-b border-border">
              <span className="text-sm font-medium">Help</span>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
            
            <div className="space-y-1">
              {links.map((link) => (
                link.external ? (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground py-1.5 px-2 rounded hover:bg-muted transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    {link.label}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <Link
                    key={link.href}
                    to={link.href}
                    className="flex items-center text-sm text-muted-foreground hover:text-foreground py-1.5 px-2 rounded hover:bg-muted transition-colors"
                    onClick={() => setIsOpen(false)}
                  >
                    {link.label}
                  </Link>
                )
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Help button */}
      <Button
        variant="outline"
        size="icon"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'h-10 w-10 rounded-full shadow-md bg-background',
          isOpen && 'bg-muted'
        )}
        aria-label="Help"
      >
        <HelpCircle className="h-4 w-4" />
      </Button>
    </div>
  );
}
