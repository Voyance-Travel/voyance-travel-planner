/**
 * EditorialShareSection — share bar + save button for published editorial guides.
 */
import { useState, useCallback } from 'react';
import { Link2, ExternalLink, Heart, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { getAppUrl } from '@/utils/getAppUrl';
import { useSavedGuide } from '@/hooks/useSavedGuide';
import { cn } from '@/lib/utils';

interface EditorialShareSectionProps {
  guideId: string;
  editorialTitle: string;
}

export default function EditorialShareSection({ guideId, editorialTitle }: EditorialShareSectionProps) {
  const [copied, setCopied] = useState(false);
  const { isSaved, toggleSave } = useSavedGuide(guideId);

  const guideUrl = `${getAppUrl()}/community-guides/${guideId}`;

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(guideUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  }, [guideUrl]);

  const handleShareX = useCallback(() => {
    const text = encodeURIComponent(`"${editorialTitle}" - my travel guide on Voyance`);
    const url = encodeURIComponent(guideUrl);
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${url}`, '_blank', 'noopener');
  }, [editorialTitle, guideUrl]);

  const handleNativeShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: editorialTitle,
          text: `${editorialTitle} — a travel guide on Voyance`,
          url: guideUrl,
        });
      } catch {
        // user cancelled
      }
    } else {
      handleCopyLink();
    }
  }, [editorialTitle, guideUrl, handleCopyLink]);

  const supportsNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <div className="mt-12 pt-8 border-t border-border share-section">
      <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-4">
        Share this guide
      </p>

      <div className="flex flex-wrap items-center gap-3">
        {/* On mobile with native share: single Share button */}
        {supportsNativeShare && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2 text-sm md:hidden"
            onClick={handleNativeShare}
          >
            <Share2 className="h-4 w-4" />
            Share
          </Button>
        )}

        {/* Desktop / fallback buttons */}
        <Button
          variant="outline"
          size="sm"
          className={cn('gap-2 text-sm', supportsNativeShare && 'hidden md:inline-flex')}
          onClick={handleCopyLink}
        >
          <Link2 className="h-4 w-4" />
          {copied ? '✓ Link Copied!' : 'Copy Link'}
        </Button>

        <Button
          variant="outline"
          size="sm"
          className={cn('gap-2 text-sm', supportsNativeShare && 'hidden md:inline-flex')}
          onClick={handleShareX}
        >
          <ExternalLink className="h-4 w-4" />
          Share on X
        </Button>
      </div>

      {/* Save button */}
      <div className="mt-4">
        <Button
          variant={isSaved ? 'default' : 'outline'}
          size="sm"
          className="gap-2 text-sm"
          onClick={toggleSave}
        >
          <Heart className={cn('h-4 w-4', isSaved && 'fill-current')} />
          {isSaved ? 'Saved' : 'Save Guide'}
        </Button>
      </div>
    </div>
  );
}
