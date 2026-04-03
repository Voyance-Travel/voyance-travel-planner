import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Sparkles, 
  MapPin,
  Compass,
  ArrowRight
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import MysteryGetawayModal from './MysteryGetawayModal';
import { normalizeUnsplashUrl } from '@/utils/unsplash';

interface SurpriseTripCardProps {
  className?: string;
}

export default function SurpriseTripCard({ className }: SurpriseTripCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "relative rounded-2xl overflow-hidden",
          className
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Background Image with Overlay */}
        <div className="absolute inset-0">
          <img
            src={normalizeUnsplashUrl("https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80")}
            alt="Mystery destination"
            className="w-full h-full object-cover transition-transform duration-700"
            style={{ transform: isHovered ? 'scale(1.05)' : 'scale(1)' }}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-primary/80 via-accent/60 to-primary/40 transition-all duration-500" />
        </div>

        {/* Floating Elements */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div
            animate={{ 
              y: [0, -10, 0],
              rotate: [0, 5, 0]
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="absolute top-8 right-12 opacity-30"
          >
            <Compass className="h-16 w-16 text-white" />
          </motion.div>
          <motion.div
            animate={{ 
              y: [0, 10, 0],
              x: [0, 5, 0]
            }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
            className="absolute bottom-16 left-8 opacity-20"
          >
            <MapPin className="h-12 w-12 text-white" />
          </motion.div>
        </div>

        {/* Content */}
        <div className="relative z-10 p-8 md:p-10">
          {/* Badge */}
          <div className="mb-6">
            <Badge className="bg-white/20 backdrop-blur-sm text-white border-0 gap-1.5 px-3 py-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Uses Credits
            </Badge>
          </div>

          {/* Title & Description */}
          <div className="max-w-md">
            <motion.div
              animate={{ rotate: isHovered ? [0, -5, 5, 0] : 0 }}
              transition={{ duration: 0.5 }}
              className="inline-block mb-4"
            >
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Sparkles className="h-7 w-7 text-white" />
              </div>
            </motion.div>

            <h3 className="font-display text-3xl md:text-4xl font-bold text-white mb-3">
              Mystery Getaway
            </h3>
            
            <p className="text-white/80 text-lg mb-8 leading-relaxed">
              Let Voyance suggest 3 destinations tailored to your Travel DNA. 
              Pick your favorite and we'll help you build the perfect trip.
            </p>

            {/* Features Grid */}
            <div className="grid grid-cols-2 gap-3 mb-8">
              {[
                'AI-curated suggestions',
                'Matches your style',
                'Choose from 3 options',
                'Build your perfect trip',
              ].map((feature, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 + 0.2 }}
                  className="flex items-center gap-2"
                >
                  <div className="h-1.5 w-1.5 rounded-full bg-white/60" />
                  <span className="text-white/70 text-sm">{feature}</span>
                </motion.div>
              ))}
            </div>

            {/* CTA */}
            <Button 
              size="lg" 
              className="bg-white text-foreground hover:bg-white/90 gap-2 group shadow-lg"
              onClick={() => setModalOpen(true)}
            >
              Discover My Matches
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </div>
        </div>
      </motion.div>

      <MysteryGetawayModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
