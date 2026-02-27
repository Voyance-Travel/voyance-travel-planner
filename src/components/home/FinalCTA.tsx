import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, Compass } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';
import SafeImage from '@/components/SafeImage';
import { toSiteImageUrlFromPhotoId } from '@/utils/unsplash';

const destinations = [
  { name: 'Tokyo', image: toSiteImageUrlFromPhotoId('photo-1540959733332-eab4deabeeaf') },
  { name: 'Paris', image: toSiteImageUrlFromPhotoId('photo-1502602898657-3e91760cbb34') },
  { name: 'Bali', image: toSiteImageUrlFromPhotoId('photo-1537996194471-e657df975ab4') },
];

const amalfiImage = toSiteImageUrlFromPhotoId('photo-1534008897995-27a23e859048');

export default function FinalCTA() {
  return (
    <section className="relative py-14 sm:py-20 md:py-24 bg-background overflow-hidden">
      {/* Top gradient fade from quote */}
      <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/5 to-transparent pointer-events-none" />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-8 md:px-16">
        <div className="grid lg:grid-cols-2 gap-10 sm:gap-16 items-center">
          {/* Left: CTA Content */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {/* Eyebrow */}
            <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
              <div className="w-6 sm:w-8 h-px bg-primary" />
              <span className="text-[10px] sm:text-xs tracking-[0.25em] uppercase text-muted-foreground font-sans">
                Still scrolling?
              </span>
            </div>

            {/* Headline */}
            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif font-normal text-foreground mb-4 sm:mb-6 leading-tight">
              Ready to Travel{' '}
              <em className="font-normal">Like Yourself?</em>
            </h2>

            {/* Subhead */}
            <p className="text-base sm:text-lg text-muted-foreground font-sans font-light mb-8 sm:mb-10 max-w-md leading-relaxed">
              Your type. Your pace. Your perfect trip, built in minutes.
            </p>

            {/* CTAs — single primary on mobile, multi on desktop */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6">
              <Button 
                asChild 
                size="lg" 
                className="text-base px-10 py-6 font-sans font-medium tracking-wide min-h-[48px]"
              >
                <Link to={ROUTES.START}>
                  Start Planning
                  <ArrowRight className="ml-3 h-4 w-4" />
                </Link>
              </Button>

              {/* Secondary — text link on mobile, button on desktop */}
              <Link 
                to={ROUTES.QUIZ}
                className="sm:hidden inline-flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-sans"
              >
                <Sparkles className="h-4 w-4" />
                Or discover your travel style
              </Link>
              <Button 
                asChild 
                variant="outline"
                size="lg" 
                className="hidden sm:inline-flex text-base px-8 py-6 font-sans font-medium"
              >
                <Link to={ROUTES.QUIZ}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  Take Quiz
                </Link>
              </Button>
            </div>

            {/* Tertiary — desktop only */}
            <Link 
              to={ROUTES.EXPLORE}
              className="hidden sm:inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors font-sans"
            >
              <Compass className="h-4 w-4" />
              Or explore destinations first
            </Link>

          </motion.div>

          {/* Right: Stacked Image Composition */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative"
          >
            {/* Main large image - Amalfi Coast */}
            <div className="relative z-10">
              <div className="aspect-[4/5] overflow-hidden">
                <SafeImage
                  src={amalfiImage}
                  alt="Amalfi Coast, Italy"
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
              
              {/* Floating label */}
              <div className="absolute -bottom-4 -left-4 bg-card p-4 shadow-elevated">
                <span className="text-xs tracking-[0.15em] uppercase text-muted-foreground font-sans block mb-1">
                  Trending
                </span>
                <span className="text-lg font-serif text-foreground">Amalfi Coast</span>
              </div>
            </div>

            {/* Smaller stacked images */}
            <div className="absolute -top-8 -right-8 w-32 h-40 z-20 hidden lg:block">
              <SafeImage
                src={destinations[0].image}
                alt={destinations[0].name}
                className="w-full h-full object-cover shadow-elevated"
                loading="lazy"
              />
            </div>
            
            <div className="absolute top-1/4 -right-4 w-24 h-32 z-0 hidden lg:block">
              <SafeImage
                src={destinations[1].image}
                alt={destinations[1].name}
                className="w-full h-full object-cover opacity-60"
                loading="lazy"
              />
            </div>

            {/* Decorative element */}
            <div className="absolute -bottom-8 right-16 w-20 h-20 border border-primary/20 hidden lg:block" />
          </motion.div>
        </div>
      </div>

      {/* Background decorative lines */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/3 w-px h-full bg-border/30" />
        <div className="absolute top-0 right-1/3 w-px h-full bg-border/30" />
      </div>
    </section>
  );
}
