import { motion } from 'framer-motion';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface HeroSectionProps {
  onFilterToggle: () => void;
  onBrowseClick: () => void;
}

export default function HeroSection({ onFilterToggle, onBrowseClick }: HeroSectionProps) {
  return (
    <section className="relative pt-32 pb-20 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1920"
          alt="Scenic lake and mountains"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-background" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-4xl md:text-6xl font-display font-bold text-white mb-4">
            Explore the World
          </h1>
          <p className="text-lg text-white/80 mb-8 max-w-xl mx-auto">
            Discover destinations curated for your travel style. From hidden gems to iconic landmarks.
          </p>

          {/* Search Bar */}
          <div className="flex gap-2 max-w-xl mx-auto bg-white/95 backdrop-blur-sm rounded-full p-2 shadow-xl">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Where do you want to go?"
                className="pl-12 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
              />
            </div>
            <Button onClick={onFilterToggle} variant="ghost" size="icon" className="shrink-0">
              <SlidersHorizontal className="h-5 w-5" />
            </Button>
            <Button onClick={onBrowseClick} className="rounded-full px-6">
              Search
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
