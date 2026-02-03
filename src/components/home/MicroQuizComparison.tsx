/**
 * Interactive Micro-Quiz: "Which day would you choose?"
 * 
 * Cinematic, magazine-style design with immersive cards.
 * One click reveals archetype tendency and leads to full quiz.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Sunrise, Moon, Utensils, Camera, Coffee, Mountain, Clock, MapPin, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';

// Two contrasting day types with imagery
const DAY_OPTIONS = {
  packed: {
    title: "The Early Bird",
    subtitle: "Dawn to dusk adventure",
    time: "6:00 AM – 10:00 PM",
    archetype: "Bucket List Sprinter",
    tendencyLabel: "You might be a Bucket List Sprinter",
    image: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800&q=80",
    activities: [
      { time: "6:00 AM", name: "Sunrise at the temple", icon: Sunrise },
      { time: "8:00 AM", name: "Street food breakfast tour", icon: Utensils },
      { time: "10:00 AM", name: "Museum district deep dive", icon: Camera },
      { time: "2:00 PM", name: "Neighborhood walking tour", icon: MapPin },
      { time: "6:00 PM", name: "Sunset viewpoint", icon: Mountain },
      { time: "8:00 PM", name: "Local dinner reservation", icon: Moon },
    ],
    vibe: "See everything. Sleep later.",
    color: "from-sky-500 to-indigo-600",
    accent: "sky",
  },
  relaxed: {
    title: "The Slow Morning",
    subtitle: "Quality over quantity",
    time: "10:00 AM – 8:00 PM",
    archetype: "Slow Traveler",
    tendencyLabel: "You might be a Slow Traveler",
    image: "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80",
    activities: [
      { time: "10:00 AM", name: "Wake up, no alarm", icon: Coffee },
      { time: "11:30 AM", name: "Long brunch at a local spot", icon: Utensils },
      { time: "2:00 PM", name: "One museum, done right", icon: Camera },
      { time: "5:00 PM", name: "Golden hour stroll", icon: Sunrise },
      { time: "7:00 PM", name: "Dinner wherever feels right", icon: Moon },
    ],
    vibe: "Less rushing. More experiencing.",
    color: "from-amber-500 to-orange-600",
    accent: "amber",
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
    <div className="w-full max-w-6xl mx-auto">
      <AnimatePresence mode="wait">
        {!selectedOption ? (
          <motion.div
            key="quiz"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-10"
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

            {/* Cinematic Cards */}
            <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
              <CinematicDayCard
                option={DAY_OPTIONS.packed}
                onClick={() => handleSelect('packed')}
                variant="packed"
                isHovered={hoveredOption === 'packed'}
                isOtherHovered={hoveredOption === 'relaxed'}
                onHover={() => setHoveredOption('packed')}
                onLeave={() => setHoveredOption(null)}
              />
              <CinematicDayCard
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

interface CinematicDayCardProps {
  option: typeof DAY_OPTIONS.packed;
  onClick: () => void;
  variant: 'packed' | 'relaxed';
  isHovered: boolean;
  isOtherHovered: boolean;
  onHover: () => void;
  onLeave: () => void;
}

function CinematicDayCard({ option, onClick, variant, isHovered, isOtherHovered, onHover, onLeave }: CinematicDayCardProps) {
  const isRelaxed = variant === 'relaxed';
  
  return (
    <motion.button
      whileHover={{ y: -4 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={cn(
        "group relative w-full text-left rounded-xl overflow-hidden transition-all duration-500",
        "border border-border/50 hover:border-primary/30",
        "shadow-md hover:shadow-xl",
        isOtherHovered ? "opacity-50 scale-[0.98]" : "opacity-100"
      )}
      style={{ minHeight: '480px' }}
    >
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src={option.image}
          alt={option.title}
          className={cn(
            "w-full h-full object-cover transition-transform duration-700",
            isHovered ? "scale-105" : "scale-100"
          )}
        />
        {/* Gradient Overlay - Stronger for readability */}
        <div className={cn(
          "absolute inset-0 transition-opacity duration-500",
          isRelaxed 
            ? "bg-gradient-to-t from-stone-950 via-stone-900/90 to-stone-800/60"
            : "bg-gradient-to-t from-slate-950 via-slate-900/90 to-slate-800/60"
        )} />
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col p-5 md:p-6">
        {/* Header Badge */}
        <div className="flex items-center mb-6">
          <div className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium tracking-wide backdrop-blur-md",
            isRelaxed 
              ? "bg-amber-500/25 text-amber-100 border border-amber-400/40"
              : "bg-sky-500/25 text-sky-100 border border-sky-400/40"
          )}>
            <Clock className="w-3 h-3" />
            {option.time}
          </div>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Main Content - Bottom */}
        <div>
          {/* Title */}
          <h4 className="text-2xl md:text-3xl font-serif text-white mb-0.5 leading-tight">
            {option.title}
          </h4>
          <p className="text-white/60 text-sm mb-5">{option.subtitle}</p>

          {/* Activity List - Cleaner layout */}
          <div className={cn(
            "space-y-2 mb-5 transition-all duration-300",
            isHovered ? "opacity-100" : "opacity-90"
          )}>
            {option.activities.map((activity, i) => (
              <motion.div 
                key={i} 
                className="flex items-center gap-2.5"
                initial={false}
                animate={{ 
                  x: isHovered ? 2 : 0,
                  transition: { delay: i * 0.02, duration: 0.2 }
                }}
              >
                <span className="text-white/40 w-12 shrink-0 font-mono text-[10px] uppercase tracking-wide">
                  {activity.time}
                </span>
                <div className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center shrink-0",
                  isRelaxed ? "bg-amber-400/20" : "bg-sky-400/20"
                )}>
                  <activity.icon className={cn(
                    "h-2.5 w-2.5",
                    isRelaxed ? "text-amber-300" : "text-sky-300"
                  )} />
                </div>
                <span className="text-white/85 text-sm leading-snug">{activity.name}</span>
              </motion.div>
            ))}
          </div>

          {/* Vibe Quote - More editorial */}
          <div className={cn(
            "flex items-start gap-2 pt-4 border-t",
            isRelaxed ? "border-amber-400/20" : "border-sky-400/20"
          )}>
            <div className={cn(
              "w-0.5 h-6 rounded-full mt-0.5 shrink-0",
              isRelaxed ? "bg-amber-400" : "bg-sky-400"
            )} />
            <p className="text-base font-serif italic text-white/80">
              "{option.vibe}"
            </p>
          </div>

          {/* Hover CTA */}
          <motion.div
            initial={false}
            animate={{ 
              opacity: isHovered ? 1 : 0,
              y: isHovered ? 0 : 8
            }}
            transition={{ duration: 0.2 }}
            className={cn(
              "mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium",
              isRelaxed 
                ? "bg-amber-500 text-white"
                : "bg-sky-500 text-white"
            )}
          >
            Choose this day
            <ArrowRight className="w-3.5 h-3.5" />
          </motion.div>
        </div>
      </div>
    </motion.button>
  );
}

export default MicroQuizComparison;
