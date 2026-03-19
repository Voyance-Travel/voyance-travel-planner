import { useMemo, useState, type MouseEvent } from 'react';
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
  Image as ImageIcon,
  MessageSquare,
  TrendingUp,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DNAMatchBadgeCompact } from '@/components/hotels/DNAMatchBadge';

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
  imageUrl?: string;
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
  // DNA match properties
  dnaMatchScore?: number;
  matchReasons?: string[];
}

interface EnhancedHotelCardProps {
  hotel: EnhancedHotelOption;
  isSelected: boolean;
  selectedRoom?: string;
  onSelect: (roomId: string) => void;
  isLoading?: boolean;
  nights: number;
  // Budget alert props (optional - only show if both are provided)
  budgetPerNight?: number;
  showBudgetWarnings?: boolean;
  // DNA personalization
  isPersonalized?: boolean;
}

const amenityIcons: Record<string, typeof Wifi> = {
  'Free WiFi': Wifi,
  WiFi: Wifi,
  Restaurant: UtensilsCrossed,
  Breakfast: Coffee,
  Gym: Dumbbell,
  Pool: Waves,
  Spa: Sparkles,
  Parking: Car,
};

function clampIndex(i: number, max: number) {
  if (max <= 0) return 0;
  if (i < 0) return max - 1;
  if (i >= max) return 0;
  return i;
}

function safeUniqueImages(images: string[]) {
  const seen = new Set<string>();
  return images.filter((img) => {
    if (!img) return false;
    if (seen.has(img)) return false;
    seen.add(img);
    return true;
  });
}

export default function EnhancedHotelCard({
  hotel,
  isSelected,
  selectedRoom,
  onSelect,
  isLoading,
  nights,
  budgetPerNight,
  showBudgetWarnings = true,
  isPersonalized = false,
}: EnhancedHotelCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentHeroImageIndex, setCurrentHeroImageIndex] = useState(0);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  // Gallery dialog state (hotel + optional room lead image)
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);

  // Reviews dialog state
  const [reviewsOpen, setReviewsOpen] = useState(false);

  const lowestPrice = useMemo(
    () => Math.min(...hotel.roomOptions.map((r) => r.pricePerNight)),
    [hotel.roomOptions]
  );

  // Check if hotel exceeds budget
  const isOverBudget = useMemo(() => {
    if (!budgetPerNight || !showBudgetWarnings) return false;
    return lowestPrice > budgetPerNight;
  }, [budgetPerNight, showBudgetWarnings, lowestPrice]);

  const budgetExcessPercent = useMemo(() => {
    if (!budgetPerNight || lowestPrice <= budgetPerNight) return 0;
    return Math.round(((lowestPrice - budgetPerNight) / budgetPerNight) * 100);
  }, [budgetPerNight, lowestPrice]);

  const heroImage = hotel.images[currentHeroImageIndex] || hotel.images[0];

  const openGallery = (images: string[], startIndex = 0) => {
    const unique = safeUniqueImages(images);
    setGalleryImages(unique);
    setGalleryIndex(clampIndex(startIndex, unique.length));
    setGalleryOpen(true);
  };

  const handleHeroImageNav = (direction: 'prev' | 'next', e: MouseEvent) => {
    e.stopPropagation();
    const next = direction === 'prev' ? currentHeroImageIndex - 1 : currentHeroImageIndex + 1;
    setCurrentHeroImageIndex(clampIndex(next, hotel.images.length));
  };

  const handleRoomSelect = (roomId: string) => {
    setSelectedRoomId(roomId);
    onSelect(roomId);
  };

  const handleOpenHotelGallery = (e?: MouseEvent) => {
    e?.stopPropagation();
    openGallery(hotel.images, currentHeroImageIndex);
  };

  const handleOpenRoomGallery = (room: RoomOption, e: MouseEvent) => {
    e.stopPropagation();
    const roomLead = room.imageUrl ? [room.imageUrl] : [];
    openGallery([...roomLead, ...hotel.images], 0);
  };

  const handleOpenReviews = (e?: MouseEvent) => {
    e?.stopPropagation();
    setReviewsOpen(true);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          'relative bg-card rounded-2xl border transition-all duration-200 overflow-hidden',
          isSelected ? 'border-primary shadow-lg ring-2 ring-primary/20' : 'border-border hover:border-primary/40 hover:shadow-md'
        )}
      >
        {/* DNA Match Badge or Top Pick Badge */}
        <div className="absolute top-4 left-4 z-20 flex flex-wrap gap-2">
          {hotel.dnaMatchScore !== undefined && isPersonalized && (
            <DNAMatchBadgeCompact
              matchScore={hotel.dnaMatchScore}
              reasons={hotel.matchReasons || []}
              isPersonalized={isPersonalized}
            />
          )}
          {hotel.isRecommended && !hotel.dnaMatchScore && (
            <Badge className="bg-primary text-primary-foreground gap-1 shadow-lg">
              <Star className="h-3 w-3 fill-current" />
              Top Pick for You
            </Badge>
          )}
        </div>

        <div className="flex flex-col lg:flex-row">
          {/* Hero Image */}
          <div className="relative lg:w-80 h-56 lg:h-auto shrink-0 group">
            <img src={heroImage} alt={`${hotel.name} hotel photo`} className="w-full h-full object-cover" loading="lazy" />

            {hotel.images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => handleHeroImageNav('prev', e)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm border border-border flex items-center justify-center text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => handleHeroImageNav('next', e)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80 backdrop-blur-sm border border-border flex items-center justify-center text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>

                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {hotel.images.slice(0, 5).map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentHeroImageIndex(idx);
                      }}
                      className={cn(
                        'h-1.5 rounded-full transition-all bg-background/80',
                        idx === currentHeroImageIndex ? 'w-3' : 'w-1.5 opacity-70'
                      )}
                      aria-label={`View photo ${idx + 1}`}
                    />
                  ))}
                  {hotel.images.length > 5 && <span className="text-xs text-background ml-1">+{hotel.images.length - 5}</span>}
                </div>
              </>
            )}

            <button
              type="button"
              onClick={handleOpenHotelGallery}
              className="absolute bottom-2 right-2 bg-background/80 border border-border backdrop-blur-sm text-foreground text-xs px-2 py-1 rounded-lg flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <ImageIcon className="h-3 w-3" />
              View gallery
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 p-5">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-1">{hotel.name}</h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-0.5" aria-label={`${hotel.stars} star hotel`}>
                    {[...Array(hotel.stars)].map((_, i) => (
                      <Star key={i} className="h-3.5 w-3.5 fill-primary text-primary" />
                    ))}
                  </div>
                  <span className="text-muted-foreground">·</span>
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    {hotel.neighborhood}
                    {hotel.distanceToCenter && <span className="text-xs">({hotel.distanceToCenter})</span>}
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0">
                <button type="button" onClick={handleOpenReviews} className="group">
                  <div className="bg-primary text-primary-foreground text-sm font-bold px-2.5 py-1.5 rounded-lg group-hover:bg-primary/90 transition-colors">
                    {hotel.rating.toFixed(1)}
                  </div>
                  <p className="text-xs text-primary mt-1 group-hover:underline flex items-center gap-0.5 justify-end">
                    <MessageSquare className="h-3 w-3" />
                    {hotel.reviewCount} reviews
                  </p>
                </button>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{hotel.description}</p>

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

            <div className="flex items-end justify-between">
              <div>
                <p className={cn(
                  "text-2xl font-bold",
                  isOverBudget ? "text-amber-600" : "text-foreground"
                )}>
                  ${lowestPrice}
                  <span className="text-sm font-normal text-muted-foreground">/night</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  ${lowestPrice * nights} total for {nights} night{nights > 1 ? 's' : ''}
                </p>
                {isOverBudget && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <TrendingUp className="h-3 w-3 text-amber-500" />
                    <span className="text-xs text-amber-600 font-medium">+{budgetExcessPercent}% over hotel allocation</span>
                  </div>
                )}
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
                    View Rooms
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
                          'p-4 rounded-xl border cursor-pointer transition-all',
                          selectedRoomId === room.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                        )}
                      >
                        <div className="flex items-start gap-4">
                          {/* Room thumbnail */}
                          <div className="w-24 shrink-0">
                            <div className="aspect-[4/3] rounded-lg overflow-hidden bg-muted">
                              {room.imageUrl ? (
                                <img
                                  src={room.imageUrl}
                                  alt={`${room.name} room photo`}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground px-2 text-center">
                                  No room photo
                                </div>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={(e) => handleOpenRoomGallery(room, e)}
                              className="mt-2 text-xs text-primary hover:underline w-full text-left"
                            >
                              View photos
                            </button>
                          </div>

                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h5 className="font-medium">{room.name}</h5>
                              {selectedRoomId === room.id && <Check className="h-4 w-4 text-primary" />}
                            </div>

                            <p className="text-sm text-muted-foreground mb-2">
                              Sleeps {room.sleeps} · {room.bedType}
                            </p>

                            <div className="flex flex-wrap gap-1.5">
                              {room.freeCancellation && (
                                <Badge variant="secondary" className="text-xs">
                                  Free cancellation
                                </Badge>
                              )}
                              {room.breakfastIncluded && (
                                <Badge variant="secondary" className="text-xs">
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

                          <div className="text-right shrink-0">
                            <p className="text-xl font-bold">${room.pricePerNight}</p>
                            <p className="text-xs text-muted-foreground">per night</p>
                            <p className="text-sm font-medium mt-1 text-primary">${room.price} total</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Why Recommended */}
                {hotel.rationale && hotel.rationale.length > 0 && (
                  <div className="bg-muted/50 rounded-xl p-4">
                    <p className="text-xs font-medium mb-2 uppercase tracking-wide text-muted-foreground">Why we recommend this hotel</p>
                    <ul className="space-y-1.5">
                      {hotel.rationale.map((reason, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <Check className="h-3.5 w-3.5 text-primary shrink-0" />
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
                      <p className="text-muted-foreground text-xs uppercase tracking-wide">Check-in</p>
                      <p className="font-medium">{hotel.policies.checkIn}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs uppercase tracking-wide">Check-out</p>
                      <p className="font-medium">{hotel.policies.checkOut}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs uppercase tracking-wide">Cancellation</p>
                      <p className="font-medium text-xs">{hotel.policies.cancellation}</p>
                    </div>
                  </div>
                )}

                {/* Select Button */}
                <div className="flex justify-end pt-4 border-t border-border">
                  <Button
                    onClick={() => selectedRoomId && onSelect(selectedRoomId)}
                    disabled={isLoading || !selectedRoomId}
                    variant={isSelected ? 'default' : 'outline'}
                    size="lg"
                    className="min-w-[180px]"
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : isSelected ? (
                      <Check className="h-4 w-4 mr-2" />
                    ) : null}
                    {isSelected
                      ? 'Selected'
                      : selectedRoomId
                        ? `Select ${hotel.roomOptions.find((r) => r.id === selectedRoomId)?.name}`
                        : 'Select a room'}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Gallery Dialog */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-w-5xl p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3">
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-primary" />
              {hotel.name} · Photos
            </DialogTitle>
          </DialogHeader>

          <div className="px-5 pb-5">
            {galleryImages.length === 0 ? (
              <div className="rounded-xl border border-border bg-muted/50 p-10 text-center text-sm text-muted-foreground">
                No photos available.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative rounded-xl overflow-hidden bg-muted">
                  <div className="aspect-[16/9]">
                    <img
                      src={galleryImages[galleryIndex]}
                      alt={`Photo ${galleryIndex + 1} of ${hotel.name}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>

                  {galleryImages.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setGalleryIndex((i) => clampIndex(i - 1, galleryImages.length))}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background/80 border border-border backdrop-blur-sm flex items-center justify-center"
                        aria-label="Previous photo"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setGalleryIndex((i) => clampIndex(i + 1, galleryImages.length))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-background/80 border border-border backdrop-blur-sm flex items-center justify-center"
                        aria-label="Next photo"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </>
                  )}

                  <div className="absolute bottom-3 right-3 text-xs bg-background/80 border border-border backdrop-blur-sm rounded-lg px-2 py-1">
                    {galleryIndex + 1} / {galleryImages.length}
                  </div>
                </div>

                {galleryImages.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {galleryImages.map((img, idx) => (
                      <button
                        key={`${img}-${idx}`}
                        type="button"
                        onClick={() => setGalleryIndex(idx)}
                        className={cn(
                          'w-20 shrink-0 rounded-lg overflow-hidden border-2 transition-all',
                          idx === galleryIndex ? 'border-primary' : 'border-transparent'
                        )}
                        aria-label={`Select photo ${idx + 1}`}
                      >
                        <div className="aspect-[4/3] bg-muted">
                          <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" />
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Reviews Dialog */}
      <Dialog open={reviewsOpen} onOpenChange={setReviewsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              Reviews · {hotel.name}
            </DialogTitle>
          </DialogHeader>

          {hotel.reviews && hotel.reviews.length > 0 ? (
            <div className="max-h-[60vh] overflow-auto space-y-3 pr-1">
              {hotel.reviews.map((review, i) => (
                <div key={i} className="bg-muted/50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-sm font-medium">
                        {review.author.charAt(0)}
                      </div>
                      <span className="font-medium text-sm">{review.author}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-primary text-primary" />
                      <span className="text-sm font-medium">{review.rating}</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{review.text}</p>
                  <p className="text-xs text-muted-foreground mt-2">{review.date}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-muted/50 p-8 text-center text-sm text-muted-foreground">
              Reviews aren’t available for this hotel yet.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
