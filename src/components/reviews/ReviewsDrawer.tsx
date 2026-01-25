/**
 * Reviews Drawer Component
 * 
 * Displays real reviews from Google, TripAdvisor, and Foursquare
 * in a slide-out drawer with place details and rating distribution.
 */

import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Star,
  MapPin,
  Phone,
  Globe,
  Clock,
  ExternalLink,
  ThumbsUp,
  User,
  Camera,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  fetchReviews,
  type Review,
  type PlaceDetails,
  getSourceInfo,
  getRatingColor,
  formatTravelType,
  formatPriceLevel,
  truncateReview,
  sortReviews,
  getRatingDistribution,
} from '@/services/reviewsService';

interface ReviewsDrawerProps {
  open: boolean;
  onClose: () => void;
  placeName: string;
  destination: string;
  placeType?: 'restaurant' | 'attraction' | 'hotel' | 'activity';
  coordinates?: { lat: number; lng: number };
  /** Rating from the activity card - used for display consistency */
  activityRating?: number;
  activityReviewCount?: number;
}

export default function ReviewsDrawer({
  open,
  onClose,
  placeName,
  destination,
  placeType = 'activity',
  coordinates,
  activityRating,
  activityReviewCount,
}: ReviewsDrawerProps) {
  const [loading, setLoading] = useState(true);
  const [place, setPlace] = useState<PlaceDetails | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [sources, setSources] = useState<{ google: boolean; tripadvisor: boolean; foursquare: boolean }>({
    google: false,
    tripadvisor: false,
    foursquare: false,
  });
  const [sortBy, setSortBy] = useState<'helpful' | 'recent' | 'rating_high' | 'rating_low'>('helpful');
  const [expandedReviews, setExpandedReviews] = useState<Set<string>>(new Set());
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  useEffect(() => {
    if (open && placeName && destination) {
      loadReviews();
    }
  }, [open, placeName, destination]);

  async function loadReviews() {
    setLoading(true);
    try {
      const response = await fetchReviews({
        placeName,
        destination,
        placeType,
        coordinates,
        maxReviews: 15,
      });

      if (response.success) {
        setPlace(response.place);
        setReviews(response.reviews);
        setSources(response.sources);
      }
    } catch (error) {
      console.error('[ReviewsDrawer] Error loading reviews:', error);
    } finally {
      setLoading(false);
    }
  }

  const sortedReviews = sortReviews(reviews, sortBy);
  const ratingDistribution = getRatingDistribution(reviews);
  const activeSourceCount = Object.values(sources).filter(Boolean).length;

  const toggleReviewExpand = (reviewId: string) => {
    setExpandedReviews(prev => {
      const next = new Set(prev);
      if (next.has(reviewId)) {
        next.delete(reviewId);
      } else {
        next.add(reviewId);
      }
      return next;
    });
  };

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl p-0 flex flex-col">
        <SheetHeader className="p-6 border-b border-border shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <Star className="w-5 h-5 text-amber-500" />
            Reviews
          </SheetTitle>
          <SheetDescription className="line-clamp-1">
            {placeName} • {destination}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {/* Loading State */}
            {loading && (
              <div className="space-y-4">
                <Skeleton className="h-32 w-full rounded-lg" />
                <Skeleton className="h-24 w-full rounded-lg" />
                <Skeleton className="h-24 w-full rounded-lg" />
              </div>
            )}

            {/* Place Details Card */}
            {!loading && place && (
              <div className="bg-muted/50 rounded-xl p-4 space-y-4">
                {/* Photos */}
                {place.photos && place.photos.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                    {place.photos.slice(0, 5).map((photo, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedPhoto(photo)}
                        className="shrink-0 rounded-lg overflow-hidden w-24 h-24 hover:opacity-90 transition-opacity"
                      >
                        <img
                          src={photo}
                          alt={`${place.name} photo ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}

                {/* Name & Rating - use activityRating for consistency with card */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-lg">{place.name}</h3>
                    {place.categories && place.categories.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        {place.categories.slice(0, 3).join(' • ')}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-2xl font-bold ${getRatingColor(activityRating ?? place.rating)}`}>
                      {(activityRating ?? place.rating).toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {activityReviewCount ? `${activityReviewCount.toLocaleString()} reviews` : `${reviews.length} reviews shown`}
                    </div>
                  </div>
                </div>

                {/* Price Level */}
                {place.priceLevel && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-green-600 font-medium">
                      {formatPriceLevel(place.priceLevel)}
                    </span>
                    <span className="text-muted-foreground">
                      {place.priceLevel <= 1 ? 'Budget-friendly' :
                       place.priceLevel === 2 ? 'Moderate' :
                       place.priceLevel === 3 ? 'Upscale' : 'Fine Dining'}
                    </span>
                  </div>
                )}

                {/* Details Grid */}
                <div className="grid gap-2 text-sm">
                  {place.address && (
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      <span className="text-muted-foreground">{place.address}</span>
                    </div>
                  )}
                  {place.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <a href={`tel:${place.phone}`} className="text-primary hover:underline">
                        {place.phone}
                      </a>
                    </div>
                  )}
                  {place.openNow !== undefined && (
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className={place.openNow ? 'text-green-600' : 'text-red-500'}>
                        {place.openNow ? 'Open now' : 'Closed'}
                      </span>
                    </div>
                  )}
                  {place.website && (
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-muted-foreground" />
                      <a
                        href={place.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1"
                      >
                        Visit website
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}
                </div>

                {/* Sources */}
                <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                  <span className="text-xs text-muted-foreground">Data from:</span>
                  {sources.google && (
                    <Badge variant="secondary" className="text-xs">
                      {getSourceInfo('google').icon} Google
                    </Badge>
                  )}
                  {sources.tripadvisor && (
                    <Badge variant="secondary" className="text-xs">
                      {getSourceInfo('tripadvisor').icon} TripAdvisor
                    </Badge>
                  )}
                  {sources.foursquare && (
                    <Badge variant="secondary" className="text-xs">
                      {getSourceInfo('foursquare').icon} Foursquare
                    </Badge>
                  )}
                  {(sources as any).opentripmap && (
                    <Badge variant="secondary" className="text-xs">
                      📍 OpenTripMap
                    </Badge>
                  )}
                </div>
              </div>
            )}

            {/* Rating Distribution */}
            {!loading && reviews.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Rating Distribution</h4>
                <div className="space-y-1">
                  {[5, 4, 3, 2, 1].map(rating => {
                    const count = ratingDistribution[rating] || 0;
                    const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                    return (
                      <div key={rating} className="flex items-center gap-2 text-sm">
                        <span className="w-8 text-muted-foreground">{rating}★</span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              rating >= 4 ? 'bg-green-500' :
                              rating === 3 ? 'bg-yellow-500' : 'bg-red-500'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="w-8 text-muted-foreground text-right">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Sort Tabs */}
            {!loading && reviews.length > 0 && (
              <Tabs defaultValue="helpful" onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                <TabsList className="grid grid-cols-4 w-full">
                  <TabsTrigger value="helpful" className="text-xs">Most Helpful</TabsTrigger>
                  <TabsTrigger value="recent" className="text-xs">Recent</TabsTrigger>
                  <TabsTrigger value="rating_high" className="text-xs">Highest</TabsTrigger>
                  <TabsTrigger value="rating_low" className="text-xs">Lowest</TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            {/* Reviews List */}
            {!loading && (
              <div className="space-y-4">
                {sortedReviews.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Camera className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>No reviews found for this place.</p>
                    <p className="text-sm">Try searching for a different name.</p>
                  </div>
                ) : (
                  sortedReviews.map(review => {
                    const isExpanded = expandedReviews.has(review.id);
                    const { text: displayText, isTruncated } = truncateReview(review.text, 200);
                    const sourceInfo = getSourceInfo(review.source);

                    return (
                      <div
                        key={review.id}
                        className="bg-card border border-border rounded-lg p-4 space-y-3"
                      >
                        {/* Review Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            {review.authorPhoto ? (
                              <img
                                src={review.authorPhoto}
                                alt={review.authorName}
                                className="w-10 h-10 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                                <User className="w-5 h-5 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <div className="font-medium text-sm">{review.authorName}</div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{review.relativeTime}</span>
                                {review.travelType && (
                                  <>
                                    <span>•</span>
                                    <span>{formatTravelType(review.travelType)}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={`flex items-center gap-1 ${getRatingColor(review.rating)}`}>
                              <Star className="w-4 h-4 fill-current" />
                              <span className="font-medium">{review.rating}</span>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {sourceInfo.icon}
                            </Badge>
                          </div>
                        </div>

                        {/* Review Text */}
                        <p className="text-sm text-foreground/90 leading-relaxed">
                          {isExpanded ? review.text : displayText}
                        </p>

                        {/* Expand/Collapse Button */}
                        {isTruncated && (
                          <button
                            onClick={() => toggleReviewExpand(review.id)}
                            className="text-sm text-primary hover:underline flex items-center gap-1"
                          >
                            {isExpanded ? (
                              <>
                                Show less <ChevronUp className="w-4 h-4" />
                              </>
                            ) : (
                              <>
                                Read more <ChevronDown className="w-4 h-4" />
                              </>
                            )}
                          </button>
                        )}

                        {/* Helpful Count */}
                        {review.helpful !== undefined && review.helpful > 0 && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <ThumbsUp className="w-3 h-3" />
                            <span>{review.helpful} found this helpful</span>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Photo Modal */}
        {selectedPhoto && (
          <div
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => setSelectedPhoto(null)}
          >
            <img
              src={selectedPhoto}
              alt="Full size"
              className="max-w-full max-h-full object-contain rounded-lg"
            />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
