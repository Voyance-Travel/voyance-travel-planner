/**
 * DNAHotelPicks
 * 
 * Shows AI-profiled personalized hotel recommendations.
 * Used in both the PlannerHotel page and TripConfirmation flow.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Star, MapPin, Heart, ChevronRight, Loader2, Dna } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { DNARecommendedHotel, IdealHotelProfile } from '@/hooks/useDNAHotelRecommendations';

interface DNAHotelPicksProps {
  profile: IdealHotelProfile | null;
  recommendations: DNARecommendedHotel[];
  topPick: DNARecommendedHotel | null;
  isLoading: boolean;
  isProfileLoading: boolean;
  onSelectHotel?: (hotel: DNARecommendedHotel) => void;
  compact?: boolean; // For confirmation dialog mode
  className?: string;
}

export function DNAHotelPicks({
  profile,
  recommendations,
  topPick,
  isLoading,
  isProfileLoading,
  onSelectHotel,
  compact = false,
  className,
}: DNAHotelPicksProps) {
  // Loading state: AI profiling
  if (isProfileLoading) {
    return (
      <div className={cn('rounded-xl border border-primary/20 bg-primary/5 p-5', className)}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Dna className="h-5 w-5 text-primary animate-pulse" />
          </div>
          <div>
            <p className="text-sm font-medium">Analyzing your Travel DNA...</p>
            <p className="text-xs text-muted-foreground">Finding your ideal hotel style</p>
          </div>
        </div>
      </div>
    );
  }

  // Loading state: searching hotels
  if (isLoading && profile) {
    return (
      <div className={cn('rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-3', className)}>
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium">Your ideal stay</p>
        </div>
        {profile.styleDescription && (
          <p className="text-xs text-muted-foreground italic">"{profile.styleDescription}"</p>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Searching for matching hotels...
        </div>
      </div>
    );
  }

  // No results
  if (!profile || recommendations.length === 0) return null;

  const displayHotels = compact ? recommendations.slice(0, 3) : recommendations.slice(0, 5);

  return (
    <div className={cn('space-y-3', className)}>
      {/* Header with AI profile insight */}
      <div className="rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-background to-accent/5 p-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2 shrink-0">
            <Dna className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Picked for you
            </h3>
            {profile.styleDescription && (
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                {profile.styleDescription}
              </p>
            )}
            {profile.idealNeighborhoods.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {profile.idealNeighborhoods.slice(0, 3).map(n => (
                  <Badge key={n} variant="secondary" className="text-[10px] px-1.5 py-0">
                    <MapPin className="h-2.5 w-2.5 mr-0.5" />
                    {n}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Hotel cards */}
      <AnimatePresence>
        {displayHotels.map((hotel, index) => (
          <motion.div
            key={hotel.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
          >
            <DNAHotelCard
              hotel={hotel}
              isTopPick={hotel.isTopPick}
              compact={compact}
              onSelect={() => onSelectHotel?.(hotel)}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// Individual Hotel Card
// ============================================================================

function DNAHotelCard({
  hotel,
  isTopPick,
  compact,
  onSelect,
}: {
  hotel: DNARecommendedHotel;
  isTopPick: boolean;
  compact: boolean;
  onSelect?: () => void;
}) {
  const matchColor = hotel.dnaMatchScore >= 80 ? 'text-green-600' 
    : hotel.dnaMatchScore >= 60 ? 'text-amber-600' 
    : 'text-muted-foreground';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'w-full text-left rounded-xl border transition-all hover:shadow-md group',
        isTopPick
          ? 'border-primary/30 bg-primary/[0.03] hover:border-primary/50'
          : 'border-border hover:border-primary/30',
      )}
    >
      <div className={cn('flex', compact ? 'gap-3 p-3' : 'gap-4 p-4')}>
        {/* Image */}
        {hotel.imageUrl && (
          <div className={cn(
            'shrink-0 rounded-lg overflow-hidden bg-muted',
            compact ? 'w-16 h-16' : 'w-20 h-20'
          )}>
            <img
              src={hotel.imageUrl}
              alt={hotel.name}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                {isTopPick && (
                  <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0 gap-0.5">
                    <Heart className="h-2.5 w-2.5 fill-current" />
                    Top Pick
                  </Badge>
                )}
                <span className={cn('font-semibold truncate', compact ? 'text-sm' : 'text-base')}>
                  {hotel.name}
                </span>
              </div>

              {hotel.neighborhood && (
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{hotel.neighborhood}</span>
                </p>
              )}
            </div>

            {/* Match score */}
            <div className="text-right shrink-0">
              <div className={cn('text-sm font-bold', matchColor)}>
                {hotel.dnaMatchScore}%
              </div>
              <div className="text-[10px] text-muted-foreground">match</div>
            </div>
          </div>

          {/* Stars + Price row */}
          <div className="flex items-center gap-3 mt-1.5">
            {hotel.stars > 0 && (
              <div className="flex items-center gap-0.5">
                {Array.from({ length: hotel.stars }).map((_, i) => (
                  <Star key={i} className="h-3 w-3 text-amber-500 fill-amber-500" />
                ))}
              </div>
            )}
            <span className="text-sm font-semibold text-foreground">
              ${hotel.pricePerNight}<span className="text-xs text-muted-foreground font-normal">/night</span>
            </span>
          </div>

          {/* Match reasons */}
          {!compact && hotel.matchReasons.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {hotel.matchReasons.map((reason, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {reason}
                </span>
              ))}
            </div>
          )}
        </div>

        {onSelect && (
          <ChevronRight className="h-4 w-4 text-muted-foreground self-center shrink-0 group-hover:text-foreground transition-colors" />
        )}
      </div>
    </button>
  );
}

export default DNAHotelPicks;
