import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { getBrowseNudge, strangerCopy } from '@/lib/strangerCopy';
import { ROUTES } from '@/config/routes';

const NUDGE_STORAGE_KEY = 'voyance_nudge_dismissed';
const PAGES_VIEWED_KEY = 'voyance_pages_viewed';
const MAX_NUDGES_PER_SESSION = 3;

interface BrowseNudgeProps {
  viewedExample?: boolean;
}

export default function BrowseNudge({ viewedExample = false }: BrowseNudgeProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [nudgeMessage, setNudgeMessage] = useState<string | null>(null);

  useEffect(() => {
    // Check if user has already dismissed or taken quiz
    const dismissed = sessionStorage.getItem(NUDGE_STORAGE_KEY);
    if (dismissed) return;

    // Track page views
    const currentViews = parseInt(sessionStorage.getItem(PAGES_VIEWED_KEY) || '0', 10);
    const newViews = currentViews + 1;
    sessionStorage.setItem(PAGES_VIEWED_KEY, String(newViews));

    // Don't show on first page
    if (newViews < 2) return;

    // Limit nudges per session
    if (newViews > MAX_NUDGES_PER_SESSION + 1) return;

    // Get appropriate nudge message
    const message = getBrowseNudge(newViews, viewedExample);
    if (!message) return;

    // Delay showing nudge
    const timer = setTimeout(() => {
      setNudgeMessage(message);
      setIsVisible(true);
    }, 3000);

    return () => clearTimeout(timer);
  }, [viewedExample]);

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem(NUDGE_STORAGE_KEY, 'true');
  };

  return (
    <AnimatePresence>
      {isVisible && nudgeMessage && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 max-w-md w-[calc(100%-2rem)]"
        >
          <div className="bg-card border border-border rounded-2xl shadow-xl p-4 flex items-center gap-4">
            {/* Message */}
            <p className="flex-1 text-sm text-foreground font-sans">
              {nudgeMessage}
            </p>

            {/* CTA */}
            <Button asChild size="sm" className="shrink-0">
              <Link to={ROUTES.QUIZ}>
                {strangerCopy.browseNudges.cta}
                <ArrowRight className="ml-2 h-3 w-3" />
              </Link>
            </Button>

            {/* Dismiss */}
            <button
              onClick={handleDismiss}
              className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
