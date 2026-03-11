/**
 * MobileStickyShareBar — fixed bottom bar on mobile for share/save actions.
 */
import { useState, useCallback } from 'react';
import { Link2, Share2, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAppUrl } from '@/utils/getAppUrl';
import { useSavedGuide } from '@/hooks/useSavedGuide';
import { cn } from '@/lib/utils';

interface MobileStickyShareBarProps {
  guideId: string;
  editorialTitle: string;
}

export default function MobileStickyShareBar({ guideId, editorialTitle }: MobileStickyShareBarProps) {
  const [copied, setCopied] = useState(false);
  const { isSaved, toggleSave } = useSavedGuide(guideId);
  const guideUrl = `${getAppUrl()}/community-guides/${guideId}`;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(guideUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  }, [guideUrl]);

  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: editorialTitle, url: guideUrl });
      } catch { /* cancelled */ }
    } else {
      handleCopy();
    }
  }, [editorialTitle, guideUrl, handleCopy]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden bg-background/95 backdrop-blur-sm border-t border-border pb-[env(safe-area-inset-bottom)] sticky-mobile-bar">
      <div className="flex items-center justify-center gap-4 px-4 py-2">
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={handleCopy}>
          <Link2 className="h-4 w-4" />
          {copied ? '✓' : 'Link'}
        </Button>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={handleShare}>
          <Share2 className="h-4 w-4" />
          Share
        </Button>
        <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={toggleSave}>
          <Heart className={cn('h-4 w-4', isSaved && 'fill-current text-primary')} />
          {isSaved ? 'Saved' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
