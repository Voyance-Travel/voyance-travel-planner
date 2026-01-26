import { motion } from 'framer-motion';
import { Sparkles, Play, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface DemoHeroProps {
  onStartTour: () => void;
  onSkipToPlayground: () => void;
}

export function DemoHero({ onStartTour, onSkipToPlayground }: DemoHeroProps) {
  return (
    <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-accent/5 to-background" />
      
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-96 h-96 rounded-full bg-primary/5 blur-3xl"
            animate={{
              x: [0, 50, 0],
              y: [0, 30, 0],
              scale: [1, 1.1, 1],
            }}
            transition={{
              duration: 10 + i * 2,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 2,
            }}
            style={{
              left: `${20 + i * 30}%`,
              top: `${10 + i * 20}%`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Badge variant="secondary" className="mb-6 px-4 py-2 text-sm">
            <Sparkles className="h-4 w-4 mr-2" />
            Free Interactive Demo
          </Badge>
          
          <h1 className="text-4xl md:text-6xl font-serif font-bold mb-6 leading-tight">
            See How AI Plans
            <br />
            <span className="text-primary">Your Perfect Trip</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-xl mx-auto">
            Watch our AI build a personalized itinerary in 60 seconds. 
            No sign-up. No payment. Just magic.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button 
              size="lg" 
              onClick={onStartTour}
              className="min-w-[200px] h-14 text-lg"
            >
              <Play className="h-5 w-5 mr-2" />
              Start the Tour
            </Button>
            <Button 
              size="lg" 
              variant="ghost" 
              onClick={onSkipToPlayground}
              className="min-w-[200px] h-14 text-lg text-muted-foreground"
            >
              Skip to Playground
              <ArrowDown className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
