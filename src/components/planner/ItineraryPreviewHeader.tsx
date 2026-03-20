import { motion } from 'framer-motion';
import { MapPin, Calendar, Users, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ItineraryPreviewHeaderProps {
  destination: string;
  startDate: Date;
  endDate: Date;
  travelersCount: number;
  backgroundImage?: string;
  className?: string;
}

export default function ItineraryPreviewHeader({
  destination,
  startDate,
  endDate,
  travelersCount,
  backgroundImage,
  className
}: ItineraryPreviewHeaderProps) {
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getTripDuration = () => {
    const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays + 1;
  };

  const getTravelersText = () => {
    return travelersCount === 1 ? '1 Traveler' : `${travelersCount} Travelers`;
  };

  return (
    <motion.div
      className={cn('relative rounded-xl overflow-hidden', className)}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Background */}
      <div className="absolute inset-0 z-0">
        {backgroundImage ? (
          <img
            src={backgroundImage}
            alt={destination}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary to-accent" />
        )}
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* Content */}
      <div className="relative z-10 p-6 text-white">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-2xl font-bold">{destination}</h1>
            </div>

            <div className="flex items-center gap-6 text-sm opacity-90">
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                <span>
                  {formatDate(startDate)} - {formatDate(endDate)}
                </span>
              </div>

              <div className="flex items-center gap-1">
                <Users className="w-4 h-4" />
                <span>{getTravelersText()}</span>
              </div>

              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                <span>{getTripDuration()} days</span>
              </div>
            </div>
          </div>

          <motion.button
            className="flex items-center gap-2 bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-lg hover:bg-white/30 transition-colors"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <span className="text-sm font-medium">View Details</span>
            <ArrowRight className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
