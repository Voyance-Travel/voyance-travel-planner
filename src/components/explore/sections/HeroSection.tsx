import { motion } from 'framer-motion';
import { Search, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toSiteImageUrlFromPhotoId } from '@/utils/unsplash';

interface HeroSectionProps {
  onFilterToggle: () => void;
  onBrowseClick: () => void;
  searchQuery?: string;
  onSearchChange?: (value: string) => void;
  onSearchSubmit?: () => void;
}

export default function HeroSection({ 
  onFilterToggle, 
  onBrowseClick,
  searchQuery = '',
  onSearchChange,
  onSearchSubmit
}: HeroSectionProps) {
  
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && onSearchSubmit) {
      e.preventDefault();
      onSearchSubmit();
    }
  };
  return (
    <section className="relative pt-32 pb-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-[#2c3e50]">
        <img
          src={toSiteImageUrlFromPhotoId('photo-1476514525535-07fb3b4ae5f1')}
          alt="Scenic lake and mountains"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/50" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-3xl mx-auto px-4 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <p className="text-sm tracking-[0.25em] uppercase text-white/60 mb-6">
            Find Your Destination
          </p>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-medium text-white mb-6 leading-tight">
            Where Will We Plan For You?
          </h1>
          <p className="text-lg text-white/70 mb-10 max-w-lg mx-auto font-light">
            Choose a destination and we'll build a personalized day-by-day itinerary crafted just for you.
          </p>

          {/* Search Bar */}
          <div className="flex gap-2 max-w-lg mx-auto bg-white rounded-full p-1.5 shadow-2xl">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Where would you like to go?"
                value={searchQuery}
                onChange={(e) => onSearchChange?.(e.target.value)}
                onKeyDown={handleKeyDown}
                className="pl-11 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-foreground"
              />
            </div>
            <Button onClick={onFilterToggle} variant="ghost" size="icon" className="shrink-0 text-muted-foreground" aria-label="Toggle filters">
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
            <Button onClick={onSearchSubmit || onBrowseClick} className="rounded-full px-6">
              Search
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
