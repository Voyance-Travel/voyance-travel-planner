import { motion } from 'framer-motion';
import { Info, ArrowRight, TrendingUp, Star, Check } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getTrendingStatus, isInSeason } from '@/utils/trending';

interface TrendMetrics {
  current: {
    searchVolume: number;
    bookingCount: number;
    timestamp: number;
  };
  previous: {
    searchVolume: number;
    bookingCount: number;
    timestamp: number;
  };
}

interface RefinedDestinationCardProps {
  id: string;
  city: string;
  country: string;
  imageUrl: string;
  description: string;
  trendMetrics?: TrendMetrics;
  featuredStatus?: "most-booked" | "trending" | "editor-choice";
  themes: string[];
  optimalMonths?: number[];
  bestTimeToVisit?: string;
  budget?: "Budget" | "Moderate" | "Premium" | "Luxury";
  avgHotelCost?: number;
  reviewScore?: number;
  detailUrl?: string;
  className?: string;
}

export default function RefinedDestinationCard({
  id,
  city,
  country,
  imageUrl,
  description,
  trendMetrics,
  featuredStatus,
  themes = [],
  optimalMonths,
  reviewScore,
  className = ""
}: RefinedDestinationCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const navigate = useNavigate();

  const formattedThemes = themes
    .slice(0, 2)
    .map((theme) => theme.charAt(0).toUpperCase() + theme.slice(1));

  const getStatusBadge = () => {
    if (featuredStatus === "most-booked") {
      return { text: "Most Booked", variant: "secondary" as const };
    }
    
    if (featuredStatus === "trending") {
      const trendData = trendMetrics ? getTrendingStatus(trendMetrics) : null;
      return { 
        text: `Up ${trendData?.percentage || 12}% this week`, 
        variant: "secondary" as const,
        icon: TrendingUp 
      };
    }
    
    if (featuredStatus === "editor-choice") {
      return { text: "Editor's Choice", variant: "secondary" as const };
    }
    
    return null;
  };

  const getTrendDisplay = () => {
    if (!trendMetrics) return null;
    
    const current = trendMetrics.current.searchVolume + trendMetrics.current.bookingCount;
    const previous = trendMetrics.previous.searchVolume + trendMetrics.previous.bookingCount;
    
    if (previous === 0) return null;
    
    return ((current - previous) / previous * 100).toFixed(0);
  };

  // Use isInSeason from trending utils
  const isOptimalTime = optimalMonths ? isInSeason(optimalMonths) : false;
  const statusBadge = getStatusBadge();
  const trendDisplay = getTrendDisplay();

  const handleExploreClick = () => {
    setIsNavigating(true);
    const slug = `${city}-${country}`.toLowerCase().replace(/\s+/g, "-");
    
    try {
      localStorage.setItem(
        "voyanceTrip",
        JSON.stringify({
          destination: { slug, city, country, id },
          currentStep: "hotels",
          updatedAt: new Date().toISOString()
        })
      );
    } catch {
      // Continue even if localStorage fails
    }
    
    navigate(`/start/hotels?destination=${slug}`);
  };

  return (
    <motion.div
      className={`group rounded-xl overflow-hidden border border-border bg-card flex flex-col h-full shadow-sm hover:shadow-lg transition-shadow duration-300 ${className}`}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.3 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image Container */}
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <motion.div
          animate={isHovered ? { scale: 1.05 } : { scale: 1 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="h-full w-full"
        >
          <img
            src={imageUrl}
            alt={`${city}, ${country}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </motion.div>

        {/* Status Badge - Top Left */}
        <div className="absolute top-3 left-3 flex flex-col gap-2 z-10">
          {statusBadge && (
            <Badge 
              variant={statusBadge.variant}
              className="bg-background/90 backdrop-blur-sm text-foreground shadow-sm"
            >
              {statusBadge.icon && <statusBadge.icon className="w-3 h-3 mr-1" />}
              {statusBadge.text}
            </Badge>
          )}
        </div>

        {/* Best Time Badge - Top Right */}
        {isOptimalTime && (
          <div className="absolute top-3 right-3 z-10">
            <Badge className="bg-emerald-100/90 text-emerald-700 backdrop-blur-sm">
              <Check className="w-3 h-3 mr-1" />
              Best Time to Visit
            </Badge>
          </div>
        )}

        {/* Gradient Overlay with Title */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
          <h3 className="text-xl font-medium text-white">
            {city}
            <span className="text-sm font-normal text-white/90 ml-2">
              {country}
            </span>
          </h3>
          <p className="text-white/90 text-sm line-clamp-1">
            {description}
          </p>
        </div>
      </div>

      {/* Card Content */}
      <div className="p-4 flex flex-col flex-grow">
        {/* Themes */}
        <div className="flex flex-wrap gap-2 mb-3 min-h-[28px]">
          {formattedThemes.map((theme, index) => (
            <Badge key={index} variant="outline" className="text-xs">
              {theme}
            </Badge>
          ))}
        </div>

        {/* Trend Indicator */}
        {trendDisplay && (
          <div className="text-sm text-muted-foreground mb-3 flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
            <span className="font-medium text-foreground">
              {trendDisplay}% more interest this week
            </span>
          </div>
        )}

        {/* Rating */}
        {reviewScore && (
          <div className="text-sm text-muted-foreground mb-3 flex items-center gap-2">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            <span className="font-medium text-foreground">
              {reviewScore.toFixed(1)}
            </span>
            <span className="text-muted-foreground">· Voyance Verified</span>
            
            {/* Info tooltip */}
            <div className="group/tooltip relative inline-flex">
              <Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-3 bg-popover text-popover-foreground text-xs rounded-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none z-50 border border-border shadow-lg">
                <p className="font-semibold mb-1">What is Voyance Verified?</p>
                <p className="text-muted-foreground leading-relaxed">
                  This rating combines expert travel assessments, historical visitor data, and quality scores.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-auto pt-3">
          <Button
            variant="outline"
            onClick={handleExploreClick}
            disabled={isNavigating}
            className="w-full group/btn"
          >
            {isNavigating ? "Loading..." : `Explore ${city}`}
            <ArrowRight className="ml-2 w-4 h-4 transition-transform group-hover/btn:translate-x-1" />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
