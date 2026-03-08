import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import DestinationHeroImage from '@/components/common/DestinationHeroImage';
import SafeImage from '@/components/SafeImage';
import DestinationCardActions from '@/components/explore/DestinationCardActions';
import type { HybridDestination } from '@/hooks/useHybridDestinationSearch';

interface ExploreDestinationCardProps {
  destination: HybridDestination;
  index: number;
  onClick: (destination: HybridDestination) => void;
}

export default function ExploreDestinationCard({ destination, index, onClick }: ExploreDestinationCardProps) {
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

        <DestinationCardActions
          itemId={destination.id}
          city={destination.city}
          country={destination.country}
          region={destination.region}
          tagline={destination.tagline}
          imageUrl={destination.imageUrl}
        />

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
