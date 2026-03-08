import { Heart, Share2 } from 'lucide-react';
import { useIsSaved, useToggleSaveDestination } from '@/hooks/useSaveDestination';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface DestinationCardActionsProps {
  itemId: string;
  city: string;
  country: string;
  region?: string;
  tagline?: string;
  imageUrl?: string;
}

export default function DestinationCardActions({
  itemId,
  city,
  country,
  region,
  tagline,
  imageUrl,
}: DestinationCardActionsProps) {
  const { data: isSaved } = useIsSaved(itemId);
  const toggleMutation = useToggleSaveDestination();

  const handleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleMutation.mutate({
      itemId,
      data: { city, country, region, tagline, imageUrl },
    });
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/destination/${itemId}`;
    const shareData = { title: `${city}, ${country}`, url };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard');
    }
  };

  return (
    <div className="absolute top-2 right-2 z-10 flex gap-1.5">
      <button
        onClick={handleFavorite}
        className="w-8 h-8 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center hover:bg-background/80 transition-colors border border-border/30"
        aria-label={isSaved ? 'Remove from favorites' : 'Add to favorites'}
      >
        <Heart
          className={cn(
            'h-4 w-4 transition-colors',
            isSaved ? 'fill-red-500 text-red-500' : 'text-white'
          )}
        />
      </button>
      <button
        onClick={handleShare}
        className="w-8 h-8 rounded-full bg-background/60 backdrop-blur-sm flex items-center justify-center hover:bg-background/80 transition-colors border border-border/30"
        aria-label="Share destination"
      >
        <Share2 className="h-4 w-4 text-white" />
      </button>
    </div>
  );
}
