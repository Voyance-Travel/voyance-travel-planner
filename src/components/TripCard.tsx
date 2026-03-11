import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calendar, Users, MapPin, ArrowRight } from 'lucide-react';
import SafeImage from '@/components/SafeImage';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Trip } from '@/lib/trips';
import { getDestinationById } from '@/lib/destinations';
import { formatDate } from '@/lib/trips';

interface TripCardProps {
  trip: Trip;
  index?: number;
}

export function TripCard({ trip, index = 0 }: TripCardProps) {
  const destination = getDestinationById(trip.destinationId);
  
  if (!destination) return null;

  const statusColors = {
    DRAFT: 'bg-muted text-muted-foreground',
    SAVED: 'bg-secondary text-secondary-foreground',
    BOOKED: 'bg-accent text-accent-foreground',
  };

  const statusLabels = {
    DRAFT: 'Draft',
    SAVED: 'Saved',
    BOOKED: 'Booked',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="group bg-card rounded-xl overflow-hidden border border-border shadow-soft hover:shadow-medium transition-shadow duration-300"
    >
      {/* Image */}
      <div className="relative h-40 overflow-hidden">
        <img 
          src={destination.imageUrl} 
          alt={destination.city}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <Badge className={`absolute top-3 right-3 ${statusColors[trip.status]}`}>
          {statusLabels[trip.status]}
        </Badge>
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="font-serif text-xl font-semibold mb-2">
          {destination.city}, {destination.country}
        </h3>
        
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground mb-4">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-4 w-4" />
            <span>{formatDate(trip.startDate)} - {formatDate(trip.endDate)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="h-4 w-4" />
            <span>{trip.travelersCount} traveler{trip.travelersCount > 1 ? 's' : ''}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="h-4 w-4" />
            <span>From {trip.departureCity}</span>
          </div>
        </div>

        <div className="flex gap-2">
          {trip.status === 'BOOKED' ? (
            <Link to={`/trip/${trip.id}/itinerary`} className="flex-1">
              <Button className="w-full" variant="accent">
                View Itinerary
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          ) : (
            <Link to={`/trip/${trip.id}`} className="flex-1">
              <Button className="w-full" variant="default">
                Continue Planning
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          )}
        </div>
      </div>
    </motion.div>
  );
}
