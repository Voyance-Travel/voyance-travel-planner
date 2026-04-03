import { motion } from 'framer-motion';
import { Sparkles, ArrowRight, MapPin, Calendar, Users } from 'lucide-react';
import SafeImage from '@/components/SafeImage';
import { normalizeUnsplashUrl } from '@/utils/unsplash';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface DemoHeroProps {
  onStartTour: () => void;
  onSkipToPlayground: () => void;
}

export function DemoHero({ onStartTour, onSkipToPlayground }: DemoHeroProps) {
  return (
    <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden bg-gradient-to-b from-secondary/30 via-background to-background">
      {/* Subtle accent shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/4 -right-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-1/4 -left-1/4 w-[500px] h-[500px] bg-accent/5 rounded-full blur-3xl" />
      </div>
      
      {/* Floating destination cards - hidden on mobile, shown on larger screens */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none hidden lg:block">
        <motion.div
          initial={{ opacity: 0, y: 50, rotate: 3 }}
          animate={{ opacity: 1, y: 0, rotate: 3 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="absolute right-[8%] top-[18%]"
        >
          <DestinationCard 
            image={normalizeUnsplashUrl("https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=400")}
            name="Kyoto"
            days={7}
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 50, rotate: -4 }}
          animate={{ opacity: 1, y: 0, rotate: -4 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="absolute left-[5%] bottom-[22%]"
        >
          <DestinationCard 
            image={normalizeUnsplashUrl("https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=400")}
            name="Santorini"
            days={5}
          />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 50, rotate: 2 }}
          animate={{ opacity: 1, y: 0, rotate: 2 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="absolute right-[12%] bottom-[25%]"
        >
          <DestinationCard 
            image={normalizeUnsplashUrl("https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400")}
            name="Bali"
            days={6}
          />
        </motion.div>
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Badge className="mb-6 px-4 py-2 text-sm bg-primary/10 text-primary border-primary/20">
            <Sparkles className="h-4 w-4 mr-2" />
            A Travel Agent in Your Pocket
          </Badge>
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold mb-6 leading-tight text-foreground">
            See Your Perfect Trip
            <br />
            <span className="text-primary">Come to Life</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-xl mx-auto leading-relaxed">
            Explore hand-crafted itineraries. Lock your favorites, swap what doesn't fit. 
            No sign-up required.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Button 
              size="lg" 
              onClick={onStartTour}
              className="min-w-[200px] h-12 text-base font-medium"
            >
              See How It Works
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              onClick={onSkipToPlayground}
              className="min-w-[200px] h-12 text-base font-medium"
            >
              Explore Itineraries
            </Button>
          </div>

          {/* Quick stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.4 }}
            className="flex items-center justify-center gap-6 md:gap-8 text-sm text-muted-foreground"
          >
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <span>4 Destinations</span>
            </div>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span>Curated Trips</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              <span>100% Free</span>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

function DestinationCard({ image, name, days }: { image: string; name: string; days: number }) {
  return (
    <div className="w-44 bg-card rounded-xl overflow-hidden shadow-xl border border-border/50">
      <div className="h-24 relative">
        <SafeImage src={image} alt={name} className="w-full h-full object-cover" fallbackCategory="sightseeing" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute bottom-2 left-3 text-white">
          <p className="font-medium text-sm">{name}</p>
          <p className="text-xs text-white/80">{days} days</p>
        </div>
      </div>
      <div className="p-2.5 flex items-center justify-between bg-card">
        <div className="flex -space-x-1.5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-4 h-4 rounded-full bg-primary/20 border-2 border-card" />
          ))}
        </div>
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Curated</Badge>
      </div>
    </div>
  );
}
