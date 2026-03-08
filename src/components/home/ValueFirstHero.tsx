import { motion } from 'framer-motion';
import DestinationEntry from './DestinationEntry';
import { toSiteImageUrlFromPhotoId } from '@/utils/unsplash';

interface ValueFirstHeroProps {
  onScrollToDemo?: () => void;
}

export default function ValueFirstHero({ onScrollToDemo }: ValueFirstHeroProps) {

  return (
    <section className="relative min-h-[85vh] md:min-h-screen flex flex-col items-center justify-center overflow-hidden">
      {/* Full-screen Background Image - LCP optimized */}
      <div className="absolute inset-0 bg-[#2c3e50]">
        <img
          src={toSiteImageUrlFromPhotoId('photo-1469854523086-cc02fe5d8800')}
          alt="Scenic mountain road at sunset"
          className="w-full h-full object-cover"
          onError={(e) => { const t = e.currentTarget; if (!t.dataset.fallbackApplied) { t.dataset.fallbackApplied = 'true'; t.style.display = 'none'; } }}
          fetchPriority="high"
          decoding="async"
        />
        {/* Gradient overlay - stronger at bottom for mobile text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/20 md:bg-black/40" />
      </div>

      {/* Editorial Grid Lines - Desktop only */}
      <div className="absolute inset-0 pointer-events-none hidden md:block">
        <div className="absolute left-16 top-0 bottom-0 w-px bg-white/10" />
        <div className="absolute right-16 top-0 bottom-0 w-px bg-white/10" />
      </div>

      {/* Content - Destination Entry */}
      <div className="relative z-10 w-full max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <DestinationEntry />
        </motion.div>
      </div>

      {/* Editorial Detail - Desktop only */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.8 }}
        className="absolute bottom-8 left-16 text-white/40 text-xs tracking-[0.2em] uppercase font-sans hidden md:block"
      >
        AI-Powered Planning
      </motion.div>

    </section>
  );
}
