import { useState } from 'react';
import { motion } from 'framer-motion';
import { Hotel, Plane, Clock, MapPin, Info, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface ItineraryContextData {
  hotelLocation?: string;
  hotelNeighborhood?: string;
  arrivalTime?: string; // HH:MM format
  departureTime?: string; // HH:MM format
}

interface ItineraryContextFormProps {
  destination: string;
  startDate: string;
  endDate: string;
  onContinue: (data: ItineraryContextData) => void;
  onSkip: () => void;
  isLoading?: boolean;
}

export default function ItineraryContextForm({
  destination,
  startDate,
  endDate,
  onContinue,
  onSkip,
  isLoading,
}: ItineraryContextFormProps) {
  const [hotelLocation, setHotelLocation] = useState('');
  const [arrivalTime, setArrivalTime] = useState('');
  const [departureTime, setDepartureTime] = useState('');

  const hasAnyData = hotelLocation || arrivalTime || departureTime;

  const handleContinue = () => {
    onContinue({
      hotelLocation: hotelLocation || undefined,
      arrivalTime: arrivalTime || undefined,
      departureTime: departureTime || undefined,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="max-w-xl mx-auto"
    >
      {/* Header */}
      <div className="text-center mb-8">
        <p className="text-xs tracking-[0.2em] uppercase text-primary font-medium mb-3">
          {destination}
        </p>
        <h1 className="font-serif text-3xl md:text-4xl font-light text-foreground mb-3">
          Help Us <em className="italic">Personalize</em>
        </h1>
        <p className="text-muted-foreground text-balance">
          Optional details that help us plan around your schedule
        </p>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20 mb-8">
        <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Why share this?</p>
          <p>
            Your hotel location helps us plan activities nearby. Flight times ensure 
            we don't schedule anything before you land or after you need to leave.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="space-y-6">
        {/* Hotel Location */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Hotel className="w-4 h-4 text-muted-foreground" />
            Where are you staying?
            <span className="text-xs text-muted-foreground font-normal">(optional)</span>
          </Label>
          <Input
            value={hotelLocation}
            onChange={(e) => setHotelLocation(e.target.value)}
            placeholder="e.g., Hilton Tower Bridge, Shoreditch area"
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">
            Hotel name, neighborhood, or address
          </p>
        </div>

        {/* Flight Times */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Plane className="w-4 h-4 text-muted-foreground rotate-[-45deg]" />
              Arrival time
              <span className="text-xs text-muted-foreground font-normal">(opt.)</span>
            </Label>
            <div className="relative">
              <Input
                type="time"
                value={arrivalTime}
                onChange={(e) => setArrivalTime(e.target.value)}
                className="h-11"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              When you land on {new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Plane className="w-4 h-4 text-muted-foreground rotate-45" />
              Departure time
              <span className="text-xs text-muted-foreground font-normal">(opt.)</span>
            </Label>
            <div className="relative">
              <Input
                type="time"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                className="h-11"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              When you leave on {new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3 mt-10">
        <Button
          onClick={handleContinue}
          disabled={isLoading}
          className="h-12 gap-2"
        >
          <Sparkles className="w-4 h-4" />
          {hasAnyData ? 'Continue with Details' : 'Build My Itinerary'}
          <ArrowRight className="w-4 h-4" />
        </Button>
        
        {!hasAnyData && (
          <Button
            variant="ghost"
            onClick={onSkip}
            disabled={isLoading}
            className="text-muted-foreground"
          >
            Skip for now, I'll add these later
          </Button>
        )}
      </div>
    </motion.div>
  );
}
