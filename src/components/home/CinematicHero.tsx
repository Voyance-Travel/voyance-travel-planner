import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';
import { normalizeUnsplashUrl } from '@/utils/unsplash';

export default function CinematicHero() {
  const scrollToFeatures = () => {
    document.getElementById('features-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0 bg-[#2c3e50]">
        <img
          src={normalizeUnsplashUrl('https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1920&q=80')}
          alt="Scenic mountain road at sunset"
          className="w-full h-full object-cover"
          onError={(e) => { const t = e.currentTarget; if (!t.dataset.fallbackApplied) { t.dataset.fallbackApplied = 'true'; t.style.display = 'none'; } }}
        />
        {/* Editorial gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/35 to-black/60" />
      </div>

      {/* Editorial Grid Lines - Magazine Detail */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute left-8 md:left-16 top-0 bottom-0 w-px bg-white/10" />
        <div className="absolute right-8 md:right-16 top-0 bottom-0 w-px bg-white/10" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-8 md:px-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.25, 0.1, 0.25, 1] }}
          className="text-white"
        >
          {/* Editorial Eyebrow */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="flex items-center gap-4 mb-8"
          >
            <div className="w-12 h-px bg-white/60" />
            <span className="text-xs tracking-[0.3em] uppercase text-white/70 font-sans font-medium">
              AI-Powered Trip Planning
            </span>
          </motion.div>

          {/* Main Headline - Editorial Typography */}
          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl font-normal mb-8 leading-[0.95] tracking-tight">
            <span className="block">Your perfect trip,</span>
            <span className="block italic">planned in</span>
            <span className="block">minutes</span>
          </h1>

          {/* Subheadline - Clean editorial copy */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="text-lg md:text-xl text-white/75 mb-12 max-w-lg font-sans font-light leading-relaxed"
          >
            Tell us how you travel. Our AI builds a personalized day-by-day itinerary 
            crafted around your style, interests, and pace.
          </motion.p>

          {/* CTA - Editorial Button */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.8 }}
            className="flex flex-col sm:flex-row gap-4"
          >
            <Button 
              asChild 
              size="lg" 
              className="text-base px-10 py-6 bg-white text-foreground hover:bg-white/90 font-sans font-medium tracking-wide"
            >
              <Link to={ROUTES.DEMO}>
                See How It Works
                <ArrowRight className="ml-3 h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="text-base px-10 py-6 border-white/30 text-white bg-transparent hover:bg-white/10 font-sans"
              asChild
            >
              <Link to={ROUTES.START}>
                Start Planning
              </Link>
            </Button>
          </motion.div>

          {/* Editorial Detail - Issue marker */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.8 }}
            className="absolute bottom-8 left-8 md:left-16 text-white/40 text-xs tracking-[0.2em] uppercase font-sans"
          >
            Vol. I · Winter 2026
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll Indicator - Editorial Style */}
      <motion.button
        onClick={scrollToFeatures}
        className="absolute bottom-12 right-8 md:right-16 text-white/40 hover:text-white/70 transition-colors flex flex-col items-center gap-2"
        animate={{ y: [0, 6, 0] }}
        transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
      >
        <span className="text-xs tracking-[0.15em] uppercase font-sans" style={{ writingMode: 'vertical-rl' }}>
          Scroll
        </span>
        <div className="w-px h-12 bg-gradient-to-b from-white/50 to-transparent" />
      </motion.button>
    </section>
  );
}