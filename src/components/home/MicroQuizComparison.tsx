/**
 * Interactive Micro-Quiz: "Which day would you choose?"
 * 
 * App-like itinerary preview cards that match Voyance's design system.
 * One click reveals archetype tendency and leads to full quiz.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Sunrise, Moon, Utensils, Camera, Coffee, Mountain, MapPin, Sparkles, Calendar, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';

// Two contrasting day types
const DAY_OPTIONS = {
  packed: {
    title: "The Early Bird",
    subtitle: "Dawn to dusk adventure",
    archetype: "Bucket List Sprinter",
    tendencyLabel: "You might be a Bucket List Sprinter",
    activities: [
      { time: "6:00 AM", name: "Sunrise at Senso-ji Temple", icon: Sunrise, badge: "Crowd Hack" },
      { time: "8:30 AM", name: "Tsukiji Outer Market breakfast", icon: Utensils, badge: null },
      { time: "10:30 AM", name: "teamLab Planets", icon: Camera, badge: "Pre-booked" },
      { time: "1:00 PM", name: "Harajuku backstreet walk", icon: MapPin, badge: "Voyance Find" },
      { time: "4:00 PM", name: "Shibuya Sky sunset", icon: Mountain, badge: null },
      { time: "7:00 PM", name: "Izakaya in Yurakucho", icon: Moon, badge: "Local Pick" },
    ],
    stats: { activities: 6, hours: "16", style: "Fast-paced" },
  },
  relaxed: {
    title: "The Slow Morning",
    subtitle: "Quality over quantity",
    archetype: "Milestone Voyager",
    tendencyLabel: "You might be a Milestone Voyager",
    activities: [
      { time: "10:00 AM", name: "Wake up, no alarm", icon: Coffee, badge: null },
      { time: "11:30 AM", name: "Kissaten coffee in Yanaka", icon: Coffee, badge: "Voyance Find" },
      { time: "1:30 PM", name: "Nezu Museum gardens", icon: Camera, badge: null },
      { time: "4:00 PM", name: "Shimokitazawa wander", icon: MapPin, badge: "Local Pick" },
      { time: "7:00 PM", name: "Omakase at chef's choice", icon: Utensils, badge: null },
    ],
    stats: { activities: 5, hours: "9", style: "Leisurely" },
  },
};

export function MicroQuizComparison() {
  const [selectedOption, setSelectedOption] = useState<'packed' | 'relaxed' | null>(null);
  const [hoveredOption, setHoveredOption] = useState<'packed' | 'relaxed' | null>(null);
  const navigate = useNavigate();

  const handleSelect = (option: 'packed' | 'relaxed') => {
    setSelectedOption(option);
  };

  const handleTakeQuiz = () => {
    navigate(ROUTES.QUIZ);
  };

  return (
    <div className="w-full max-w-5xl mx-auto">
      <AnimatePresence mode="wait">
        {!selectedOption ? (
          <motion.div
            key="quiz"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-8"
          >
            {/* Editorial Question */}
            <div className="text-center">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-center gap-3 mb-4"
              >
                <div className="w-12 h-px bg-border" />
                <span className="text-xs tracking-[0.3em] uppercase text-muted-foreground font-medium">
                  Quick Quiz
                </span>
                <div className="w-12 h-px bg-border" />
              </motion.div>
              <h3 className="text-3xl md:text-4xl lg:text-5xl font-serif text-foreground mb-3">
                Which day calls to you?
              </h3>
              <p className="text-lg text-muted-foreground max-w-md mx-auto">
                Same destination. Very different experience.
              </p>
            </div>

            {/* App-like Itinerary Cards */}
            <div className="grid md:grid-cols-2 gap-5">
              <ItineraryPreviewCard
                option={DAY_OPTIONS.packed}
                onClick={() => handleSelect('packed')}
                variant="packed"
                isHovered={hoveredOption === 'packed'}
                isOtherHovered={hoveredOption === 'relaxed'}
                onHover={() => setHoveredOption('packed')}
                onLeave={() => setHoveredOption(null)}
              />
              <ItineraryPreviewCard
                option={DAY_OPTIONS.relaxed}
                onClick={() => handleSelect('relaxed')}
                variant="relaxed"
                isHovered={hoveredOption === 'relaxed'}
                isOtherHovered={hoveredOption === 'packed'}
                onHover={() => setHoveredOption('relaxed')}
                onLeave={() => setHoveredOption(null)}
              />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            {/* Result Reveal */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="mb-10"
            >
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
                <Sparkles className="w-4 h-4" />
                Based on your choice
              </div>
              <h3 className="text-4xl md:text-5xl font-serif text-foreground mb-6">
                {DAY_OPTIONS[selectedOption].tendencyLabel}
              </h3>
              <p className="text-lg text-muted-foreground max-w-lg mx-auto leading-relaxed">
                {selectedOption === 'packed' 
                  ? "You want to maximize every moment. You'd rather be tired than miss something great. Your itineraries should be packed with discoveries."
                  : "You know the best memories come from slowing down. Quality over quantity. Your itineraries should leave room for spontaneity."
                }
              </p>
            </motion.div>

            {/* CTA */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-4"
            >
              <Button
                size="lg"
                onClick={handleTakeQuiz}
                className="rounded-full px-10 py-6 text-base shadow-lg hover:shadow-xl transition-shadow"
              >
                Discover your full Travel DNA
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <button
                onClick={() => setSelectedOption(null)}
                className="block mx-auto text-sm text-muted-foreground hover:text-foreground transition-colors mt-4"
              >
                ← Choose again
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface ItineraryPreviewCardProps {
  option: typeof DAY_OPTIONS.packed;
  onClick: () => void;
  variant: 'packed' | 'relaxed';
  isHovered: boolean;
  isOtherHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
}

function ItineraryPreviewCard({ option, onClick, variant, isHovered, isOtherHovered, onHover, onLeave }: ItineraryPreviewCardProps) {
  const isPacked = variant === 'packed';
  
  return (
    <motion.button
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={cn(
        "group relative w-full text-left rounded-xl overflow-hidden transition-all duration-300",
        "bg-card border border-border",
        "shadow-sm hover:shadow-lg hover:border-primary/40",
        isOtherHovered ? "opacity-50 scale-[0.98]" : "opacity-100"
      )}
    >
      {/* Card Header - App-like */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <div className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center",
            isPacked ? "bg-sky-500/10" : "bg-amber-500/10"
          )}>
            <Calendar className={cn(
              "w-4 h-4",
              isPacked ? "text-sky-600" : "text-amber-600"
            )} />
          </div>
          <div>
            <h4 className="text-base font-semibold text-foreground">{option.title}</h4>
            <p className="text-xs text-muted-foreground">{option.subtitle}</p>
          </div>
        </div>
        <ChevronRight className={cn(
          "w-5 h-5 text-muted-foreground transition-transform duration-200",
          isHovered ? "translate-x-1 text-primary" : ""
        )} />
      </div>

      {/* Stats Bar */}
      <div className="flex items-center gap-4 px-5 py-3 bg-muted/20 border-b border-border/50">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Activities:</span>
          <span className="text-xs font-semibold text-foreground">{option.stats.activities}</span>
        </div>
        <div className="w-px h-3 bg-border" />
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Duration:</span>
          <span className="text-xs font-semibold text-foreground">{option.stats.hours}h</span>
        </div>
        <div className="w-px h-3 bg-border" />
        <div className={cn(
          "text-xs font-medium px-2 py-0.5 rounded-full",
          isPacked 
            ? "bg-sky-500/10 text-sky-700" 
            : "bg-amber-500/10 text-amber-700"
        )}>
          {option.stats.style}
        </div>
      </div>

      {/* Activity List */}
      <div className="p-4 space-y-1">
        {option.activities.map((activity, i) => (
          <motion.div 
            key={i}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
              isHovered ? "bg-muted/50" : "bg-transparent"
            )}
            initial={false}
            animate={{ 
              x: isHovered ? 2 : 0,
              transition: { delay: i * 0.02, duration: 0.15 }
            }}
          >
            {/* Time */}
            <span className="text-[11px] text-muted-foreground font-mono w-14 shrink-0">
              {activity.time}
            </span>
            
            {/* Timeline dot */}
            <div className="relative flex flex-col items-center">
              <div className={cn(
                "w-2 h-2 rounded-full",
                isPacked ? "bg-sky-500" : "bg-amber-500"
              )} />
              {i < option.activities.length - 1 && (
                <div className={cn(
                  "w-px h-6 absolute top-2",
                  isPacked ? "bg-sky-200" : "bg-amber-200"
                )} />
              )}
            </div>
            
            {/* Activity name */}
            <div className="flex-1 flex items-center gap-2 min-w-0">
              <activity.icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm text-foreground truncate">{activity.name}</span>
            </div>
            
            {/* Badge */}
            {activity.badge && (
              <span className={cn(
                "text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0",
                activity.badge === "Voyance Find" && "bg-primary/10 text-primary",
                activity.badge === "Local Pick" && "bg-emerald-500/10 text-emerald-700",
                activity.badge === "Crowd Hack" && "bg-violet-500/10 text-violet-700",
                activity.badge === "Pre-booked" && "bg-blue-500/10 text-blue-700"
              )}>
                {activity.badge}
              </span>
            )}
          </motion.div>
        ))}
      </div>

      {/* Hover CTA */}
      <div className={cn(
        "px-5 py-4 border-t border-border bg-muted/30 flex items-center justify-center gap-2 transition-all duration-200",
        isHovered ? "bg-primary text-primary-foreground" : ""
      )}>
        <span className={cn(
          "text-sm font-medium",
          isHovered ? "text-primary-foreground" : "text-muted-foreground"
        )}>
          {isHovered ? "This is my vibe" : "Choose this day"}
        </span>
        <ArrowRight className={cn(
          "w-4 h-4 transition-transform",
          isHovered ? "translate-x-1 text-primary-foreground" : "text-muted-foreground"
        )} />
      </div>
    </motion.button>
  );
}

export default MicroQuizComparison;
