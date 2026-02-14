import { motion, AnimatePresence } from 'framer-motion';
import { 
  MapPin, Clock, Coffee, Utensils, Camera, 
  Footprints, ChevronDown, ChevronUp, Info, Lock
} from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import type { Itinerary, ItineraryDay, ItineraryItem } from '@/lib/trips';

interface ItineraryViewProps {
  itinerary: Itinerary;
  isLocked?: boolean;
}

const itemIcons: Record<string, React.ReactNode> = {
  ACTIVITY: <Camera className="h-4 w-4" />,
  FOOD: <Utensils className="h-4 w-4" />,
  TRANSIT: <Footprints className="h-4 w-4" />,
  BREAK: <Coffee className="h-4 w-4" />,
};

const itemColors: Record<string, string> = {
  ACTIVITY: 'bg-accent/10 text-accent border-accent/20',
  FOOD: 'bg-gold/10 text-gold border-gold/20',
  TRANSIT: 'bg-muted text-muted-foreground border-border',
  BREAK: 'bg-secondary text-secondary-foreground border-border',
};

export function ItineraryView({ itinerary, isLocked = false }: ItineraryViewProps) {
  const [expandedDays, setExpandedDays] = useState<Set<number>>(() => 
    new Set(itinerary.days.slice(0, 2).map(d => d.dayNumber))
  );

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
      {/* Summary */}
      <div className="p-6 bg-card rounded-xl border border-border">
        <h3 className="font-serif text-xl font-semibold mb-3">Trip Overview</h3>
        <p className="text-muted-foreground leading-relaxed">{itinerary.summary}</p>
      </div>

      {/* Days */}
      <div className="space-y-4">
        {itinerary.days.map((day, index) => (
          <DayCard 
            key={day.id} 
            day={day} 
            isExpanded={expandedDays.has(day.dayNumber)}
            onToggle={() => toggleDay(day.dayNumber)}
            isLocked={isLocked}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}

interface DayCardProps {
  day: ItineraryDay;
  isExpanded: boolean;
  onToggle: () => void;
  isLocked: boolean;
  index: number;
}

function DayCard({ day, isExpanded, onToggle, isLocked, index }: DayCardProps) {
  const formattedDate = new Date(day.date).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-card rounded-xl border border-border overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-secondary/50 transition-colors text-left"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="text-xs">
              Day {day.dayNumber}
            </Badge>
            <span className="text-sm text-muted-foreground">{formattedDate}</span>
          </div>
          <h4 className="font-serif text-lg font-semibold">{day.headline}</h4>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-5 w-5 text-muted-foreground" />
        )}
      </button>

      {/* Content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className={`px-6 pb-6 ${isLocked ? 'blur-locked' : ''}`}>
              {/* Rationale */}
              {day.rationale.length > 0 && (
                <div className="flex items-start gap-2 mb-4 p-3 bg-secondary/50 rounded-lg text-sm">
                  <Info className="h-4 w-4 mt-0.5 text-accent shrink-0" />
                  <div>
                    <p className="font-medium mb-1">Why this day works:</p>
                    <ul className="text-muted-foreground space-y-0.5">
                      {day.rationale.map((r, i) => (
                        <li key={i}>• {r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}

              {/* Items */}
              <div className="space-y-3">
                {day.items.map((item) => (
                  <ItemRow key={item.id} item={item} />
                ))}
              </div>
            </div>

            {/* Lock overlay */}
            {isLocked && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                <div className="text-center">
                  <Lock className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
                  <p className="font-medium">Unlock to explore your full itinerary</p>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ItemRow({ item }: { item: ItineraryItem }) {
  return (
    <div className={`p-4 rounded-lg border ${itemColors[item.type]}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5">
          {itemIcons[item.type]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {item.startTime && (
              <span className="text-xs font-mono text-muted-foreground">
                {item.startTime}{item.endTime && ` - ${item.endTime}`}
              </span>
            )}
            {item.neighborhood && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {item.neighborhood}
              </span>
            )}
          </div>
          <h5 className="font-medium">{item.title}</h5>
          {item.notes && (
            <p className="text-sm text-muted-foreground mt-1">{item.notes}</p>
          )}
          {item.rationale && item.rationale.length > 0 && (
            <div className="mt-2 text-xs text-muted-foreground">
              <span className="text-accent">Tip:</span> {item.rationale[0]}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
