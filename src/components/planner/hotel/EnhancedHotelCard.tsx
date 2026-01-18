import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Star, 
  MapPin, 
  Check,
  Loader2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Wifi,
  UtensilsCrossed,
  Dumbbell,
  Waves,
  Car,
  Coffee,
  Sparkles,
  Users,
  Bed,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface RoomOption {
  id: string;
  name: string;
  price: number;
  pricePerNight: number;
  sleeps: number;
  bedType: string;
  features: string[];
  freeCancellation?: boolean;
  breakfastIncluded?: boolean;
  refundable?: boolean;
}

interface Review {
  author: string;
  rating: number;
  date: string;
  text: string;
}

export interface EnhancedHotelOption {
  id: string;
  name: string;
  stars: number;
  rating: number;
  reviewCount: number;
  neighborhood: string;
  distanceToCenter?: string;
  description: string;
  images: string[];
  amenities: string[];
  roomOptions: RoomOption[];
  reviews?: Review[];
  highlights?: string[];
  policies?: {
    checkIn: string;
    checkOut: string;
    cancellation: string;
  };
  isRecommended?: boolean;
  rationale?: string[];
}

interface EnhancedHotelCardProps {
  hotel: EnhancedHotelOption;
  isSelected: boolean;
  selectedRoom?: string;
  onSelect: (roomId: string) => void;
  isLoading?: boolean;
  nights: number;
}

const amenityIcons: Record<string, typeof Wifi> = {
  'Free WiFi': Wifi,
  'WiFi': Wifi,
  'Restaurant': UtensilsCrossed,
  'Breakfast': Coffee,
  'Gym': Dumbbell,
  'Pool': Waves,
  'Spa': Sparkles,
  'Parking': Car,
};

export default function EnhancedHotelCard({
  hotel,
  isSelected,
  selectedRoom,
  onSelect,
  isLoading,
  nights,
}: EnhancedHotelCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const lowestPrice = Math.min(...hotel.roomOptions.map(r => r.pricePerNight));
  
  const handleImageNav = (direction: 'prev' | 'next', e: React.MouseEvent) => {
    e.stopPropagation();
    if (direction === 'prev') {
      setCurrentImageIndex(prev => prev === 0 ? hotel.images.length - 1 : prev - 1);
    } else {
      setCurrentImageIndex(prev => prev === hotel.images.length - 1 ? 0 : prev + 1);
    }
  };

  const handleRoomSelect = (roomId: string) => {
    setSelectedRoomId(roomId);
    onSelect(roomId);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative bg-card rounded-xl border transition-all duration-200 overflow-hidden',
        isSelected 
          ? 'border-slate shadow-lg ring-2 ring-slate/20' 
          : 'border-border hover:border-slate/50 hover:shadow-md'
      )}
    >
      {/* Recommended Badge */}
      {hotel.isRecommended && (
        <div className="absolute top-4 left-4 z-20">
          <Badge className="bg-slate text-slate-foreground gap-1 shadow-lg">
            <Star className="h-3 w-3 fill-current" />
            Top Pick for You
          </Badge>
        </div>
      )}

      <div className="flex flex-col lg:flex-row">
        {/* Image Gallery */}
        <div className="relative lg:w-80 h-56 lg:h-auto shrink-0 group">
          <img 
            src={hotel.images[currentImageIndex] || hotel.images[0]} 
            alt={hotel.name}
            className="w-full h-full object-cover"
          />
          
          {/* Image Navigation */}
          {hotel.images.length > 1 && (
            <>
              <button
                onClick={(e) => handleImageNav('prev', e)}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={(e) => handleImageNav('next', e)}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              
              {/* Image Dots */}
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {hotel.images.slice(0, 5).map((_, idx) => (
                  <button
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentImageIndex(idx);
                    }}
                    className={`w-1.5 h-1.5 rounded-full transition-all ${
                      idx === currentImageIndex ? 'bg-white w-3' : 'bg-white/50'
                    }`}
                  />
                ))}
                {hotel.images.length > 5 && (
                  <span className="text-white text-xs ml-1">+{hotel.images.length - 5}</span>
                )}
              </div>
            </>
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 p-5">
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-3">
            <div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                {hotel.name}
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-0.5">
                  {[...Array(hotel.stars)].map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <span className="text-muted-foreground">·</span>
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" />
                  {hotel.neighborhood}
                  {hotel.distanceToCenter && (
                    <span className="text-xs">({hotel.distanceToCenter})</span>
                  )}
                </span>
              </div>
            </div>
            
            {/* Rating */}
            <div className="text-right shrink-0">
              <div className="bg-slate text-slate-foreground text-sm font-bold px-2.5 py-1.5 rounded-lg">
                {hotel.rating.toFixed(1)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {hotel.reviewCount} reviews
              </p>
            </div>
          </div>
          
          {/* Description */}
          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {hotel.description}
          </p>
          
          {/* Amenities */}
          <div className="flex flex-wrap gap-2 mb-4">
            {hotel.amenities.slice(0, 6).map((amenity, i) => {
              const Icon = amenityIcons[amenity] || Sparkles;
              return (
                <Badge key={i} variant="secondary" className="gap-1 text-xs">
                  <Icon className="h-3 w-3" />
                  {amenity}
                </Badge>
              );
            })}
            {hotel.amenities.length > 6 && (
              <Badge variant="secondary" className="text-xs">
                +{hotel.amenities.length - 6} more
              </Badge>
            )}
          </div>
          
          {/* Price & Expand */}
          <div className="flex items-end justify-between">
            <div>
              <p className="text-2xl font-bold text-foreground">
                ${lowestPrice}
                <span className="text-sm font-normal text-muted-foreground">/night</span>
              </p>
              <p className="text-sm text-muted-foreground">
                ${lowestPrice * nights} total for {nights} night{nights > 1 ? 's' : ''}
              </p>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-muted-foreground"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="h-4 w-4 mr-1" />
                  Less
                </>
              ) : (
                <>
                  <ChevronDown className="h-4 w-4 mr-1" />
                  View Rooms & Details
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border"
          >
            <div className="p-5 space-y-6">
              {/* Room Options */}
              <div>
                <h4 className="font-medium mb-3">Available Rooms</h4>
                <div className="space-y-3">
                  {hotel.roomOptions.map((room) => (
                    <div
                      key={room.id}
                      onClick={() => handleRoomSelect(room.id)}
                      className={cn(
                        'p-4 rounded-lg border cursor-pointer transition-all',
                        selectedRoomId === room.id
                          ? 'border-slate bg-slate/5'
                          : 'border-border hover:border-slate/50'
                      )}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h5 className="font-medium">{room.name}</h5>
                            {selectedRoomId === room.id && (
                              <Check className="h-4 w-4 text-slate" />
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground mb-2">
                            <span className="flex items-center gap-1">
                              <Users className="h-3.5 w-3.5" />
                              Sleeps {room.sleeps}
                            </span>
                            <span className="flex items-center gap-1">
                              <Bed className="h-3.5 w-3.5" />
                              {room.bedType}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {room.freeCancellation && (
                              <Badge variant="outline" className="text-xs text-green-600 border-green-200 bg-green-50">
                                Free cancellation
                              </Badge>
                            )}
                            {room.breakfastIncluded && (
                              <Badge variant="outline" className="text-xs">
                                Breakfast included
                              </Badge>
                            )}
                            {room.features.slice(0, 3).map((feature, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {feature}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">${room.pricePerNight}</p>
                          <p className="text-xs text-muted-foreground">per night</p>
                          <p className="text-sm font-medium mt-1">${room.price} total</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Reviews */}
              {hotel.reviews && hotel.reviews.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3">Guest Reviews</h4>
                  <div className="space-y-3">
                    {hotel.reviews.slice(0, 3).map((review, i) => (
                      <div key={i} className="bg-muted/50 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm font-medium">
                              {review.author.charAt(0)}
                            </div>
                            <span className="font-medium text-sm">{review.author}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            <span className="text-sm font-medium">{review.rating}</span>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground">{review.text}</p>
                        <p className="text-xs text-muted-foreground mt-1">{review.date}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Why Recommended */}
              {hotel.rationale && hotel.rationale.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">Why we recommend this hotel:</p>
                  <ul className="space-y-1">
                    {hotel.rationale.map((reason, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <Check className="h-3.5 w-3.5 text-slate shrink-0" />
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Policies */}
              {hotel.policies && (
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Check-in</p>
                    <p className="font-medium">{hotel.policies.checkIn}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Check-out</p>
                    <p className="font-medium">{hotel.policies.checkOut}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Cancellation</p>
                    <p className="font-medium">{hotel.policies.cancellation}</p>
                  </div>
                </div>
              )}

              {/* Select Button */}
              <div className="flex justify-end pt-4 border-t border-border">
                <Button
                  onClick={() => selectedRoomId && onSelect(selectedRoomId)}
                  disabled={isLoading || !selectedRoomId}
                  variant={isSelected ? "default" : "outline"}
                  size="lg"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : isSelected ? (
                    <Check className="h-4 w-4 mr-2" />
                  ) : null}
                  {isSelected ? 'Selected' : selectedRoomId 
                    ? `Select ${hotel.roomOptions.find(r => r.id === selectedRoomId)?.name}` 
                    : 'Select a room'}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
