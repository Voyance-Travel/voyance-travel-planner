import { motion } from 'framer-motion';
import { useState } from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';

const itineraries = [
  {
    id: 'kyoto',
    destination: 'Kyoto',
    country: 'Japan',
    duration: '7 days',
    image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800',
    category: 'Culture & Heritage',
    tagline: 'Where tradition meets tranquility',
    highlights: ['Ancient temples', 'Traditional ryokans', 'Geisha districts', 'Tea ceremonies'],
    price: 2890,
  },
  {
    id: 'santorini',
    destination: 'Santorini',
    country: 'Greece',
    duration: '5 days',
    image: 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=800',
    category: 'Romance & Relaxation',
    tagline: 'Sunsets that redefine beauty',
    highlights: ['Sunset views', 'Wine tasting', 'Volcanic beaches', 'Boutique hotels'],
    price: 3250,
  },
  {
    id: 'iceland',
    destination: 'Reykjavik',
    country: 'Iceland',
    duration: '6 days',
    image: 'https://images.unsplash.com/photo-1520769945061-0a448c463865?w=800',
    category: 'Adventure & Nature',
    tagline: 'Nature in its purest form',
    highlights: ['Northern Lights', 'Golden Circle', 'Blue Lagoon', 'Glacier hiking'],
    price: 3680,
  },
];

export default function ItineraryShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeItinerary = itineraries[activeIndex];

  return (
    <section className="py-14 sm:py-20 md:py-24 bg-muted/30 relative overflow-hidden">
      {/* Top curved divider */}
      <div className="absolute top-0 left-0 right-0 h-24 -translate-y-full">
        <svg viewBox="0 0 1440 96" fill="none" className="absolute bottom-0 w-full h-24" preserveAspectRatio="none">
          <path d="M0 96L1440 96L1440 0C1440 0 1080 96 720 96C360 96 0 0 0 0L0 96Z" className="fill-muted/30" />
        </svg>
      </div>
      {/* Editorial Section Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-8 md:px-16">
        <div className="flex items-start justify-between mb-10 sm:mb-16">
          <div>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="flex items-center gap-3 sm:gap-4 mb-4"
            >
              <div className="w-6 sm:w-8 h-px bg-primary" />
              <span className="text-[10px] sm:text-xs tracking-[0.25em] uppercase text-muted-foreground font-sans">
                Featured Journeys
              </span>
            </motion.div>
            <motion.h2 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif font-normal text-foreground"
            >
              Curated <em className="font-normal">for you</em>
            </motion.h2>
          </div>
          
          {/* Issue Number - Editorial Detail */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="hidden md:block text-right"
          >
            <span className="text-7xl font-serif text-muted/20">{activeIndex + 1}</span>
          </motion.div>
        </div>

        {/* Destination Navigation - Magazine Style */}
        <div className="flex gap-1 mb-8 sm:mb-12 border-b border-border overflow-x-auto scrollbar-hide">
          {itineraries.map((itinerary, index) => (
            <button
              key={itinerary.id}
              onClick={() => setActiveIndex(index)}
              className={`relative px-4 sm:px-6 py-3 sm:py-4 font-sans text-xs sm:text-sm tracking-wide transition-colors whitespace-nowrap ${
                activeIndex === index
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {itinerary.destination}
              {activeIndex === index && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
                />
              )}
            </button>
          ))}
        </div>

        {/* Itinerary Feature - Magazine Layout */}
        <motion.div
          key={activeItinerary.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="grid lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-12"
        >
          {/* Image - Large Editorial Image */}
          <div className="lg:col-span-7 relative">
            <div className="aspect-[3/4] sm:aspect-[4/5] lg:aspect-[3/4] relative overflow-hidden">
              <img
                src={activeItinerary.image}
                alt={activeItinerary.destination}
                className="w-full h-full object-cover"
              />
              {/* Category Badge */}
              <div className="absolute top-6 left-6">
                <span className="px-3 py-1.5 bg-white/95 backdrop-blur-sm text-xs tracking-[0.15em] uppercase font-sans text-foreground">
                  {activeItinerary.category}
                </span>
              </div>
            </div>
          </div>

          {/* Content - Editorial Text */}
          <div className="lg:col-span-5 flex flex-col justify-center py-4 sm:py-8">
            <div className="mb-4 sm:mb-6">
              <span className="text-[10px] sm:text-xs tracking-[0.2em] uppercase text-muted-foreground font-sans">
                {activeItinerary.duration} · {activeItinerary.country}
              </span>
            </div>

            <h3 className="text-3xl sm:text-4xl md:text-5xl font-serif font-normal text-foreground mb-3 sm:mb-4">
              {activeItinerary.destination}
            </h3>

            <p className="text-lg font-serif italic text-muted-foreground mb-8">
              {activeItinerary.tagline}
            </p>

            {/* Highlights - Clean List */}
            <div className="mb-10 space-y-3">
              {activeItinerary.highlights.map((highlight, i) => (
                <div key={highlight} className="flex items-center gap-4 text-sm text-foreground/80 font-sans">
                  <span className="text-xs text-muted-foreground w-4">{i + 1}</span>
                  <span>{highlight}</span>
                </div>
              ))}
            </div>

            {/* Price & CTA */}
            <div className="pt-8 border-t border-border">
              <div className="mb-6">
                <span className="text-xs tracking-[0.15em] uppercase text-muted-foreground font-sans block mb-1">
                  From
                </span>
                <span className="text-3xl font-serif text-foreground">
                  ${activeItinerary.price.toLocaleString()}
                </span>
                <span className="text-sm text-muted-foreground font-sans ml-1">/person</span>
              </div>
              
              <div className="flex gap-3">
                <Button variant="outline" size="sm" className="font-sans text-sm" asChild>
                  <Link to={`${ROUTES.ITINERARY.SAMPLE}?destination=${activeItinerary.id}`}>
                    View Details
                    <ArrowUpRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
                <Button size="sm" className="font-sans text-sm" asChild>
                  <Link to={ROUTES.START}>
                    Book Now
                    <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}