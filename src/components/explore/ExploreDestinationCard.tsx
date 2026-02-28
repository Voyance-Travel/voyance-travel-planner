import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Heart, Share2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import DestinationHeroImage from '@/components/common/DestinationHeroImage';
import SafeImage from '@/components/SafeImage';
import { supabase } from '@/integrations/supabase/client';
import type { HybridDestination } from '@/hooks/useHybridDestinationSearch';

interface ExploreDestinationCardProps {
  destination: HybridDestination;
  index: number;
  onClick: (destination: HybridDestination) => void;
}

export default function ExploreDestinationCard({ destination, index, onClick }: ExploreDestinationCardProps) {
  const [isFavorited, setIsFavorited] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleFavorite = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Sign in to save favorites');
      return;
    }

    setIsSaving(true);
    try {
      if (isFavorited) {
        await supabase
          .from('saved_items')
          .delete()
          .eq('user_id', user.id)
          .eq('item_type', 'destination')
          .eq('item_id', destination.id);
        setIsFavorited(false);
        toast.success('Removed from favorites');
      } else {
        await supabase
          .from('saved_items')
          .upsert({
            user_id: user.id,
            item_type: 'destination',
            item_id: destination.id,
            item_data: {
              city: destination.city,
              country: destination.country,
              region: destination.region,
              tagline: destination.tagline,
              imageUrl: destination.imageUrl,
            },
          });
        setIsFavorited(true);
        toast.success(`${destination.city} saved to favorites`);
      }
    } catch {
      toast.error('Something went wrong');
    } finally {
      setIsSaving(false);
    }
  }, [destination, isFavorited]);

  const handleShare = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const slug = destination.source === 'featured'
      ? destination.id
      : destination.city.toLowerCase().replace(/\s+/g, '-');
    const url = `${window.location.origin}/destination/${slug}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `${destination.city}, ${destination.country}`,
          text: destination.tagline,
          url,
        });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied to clipboard');
    }
  }, [destination]);

  // Check if user has favorited this on mount
  useState(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('saved_items')
        .select('id')
        .eq('user_id', user.id)
        .eq('item_type', 'destination')
        .eq('item_id', destination.id)
        .maybeSingle();
      if (data) setIsFavorited(true);
    })();
  });

  const hasDirectImage = !!destination.imageUrl;

  return (
    <motion.div
      key={destination.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="group cursor-pointer"
      onClick={() => onClick(destination)}
    >
      <div className="relative aspect-[4/3] rounded-xl overflow-hidden mb-3">
        {/* Image: use direct URL if available, otherwise DestinationHeroImage */}
        {hasDirectImage ? (
          <SafeImage
            src={destination.imageUrl!}
            alt={destination.city}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <DestinationHeroImage
            destinationName={`${destination.city}, ${destination.country}`}
            alt={destination.city}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            overlayGradient=""
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

        {/* Action buttons */}
        <div className="absolute top-3 right-3 flex gap-2 z-10 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleFavorite}
            disabled={isSaving}
            className="w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors border border-border/50"
            aria-label={isFavorited ? 'Remove from favorites' : 'Save to favorites'}
          >
            <Heart
              className={`h-4 w-4 transition-colors ${isFavorited ? 'fill-red-500 text-red-500' : 'text-foreground'}`}
            />
          </button>
          <button
            onClick={handleShare}
            className="w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors border border-border/50"
            aria-label="Share destination"
          >
            <Share2 className="h-4 w-4 text-foreground" />
          </button>
        </div>

        <div className="absolute bottom-3 left-3 right-3">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white text-lg">
              {destination.city}
            </h3>
            {destination.source === 'featured' && (
              <Sparkles className="h-3 w-3 text-amber-400" />
            )}
          </div>
          <p className="text-sm text-white/80">
            {destination.country} • {destination.region}
          </p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground line-clamp-2">
        {destination.tagline}
      </p>
    </motion.div>
  );
}
