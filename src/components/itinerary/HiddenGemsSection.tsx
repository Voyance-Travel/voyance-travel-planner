/**
 * Hidden Gems Section
 * 
 * Browsable section showing discovered hidden gems alongside each itinerary day.
 * Gems come from 5 discovery layers: DNA-Personalized, Reddit Mining, 
 * Time-Gated Intelligence, Non-English Sources, and Cluster Discovery.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Gem, MapPin, Sparkles, ChevronDown, ChevronUp, 
  Star, Clock, MessageCircle, Globe, Compass, Users, TrendingUp
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface HiddenGem {
  name: string;
  category: string;
  neighborhood: string;
  whyHidden: string;
  whyFitsYou: string;
  discoveryLayer: string;
  confidenceSignals: string[];
  tip: string;
  priceRange?: string;
  bestTime?: string;
}

interface HiddenGemsSectionProps {
  gems: HiddenGem[];
  archetype?: string;
  className?: string;
  onAddToItinerary?: (gem: HiddenGem) => void;
}

const LAYER_ICONS: Record<string, { icon: typeof Sparkles; label: string; color: string }> = {
  'DNA-Personalized': { icon: Sparkles, label: 'Made for You', color: 'text-primary' },
  'Reddit/Forum Mining': { icon: MessageCircle, label: 'Local Intel', color: 'text-orange-500' },
  'Time-Gated Intelligence': { icon: TrendingUp, label: 'New Discovery', color: 'text-emerald-500' },
  'Non-English Sources': { icon: Globe, label: 'Local Secret', color: 'text-blue-500' },
  'Cluster Discovery': { icon: Compass, label: 'Neighborhood Find', color: 'text-violet-500' },
};

const CATEGORY_EMOJI: Record<string, string> = {
  restaurant: '🍽️',
  cafe: '☕',
  bar: '🍸',
  museum: '🏛️',
  gallery: '🎨',
  market: '🛒',
  trail: '🥾',
  experience: '✨',
  shop: '🛍️',
};

function GemCard({ gem, onAdd }: { gem: HiddenGem; onAdd?: (gem: HiddenGem) => void }) {
  const [expanded, setExpanded] = useState(false);
  const layerInfo = LAYER_ICONS[gem.discoveryLayer] || LAYER_ICONS['DNA-Personalized'];
  const LayerIcon = layerInfo.icon;
  const emoji = CATEGORY_EMOJI[gem.category?.toLowerCase()] || '💎';

  return (
    <motion.div
      layout
      className={cn(
        "rounded-xl border bg-card/50 backdrop-blur-sm overflow-hidden transition-all",
        "hover:border-primary/30 hover:shadow-sm"
      )}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4"
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl flex-shrink-0 mt-0.5">{emoji}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-foreground text-sm">{gem.name}</h4>
              <Badge variant="outline" className={cn("text-[10px] gap-1 px-1.5 py-0", layerInfo.color)}>
                <LayerIcon className="h-2.5 w-2.5" />
                {layerInfo.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <MapPin className="h-3 w-3" />
              {gem.neighborhood}
              {gem.priceRange && <span className="ml-2">{gem.priceRange}</span>}
            </p>
            <p className="text-xs text-foreground/80 mt-1.5 line-clamp-2">{gem.whyFitsYou}</p>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
              {/* Why hidden */}
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">Why Most Miss This</p>
                <p className="text-xs text-foreground/70">{gem.whyHidden}</p>
              </div>

              {/* Insider tip */}
              {gem.tip && (
                <div className="bg-primary/5 rounded-lg p-2.5">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-primary mb-1">💡 Insider Tip</p>
                  <p className="text-xs text-foreground/80">{gem.tip}</p>
                </div>
              )}

              {/* Confidence signals */}
              {gem.confidenceSignals?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {gem.confidenceSignals.map((signal, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px] font-normal">
                      {signal}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Best time */}
              {gem.bestTime && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Best time: {gem.bestTime}
                </p>
              )}

              {/* Add to itinerary CTA */}
              {onAdd && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full text-xs gap-1.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAdd(gem);
                  }}
                >
                  <Sparkles className="h-3 w-3" />
                  Add to My Itinerary
                </Button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function HiddenGemsSection({ gems, archetype, className, onAddToItinerary }: HiddenGemsSectionProps) {
  const [showAll, setShowAll] = useState(false);
  
  if (!gems?.length) return null;

  const displayGems = showAll ? gems : gems.slice(0, 4);
  const hasMore = gems.length > 4;

  // Group by discovery layer for the header stats
  const layerCounts = gems.reduce((acc, g) => {
    acc[g.discoveryLayer] = (acc[g.discoveryLayer] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className={cn("space-y-4", className)}>
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Gem className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-display text-base font-semibold text-foreground">
              Hidden Gems
            </h3>
            <p className="text-xs text-muted-foreground">
              {gems.length} discoveries {archetype ? `for the ${archetype}` : ''}
            </p>
          </div>
        </div>
        
        {/* Layer breakdown chips */}
        <div className="hidden md:flex items-center gap-1.5">
          {Object.entries(layerCounts).slice(0, 3).map(([layer, count]) => {
            const info = LAYER_ICONS[layer];
            if (!info) return null;
            const Icon = info.icon;
            return (
              <Badge key={layer} variant="outline" className={cn("text-[10px] gap-1", info.color)}>
                <Icon className="h-2.5 w-2.5" />
                {count}
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Gems grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {displayGems.map((gem, idx) => (
          <GemCard key={`${gem.name}-${idx}`} gem={gem} onAdd={onAddToItinerary} />
        ))}
      </div>

      {/* Show more */}
      {hasMore && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full text-xs text-muted-foreground"
          onClick={() => setShowAll(!showAll)}
        >
          {showAll ? 'Show fewer' : `Show ${gems.length - 4} more hidden gems`}
        </Button>
      )}
    </div>
  );
}
