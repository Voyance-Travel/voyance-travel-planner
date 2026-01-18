import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';

export default function CinematicHero() {
  const scrollToFeatures = () => {
    document.getElementById('features-section')?.scrollIntoView({ behavior: 'smooth' });
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
        {/* Richer gradient overlay with color */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/60" />
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-transparent to-accent/10" />
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-4xl mx-auto px-4 text-center text-white">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          {/* Tagline */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-sm tracking-[0.25em] uppercase text-white/70 mb-8"
          >
            Intelligent Travel Planning
          </motion.p>

          {/* Main Headline */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-display font-medium mb-6 leading-[1.1] tracking-tight">
            Travel designed
            <br />
            with intention
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-white/80 mb-12 max-w-xl mx-auto font-light leading-relaxed">
            Research-driven itineraries that respect your time. 
            Thoughtful recommendations with clear reasoning.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              asChild 
              size="lg" 
              className="text-base px-8 bg-gradient-to-r from-accent to-gold text-white hover:opacity-90 shadow-accent"
            >
              <Link to={ROUTES.START}>
                Start Planning
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="text-base px-8 border-white/40 text-white bg-transparent hover:bg-white/10"
              asChild
            >
              <Link to={ROUTES.EXPLORE}>
                Explore Destinations
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.button
        onClick={scrollToFeatures}
        className="absolute bottom-12 left-1/2 -translate-x-1/2 text-white/50 hover:text-white transition-colors"
        animate={{ y: [0, 8, 0] }}
        transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
      >
        <div className="w-[1px] h-16 bg-gradient-to-b from-white/60 to-transparent" />
      </motion.button>
    </section>
  );
}
