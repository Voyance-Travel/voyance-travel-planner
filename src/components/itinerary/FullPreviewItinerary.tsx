/**
 * Full Preview Itinerary Display
 * 
 * Shows the complete itinerary with real venue names, times, and reasoning
 * but with GATED details (addresses, hours, tips, photos, booking links).
 * 
 * Psychology: User sees exactly what they're getting, but can't ACT on it.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  MapPin, Clock, Utensils, Camera, Landmark, ShoppingBag, 
  Bus, Hotel, Lock, ChevronDown, ChevronUp, Sparkles,
  Check, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// =============================================================================
// Types
// =============================================================================

interface PreviewActivity {
  time: string;
  venueName: string;
  venueType: 'dining' | 'cultural' | 'nature' | 'shopping' | 'entertainment' | 'transport' | 'accommodation';
  neighborhood: string;
  reasoning: string;
  durationMinutes: number;
  // GATED - null in preview
  address?: null;
  hours?: null;
  photoUrl?: null;
  bookingUrl?: null;
  tips?: null;
  coordinates?: null;
}

interface PreviewDay {
  dayNumber: number;
  date: string;
  title: string;
  theme: string;
  activities: PreviewActivity[];
}

interface FullPreview {
  destination: string;
  country?: string;
  totalDays: number;
  totalActivities: number;
  days: PreviewDay[];
  tripSummary: {
    experienceCount: number;
    diningCount: number;
    culturalCount: number;
    uniqueNeighborhoods: string[];
  };
  dnaAlignment: string[];
  isPreview: true;
  gatedFeatures: string[];
  generatedAt: string;
}

interface ConversionCopy {
  headline: string;
  subheadline: string;
  cta: string;
  valueProps: string[];
}

interface FullPreviewItineraryProps {
  preview: FullPreview;
  conversionCopy: ConversionCopy;
  onUnlock: () => void;
  isUnlocking?: boolean;
  price?: number;
}

// =============================================================================
// Icon Mapping
// =============================================================================

const VENUE_ICONS: Record<string, React.ElementType> = {
  dining: Utensils,
  cultural: Landmark,
  nature: Camera,
  shopping: ShoppingBag,
  entertainment: Sparkles,
  transport: Bus,
  accommodation: Hotel,
};

const VENUE_COLORS: Record<string, string> = {
  dining: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  cultural: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  nature: 'bg-green-500/20 text-green-400 border-green-500/30',
  shopping: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  entertainment: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  transport: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  accommodation: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
};

// =============================================================================
// Activity Card Component
// =============================================================================

function PreviewActivityCard({ activity, index }: { activity: PreviewActivity; index: number }) {
  const Icon = VENUE_ICONS[activity.venueType] || MapPin;
  const colorClass = VENUE_COLORS[activity.venueType] || 'bg-muted text-muted-foreground';
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="relative pl-8 pb-6 last:pb-0"
    >
      {/* Timeline line */}
      <div className="absolute left-3 top-6 bottom-0 w-px bg-border last:hidden" />
      
      {/* Timeline dot */}
      <div className={cn(
        "absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center border",
        colorClass
      )}>
        <Icon className="w-3 h-3" />
      </div>
      
      <div className="space-y-2">
        {/* Time & Venue */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="text-sm font-medium text-primary">{activity.time}</span>
            <h4 className="font-semibold text-foreground">{activity.venueName}</h4>
          </div>
          <Badge variant="outline" className="text-xs shrink-0">
            {activity.neighborhood}
          </Badge>
        </div>
        
        {/* Reasoning - the value prop */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          {activity.reasoning}
        </p>
        
        {/* Gated info teaser */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground/60">
          <span className="flex items-center gap-1">
            <Lock className="w-3 h-3" />
            <span className="line-through">Address</span>
          </span>
          <span className="flex items-center gap-1">
            <Lock className="w-3 h-3" />
            <span className="line-through">Hours</span>
          </span>
          <span className="flex items-center gap-1">
            <Lock className="w-3 h-3" />
            <span className="line-through">Tips</span>
          </span>
        </div>
      </div>
    </motion.div>
  );
}

// =============================================================================
// Day Card Component
// =============================================================================

function PreviewDayCard({ day, isExpanded, onToggle }: { 
  day: PreviewDay; 
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return `Day ${day.dayNumber}`;
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch { return `Day ${day.dayNumber}`; }
  };

  return (
    <Card className="overflow-hidden border-border/50 bg-card/50">
      {/* Day Header - Always Visible */}
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
            <span className="text-lg font-bold text-primary">{day.dayNumber}</span>
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-foreground">{day.title}</h3>
            <p className="text-xs text-muted-foreground">
              {formatDate(day.date)} · {day.theme} · {day.activities.length} stops
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-5 h-5 text-muted-foreground" />
        )}
      </button>
      
      {/* Activities - Expandable */}
      {isExpanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="px-4 pb-4 pt-2 border-t border-border/30"
        >
          {day.activities.map((activity, idx) => (
            <PreviewActivityCard key={idx} activity={activity} index={idx} />
          ))}
        </motion.div>
      )}
    </Card>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function FullPreviewItinerary({
  preview,
  conversionCopy,
  onUnlock,
  isUnlocking = false,
  price = 29,
}: FullPreviewItineraryProps) {
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([1])); // Day 1 expanded by default
  
  const toggleDay = (dayNumber: number) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dayNumber)) {
        next.delete(dayNumber);
      } else {
        next.add(dayNumber);
      }
      return next;
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <Badge variant="secondary" className="mb-2">
          <Sparkles className="w-3 h-3 mr-1" />
          Your Personalized Itinerary
        </Badge>
        <h2 className="text-2xl md:text-3xl font-bold text-foreground">
          {conversionCopy.headline}
        </h2>
        <p className="text-muted-foreground">
          {conversionCopy.subheadline}
        </p>
      </div>

      {/* Trip Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-muted/30 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-primary">{preview.totalDays}</div>
          <div className="text-xs text-muted-foreground">Days</div>
        </div>
        <div className="bg-muted/30 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-primary">{preview.totalActivities}</div>
          <div className="text-xs text-muted-foreground">Experiences</div>
        </div>
        <div className="bg-muted/30 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-primary">{preview.tripSummary.diningCount}</div>
          <div className="text-xs text-muted-foreground">Restaurants</div>
        </div>
        <div className="bg-muted/30 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-primary">{preview.tripSummary.uniqueNeighborhoods.length}</div>
          <div className="text-xs text-muted-foreground">Neighborhoods</div>
        </div>
      </div>

      {/* DNA Alignment */}
      {preview.dnaAlignment.length > 0 && (
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <h4 className="text-sm font-medium text-primary mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Built for Your Travel Style
          </h4>
          <ul className="space-y-1">
            {preview.dnaAlignment.map((alignment, idx) => (
              <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                {alignment}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Day Cards */}
      <div className="space-y-3">
        {preview.days.map((day) => (
          <PreviewDayCard
            key={day.dayNumber}
            day={day}
            isExpanded={expandedDays.has(day.dayNumber)}
            onToggle={() => toggleDay(day.dayNumber)}
          />
        ))}
      </div>

      {/* Conversion CTA */}
      <div className="sticky bottom-4 z-10">
        <Card className="p-4 bg-card/95 backdrop-blur border-primary/30 shadow-lg">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-center md:text-left">
              <h4 className="font-semibold text-foreground">
                You've seen the plan. Now get everything you need to actually do it.
              </h4>
              <ul className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1 justify-center md:justify-start">
                {conversionCopy.valueProps.map((prop, idx) => (
                  <li key={idx} className="flex items-center gap-1">
                    <Check className="w-3 h-3 text-primary" />
                    {prop}
                  </li>
                ))}
              </ul>
            </div>
            <Button
              size="lg"
              onClick={onUnlock}
              disabled={isUnlocking}
              className="w-full md:w-auto shrink-0 gap-2"
            >
              {isUnlocking ? (
                'Processing...'
              ) : (
                <>
                  {conversionCopy.cta} - ${price}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>

      {/* Gated Features List */}
      <div className="text-center text-xs text-muted-foreground">
        <p className="mb-2">What's included when you unlock:</p>
        <div className="flex flex-wrap justify-center gap-2">
          {preview.gatedFeatures.map((feature, idx) => (
            <Badge key={idx} variant="outline" className="text-xs">
              <Lock className="w-3 h-3 mr-1" />
              {feature}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

export default FullPreviewItinerary;
