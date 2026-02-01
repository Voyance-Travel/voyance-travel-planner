import { useState } from 'react';
import { motion } from 'framer-motion';
import { Hotel, Plane, Clock, MapPin, Info, Sparkles, ArrowRight, Globe } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';

export interface ItineraryContextData {
  hotelLocation?: string;
  hotelNeighborhood?: string;
  arrivalTime?: string; // HH:MM format
  departureTime?: string; // HH:MM format
  isFirstTimeVisitor?: boolean; // First time visiting this destination?
  childrenAges?: number[]; // Ages of children if traveling with kids
}

interface ItineraryContextFormProps {
  destination: string;
  startDate: string;
  endDate: string;
  onContinue: (data: ItineraryContextData) => void;
  onSkip: () => void;
  isLoading?: boolean;
  // Pre-populated values from Start page (if available)
  initialHotelLocation?: string;
  initialArrivalTime?: string;
  initialDepartureTime?: string;
  // Family trip context
  childrenCount?: number;
  tripType?: string;
}

export default function ItineraryContextForm({
  destination,
  startDate,
  endDate,
  onContinue,
  onSkip,
  isLoading,
  initialHotelLocation,
  initialArrivalTime,
  initialDepartureTime,
  childrenCount = 0,
  tripType,
}: ItineraryContextFormProps) {
  const [hotelLocation, setHotelLocation] = useState(initialHotelLocation || '');
  // Don't auto-fill flight times - let user explicitly enter them
  const [arrivalTime, setArrivalTime] = useState('');
  const [departureTime, setDepartureTime] = useState('');
  // First-time visitor toggle - defaults to true (most common case)
  const [isFirstTimeVisitor, setIsFirstTimeVisitor] = useState(true);
  // Children ages for family trips
  const [childrenAges, setChildrenAges] = useState<number[]>(
    childrenCount > 0 ? Array(childrenCount).fill(5) : []
  );

  const hasAnyData = hotelLocation || arrivalTime || departureTime;
  const showChildrenAges = childrenCount > 0 || tripType === 'family';

  const handleChildAgeChange = (index: number, age: number) => {
    const newAges = [...childrenAges];
    newAges[index] = age;
    setChildrenAges(newAges);
  };

  const handleContinue = () => {
    onContinue({
      hotelLocation: hotelLocation || undefined,
      arrivalTime: arrivalTime || undefined,
      departureTime: departureTime || undefined,
      isFirstTimeVisitor,
      childrenAges: showChildrenAges && childrenAges.length > 0 ? childrenAges : undefined,
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

        {/* First-Time Visitor Toggle */}
        <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-muted/30">
          <Checkbox
            id="firstTimeVisitor"
            checked={isFirstTimeVisitor}
            onCheckedChange={(checked) => setIsFirstTimeVisitor(checked === true)}
            className="mt-0.5"
          />
          <div className="flex-1">
            <Label 
              htmlFor="firstTimeVisitor" 
              className="flex items-center gap-2 text-sm font-medium cursor-pointer"
            >
              <Globe className="w-4 h-4 text-muted-foreground" />
              First time visiting {destination}?
            </Label>
            <p className="text-xs text-muted-foreground mt-1">
              {isFirstTimeVisitor 
                ? "We'll include iconic landmarks and must-see attractions" 
                : "We'll focus on hidden gems and local favorites"}
            </p>
          </div>
        </div>

        {/* Children Ages - Only show for family trips */}
        {showChildrenAges && (
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-sm font-medium">
              Children's Ages
              <span className="text-xs text-muted-foreground font-normal">(helps us pick activities)</span>
            </Label>
            <div className="flex flex-wrap gap-3">
              {Array.from({ length: childrenCount || 1 }).map((_, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Child {index + 1}:</span>
                  <select
                    value={childrenAges[index] || 5}
                    onChange={(e) => handleChildAgeChange(index, parseInt(e.target.value))}
                    className="h-9 px-2 text-sm rounded-md border border-border bg-background"
                  >
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map(age => (
                      <option key={age} value={age}>
                        {age === 0 ? 'Under 1' : age === 17 ? '17+' : age}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {childrenAges.some(age => age <= 3) 
                ? "👶 Toddler detected - we'll include nap time and early dinners"
                : childrenAges.some(age => age >= 13)
                ? "🎮 Teen detected - we'll include age-appropriate activities"
                : "👦 We'll pick family-friendly activities for all ages"}
            </p>
          </div>
        )}

        {/* Flight Times - Optional Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Plane className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Flight Times</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Optional</span>
          </div>
          <p className="text-xs text-muted-foreground -mt-1">
            Skip this if you don't have flights booked yet — we'll plan a full day for arrival and departure.
          </p>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Plane className="w-3.5 h-3.5 rotate-[-45deg]" />
                Arrival
              </Label>
              <Input
                type="time"
                value={arrivalTime}
                onChange={(e) => setArrivalTime(e.target.value)}
                className="h-11"
                placeholder="--:--"
              />
              <p className="text-xs text-muted-foreground">
                {new Date(startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Plane className="w-3.5 h-3.5 rotate-45" />
                Departure
              </Label>
              <Input
                type="time"
                value={departureTime}
                onChange={(e) => setDepartureTime(e.target.value)}
                className="h-11"
                placeholder="--:--"
              />
              <p className="text-xs text-muted-foreground">
                {new Date(endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            </div>
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
