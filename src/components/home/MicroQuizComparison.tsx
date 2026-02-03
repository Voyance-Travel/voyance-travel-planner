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
      whileHover={{ y: -8 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      className={cn(
        "group relative w-full text-left rounded-2xl overflow-hidden transition-all duration-500",
        "shadow-lg hover:shadow-2xl",
        isOtherHovered ? "opacity-60 scale-[0.98]" : "opacity-100"
      )}
      style={{ minHeight: '420px' }}
    >
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src={option.image}
          alt={option.title}
          className={cn(
            "w-full h-full object-cover transition-transform duration-700",
            isHovered ? "scale-110" : "scale-100"
          )}
        />
        {/* Gradient Overlay */}
        <div className={cn(
          "absolute inset-0 bg-gradient-to-t transition-opacity duration-500",
          isRelaxed 
            ? "from-amber-950/95 via-amber-900/70 to-amber-800/30"
            : "from-slate-950/95 via-slate-900/70 to-slate-800/30"
        )} />
        {/* Extra darkening on hover for contrast */}
        <div className={cn(
          "absolute inset-0 bg-black/20 transition-opacity duration-300",
          isHovered ? "opacity-0" : "opacity-100"
        )} />
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col p-6 md:p-8">
        {/* Header Badge */}
        <div className="flex items-center justify-between mb-auto">
          <div className={cn(
            "inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide uppercase backdrop-blur-sm",
            isRelaxed 
              ? "bg-amber-500/20 text-amber-200 border border-amber-400/30"
              : "bg-sky-500/20 text-sky-200 border border-sky-400/30"
          )}>
            <Clock className="w-3.5 h-3.5" />
            {option.time}
          </div>
        </div>

        {/* Main Content - Bottom */}
        <div className="mt-auto">
          {/* Title */}
          <h4 className="text-2xl md:text-3xl font-serif text-white mb-1">
            {option.title}
          </h4>
          <p className="text-white/70 text-sm mb-6">{option.subtitle}</p>

          {/* Activity List */}
          <div className={cn(
            "space-y-2.5 mb-6 transition-all duration-500",
            isHovered ? "opacity-100 translate-y-0" : "opacity-80 translate-y-1"
          )}>
            {option.activities.map((activity, i) => (
              <motion.div 
                key={i} 
                className="flex items-center gap-3"
                initial={false}
                animate={{ 
                  x: isHovered ? 4 : 0,
                  transition: { delay: i * 0.03 }
                }}
              >
                <span className="text-white/50 w-14 shrink-0 font-mono text-xs">
                  {activity.time}
                </span>
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center shrink-0",
                  isRelaxed ? "bg-amber-500/30" : "bg-sky-500/30"
                )}>
                  <activity.icon className={cn(
                    "h-3 w-3",
                    isRelaxed ? "text-amber-300" : "text-sky-300"
                  )} />
                </div>
                <span className="text-white/90 text-sm">{activity.name}</span>
              </motion.div>
            ))}
          </div>

          {/* Vibe Quote */}
          <div className={cn(
            "flex items-center gap-3 pt-4 border-t transition-colors duration-300",
            isRelaxed ? "border-amber-500/30" : "border-sky-500/30"
          )}>
            <div className={cn(
              "w-1 h-8 rounded-full",
              isRelaxed ? "bg-amber-400" : "bg-sky-400"
            )} />
            <p className="text-lg font-serif italic text-white/90">
              "{option.vibe}"
            </p>
          </div>

          {/* Hover CTA */}
          <motion.div
            initial={false}
            animate={{ 
              opacity: isHovered ? 1 : 0,
              y: isHovered ? 0 : 10
            }}
            className="mt-6 flex items-center gap-2 text-white font-medium"
          >
            Choose this day
            <ArrowRight className="w-4 h-4" />
          </motion.div>
        </div>
      </div>
    </motion.button>
  );
}

export default MicroQuizComparison;
