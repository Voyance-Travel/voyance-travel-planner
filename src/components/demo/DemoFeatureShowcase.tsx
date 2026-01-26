import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sparkles, Wand2, RefreshCw, MapPin, Lock, Star,
  ChevronLeft, ChevronRight, Check, Clock, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const FEATURES = [
  {
    id: 'quiz',
    title: 'Travel DNA Quiz',
    subtitle: '2 minutes to understand you',
    description: 'Answer fun questions about your travel style. Early bird or night owl? Adventure seeker or culture lover? We build your unique traveler profile.',
    icon: Sparkles,
    color: 'from-violet-500 to-purple-600',
  },
  {
    id: 'generate',
    title: 'AI Builds Your Trip',
    subtitle: 'Personalized in seconds',
    description: 'Watch our AI craft a day-by-day itinerary tailored to your preferences. Every restaurant, activity, and timing optimized just for you.',
    icon: Wand2,
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'customize',
    title: 'Lock & Swap',
    subtitle: 'Make it yours',
    description: "Love something? Lock it in. Not feeling an activity? Swap it with one click. The AI adapts around your choices instantly.",
    icon: RefreshCw,
    color: 'from-emerald-500 to-teal-500',
  },
  {
    id: 'optimize',
    title: 'Smart Routing',
    subtitle: 'Less walking, more exploring',
    description: 'AI optimizes your daily routes so you spend less time commuting and more time experiencing. Perfect timing for every stop.',
    icon: MapPin,
    color: 'from-orange-500 to-amber-500',
  },
];

interface DemoFeatureShowcaseProps {
  onComplete: () => void;
}

export function DemoFeatureShowcase({ onComplete }: DemoFeatureShowcaseProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentFeature = FEATURES[currentIndex];
  const isLast = currentIndex === FEATURES.length - 1;

  // Auto-advance option
  const [autoPlay, setAutoPlay] = useState(false);
  useEffect(() => {
    if (!autoPlay) return;
    const timer = setTimeout(() => {
      if (isLast) {
        onComplete();
      } else {
        setCurrentIndex(prev => prev + 1);
      }
    }, 4000);
    return () => clearTimeout(timer);
  }, [currentIndex, autoPlay, isLast, onComplete]);

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
    <section className="py-16 min-h-screen flex items-center bg-gradient-to-b from-background to-secondary/20">
      <div className="max-w-6xl mx-auto px-4 w-full">
        {/* Progress bar */}
        <div className="flex items-center justify-center gap-3 mb-12">
          {FEATURES.map((feature, idx) => (
            <button
              key={feature.id}
              onClick={() => setCurrentIndex(idx)}
              className="group flex items-center gap-2"
            >
              <div className={cn(
                "h-1.5 rounded-full transition-all duration-500",
                idx === currentIndex 
                  ? "w-16 bg-primary" 
                  : idx < currentIndex 
                    ? "w-8 bg-primary/60" 
                    : "w-8 bg-muted"
              )} />
            </button>
          ))}
        </div>

        {/* Feature content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentFeature.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center"
          >
            {/* Left: Content */}
            <div className="order-2 lg:order-1">
              <Badge variant="outline" className="mb-6 text-sm">
                Step {currentIndex + 1} of {FEATURES.length}
              </Badge>
              
              <div className={cn(
                "w-16 h-16 rounded-2xl bg-gradient-to-br flex items-center justify-center mb-6 shadow-lg",
                currentFeature.color
              )}>
                <currentFeature.icon className="h-8 w-8 text-white" />
              </div>

              <h2 className="text-3xl md:text-4xl font-serif font-bold mb-3">
                {currentFeature.title}
              </h2>
              <p className="text-lg text-primary font-medium mb-4">
                {currentFeature.subtitle}
              </p>
              <p className="text-muted-foreground text-lg leading-relaxed mb-8">
                {currentFeature.description}
              </p>

              {/* Navigation */}
              <div className="flex items-center gap-4">
                <Button
                  variant="ghost"
                  onClick={goPrev}
                  disabled={currentIndex === 0}
                  className="gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>

                <Button onClick={goNext} size="lg" className="gap-2 min-w-[160px]">
                  {isLast ? (
                    <>
                      Try It Yourself
                      <ArrowRight className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Continue
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Right: Interactive Preview */}
            <div className="order-1 lg:order-2">
              <Card className="p-6 bg-card/80 backdrop-blur-sm border-border/50 shadow-2xl">
                <FeaturePreview feature={currentFeature} />
              </Card>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Skip option */}
        <div className="text-center mt-12">
          <Button
            variant="link"
            onClick={onComplete}
            className="text-muted-foreground hover:text-foreground"
          >
            Skip tour and try playground →
          </Button>
        </div>
      </div>
    </section>
  );
}

function FeaturePreview({ feature }: { feature: typeof FEATURES[0] }) {
  if (feature.id === 'quiz') {
    return <QuizPreview />;
  }
  if (feature.id === 'generate') {
    return <GenerationPreview />;
  }
  if (feature.id === 'customize') {
    return <CustomizePreview />;
  }
  if (feature.id === 'optimize') {
    return <RoutePreview />;
  }
  return null;
}

function QuizPreview() {
  const [selected, setSelected] = useState<number | null>(null);
  const options = ['Relaxed Explorer', 'Adventure Seeker', 'Culture Enthusiast', 'Foodie Traveler'];

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <p className="text-sm text-muted-foreground mb-2">Question 3 of 8</p>
        <h3 className="text-lg font-medium">What's your travel style?</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {options.map((option, idx) => (
          <motion.button
            key={option}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: idx * 0.1 }}
            onClick={() => setSelected(idx)}
            className={cn(
              "p-4 rounded-xl border-2 text-left transition-all",
              selected === idx 
                ? "border-primary bg-primary/10" 
                : "border-border hover:border-primary/50"
            )}
          >
            <span className="text-sm font-medium">{option}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

function GenerationPreview() {
  const [step, setStep] = useState(0);
  const steps = [
    { label: 'Analyzing preferences', icon: Sparkles },
    { label: 'Finding local gems', icon: MapPin },
    { label: 'Optimizing schedule', icon: Clock },
    { label: 'Itinerary ready!', icon: Check },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setStep(prev => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 800);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Wand2 className="h-4 w-4" />
          </motion.div>
          Building "Bali Wellness Retreat"
        </div>
      </div>
      <div className="space-y-3">
        {steps.map((s, idx) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0.3, x: -10 }}
            animate={{ 
              opacity: idx <= step ? 1 : 0.3, 
              x: idx <= step ? 0 : -10 
            }}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg transition-colors",
              idx <= step ? "bg-primary/10" : "bg-muted/30"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
              idx < step ? "bg-primary text-primary-foreground" : 
              idx === step ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
            )}>
              {idx < step ? <Check className="h-4 w-4" /> : <s.icon className="h-4 w-4" />}
            </div>
            <span className={cn(
              "text-sm font-medium",
              idx <= step ? "text-foreground" : "text-muted-foreground"
            )}>{s.label}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function CustomizePreview() {
  const [locked, setLocked] = useState(false);
  const [swapped, setSwapped] = useState(false);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground text-center mb-4">
        Click to interact with activities
      </p>
      
      {/* Activity cards that look like real ones */}
      <motion.div
        className={cn(
          "flex items-stretch rounded-lg border overflow-hidden transition-all",
          locked ? "border-primary bg-primary/5" : "border-border hover:bg-secondary/30"
        )}
      >
        <div className="w-16 shrink-0 p-3 border-r border-border bg-gradient-to-b from-secondary/20 to-secondary/5">
          <span className="text-xs font-medium">09:00</span>
          <p className="text-[10px] text-muted-foreground">2h</p>
        </div>
        <div className="w-16 h-16 shrink-0 border-r border-border overflow-hidden">
          <img 
            src="https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=200" 
            alt="Temple"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Cultural</Badge>
            <Badge variant="secondary" className="text-[10px] gap-0.5 bg-amber-500/10 text-amber-600 border-none">
              <Star className="h-2.5 w-2.5 fill-amber-500" /> 4.9
            </Badge>
          </div>
          <p className="text-sm font-medium">Tanah Lot Temple</p>
        </div>
        <button 
          onClick={() => setLocked(!locked)}
          className="px-3 border-l border-border hover:bg-secondary/50 transition-colors"
        >
          <Lock className={cn(
            "h-4 w-4 transition-colors",
            locked ? "text-primary fill-primary/20" : "text-muted-foreground"
          )} />
        </button>
      </motion.div>

      <motion.div
        animate={swapped ? { scale: [1, 0.95, 1] } : {}}
        className="flex items-stretch rounded-lg border border-border overflow-hidden hover:bg-secondary/30 transition-colors"
      >
        <div className="w-16 shrink-0 p-3 border-r border-border bg-gradient-to-b from-secondary/20 to-secondary/5">
          <span className="text-xs font-medium">12:00</span>
          <p className="text-[10px] text-muted-foreground">1.5h</p>
        </div>
        <div className="w-16 h-16 shrink-0 border-r border-border overflow-hidden">
          <img 
            src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200" 
            alt="Food"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Dining</Badge>
          </div>
          <p className="text-sm font-medium">
            {swapped ? 'Warung Local Cuisine' : 'Bebek Bengil Restaurant'}
          </p>
        </div>
        <button 
          onClick={() => setSwapped(!swapped)}
          className="px-3 border-l border-border hover:bg-secondary/50 transition-colors"
        >
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
        </button>
      </motion.div>

      <p className="text-xs text-center text-muted-foreground mt-4">
        💡 Click lock or swap icons to see the interaction
      </p>
    </div>
  );
}

function RoutePreview() {
  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
          45 min saved today
        </Badge>
      </div>
      
      {/* Visual route timeline */}
      <div className="relative pl-6">
        <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-gradient-to-b from-primary via-primary/50 to-primary/20" />
        
        {[
          { time: '09:00', place: 'Villa Amrita', type: 'Start' },
          { time: '09:15', place: 'Tanah Lot Temple', type: '15 min drive' },
          { time: '11:30', place: 'Tirta Empul', type: '25 min drive' },
          { time: '14:00', place: 'Ubud Market', type: '10 min walk' },
        ].map((stop, idx) => (
          <motion.div
            key={stop.place}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.2 }}
            className="relative mb-4 last:mb-0"
          >
            <div className="absolute -left-4 w-4 h-4 rounded-full bg-primary border-2 border-background" />
            <div className="pl-4">
              <p className="text-xs text-muted-foreground">{stop.time}</p>
              <p className="text-sm font-medium">{stop.place}</p>
              <p className="text-xs text-primary">{stop.type}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
