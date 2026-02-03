import { motion } from 'framer-motion';
import { useState } from 'react';
import { ArrowRight, Eye, Sparkles, Clock, DollarSign, AlertTriangle, Gem, MapPin, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ROUTES } from '@/config/routes';

// Sample itineraries with computed intelligence metrics
const SAMPLE_ITINERARIES = [
  {
    id: 'tokyo-slow',
    destination: 'Tokyo',
    country: 'Japan',
    duration: '7 days',
    image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800',
    archetype: 'Slow Traveler',
    archetypeCategory: 'RESTORER',
    budgetTier: 'Stretch',
    totalCost: 2890,
    // Intelligence metrics - computed from real trip analysis
    intelligence: {
      finds: 3,        // Voyance-discovered gems
      timingHacks: 2,  // Optimal timing suggestions
      trapsAvoided: 3, // Tourist traps skipped
    },
    highlights: [
      'Morning at Tsukiji Outer Market (before 8am)',
      'Private tea ceremony in Yanaka',
      'Sunset from Shimokitazawa rooftops',
    ],
  },
  {
    id: 'paris-culture',
    destination: 'Paris',
    country: 'France',
    duration: '5 days',
    image: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800',
    archetype: 'Culture Curator',
    archetypeCategory: 'CURATOR',
    budgetTier: 'Splurge',
    totalCost: 4250,
    intelligence: {
      finds: 5,
      timingHacks: 3,
      trapsAvoided: 4,
    },
    highlights: [
      'Musée de lOrangerie at golden hour',
      'Hidden sculpture garden in Le Marais',
      'Chef table at unmarked bistro',
    ],
  },
  {
    id: 'bali-adventurer',
    destination: 'Bali',
    country: 'Indonesia',
    duration: '6 days',
    image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=800',
    archetype: 'Adrenaline Architect',
    archetypeCategory: 'EXPLORER',
    budgetTier: 'Safe',
    totalCost: 1890,
    intelligence: {
      finds: 4,
      timingHacks: 2,
      trapsAvoided: 5,
    },
    highlights: [
      'Sunrise trek to Mount Batur',
      'Hidden waterfall only locals know',
      'Cliff jumping at secret cove',
    ],
  },
  {
    id: 'rome-foodie',
    destination: 'Rome',
    country: 'Italy',
    duration: '4 days',
    image: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=800',
    archetype: 'Culinary Explorer',
    archetypeCategory: 'CURATOR',
    budgetTier: 'Stretch',
    totalCost: 2450,
    intelligence: {
      finds: 6,
      timingHacks: 4,
      trapsAvoided: 3,
    },
    highlights: [
      'Supplì tasting in Testaccio',
      'Sunset aperitivo on hidden terrace',
      'Family-run trattoria (no tourists)',
    ],
  },
];

const DESTINATIONS = ['Tokyo', 'Paris', 'Bali', 'Rome'];

function getBudgetTierColor(tier: string) {
  switch (tier) {
    case 'Safe': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    case 'Stretch': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400';
    case 'Splurge': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
    default: return 'bg-muted text-muted-foreground';
  }
}

function ItineraryCard({ itinerary }: { itinerary: typeof SAMPLE_ITINERARIES[0] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-xl hover:border-primary/20 transition-all duration-300 group"
    >
      {/* Image */}
      <div className="relative aspect-[16/10] overflow-hidden">
        <img
          src={itinerary.image}
          alt={`${itinerary.destination}, ${itinerary.country}`}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
        
        {/* Destination overlay */}
        <div className="absolute bottom-4 left-4 text-white">
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="w-3.5 h-3.5" />
            <span className="text-xs opacity-80">{itinerary.country}</span>
          </div>
          <h3 className="text-2xl font-serif font-semibold">{itinerary.destination}</h3>
        </div>
        
        {/* Duration badge */}
        <div className="absolute top-4 right-4">
          <Badge variant="secondary" className="bg-white/90 text-foreground backdrop-blur-sm">
            <Calendar className="w-3 h-3 mr-1" />
            {itinerary.duration}
          </Badge>
        </div>
      </div>
      
      {/* Content */}
      <div className="p-5">
        {/* Archetype & Budget */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">
              Built for: <span className="text-foreground font-medium">{itinerary.archetype}</span>
            </span>
          </div>
          <Badge className={getBudgetTierColor(itinerary.budgetTier)}>
            {itinerary.budgetTier}
          </Badge>
        </div>
        
        {/* Total Cost */}
        <div className="flex items-baseline gap-1 mb-4">
          <span className="text-2xl font-serif font-semibold text-foreground">
            ${itinerary.totalCost.toLocaleString()}
          </span>
          <span className="text-sm text-muted-foreground">/person</span>
        </div>
        
        {/* Intelligence Metrics */}
        <div className="flex items-center gap-4 mb-5 py-3 px-4 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-1.5" title="Voyance Finds - Hidden gems matched to your style">
            <Gem className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-medium text-foreground">{itinerary.intelligence.finds}</span>
            <span className="text-xs text-muted-foreground">Finds</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-1.5" title="Timing Hacks - Optimal timing suggestions">
            <Clock className="w-3.5 h-3.5 text-accent" />
            <span className="text-xs font-medium text-foreground">{itinerary.intelligence.timingHacks}</span>
            <span className="text-xs text-muted-foreground">Timing</span>
          </div>
          <div className="w-px h-4 bg-border" />
          <div className="flex items-center gap-1.5" title="Traps Avoided - Tourist traps we skipped">
            <AlertTriangle className="w-3.5 h-3.5 text-destructive/70" />
            <span className="text-xs font-medium text-foreground">{itinerary.intelligence.trapsAvoided}</span>
            <span className="text-xs text-muted-foreground">Skipped</span>
          </div>
        </div>
        
        {/* Highlights */}
        <div className="space-y-2 mb-5">
          {itinerary.highlights.map((highlight, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className="text-primary mt-0.5">•</span>
              <span className="text-muted-foreground">{highlight}</span>
            </div>
          ))}
        </div>
        
        {/* CTAs */}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" asChild>
            <Link to={`${ROUTES.ITINERARY.SAMPLE}?id=${itinerary.id}`}>
              <Eye className="w-3.5 h-3.5 mr-1.5" />
              Preview This Trip
            </Link>
          </Button>
          <Button size="sm" className="flex-1" asChild>
            <Link to={`${ROUTES.START}?destination=${itinerary.destination}`}>
              Build Like This
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Link>
          </Button>
        </div>
      </div>
      
      {/* Sample label - honest framing */}
      <div className="px-5 py-2.5 bg-muted/30 border-t border-border">
        <p className="text-xs text-muted-foreground text-center">
          Sample itinerary for the {itinerary.archetype} in {itinerary.destination}
        </p>
      </div>
    </motion.div>
  );
}

export default function ItineraryShowcase() {
  const [activeDestination, setActiveDestination] = useState('Tokyo');

  return (
    <section className="py-16 sm:py-24 md:py-32 bg-muted/30 relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 md:px-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10 md:mb-12"
        >
          <div className="flex items-center justify-center gap-3 sm:gap-4 mb-4">
            <div className="w-6 sm:w-8 h-px bg-primary" />
            <span className="text-[10px] sm:text-xs tracking-[0.25em] uppercase text-muted-foreground font-sans">
              Featured Journeys
            </span>
            <div className="w-6 sm:w-8 h-px bg-primary" />
          </div>
          
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-normal text-foreground mb-4">
            See what we <em className="font-normal">build</em>
          </h2>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Real sample itineraries with intelligence metrics. Preview a full trip or build something like it.
          </p>
        </motion.div>

        {/* Embedded Demo Preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12"
        >
          <div className="relative bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
            {/* Browser-like header */}
            <div className="flex items-center gap-2 px-4 py-3 bg-muted/50 border-b border-border">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 mx-4">
                <div className="bg-background rounded-md px-3 py-1.5 text-xs text-muted-foreground text-center max-w-md mx-auto">
                  voyance.travel/itinerary/tokyo-slow-traveler
                </div>
              </div>
            </div>
            
            {/* Demo iframe placeholder - shows a sample itinerary */}
            <div className="aspect-[16/9] bg-gradient-to-br from-muted to-muted/50 relative">
              <img
                src="https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1200"
                alt="Tokyo sample itinerary preview"
                className="w-full h-full object-cover opacity-30"
              />
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6">
                <div className="bg-card/95 backdrop-blur-sm rounded-2xl p-8 max-w-lg border border-border shadow-lg">
                  <h3 className="text-2xl font-serif text-foreground mb-3">
                    7 Days in Tokyo
                  </h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    Built for: The Slow Traveler
                  </p>
                  <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground mb-6">
                    <span className="flex items-center gap-1">
                      <Gem className="w-3.5 h-3.5 text-primary" /> 3 Finds
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> 2 Timing Hacks
                    </span>
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="w-3.5 h-3.5" /> 3 Traps Skipped
                    </span>
                  </div>
                  <div className="flex gap-3 justify-center">
                    <Button variant="outline" size="sm" asChild>
                      <Link to={`${ROUTES.ITINERARY.SAMPLE}?id=tokyo-slow`}>
                        <Eye className="w-4 h-4 mr-2" />
                        View Full Trip
                      </Link>
                    </Button>
                    <Button size="sm" asChild>
                      <Link to={`${ROUTES.START}?destination=Tokyo`}>
                        Build Like This
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Destination Tabs */}
        <div className="flex justify-center gap-2 mb-10 flex-wrap">
          {DESTINATIONS.map((dest) => (
            <button
              key={dest}
              onClick={() => setActiveDestination(dest)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeDestination === dest
                  ? 'bg-primary text-primary-foreground shadow-md'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              {dest}
            </button>
          ))}
        </div>

        {/* Itinerary Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {SAMPLE_ITINERARIES.filter(it => it.destination === activeDestination).length > 0 ? (
            SAMPLE_ITINERARIES.filter(it => it.destination === activeDestination).map((itinerary) => (
              <ItineraryCard key={itinerary.id} itinerary={itinerary} />
            ))
          ) : (
            <ItineraryCard itinerary={SAMPLE_ITINERARIES.find(it => it.destination === activeDestination) || SAMPLE_ITINERARIES[0]} />
          )}
        </div>
        
        {/* View More CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mt-10"
        >
          <Button variant="outline" size="lg" asChild>
            <Link to={ROUTES.EXPLORE}>
              Explore More Destinations
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}
