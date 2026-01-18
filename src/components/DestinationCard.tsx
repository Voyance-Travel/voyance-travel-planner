import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import DestinationHeroImage from '@/components/common/DestinationHeroImage';
import type { Destination } from '@/lib/destinations';

interface DestinationCardProps {
  destination: Destination;
  index?: number;
}

export function DestinationCard({ destination, index = 0 }: DestinationCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
    >
      <Link 
        to={`/destinations/${destination.id}`}
        className="group block relative overflow-hidden rounded-xl aspect-[4/5] card-shine"
      >
        {/* Image */}
        <div className="absolute inset-0 image-zoom">
          <DestinationHeroImage
            destinationName={`${destination.city}, ${destination.country}`}
            alt={`${destination.city}, ${destination.country}`}
            className="w-full h-full object-cover"
            overlayGradient=""
          />
        </div>
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        
        {/* Warm Glow */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 radial-glow" />
        
        {/* Content */}
        <div className="absolute bottom-0 left-0 right-0 p-5 text-primary-foreground">
          <p className="text-xs uppercase tracking-widest opacity-80 mb-1">
            {destination.country} · {destination.region}
          </p>
          <h3 className="font-serif text-2xl font-semibold mb-2">
            {destination.city}
          </h3>
          <p className="text-sm opacity-90 line-clamp-2">
            {destination.tagline}
          </p>
        </div>

        {/* Hover Border */}
        <div className="absolute inset-0 rounded-xl border-2 border-transparent group-hover:border-accent/50 transition-colors duration-300" />
      </Link>
    </motion.div>
  );
}
