import { motion } from 'framer-motion';
import { MapPin, Star, Check, Info, Wifi, Coffee, Dumbbell, Waves } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import SafeImage from '@/components/SafeImage';
import type { HotelOption } from '@/lib/trips';

interface HotelSelectorProps {
  hotels: HotelOption[];
  selectedHotel?: HotelOption;
  onSelect: (hotel: HotelOption) => void;
}

const amenityIcons: Record<string, React.ReactNode> = {
  'Free WiFi': <Wifi className="h-3.5 w-3.5" />,
  'Breakfast included': <Coffee className="h-3.5 w-3.5" />,
  'Gym': <Dumbbell className="h-3.5 w-3.5" />,
  'Pool': <Waves className="h-3.5 w-3.5" />,
};

export function HotelSelector({ hotels, selectedHotel, onSelect }: HotelSelectorProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {hotels.map((hotel, index) => {
        const isSelected = selectedHotel?.id === hotel.id;
        
        return (
          <motion.div
            key={hotel.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className={`relative rounded-xl border-2 overflow-hidden transition-all duration-300 cursor-pointer ${
              isSelected 
                ? 'border-accent shadow-glow' 
                : 'border-border hover:border-accent/50 hover:shadow-soft'
            }`}
            onClick={() => onSelect(hotel)}
          >
            {/* Selected indicator */}
            {isSelected && (
              <div className="absolute top-3 right-3 z-10 h-6 w-6 rounded-full bg-accent text-accent-foreground flex items-center justify-center">
                <Check className="h-4 w-4" />
              </div>
            )}

            {/* Image */}
            <div className="relative h-40 overflow-hidden">
              <SafeImage 
                src={hotel.imageUrl} 
                alt={hotel.name}
                className="w-full h-full object-cover"
                fallbackCategory="accommodation"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-3 left-3 right-3">
                <div className="flex items-center gap-1 text-primary-foreground mb-1">
                  {Array.from({ length: hotel.stars }).map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-gold text-gold" />
                  ))}
                </div>
                <h4 className="font-serif text-lg font-semibold text-primary-foreground">
                  {hotel.name}
                </h4>
              </div>
            </div>

            {/* Content */}
            <div className="p-4 bg-card">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-3">
                <MapPin className="h-4 w-4" />
                <span>{hotel.neighborhood}</span>
              </div>

              {/* Amenities */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {hotel.amenities.slice(0, 4).map((amenity) => (
                  <Badge key={amenity} variant="secondary" className="text-xs gap-1">
                    {amenityIcons[amenity]}
                    {amenity}
                  </Badge>
                ))}
                {hotel.amenities.length > 4 && (
                  <Badge variant="secondary" className="text-xs">
                    +{hotel.amenities.length - 4} more
                  </Badge>
                )}
              </div>

              {/* Price */}
              <div className="flex items-end justify-between mb-4">
                <div>
                  <span className="text-2xl font-serif font-semibold">
                    ${hotel.pricePerNight}
                  </span>
                  <span className="text-sm text-muted-foreground"> / night</span>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="font-semibold">${hotel.totalPrice.toLocaleString()}</p>
                </div>
              </div>

              {/* Rationale */}
              <div className="pt-3 border-t border-border">
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Info className="h-4 w-4 mt-0.5 text-accent shrink-0" />
                  <ul className="space-y-0.5">
                    {hotel.rationale.slice(0, 2).map((reason, i) => (
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
