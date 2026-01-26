import { motion } from 'framer-motion';
import { ArrowRight, Dna } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';

export default function TravelDNAHero() {
  const scrollToArchetype = () => {
    document.getElementById('sample-archetype')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background Image */}
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1920&q=80"
          alt="Scenic mountain road at sunset"
          className="w-full h-full object-cover"
        />
        {/* Editorial gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/70" />
      </div>

      {/* Editorial Grid Lines */}
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
          {/* Editorial Eyebrow with DNA Icon */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="flex items-center gap-4 mb-8"
          >
            <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center">
              <Dna className="w-5 h-5 text-white/80" />
            </div>
            <span className="text-xs tracking-[0.3em] uppercase text-white/70 font-sans font-medium">
              Travel DNA
            </span>
          </motion.div>

          {/* Main Headline */}
          <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl font-normal mb-6 leading-[1.05] tracking-tight">
            <span className="block">Discover who you are</span>
            <span className="block italic">as a traveler</span>
          </h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="text-lg md:text-xl text-white/80 mb-4 max-w-xl font-sans font-light leading-relaxed"
          >
            25 distinct travel personalities. One quiz. Two minutes.
          </motion.p>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="text-base md:text-lg text-white/60 mb-10 max-w-lg font-sans font-light leading-relaxed"
          >
            Then watch us build trips only we could build for you.
          </motion.p>

          {/* CTA */}
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
              <Link to={ROUTES.START}>
                Take the Quiz
                <ArrowRight className="ml-3 h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="text-base px-10 py-6 border-white/30 text-white bg-transparent hover:bg-white/10 font-sans"
              onClick={scrollToArchetype}
            >
              See an Example
            </Button>
          </motion.div>

          {/* Editorial Detail */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.8 }}
            className="absolute bottom-8 left-8 md:left-16 text-white/40 text-xs tracking-[0.2em] uppercase font-sans"
          >
            27 Archetypes · 8 Traits
          </motion.div>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.button
        onClick={scrollToArchetype}
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
