import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, Wand2, RefreshCw, MapPin, 
  ChevronLeft, ChevronRight, Check 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const FEATURES = [
  {
    id: 'quiz',
    title: 'Travel DNA Quiz',
    subtitle: '2 minutes to understand you',
    description: 'Answer a few fun questions about your travel style. Are you an early riser or night owl? Adventure seeker or culture buff? We learn what makes you tick.',
    icon: Sparkles,
    color: 'from-violet-500 to-purple-600',
    preview: {
      type: 'quiz',
      questions: ['What pace do you prefer?', 'Morning or evening person?', 'Budget or luxury?'],
    },
  },
  {
    id: 'generate',
    title: 'AI Builds Your Trip',
    subtitle: 'Personalized in seconds',
    description: 'Watch as our AI crafts a day-by-day itinerary tailored to your preferences. Every restaurant, activity, and timing optimized just for you.',
    icon: Wand2,
    color: 'from-blue-500 to-cyan-500',
    preview: {
      type: 'generation',
      steps: ['Analyzing preferences', 'Finding hidden gems', 'Optimizing schedule', 'Done!'],
    },
  },
  {
    id: 'customize',
    title: 'Make It Yours',
    subtitle: 'Swap, lock, and refine',
    description: "Don't love a suggestion? Swap it with one click. Found something perfect? Lock it in. The AI adapts around your choices.",
    icon: RefreshCw,
    color: 'from-emerald-500 to-teal-500',
    preview: {
      type: 'customize',
      actions: ['Lock favorite spots', 'Swap activities', 'Adjust timing'],
    },
  },
  {
    id: 'optimize',
    title: 'Smart Routing',
    subtitle: 'Less walking, more exploring',
    description: 'AI optimizes your daily routes so you spend less time commuting and more time experiencing. Perfect timing for every stop.',
    icon: MapPin,
    color: 'from-orange-500 to-amber-500',
    preview: {
      type: 'map',
      savings: '45 mins saved per day',
    },
  },
];

interface DemoFeatureShowcaseProps {
  onComplete: () => void;
}

export function DemoFeatureShowcase({ onComplete }: DemoFeatureShowcaseProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentFeature = FEATURES[currentIndex];
  const isLast = currentIndex === FEATURES.length - 1;

  const goNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  return (
    <section className="py-16 bg-secondary/30">
      <div className="max-w-5xl mx-auto px-4">
        {/* Progress indicators */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {FEATURES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={cn(
                "h-2 rounded-full transition-all duration-300",
                idx === currentIndex 
                  ? "w-8 bg-primary" 
                  : idx < currentIndex 
                    ? "w-2 bg-primary/50" 
                    : "w-2 bg-muted-foreground/30"
              )}
            />
          ))}
        </div>

        {/* Feature card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentFeature.id}
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -50 }}
            transition={{ duration: 0.3 }}
            className="bg-card border rounded-2xl overflow-hidden shadow-lg"
          >
            <div className="grid md:grid-cols-2 gap-0">
              {/* Left: Content */}
              <div className="p-8 md:p-12 flex flex-col justify-center">
                <Badge variant="outline" className="w-fit mb-4">
                  Step {currentIndex + 1} of {FEATURES.length}
                </Badge>
                
                <div className={cn(
                  "w-14 h-14 rounded-xl bg-gradient-to-br flex items-center justify-center mb-6",
                  currentFeature.color
                )}>
                  <currentFeature.icon className="h-7 w-7 text-white" />
                </div>

                <h2 className="text-2xl md:text-3xl font-serif font-bold mb-2">
                  {currentFeature.title}
                </h2>
                <p className="text-primary font-medium mb-4">
                  {currentFeature.subtitle}
                </p>
                <p className="text-muted-foreground leading-relaxed">
                  {currentFeature.description}
                </p>
              </div>

              {/* Right: Visual preview */}
              <div className="bg-secondary/50 p-8 md:p-12 flex items-center justify-center min-h-[300px]">
                <FeaturePreview feature={currentFeature} />
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <Button
            variant="ghost"
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </Button>

          <Button onClick={goNext} className="gap-2 min-w-[140px]">
            {isLast ? (
              <>
                Try It Now
                <Check className="h-4 w-4" />
              </>
            ) : (
              <>
                Next
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </section>
  );
}

function FeaturePreview({ feature }: { feature: typeof FEATURES[0] }) {
  if (feature.preview.type === 'quiz') {
    return (
      <div className="w-full max-w-xs space-y-3">
        {feature.preview.questions?.map((q, idx) => (
          <motion.div
            key={q}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.15 }}
            className="bg-card p-4 rounded-lg border shadow-sm"
          >
            <p className="text-sm font-medium">{q}</p>
            <div className="flex gap-2 mt-2">
              <div className="h-2 flex-1 bg-primary/20 rounded-full" />
              <div className="h-2 flex-1 bg-primary/20 rounded-full" />
            </div>
          </motion.div>
        ))}
      </div>
    );
  }

  if (feature.preview.type === 'generation') {
    return (
      <div className="w-full max-w-xs space-y-3">
        {feature.preview.steps?.map((step, idx) => (
          <motion.div
            key={step}
            initial={{ opacity: 0.3 }}
            animate={{ opacity: 1 }}
            transition={{ delay: idx * 0.5, duration: 0.3 }}
            className="flex items-center gap-3"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: idx * 0.5 + 0.2 }}
              className="w-6 h-6 rounded-full bg-primary flex items-center justify-center"
            >
              <Check className="h-3 w-3 text-primary-foreground" />
            </motion.div>
            <span className="text-sm">{step}</span>
          </motion.div>
        ))}
      </div>
    );
  }

  if (feature.preview.type === 'customize') {
    return (
      <div className="w-full max-w-xs space-y-3">
        {feature.preview.actions?.map((action, idx) => (
          <motion.div
            key={action}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.2 }}
            className="bg-card p-3 rounded-lg border shadow-sm flex items-center gap-3"
          >
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <RefreshCw className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-medium">{action}</span>
          </motion.div>
        ))}
      </div>
    );
  }

  if (feature.preview.type === 'map') {
    return (
      <div className="text-center">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-32 h-32 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-500/20 to-amber-500/20 flex items-center justify-center"
        >
          <MapPin className="h-12 w-12 text-orange-500" />
        </motion.div>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-lg font-semibold text-primary"
        >
          {feature.preview.savings}
        </motion.p>
      </div>
    );
  }

  return null;
}
