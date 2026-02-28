import { motion } from 'framer-motion';
import { Heart, X, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import SafeImage from '@/components/SafeImage';
import DestinationHeroImage from '@/components/common/DestinationHeroImage';
import { useSavedDestinations, useRemoveSavedDestination } from '@/hooks/useSavedDestinations';

export default function SavedDestinations() {
  const { data: saved, isLoading } = useSavedDestinations();
  const removeMutation = useRemoveSavedDestination();
  const navigate = useNavigate();

  if (isLoading || !saved || saved.length === 0) return null;

  const handleRemove = (e: React.MouseEvent, id: string, city: string) => {
    e.stopPropagation();
    removeMutation.mutate(id, {
      onSuccess: () => toast.success(`${city} removed from favorites`),
      onError: () => toast.error('Failed to remove'),
    });
  };

  const handleClick = (dest: typeof saved[0]) => {
    const slug = dest.item_id || dest.city.toLowerCase().replace(/\s+/g, '-');
    navigate(`/destination/${slug}`);
  };

  return (
    <section className="py-10">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center gap-2 mb-6">
          <Heart className="h-5 w-5 text-red-500 fill-red-500" />
          <h2 className="text-xl md:text-2xl font-display font-bold text-foreground">
            Your Saved Destinations
          </h2>
          <span className="text-sm text-muted-foreground ml-2">({saved.length})</span>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {saved.map((dest, index) => (
            <motion.div
              key={dest.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="group cursor-pointer"
              onClick={() => handleClick(dest)}
            >
              <div className="relative aspect-[4/3] rounded-xl overflow-hidden mb-2">
                {dest.imageUrl ? (
                  <SafeImage
                    src={dest.imageUrl}
                    alt={dest.city}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <DestinationHeroImage
                    destinationName={`${dest.city}, ${dest.country}`}
                    alt={dest.city}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    overlayGradient=""
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />

                {/* Remove button */}
                <button
                  onClick={(e) => handleRemove(e, dest.id, dest.city)}
                  className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors border border-border/50"
                  aria-label="Remove from favorites"
                >
                  <X className="h-3.5 w-3.5" />
                </button>

                <div className="absolute bottom-2 left-2 right-2">
                  <h3 className="font-semibold text-white text-base">{dest.city}</h3>
                  {dest.country && (
                    <p className="text-xs text-white/80 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {dest.country}{dest.region ? ` · ${dest.region}` : ''}
                    </p>
                  )}
                </div>
              </div>
              {dest.tagline && (
                <p className="text-xs text-muted-foreground line-clamp-1">{dest.tagline}</p>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
