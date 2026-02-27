import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import DestinationEntry from './DestinationEntry';
import { useIsMobile } from '@/hooks/use-mobile';

interface ValueFirstHeroProps {
  onScrollToDemo?: () => void;
}

export default function ValueFirstHero({ onScrollToDemo }: ValueFirstHeroProps) {
  const isMobile = useIsMobile();

  return (
    <section className="relative min-h-[55vh] md:min-h-screen flex flex-col items-center justify-center overflow-hidden">
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
        {/* Gradient overlay - stronger at bottom for mobile text readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/20 md:bg-black/40" />
      </div>

      {/* Editorial Grid Lines - Desktop only */}
      <div className="absolute inset-0 pointer-events-none hidden md:block">
        <div className="absolute left-16 top-0 bottom-0 w-px bg-white/10" />
        <div className="absolute right-16 top-0 bottom-0 w-px bg-white/10" />
      </div>

      {/* Mobile: Headline + CTA overlay at bottom */}
      {isMobile ? (
        <div className="relative z-10 w-full px-6 mt-auto pb-16">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-3xl font-serif font-bold text-white leading-tight mb-3"
          >
            Travel planning that knows you
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-base text-white/80 font-light mb-6 max-w-sm"
          >
            AI-powered itineraries built around your travel personality.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Button asChild size="lg" className="w-full min-h-[48px] text-base font-medium">
              <Link to={ROUTES.START}>
                Start Planning
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </motion.div>
        </div>
      ) : (
        /* Desktop: Full DestinationEntry widget */
        <div className="relative z-10 w-full max-w-3xl mx-auto px-6 py-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <DestinationEntry />
          </motion.div>
        </div>
      )}

      {/* Editorial Detail - Desktop only */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.8 }}
        className="absolute bottom-8 left-16 text-white/40 text-xs tracking-[0.2em] uppercase font-sans hidden md:block"
      >
        AI-Powered Planning
      </motion.div>

      {/* Scroll indicator - Desktop only */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/60 hidden md:flex"
        animate={{ y: [0, 6, 0] }}
        transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
      >
        <div className="flex flex-col items-center gap-2">
          <span className="text-xs tracking-wide uppercase">Scroll</span>
          <div className="w-px h-8 bg-gradient-to-b from-white/50 to-transparent" />
        </div>
      </motion.div>
    </section>
  );
}
