/**
 * Interactive Micro-Quiz: "Which day would you choose?"
 * 
 * Shows two visually distinct itinerary options for the same destination.
 * One click reveals archetype tendency and leads to full quiz.
 * Lives in the Traveler Identity section.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, Sun, Moon, Utensils, Camera, Coffee, Mountain, Clock, MapPin } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';

// Two contrasting day types
const DAY_OPTIONS = {
  packed: {
    title: "The Early Bird",
    time: "6:00 AM – 10:00 PM",
    archetype: "Bucket List Sprinter",
    tendencyLabel: "You might be a Bucket List Sprinter",
    activities: [
      { time: "6:00 AM", name: "Sunrise at the temple", icon: Sun },
      { time: "8:00 AM", name: "Street food breakfast tour", icon: Utensils },
      { time: "10:00 AM", name: "Museum district deep dive", icon: Camera },
      { time: "2:00 PM", name: "Neighborhood walking tour", icon: MapPin },
      { time: "6:00 PM", name: "Sunset viewpoint", icon: Mountain },
      { time: "8:00 PM", name: "Local dinner reservation", icon: Moon },
    ],
    vibe: "See everything. Sleep later.",
  },
  relaxed: {
    title: "The Slow Morning",
    time: "10:00 AM – 8:00 PM",
    archetype: "Slow Traveler",
    tendencyLabel: "You might be a Slow Traveler",
    activities: [
      { time: "10:00 AM", name: "Wake up, no alarm", icon: Coffee },
      { time: "11:30 AM", name: "Long brunch at a local spot", icon: Utensils },
      { time: "2:00 PM", name: "One museum, done right", icon: Camera },
      { time: "5:00 PM", name: "Golden hour stroll", icon: Sun },
      { time: "7:00 PM", name: "Dinner wherever feels right", icon: Moon },
    ],
    vibe: "Less rushing. More experiencing.",
  },
};

export function MicroQuizComparison() {
  const [selectedOption, setSelectedOption] = useState<'packed' | 'relaxed' | null>(null);
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
            {/* Question */}
            <div className="text-center">
              <h3 className="text-2xl md:text-3xl font-serif text-foreground mb-2">
                Which day would you choose?
              </h3>
              <p className="text-muted-foreground">
                Same destination. Very different experience.
              </p>
            </div>

            {/* Two options side by side */}
            <div className="grid md:grid-cols-2 gap-4 md:gap-6">
              <DayCard
                option={DAY_OPTIONS.packed}
                onClick={() => handleSelect('packed')}
                variant="packed"
              />
              <DayCard
                option={DAY_OPTIONS.relaxed}
                onClick={() => handleSelect('relaxed')}
                variant="relaxed"
              />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-8"
          >
            {/* Result */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="mb-8"
            >
              <p className="text-lg text-muted-foreground mb-2">Based on that choice...</p>
              <h3 className="text-3xl md:text-4xl font-serif text-foreground mb-4">
                {DAY_OPTIONS[selectedOption].tendencyLabel}
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                {selectedOption === 'packed' 
                  ? "You want to maximize every moment. You'd rather be tired than miss something great."
                  : "You know the best memories come from slowing down. Quality over quantity."
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
                className="rounded-full px-8"
              >
                Take the full quiz
                <ArrowRight className="ml-2 w-4 h-4" />
              </Button>
              <button
                onClick={() => setSelectedOption(null)}
                className="block mx-auto text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Choose again
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

interface DayCardProps {
  option: typeof DAY_OPTIONS.packed;
  onClick: () => void;
  variant: 'packed' | 'relaxed';
}

function DayCard({ option, onClick, variant }: DayCardProps) {
  const isRelaxed = variant === 'relaxed';
  
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "w-full text-left p-6 rounded-2xl border-2 transition-all duration-300",
        "hover:shadow-xl hover:border-primary/50",
        isRelaxed 
          ? "bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border-amber-200 dark:border-amber-800/50"
          : "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/20 border-blue-200 dark:border-blue-800/50"
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h4 className="font-semibold text-lg text-foreground">{option.title}</h4>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            {option.time}
          </div>
        </div>
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center",
          isRelaxed ? "bg-amber-100 dark:bg-amber-900/50" : "bg-blue-100 dark:bg-blue-900/50"
        )}>
          {isRelaxed ? (
            <Coffee className={cn("h-5 w-5", isRelaxed ? "text-amber-600" : "text-blue-600")} />
          ) : (
            <Mountain className="h-5 w-5 text-blue-600" />
          )}
        </div>
      </div>

      {/* Activities */}
      <div className="space-y-2 mb-4">
        {option.activities.map((activity, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            <span className="text-muted-foreground w-16 shrink-0 font-mono text-xs">
              {activity.time}
            </span>
            <activity.icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-foreground">{activity.name}</span>
          </div>
        ))}
      </div>

      {/* Vibe */}
      <p className={cn(
        "text-sm font-medium italic",
        isRelaxed ? "text-amber-700 dark:text-amber-400" : "text-blue-700 dark:text-blue-400"
      )}>
        "{option.vibe}"
      </p>
    </motion.button>
  );
}

export default MicroQuizComparison;
