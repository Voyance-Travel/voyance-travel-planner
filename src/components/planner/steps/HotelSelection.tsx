import { motion } from 'framer-motion';
import { Star, MapPin, Wifi, Coffee, Car, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Hotel {
  id: string;
  name: string;
  rating: number;
  reviews: number;
  pricePerNight: number;
  image: string;
  location: string;
  amenities: string[];
}

interface HotelSelectionProps {
  formData: {
    destination: string;
    startDate: string;
    endDate: string;
  };
  selectedHotel: string | null;
  onSelectHotel: (id: string, hotel: Hotel) => void;
  onContinue: () => void;
  onBack: () => void;
  isSubmitting?: boolean;
}

// Mock hotel data
const hotels: Hotel[] = [
  {
    id: 'hotel-1',
    name: 'The Grand Plaza',
    rating: 4.8,
    reviews: 1247,
    pricePerNight: 189,
    image: 'https://images.pexels.com/photos/258154/pexels-photo-258154.jpeg?auto=compress&cs=tinysrgb&w=600',
    location: 'City Center',
    amenities: ['wifi', 'breakfast', 'parking'],
  },
  {
    id: 'hotel-2',
    name: 'Boutique Maison',
    rating: 4.6,
    reviews: 856,
    pricePerNight: 145,
    image: 'https://images.pexels.com/photos/164595/pexels-photo-164595.jpeg?auto=compress&cs=tinysrgb&w=600',
    location: 'Historic District',
    amenities: ['wifi', 'breakfast'],
  },
  {
    id: 'hotel-3',
    name: 'Skyline Suites',
    rating: 4.9,
    reviews: 2103,
    pricePerNight: 320,
    image: 'https://images.pexels.com/photos/1134176/pexels-photo-1134176.jpeg?auto=compress&cs=tinysrgb&w=600',
    location: 'Financial District',
    amenities: ['wifi', 'breakfast', 'parking'],
  },
];

const amenityIcons: Record<string, React.ReactNode> = {
  wifi: <Wifi className="w-4 h-4" />,
  breakfast: <Coffee className="w-4 h-4" />,
  parking: <Car className="w-4 h-4" />,
};

function HotelCard({
  hotel,
  isSelected,
  onSelect,
  nights,
}: {
  hotel: Hotel;
  isSelected: boolean;
  onSelect: (hotel: Hotel) => void;
  nights: number;
}) {
  const totalPrice = hotel.pricePerNight * nights;

  return (
    <motion.button
      onClick={() => onSelect(hotel)}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        'w-full rounded-xl border-2 overflow-hidden text-left transition-all',
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-slate-200 hover:border-slate-300 bg-white'
      )}
    >
      <div className="flex">
        {/* Image */}
        <div className="w-48 h-40 flex-shrink-0">
          <img
            src={hotel.image}
            alt={hotel.name}
            className="w-full h-full object-cover"
          />
        </div>

        {/* Details */}
        <div className="flex-1 p-4 flex justify-between">
          <div className="flex flex-col justify-between">
            <div>
              <h3 className="font-semibold text-slate-900 text-lg">{hotel.name}</h3>
              <div className="flex items-center gap-1 mt-1">
                <MapPin className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-500">
                  {typeof hotel.location === 'string' 
                    ? hotel.location 
                    : (hotel.location as { name?: string; address?: string })?.name || 
                      (hotel.location as { name?: string; address?: string })?.address || ''}
                </span>
              </div>

              {/* Rating */}
              <div className="flex items-center gap-2 mt-2">
                <div className="flex items-center gap-1">
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  <span className="font-medium text-slate-900">{hotel.rating}</span>
                </div>
                <span className="text-sm text-slate-500">
                  ({hotel.reviews.toLocaleString()} reviews)
                </span>
              </div>
            </div>

            {/* Amenities */}
            <div className="flex items-center gap-3">
              {hotel.amenities.map((amenity) => (
                <div
                  key={amenity}
                  className="flex items-center gap-1 text-slate-500"
                  title={amenity}
                >
                  {amenityIcons[amenity]}
                </div>
              ))}
            </div>
          </div>

          {/* Price & Selection */}
          <div className="flex flex-col items-end justify-between">
            <div
              className={cn(
                'w-6 h-6 rounded-full border-2 flex items-center justify-center',
                isSelected ? 'border-primary bg-primary' : 'border-slate-300'
              )}
            >
              {isSelected && <Check className="w-4 h-4 text-primary-foreground" />}
            </div>

            <div className="text-right">
              <p className="text-sm text-slate-500">
                ${hotel.pricePerNight}/night
              </p>
              <p className="font-semibold text-lg text-slate-900">
                ${totalPrice} total
              </p>
              <p className="text-xs text-slate-400">{nights} nights</p>
            </div>
          </div>
        </div>
      </div>
    </motion.button>
  );
}

export default function HotelSelection({
  formData,
  selectedHotel,
  onSelectHotel,
  onContinue,
  onBack,
  isSubmitting,
}: HotelSelectionProps) {
  // Calculate nights
  const startDate = new Date(formData.startDate);
  const endDate = new Date(formData.endDate);
  const nights = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto"
    >
      <div className="text-center mb-10">
        <h1 className="text-3xl font-display font-medium text-slate-900 mb-2">
          Where will you stay?
        </h1>
        <p className="text-slate-600 truncate max-w-full">
          Hotels in {formData.destination} • {nights} nights
        </p>
      </div>

      {/* Hotel List */}
      <div className="space-y-4 mb-10">
        {hotels.map((hotel) => (
          <HotelCard
            key={hotel.id}
            hotel={hotel}
            isSelected={selectedHotel === hotel.id}
            onSelect={(h) => onSelectHotel(h.id, h)}
            nights={nights}
          />
        ))}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isSubmitting} className="h-12 px-6">
          Back
        </Button>
        <Button
          onClick={onContinue}
          disabled={!selectedHotel || isSubmitting}
          className="h-12 px-8 bg-slate-900 hover:bg-slate-800 text-white"
        >
          {isSubmitting ? 'Saving...' : 'Continue to Itinerary'}
        </Button>
      </div>
    </motion.div>
  );
}
