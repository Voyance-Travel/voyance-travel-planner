import { motion } from 'framer-motion';
import { Sparkles, Play, ChevronDown, MapPin, Calendar, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface DemoHeroProps {
  onStartTour: () => void;
  onSkipToPlayground: () => void;
}

export function DemoHero({ onStartTour, onSkipToPlayground }: DemoHeroProps) {
  return (
    <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden">
      {/* Background with destination image */}
      <div className="absolute inset-0">
        <div 
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1920&q=80')`,
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-background/80 via-background/60 to-background" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-transparent to-background/90" />
      </div>
      
      {/* Floating destination cards */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 0.6, y: 0 }}
          transition={{ duration: 1.2, delay: 0.5 }}
          className="absolute right-[5%] top-[15%] rotate-3"
        >
          <DestinationCard 
            image="https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400"
            name="Kyoto"
            days={7}
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 0.5, y: 0 }}
          transition={{ duration: 1.2, delay: 0.8 }}
          className="absolute left-[3%] bottom-[20%] -rotate-6"
        >
          <DestinationCard 
            image="https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=400"
            name="Santorini"
            days={5}
          />
        </motion.div>
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <Badge className="mb-6 px-4 py-2 text-sm bg-primary/20 text-primary border-primary/30 backdrop-blur-sm">
            <Sparkles className="h-4 w-4 mr-2" />
            Interactive Demo — No Sign-up Required
          </Badge>
          
          <h1 className="text-5xl md:text-7xl font-serif font-bold mb-6 leading-tight">
            Watch AI Plan
            <br />
            <span className="bg-gradient-to-r from-primary via-primary/80 to-accent bg-clip-text text-transparent">
              Your Dream Trip
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto leading-relaxed">
            See exactly how our AI crafts personalized day-by-day itineraries. 
            Lock favorites, swap activities, and explore real trip plans.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Button 
              size="lg" 
              onClick={onStartTour}
              className="min-w-[220px] h-14 text-lg group"
            >
              <Play className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />
              Start the Tour
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              onClick={onSkipToPlayground}
              className="min-w-[220px] h-14 text-lg border-border/50 bg-background/50 backdrop-blur-sm"
            >
              Try the Playground
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </div>

          {/* Quick stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8, duration: 0.5 }}
            className="flex items-center justify-center gap-8 text-sm text-muted-foreground"
          >
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span>4 Sample Destinations</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span>Real Itineraries</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span>100% Free</span>
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          className="text-muted-foreground/50"
        >
          <ChevronDown className="h-6 w-6" />
        </motion.div>
      </motion.div>
    </section>
  );
}

function DestinationCard({ image, name, days }: { image: string; name: string; days: number }) {
  return (
    <div className="w-48 bg-card/90 backdrop-blur-md rounded-xl overflow-hidden shadow-2xl border border-border/30">
      <div className="h-28 relative">
        <img src={image} alt={name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-2 left-3 text-white">
          <p className="font-medium text-sm">{name}</p>
          <p className="text-xs text-white/80">{days} days planned</p>
        </div>
      </div>
      <div className="p-3 flex items-center justify-between">
        <div className="flex -space-x-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-5 h-5 rounded-full bg-primary/20 border-2 border-card" />
          ))}
        </div>
        <Badge variant="secondary" className="text-[10px]">AI Generated</Badge>
      </div>
    </div>
  );
}
