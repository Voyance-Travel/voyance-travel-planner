import { motion } from 'framer-motion';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DestinationEntry from './DestinationEntry';

interface ValueFirstHeroProps {
  onScrollToDemo?: () => void;
}

export default function ValueFirstHero({ onScrollToDemo }: ValueFirstHeroProps) {
  return (
    <section className="relative min-h-[45vh] md:min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Full-screen Background Image - LCP optimized */}
      <div className="absolute inset-0 bg-[#2c3e50]">
        <img
          src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1920&q=80"
          alt="Scenic mountain road at sunset"
          className="w-full h-full object-cover"
          onError={(e) => { const t = e.currentTarget; if (!t.dataset.fallbackApplied) { t.dataset.fallbackApplied = 'true'; t.style.display = 'none'; } }}
          fetchPriority="high"
          decoding="async"
        />
        {/* Uniform subtle overlay for text readability without dark spots */}
        <div className="absolute inset-0 bg-black/40" />
      </div>

      {/* Editorial Grid Lines - Magazine Detail */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-6 md:left-16 top-0 bottom-0 w-px bg-white/10" />
        <div className="absolute right-6 md:right-16 top-0 bottom-0 w-px bg-white/10" />
      </div>

      {/* Content - Destination Entry Only */}
      <div className="relative z-10 w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <DestinationEntry />
        </motion.div>
      </div>


      {/* Editorial Detail - Issue marker */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.8 }}
        className="absolute bottom-6 sm:bottom-8 left-4 sm:left-6 md:left-16 text-white/40 text-[10px] sm:text-xs tracking-[0.2em] uppercase font-sans hidden sm:block"
      >
        AI-Powered Planning
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-4 sm:bottom-8 left-1/2 -translate-x-1/2 text-white/60"
        animate={{ y: [0, 6, 0] }}
        transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
      >
        <div className="flex flex-col items-center gap-1 sm:gap-2">
          <span className="text-[10px] sm:text-xs tracking-wide uppercase">Scroll</span>
          <div className="w-px h-6 sm:h-8 bg-gradient-to-b from-white/50 to-transparent" />
        </div>
      </motion.div>
    </section>
  );
}
