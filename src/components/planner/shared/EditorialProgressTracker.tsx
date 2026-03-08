import { motion } from 'framer-motion';
import { Check, Plane, Hotel, Sparkles, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface EditorialProgressTrackerProps {
  destination: string;
  destinationImage?: string;
  startDate?: string;
  endDate?: string;
  travelers?: number;
  currentStep: 'context' | 'flights' | 'hotels' | 'itinerary';
  flightSelected?: boolean;
  hotelSelected?: boolean;
  flightDetails?: {
    airline?: string;
    price?: number;
    departure?: string;
  };
  hotelDetails?: {
    name?: string;
    pricePerNight?: number;
  };
}

const steps = [
  { id: 'context', label: 'Trip Details', icon: MapPin },
  { id: 'flights', label: 'Flights', icon: Plane },
  { id: 'hotels', label: 'Hotel', icon: Hotel },
  { id: 'itinerary', label: 'Your Trip', icon: Sparkles },
];

export default function EditorialProgressTracker({
  destination,
  destinationImage,
  startDate,
  endDate,
  travelers,
  currentStep,
  flightSelected,
  hotelSelected,
  flightDetails,
  hotelDetails,
}: EditorialProgressTrackerProps) {
  const currentStepIndex = steps.findIndex(s => s.id === currentStep);
  
  const formatDates = () => {
    if (!startDate || !endDate) return null;
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const nights = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return {
        range: `${format(start, 'MMM d')} - ${format(end, 'MMM d')}`,
        nights,
      };
    } catch {
      return null;
    }
  };

  const dateInfo = formatDates();

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative bg-card rounded-2xl border border-border shadow-lg overflow-hidden"
    >
      {/* Destination Hero Strip */}
      <div className="relative h-24 overflow-hidden">
        {destinationImage ? (
          <img 
            src={destinationImage} 
            alt={destination}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/30 to-accent/30" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent" />
        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
          <div className="min-w-0 flex-1">
            <h3 className="text-white font-serif text-lg sm:text-xl font-semibold truncate">{destination}</h3>
            {dateInfo && (
              <p className="text-white/80 text-sm">
                {dateInfo.range} · {dateInfo.nights} nights
              </p>
            )}
          </div>
          {travelers && travelers > 1 && (
            <span className="text-white/80 text-sm">
              {travelers} travelers
            </span>
          )}
        </div>
      </div>

      {/* Progress Steps */}
      <div className="p-4">
        <div className="flex items-center justify-between relative">
          {/* Connection Line */}
          <div className="absolute top-4 left-8 right-8 h-0.5 bg-border" />
          <motion.div 
            className="absolute top-4 left-8 h-0.5 bg-primary"
            initial={{ width: 0 }}
            animate={{ 
              width: `${Math.max(0, (currentStepIndex / (steps.length - 1)) * 100)}%`
            }}
            transition={{ duration: 0.5, ease: 'easeInOut' }}
          />

          {steps.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = index < currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const isUpcoming = index > currentStepIndex;

            return (
              <div key={step.id} className="relative z-10 flex flex-col items-center">
                <motion.div
                  initial={false}
                  animate={{
                    scale: isCurrent ? 1.1 : 1,
                    backgroundColor: isCompleted 
                      ? 'hsl(var(--primary))' 
                      : isCurrent 
                        ? 'hsl(var(--background))' 
                        : 'hsl(var(--muted))',
                    borderColor: isCompleted || isCurrent 
                      ? 'hsl(var(--primary))' 
                      : 'hsl(var(--border))',
                  }}
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors',
                    isCompleted && 'text-primary-foreground',
                    isCurrent && 'text-primary ring-4 ring-primary/20',
                    isUpcoming && 'text-muted-foreground'
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </motion.div>
                <span className={cn(
                  'text-xs mt-1.5 font-medium',
                  isCurrent ? 'text-primary' : isCompleted ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Selection Summary */}
        {(flightSelected || hotelSelected) && (
          <div className="mt-4 pt-4 border-t border-border space-y-2">
            {flightSelected && flightDetails && (
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                    <Plane className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="text-muted-foreground">Flight</span>
                </div>
                <div className="text-right">
                  <span className="font-medium">{flightDetails.airline}</span>
                  {flightDetails.price && (
                    <span className="text-muted-foreground ml-2">${flightDetails.price}</span>
                  )}
                </div>
              </div>
            )}
            {hotelSelected && hotelDetails && (
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                    <Hotel className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="text-muted-foreground">Hotel</span>
                </div>
                <div className="text-right">
                  <span className="font-medium">{hotelDetails.name}</span>
                  {hotelDetails.pricePerNight && (
                    <span className="text-muted-foreground ml-2">${hotelDetails.pricePerNight}/night</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
