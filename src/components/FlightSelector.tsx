import { motion } from 'framer-motion';
import { Clock, Plane, Star, Check, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { FlightOption } from '@/lib/trips';

interface FlightSelectorProps {
  flights: FlightOption[];
  selectedFlight?: FlightOption;
  onSelect: (flight: FlightOption) => void;
}

export function FlightSelector({ flights, selectedFlight, onSelect }: FlightSelectorProps) {
  const cabinLabels = {
    economy: 'Economy',
    premium_economy: 'Premium Economy',
    business: 'Business',
    first: 'First Class',
  };

  return (
    <div className="space-y-4">
      {flights.map((flight, index) => {
        const isSelected = selectedFlight?.id === flight.id;
        
        return (
          <motion.div
            key={flight.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`relative p-5 rounded-xl border-2 transition-all duration-300 cursor-pointer ${
              isSelected 
                ? 'border-accent bg-accent/5 shadow-glow' 
                : 'border-border bg-card hover:border-accent/50 hover:shadow-soft'
            }`}
            onClick={() => onSelect(flight)}
          >
            {/* Selected indicator */}
            {isSelected && (
              <div className="absolute top-4 right-4 h-6 w-6 rounded-full bg-accent text-accent-foreground flex items-center justify-center">
                <Check className="h-4 w-4" />
              </div>
            )}

            <div className="flex flex-col md:flex-row md:items-center gap-4">
              {/* Airline & Route */}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Plane className="h-4 w-4 text-accent" />
                  <span className="font-semibold">{flight.airline}</span>
                  <Badge variant="secondary" className="text-xs">
                    {cabinLabels[flight.cabin]}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-medium text-lg">{flight.departureTime}</span>
                  <div className="flex-1 flex items-center gap-2">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs text-muted-foreground px-2">
                      {flight.stops === 0 ? 'Direct' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}`}
                    </span>
                    <div className="h-px flex-1 bg-border" />
                  </div>
                  <span className="font-medium text-lg">{flight.arrivalTime}</span>
                </div>
                
                <div className="flex items-center gap-1 mt-1 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5" />
                  <span>{flight.duration}</span>
                </div>
              </div>

              {/* Price */}
              <div className="text-right">
                <div className="text-2xl font-serif font-semibold text-foreground">
                  ${flight.price.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">per person</p>
              </div>
            </div>

            {/* Rationale */}
            <div className="mt-4 pt-4 border-t border-border">
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <Info className="h-4 w-4 mt-0.5 text-accent shrink-0" />
                <div>
                  <p className="font-medium text-foreground mb-1">Why we suggest this:</p>
                  <ul className="space-y-0.5">
                    {flight.rationale.map((reason, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <span className="text-accent">•</span>
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
