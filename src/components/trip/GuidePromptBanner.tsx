/**
 * GuidePromptBanner — CTA shown on past trips to build a travel guide.
 * Shows different states based on favorites count and existing guide status.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, Sparkles, Bookmark, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useGuideFavoritesCount, useCommunityGuideForTrip } from '@/hooks/useGuideFavorites';

interface GuidePromptBannerProps {
  tripId: string;
  destination: string;
}

export function GuidePromptBanner({ tripId, destination }: GuidePromptBannerProps) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);
  const { data: favCount = 0, isLoading: favLoading } = useGuideFavoritesCount(tripId);
  const { data: guide, isLoading: guideLoading } = useCommunityGuideForTrip(tripId);

  if (dismissed || favLoading || guideLoading) return null;

  const hasFavorites = favCount > 0;
  const hasDraft = guide?.status === 'draft';
  const hasPublished = guide?.status === 'published';

  // Published guide — link to view
  if (hasPublished) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5 mb-6">
        <DismissButton onDismiss={() => setDismissed(true)} />
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold">Your {destination} Guide is Live!</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              Share your travel guide with friends and the community.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 gap-1.5 text-xs h-8"
              onClick={() => navigate(`/community-guide/${guide?.slug}`)}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View Your Published Guide
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Draft exists — continue building
  if (hasDraft) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5 mb-6">
        <DismissButton onDismiss={() => setDismissed(true)} />
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold">Continue Building Your Guide</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {favCount} favorite{favCount !== 1 ? 's' : ''} selected. Pick up where you left off.
            </p>
            <Button
              size="sm"
              className="mt-3 gap-1.5 text-xs h-8"
              onClick={() => navigate(`/trip/${tripId}/guide`)}
            >
              <BookOpen className="h-3.5 w-3.5" />
              Continue Building Guide
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Has favorites — prompt to build
  if (hasFavorites) {
    return (
      <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-primary/5 p-4 sm:p-5 mb-6">
        <DismissButton onDismiss={() => setDismissed(true)} />
        <div className="flex items-start gap-3">
          <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-4.5 w-4.5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold">Build Your Travel Guide</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              {favCount} favorite{favCount !== 1 ? 's' : ''} selected — compile them into a shareable guide.
            </p>
            <Button
              size="sm"
              className="mt-3 gap-1.5 text-xs h-8"
              onClick={() => navigate(`/trip/${tripId}/guide`)}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Build My Guide
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // No favorites — soft instructional CTA
  return (
    <div className="relative overflow-hidden rounded-xl border border-dashed border-border bg-muted/30 p-4 sm:p-5 mb-6">
      <DismissButton onDismiss={() => setDismissed(true)} />
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
          <Bookmark className="h-4.5 w-4.5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-muted-foreground">Create a Travel Guide</h4>
          <p className="text-xs text-muted-foreground/80 mt-0.5">
            Bookmark your favorite activities to build a shareable travel guide from this trip.
          </p>
        </div>
      </div>
    </div>
  );
}

function DismissButton({ onDismiss }: { onDismiss: () => void }) {
  return (
    <button
      onClick={onDismiss}
      className="absolute top-2 right-2 p-1 rounded-md hover:bg-muted/50 text-muted-foreground/50 hover:text-muted-foreground transition-colors"
      aria-label="Dismiss"
    >
      <ChevronUp className="h-3.5 w-3.5" />
    </button>
  );
}
