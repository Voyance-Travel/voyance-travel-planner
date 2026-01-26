import { Hotel, MapPin, Star } from 'lucide-react';
import { useState } from 'react';

interface HotelInfo {
  name: string;
  rating: number;
  location: string;
  price: number;
  totalPrice?: number;
  amenities?: string[];
  images?: string[];
  description?: string;
}

interface SelectedHotelCardProps {
  hotel: HotelInfo;
  nights?: number;
  className?: string;
}

export default function SelectedHotelCard({
  hotel,
  nights = 1,
  className = ''
}: SelectedHotelCardProps) {
  const [imageError, setImageError] = useState(false);
  const totalPrice = hotel.totalPrice || (hotel.price * nights);

  return (
    <div className={`p-4 ${className}`}>
      <div className="bg-card rounded-xl shadow-sm p-6 border border-border">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center bg-primary/10 text-primary rounded-full w-12 h-12 flex-shrink-0">
            <Hotel size={24} />
          </div>
          
          <div className="flex-1">
            <h3 className="font-semibold text-foreground mb-3">
              Selected Accommodation
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Hotel Image */}
              <div className="overflow-hidden rounded-lg h-40 relative">
                {hotel.images && hotel.images[0] && !imageError ? (
                  <img
                    src={hotel.images[0]}
                    alt={hotel.name}
                    className="w-full h-full object-cover"
                    onError={() => setImageError(true)}
                  />
                ) : (
                  <div className="w-full h-full bg-muted flex items-center justify-center">
                    <Hotel size={32} className="text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Hotel Details */}
              <div className="space-y-3">
                <div>
                  <h4 className="font-semibold text-foreground mb-1">
                    {hotel.name}
                  </h4>
                  
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <div className="flex items-center">
                      {Array(5).fill(0).map((_, i) => (
                        <Star
                          key={i}
                          size={14}
                          className={
                            i < Math.floor(hotel.rating)
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-muted'
                          }
                        />
                      ))}
                      <span className="ml-1">{hotel.rating}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="w-4 h-4" />
                    <span>
                      {typeof hotel.location === 'string' 
                        ? hotel.location 
                        : (hotel.location as { name?: string; address?: string })?.name || 
                          (hotel.location as { name?: string; address?: string })?.address || ''}
                    </span>
                  </div>
                </div>

                {/* Amenities */}
                {hotel.amenities && hotel.amenities.length > 0 && (
                  <div>
                    <h5 className="text-sm font-medium text-foreground mb-1">
                      Amenities
                    </h5>
                    <div className="flex flex-wrap gap-1">
                      {hotel.amenities.slice(0, 4).map((amenity, index) => (
                        <span
                          key={index}
                          className="px-2 py-1 bg-muted text-muted-foreground rounded text-xs"
                        >
                          {amenity}
                        </span>
                      ))}
                      {hotel.amenities.length > 4 && (
                        <span className="px-2 py-1 bg-muted text-muted-foreground rounded text-xs">
                          +{hotel.amenities.length - 4} more
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Description */}
                {hotel.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {hotel.description}
                  </p>
                )}
              </div>
            </div>

            {/* Price */}
            <div className="flex items-center justify-between pt-4 border-t border-border mt-4">
              <span className="text-sm text-muted-foreground">
                Total for {nights} {nights === 1 ? 'night' : 'nights'}
              </span>
              <div className="text-right">
                <span className="text-xl font-bold text-foreground">
                  ${totalPrice.toLocaleString()}
                </span>
                <div className="text-sm text-muted-foreground">
                  ${hotel.price}/night
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
