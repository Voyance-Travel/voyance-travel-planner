import { motion } from 'framer-motion';
import { Car, Train, CarTaxiFront, Footprints, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export type TransportMode = 'rental_car' | 'public_transit' | 'rideshare' | 'walking';

export interface TransportationPreference {
  modes: TransportMode[];
  primaryMode?: TransportMode;
  notes?: string;
}

interface TransportationPreferencesProps {
  value: TransportationPreference;
  onChange: (value: TransportationPreference) => void;
  onAddRentalCar?: () => void;
  hasRentalCar?: boolean;
}

const TRANSPORT_OPTIONS: { id: TransportMode; label: string; icon: typeof Car; description: string }[] = [
  {
    id: 'rental_car',
    label: 'Rental Car',
    icon: Car,
    description: 'Freedom to explore at your own pace',
  },
  {
    id: 'public_transit',
    label: 'Public Transit',
    icon: Train,
    description: 'Metro, bus, tram - local experience',
  },
  {
    id: 'rideshare',
    label: 'Rideshare/Taxi',
    icon: CarTaxiFront,
    description: 'Uber, Lyft, local taxis on demand',
  },
  {
    id: 'walking',
    label: 'Walking-Focused',
    icon: Footprints,
    description: 'Explore neighborhoods on foot',
  },
];

export default function TransportationPreferences({
  value,
  onChange,
  onAddRentalCar,
  hasRentalCar,
}: TransportationPreferencesProps) {
  const toggleMode = (mode: TransportMode) => {
    const currentModes = value.modes || [];
    const isSelected = currentModes.includes(mode);
    
    let newModes: TransportMode[];
    if (isSelected) {
      newModes = currentModes.filter(m => m !== mode);
    } else {
      newModes = [...currentModes, mode];
    }
    
    // Set primary mode to first selected if none set
    const newPrimary = newModes.length > 0 
      ? (newModes.includes(value.primaryMode || 'walking') ? value.primaryMode : newModes[0])
      : undefined;
    
    onChange({
      ...value,
      modes: newModes,
      primaryMode: newPrimary,
    });
  };

  const setPrimaryMode = (mode: TransportMode) => {
    onChange({
      ...value,
      primaryMode: mode,
    });
  };

  const selectedModes = value.modes || [];

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Car className="w-5 h-5 text-primary" />
          How will you get around?
        </CardTitle>
        <CardDescription>
          Select all that apply. We'll tailor your itinerary accordingly
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {TRANSPORT_OPTIONS.map((option) => {
            const isSelected = selectedModes.includes(option.id);
            const isPrimary = value.primaryMode === option.id;
            const Icon = option.icon;
            
            return (
              <motion.div
                key={option.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <button
                  type="button"
                  onClick={() => toggleMode(option.id)}
                  className={cn(
                    'w-full p-4 rounded-lg border-2 text-left transition-all relative',
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border bg-card hover:border-muted-foreground/50'
                  )}
                >
                  {isSelected && (
                    <div className="absolute top-2 right-2">
                      <Check className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <Icon className={cn(
                    'w-6 h-6 mb-2',
                    isSelected ? 'text-primary' : 'text-muted-foreground'
                  )} />
                  <p className={cn(
                    'font-medium text-sm',
                    isSelected ? 'text-foreground' : 'text-muted-foreground'
                  )}>
                    {option.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {option.description}
                  </p>
                  {isPrimary && selectedModes.length > 1 && (
                    <Badge variant="secondary" className="mt-2 text-xs">
                      Primary
                    </Badge>
                  )}
                </button>
              </motion.div>
            );
          })}
        </div>

        {/* Primary mode selector when multiple selected */}
        {selectedModes.length > 1 && (
          <div className="pt-2 border-t border-border">
            <p className="text-sm text-muted-foreground mb-2">
              Primary transportation:
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedModes.map((mode) => {
                const option = TRANSPORT_OPTIONS.find(o => o.id === mode);
                if (!option) return null;
                return (
                  <Button
                    key={mode}
                    variant={value.primaryMode === mode ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPrimaryMode(mode)}
                  >
                    {option.label}
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {/* Add rental car details button */}
        {selectedModes.includes('rental_car') && onAddRentalCar && (
          <div className="pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onAddRentalCar}
              className="w-full gap-2"
            >
              {hasRentalCar ? (
                <>
                  <Check className="w-4 h-4 text-green-500" />
                  Rental Car Added - Edit Details
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  Add Rental Car Details
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
