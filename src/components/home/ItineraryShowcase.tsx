import { motion } from 'framer-motion';
import { useState } from 'react';
import { ArrowRight, Eye, Sparkles, Clock, DollarSign, AlertTriangle, Gem, MapPin, Calendar, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ROUTES } from '@/config/routes';
import nolaHero1 from '@/assets/destinations/new-orleans-1.jpg';
import denverHero from '@/assets/destinations/denver-hero.jpg';
import baliHero from '@/assets/destinations/bali-hero.jpg';
import romeHero from '@/assets/destinations/rome-hero.jpg';
import tokyoHero from '@/assets/destinations/tokyo-hero.jpg';

// Sample itineraries with computed intelligence metrics
const SAMPLE_ITINERARIES = [
  {
    id: 'denver-social',
    destination: 'Denver',
    country: 'Colorado',
    duration: '3 days',
    image: denverHero,
    archetype: 'Social Butterfly',
    archetypeCategory: 'CONNECTOR',
    budgetTier: 'Safe',
    totalCost: 980,
    intelligence: {
      finds: 4,
      timingHacks: 2,
      trapsAvoided: 2,
    },
    highlights: [
      'RiNo Art District brewery crawl',
      'Sunrise hike at Red Rocks (before crowds)',
      'Live music on South Broadway',
    ],
  },
  {
    id: 'new-orleans-romantic',
    destination: 'New Orleans',
    country: 'Louisiana',
    duration: '4 days',
    image: nolaHero1,
    archetype: 'Culinary Cartographer',
    archetypeCategory: 'CURATOR',
    budgetTier: 'Stretch',
    totalCost: 1650,
    intelligence: {
      finds: 5,
      timingHacks: 3,
      trapsAvoided: 4,
    },
    highlights: [
      'Private courtyard dinner in the Bywater',
      'Jazz at Preservation Hall (skip Bourbon St)',
      'Beignets at Café Du Monde before 7am',
    ],
  },
  {
    id: 'bali-adventurer',
    destination: 'Bali',
    country: 'Indonesia',
    duration: '6 days',
    image: baliHero,
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
    image: romeHero,
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
  {
    id: 'tokyo-slow',
    destination: 'Tokyo',
    country: 'Japan',
    duration: '7 days',
    image: tokyoHero,
    archetype: 'Present Traveler',
    archetypeCategory: 'CURATOR',
    budgetTier: 'Stretch',
    totalCost: 2890,
    intelligence: {
      finds: 3,
      timingHacks: 2,
      trapsAvoided: 3,
    },
    highlights: [
      'Morning at Tsukiji Outer Market (before 8am)',
      'Private tea ceremony in Yanaka',
      'Sunset from Shimokitazawa rooftops',
    ],
  },
];

const DESTINATIONS = ['Denver', 'New Orleans', 'Bali', 'Rome', 'Tokyo'];

// All destinations have sample itineraries
const HAS_REAL_SAMPLE = new Set(['denver-social', 'new-orleans-romantic', 'bali-adventurer', 'rome-foodie', 'tokyo-slow']);
function ItineraryCard({ itinerary }: { itinerary: typeof SAMPLE_ITINERARIES[0] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="rounded-xl overflow-hidden hover:shadow-xl transition-all duration-300 group"
    >
      {/* Image */}
      <div className="relative aspect-[16/10] overflow-hidden">
        <img
          src={itinerary.image}
          alt={`${itinerary.destination}, ${itinerary.country}`}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
          onError={(e) => { const t = e.currentTarget; if (!t.dataset.fallbackApplied) { t.dataset.fallbackApplied = 'true'; t.style.display = 'none'; t.parentElement?.classList.add('bg-gradient-to-br', 'from-muted', 'to-muted-foreground/20'); } }}
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
      <div className="p-5 bg-muted/40 backdrop-blur-sm">
        {/* Archetype */}
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs text-muted-foreground">
            Built for: <span className="text-foreground font-medium">{itinerary.archetype}</span>
          </span>
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
          <div className="flex items-center gap-1.5" title="Local Picks - Insider alternatives included">
            <Gem className="w-3.5 h-3.5 text-primary/70" />
            <span className="text-xs font-medium text-foreground">{itinerary.intelligence.trapsAvoided}</span>
            <span className="text-xs text-muted-foreground">Local Picks</span>
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
          {HAS_REAL_SAMPLE.has(itinerary.id) && (
            <Button variant="outline" size="sm" className="flex-1" asChild>
              <Link to={`${ROUTES.ITINERARY.SAMPLE}?id=${itinerary.id}`}>
                <Eye className="w-3.5 h-3.5 mr-1.5" />
                Preview This Trip
              </Link>
            </Button>
          )}
          <Button size="sm" className="flex-1" asChild>
            <Link to={`${ROUTES.START}?destination=${itinerary.destination}`}>
              Build Like This
              <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
            </Link>
          </Button>
        </div>
      </div>
      
      {/* Sample label - honest framing */}
      <div className="px-5 py-2.5 bg-muted/30">
        <p className="text-xs text-muted-foreground text-center">
          Sample itinerary for the {itinerary.archetype} in {itinerary.destination}
        </p>
      </div>
    </motion.div>
  );
}

export default function ItineraryShowcase() {
  const [activeDestination, setActiveDestination] = useState('Denver');

  return (
    <section className="py-24 px-6 bg-muted/30">
      <div className="max-w-7xl mx-auto">
        {/* Section Header */}
        <motion.div 
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <Badge variant="secondary" className="mb-4">
            <Eye className="w-3 h-3 mr-1" />
            Sample Itineraries
          </Badge>
          
          <h2 className="text-3xl md:text-4xl font-serif font-semibold text-foreground mb-4">
            See what we <em className="font-normal">build</em>
          </h2>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
            Real sample itineraries with intelligence metrics. Preview a full trip or build something like it.
          </p>

          {/* Link to Demo page */}
          <Link to="/demo">
            <Button variant="outline" className="gap-2">
              <Play className="w-4 h-4" />
              See how it works
            </Button>
          </Link>
        </motion.div>

        {/* Embedded Demo Preview */}

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
