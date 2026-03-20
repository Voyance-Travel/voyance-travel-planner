import { motion } from 'framer-motion';
import { Calendar, Users, Clock } from 'lucide-react';

interface DestinationWelcomeProps {
  destination: string;
  startDate: string;
  endDate: string;
  companions?: number;
  className?: string;
}

export default function DestinationWelcome({
  destination,
  startDate,
  endDate,
  companions = 1,
  className = ''
}: DestinationWelcomeProps) {
  // Calculate days until the trip starts
  const calculateDaysUntilTrip = (): number => {
    if (!startDate) return 0;
    const today = new Date();
    const tripStart = new Date(startDate);
    const diffTime = tripStart.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Calculate the duration of the trip
  const calculateTripDuration = (): number => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  };

  const daysUntilTrip = calculateDaysUntilTrip();
  const tripDuration = calculateTripDuration();

  // Get a contextual message based on days until trip
  const getContextualMessage = (): string => {
    if (daysUntilTrip < 0) {
      return 'Looking back at your recent trip to';
    } else if (daysUntilTrip === 0) {
      return 'Your trip starts today! Get ready for';
    } else if (daysUntilTrip <= 7) {
      return 'Your trip is coming up soon! Preparing for';
    } else if (daysUntilTrip <= 30) {
      return 'Getting ready for your upcoming trip to';
    } else {
      return 'Planning ahead for your journey to';
    }
  };

  // Use centralized curated image utility
  const getDestinationImageUrl = (): string => {
    // Import at runtime to avoid circular dependencies
    const { getDestinationImage } = require('@/utils/destinationImages');
    return getDestinationImage(destination);
  };

  return (
    <div className={`rounded-xl overflow-hidden shadow-md border border-border ${className}`}>
      <div className="relative h-[200px] overflow-hidden">
        {/* Destination Image */}
        <img
          src={getDestinationImageUrl()}
          alt={destination}
          className="w-full h-full object-cover"
        />
        
        {/* Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        
        {/* Content Overlay */}
        <div className="absolute inset-0 flex flex-col justify-end p-6 text-white">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <p className="text-sm opacity-90 mb-1">
              {getContextualMessage()}
            </p>
            <h2 className="text-3xl font-bold mb-2">{destination}</h2>
          </motion.div>
        </div>
      </div>

      {/* Trip Details Bar */}
      <motion.div
        className="bg-card p-4 flex items-center justify-between"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
      >
        <div className="flex items-center gap-6">
          {/* Trip Duration */}
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">
              {tripDuration} {tripDuration === 1 ? 'day' : 'days'}
            </span>
          </div>
          
          {/* Travel Companions */}
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">
              {companions} {companions === 1 ? 'traveler' : 'travelers'}
            </span>
          </div>
          
          {/* Start Date */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-foreground">
              {new Date(startDate).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
              })}
            </span>
          </div>
        </div>

        {/* Days Until Trip Badge */}
        {daysUntilTrip > 0 && (
          <div className={`px-3 py-1 rounded-full text-xs font-medium ${
            daysUntilTrip <= 7
              ? 'bg-orange-100 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400'
              : daysUntilTrip <= 30
              ? 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400'
              : 'bg-muted text-muted-foreground'
          }`}>
            {daysUntilTrip} {daysUntilTrip === 1 ? 'day' : 'days'} to go
          </div>
        )}
      </motion.div>
    </div>
  );
}
