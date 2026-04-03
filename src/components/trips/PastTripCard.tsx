/**
 * Past Trip Card
 * A journal-style recap card for completed trips with inline rating + review access.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Star, Calendar, Users, MapPin, Eye, Edit3, Sparkles, BookOpen, Trash2,
} from 'lucide-react';
import { useGuideFavoritesCount } from '@/hooks/useGuideFavorites';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useTripHeroImage } from '@/hooks/useTripHeroImage';
import { useTripReview } from '@/services/tripReviewAPI';
import { TripReviewModal } from './TripReviewModal';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PastTripCardProps {
  trip: {
    id: string;
    destination: string;
    name: string;
    startDate: string | null;
    endDate: string | null;
    travelers: number;
    departureCity: string | null;
    hasItineraryData: boolean;
    metadata: Record<string, any> | null;
  };
  index?: number;
  onDelete?: (tripId: string) => void;
}

function formatShortDate(d: string | null) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function getDayCount(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const diff = Math.abs(new Date(end).getTime() - new Date(start).getTime());
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function MiniStars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={cn(
            'h-3.5 w-3.5',
            rating >= s ? 'fill-primary text-primary' : 'text-muted-foreground/20'
          )}
        />
      ))}
    </div>
  );
}

export function PastTripCard({ trip, index = 0, onDelete }: PastTripCardProps) {
  const navigate = useNavigate();
  const [reviewOpen, setReviewOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { data: review } = useTripReview(trip.id);
  const { data: favCount = 0 } = useGuideFavoritesCount(trip.id);

  const seededHero = trip.metadata?.hero_image;
  const seededHeroUrl = typeof seededHero === 'string' && seededHero.length > 0 ? seededHero : null;
  const { imageUrl, onError: onImageError, onLoad: onImageLoad } = useTripHeroImage({
    destination: trip.destination,
    seededHeroUrl,
    tripId: trip.id,
  });

  const days = getDayCount(trip.startDate, trip.endDate);
  const hasReview = !!review;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const userId = session?.session?.user?.id;
      if (!userId) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('trips')
        .delete()
        .eq('id', trip.id)
        .eq('user_id', userId)
        .select('id');
      if (error) throw error;
      if (!data || data.length === 0) throw new Error('Trip could not be deleted');
      toast.success('Trip deleted');
      onDelete?.(trip.id);
    } catch (e: any) {
      toast.error('Failed to delete trip');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: index * 0.08 }}
        className="group relative bg-card rounded-2xl overflow-hidden border border-border hover:border-primary/30 shadow-soft hover:shadow-elevated transition-all duration-500"
      >
        {/* Hero image */}
        <div
          className="relative h-44 sm:h-56 overflow-hidden cursor-pointer"
          onClick={() => navigate(`/trip/${trip.id}`)}
        >
          <img
            src={imageUrl}
            alt={trip.destination}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            onError={onImageError}
            onLoad={onImageLoad}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

          {/* Date overlay */}
          <div className="absolute top-3 right-3">
            <Badge className="bg-black/40 text-white border-0 backdrop-blur-sm text-[10px]">
              {formatShortDate(trip.startDate)}
              {days ? ` · ${days} days` : ''}
            </Badge>
          </div>

          {/* Rating overlay */}
          {hasReview && (
            <div className="absolute top-3 left-3">
              <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-sm rounded-full px-2.5 py-1">
                <MiniStars rating={review.overall_rating} />
              </div>
            </div>
          )}

          {/* Destination title */}
          <div className="absolute bottom-3 left-4 right-4">
            <h3 className="font-serif text-xl sm:text-2xl font-semibold text-white drop-shadow-lg leading-tight">
              {trip.destination}
            </h3>
            {trip.name && trip.name !== trip.destination && (
              <p className="text-white/70 text-xs mt-0.5 truncate">{trip.name}</p>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Quick stats */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {formatShortDate(trip.startDate)}
            </span>
            {trip.travelers > 1 && (
              <span className="flex items-center gap-1">
                <Users className="h-3.5 w-3.5" />
                {trip.travelers}
              </span>
            )}
            {trip.departureCity && (
              <span className="flex items-center gap-1 hidden sm:flex">
                <MapPin className="h-3.5 w-3.5" />
                {trip.departureCity}
              </span>
            )}
          </div>

          {/* Review summary or prompt */}
          {hasReview ? (
            <div className="space-y-2">
              {review.tags && review.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {review.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px] px-2 py-0">
                      {tag}
                    </Badge>
                  ))}
                  {review.tags.length > 3 && (
                    <Badge variant="secondary" className="text-[10px] px-2 py-0">
                      +{review.tags.length - 3}
                    </Badge>
                  )}
                </div>
              )}
              {review.highlight_label && (
                <p className="text-xs text-muted-foreground italic">
                  <span className="font-medium text-foreground">{review.highlight_label}:</span>{' '}
                  {review.highlight_text || 'No details'}
                </p>
              )}
              {review.review_text && (
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  "{review.review_text}"
                </p>
              )}
            </div>
          ) : (
            <button
              onClick={() => setReviewOpen(true)}
              className="w-full flex items-center gap-2 p-2.5 rounded-xl border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors text-xs text-primary font-medium"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Rate and review this trip
            </button>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            {trip.hasItineraryData && (
              <Button
              onClick={() => navigate(`/trip/${trip.id}`)}
              variant="outline"
                size="sm"
                className="flex-1 gap-1.5 text-xs h-9"
              >
                <Eye className="h-3.5 w-3.5" />
                Relive Trip
              </Button>
            )}
            <Button
              onClick={() => setReviewOpen(true)}
              variant={hasReview ? 'ghost' : 'default'}
              size="sm"
              className="flex-1 gap-1.5 text-xs h-9"
            >
              <Edit3 className="h-3.5 w-3.5" />
              {hasReview ? 'Edit Review' : 'Add Review'}
            </Button>
            {favCount > 0 && (
              <Button
                onClick={() => navigate(`/trip/${trip.id}/guide`)}
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-9"
              >
                <BookOpen className="h-3.5 w-3.5" />
                Build Guide
              </Button>
            )}
            {onDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-9 w-9 p-0 text-muted-foreground hover:text-destructive"
                    disabled={isDeleting}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete trip?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete "{trip.name || trip.destination}" and all its data. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </motion.div>

      <TripReviewModal
        isOpen={reviewOpen}
        onClose={() => setReviewOpen(false)}
        tripId={trip.id}
        destination={trip.destination}
      />
    </>
  );
}

export default PastTripCard;
