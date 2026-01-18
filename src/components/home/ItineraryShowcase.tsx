import { motion } from 'framer-motion';
import { useState } from 'react';
import { MapPin, Clock, Star, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ROUTES } from '@/config/routes';

const itineraries = [
  {
    id: 'kyoto',
    destination: 'Kyoto, Japan',
    duration: '7 days',
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=800',
    category: 'Culture & Heritage',
    highlights: ['Ancient temples', 'Traditional ryokans', 'Geisha districts', 'Tea ceremonies'],
    price: 2890,
  },
  {
    id: 'santorini',
    destination: 'Santorini, Greece',
    duration: '5 days',
    rating: 4.8,
    image: 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=800',
    category: 'Romance & Relaxation',
    highlights: ['Sunset views', 'Wine tasting', 'Volcanic beaches', 'Boutique hotels'],
    price: 3250,
  },
  {
    id: 'iceland',
    destination: 'Reykjavik, Iceland',
    duration: '6 days',
    rating: 4.9,
    image: 'https://images.unsplash.com/photo-1520769945061-0a448c463865?w=800',
    category: 'Adventure & Nature',
    highlights: ['Northern Lights', 'Golden Circle', 'Blue Lagoon', 'Glacier hiking'],
    price: 3680,
  },
];

export default function ItineraryShowcase() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeItinerary = itineraries[activeIndex];

  return (
    <section className="py-24 bg-background relative overflow-hidden">
      {/* Decorative background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-secondary/20 to-transparent" />
      <div className="absolute top-20 right-20 w-72 h-72 bg-ocean/5 rounded-full blur-3xl" />
      <div className="absolute bottom-20 left-20 w-56 h-56 bg-gold/5 rounded-full blur-3xl" />
      
      <div className="max-w-7xl mx-auto px-4 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-gradient-to-r from-accent/20 to-gold/20 text-accent text-sm font-medium mb-4 border border-accent/20">
            Featured Itineraries
          </span>
          <h2 className="text-3xl md:text-5xl font-display font-bold text-foreground mb-4">
            Real trips, real experiences
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Explore curated itineraries from travelers like you—or create your own.
          </p>
        </motion.div>

        {/* Destination Tabs */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          {itineraries.map((itinerary, index) => (
            <button
              key={itinerary.id}
              onClick={() => setActiveIndex(index)}
              className={`px-5 py-2.5 rounded-full font-medium text-sm transition-all ${
                activeIndex === index
                  ? 'bg-gradient-to-r from-primary to-emerald text-white shadow-md'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              {itinerary.destination}
            </button>
          ))}
        </div>

        {/* Itinerary Card */}
        <motion.div
          key={activeItinerary.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid lg:grid-cols-2 gap-8 items-center"
        >
          {/* Image */}
          <div className="relative aspect-[4/3] rounded-2xl overflow-hidden">
            <img
              src={activeItinerary.image}
              alt={activeItinerary.destination}
              className="w-full h-full object-cover"
            />
            <div className="absolute top-4 left-4 px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-sm font-medium">
              {activeItinerary.category}
            </div>
          </div>

          {/* Content */}
          <div>
            <div className="flex items-center gap-4 mb-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                {activeItinerary.destination}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-4 w-4" />
                {activeItinerary.duration}
              </span>
              <span className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                {activeItinerary.rating}
              </span>
            </div>

            <h3 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-4">
              {activeItinerary.duration} in {activeItinerary.destination}
            </h3>

            <div className="mb-6">
              <h4 className="text-sm font-medium text-foreground mb-3">Trip Highlights</h4>
              <ul className="grid grid-cols-2 gap-2">
                {activeItinerary.highlights.map((highlight) => (
                  <li key={highlight} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <ChevronRight className="h-4 w-4 text-primary" />
                    {highlight}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-sm text-muted-foreground">Starting from</p>
                <p className="text-3xl font-bold text-foreground">
                  ${activeItinerary.price.toLocaleString()}
                  <span className="text-base font-normal text-muted-foreground">/person</span>
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Button asChild size="lg">
                <Link to={ROUTES.ITINERARY.SAMPLE}>
                  View Full Itinerary
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link to={ROUTES.START}>
                  Customize This Trip
                </Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
