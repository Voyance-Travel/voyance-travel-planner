import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal, ArrowRight, Sparkles, Clock, ChevronRight, Compass } from 'lucide-react';
import { Header } from '@/components/Header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { destinations } from '@/lib/destinations';

// Seasonal collections data
const seasonalCollections = [
  {
    id: 'spring',
    emoji: '🌸',
    title: 'Spring Escapes',
    description: 'Cherry blossoms, festivals, and perfect weather',
    destinations: ['paris', 'amsterdam', 'kyoto', 'lisbon'],
  },
  {
    id: 'summer',
    emoji: '☀️',
    title: 'Summer Adventures',
    description: 'Beach getaways, outdoor activities, and sunshine adventures',
    destinations: ['santorini', 'barcelona', 'bali', 'sydney'],
  },
  {
    id: 'autumn',
    emoji: '🍂',
    title: 'Autumn Retreats',
    description: 'Fall foliage, harvest seasons, and cozy experiences',
    destinations: ['kyoto', 'vermont', 'vienna', 'florence'],
  },
  {
    id: 'winter',
    emoji: '❄️',
    title: 'Winter Wonders',
    description: 'Ice escapes, northern lights, and festive markets',
    destinations: ['dubai', 'reykjavik', 'salzburg', 'aspen'],
    isNew: true,
  },
];

// Travel styles
const travelStyles = [
  { id: 'luxe', label: 'Luxe Traveler', desc: 'Indulge in world-class destinations' },
  { id: 'adventure', label: 'Adventure Seeker', desc: 'Thrilling experiences await' },
  { id: 'culture', label: 'Culture Explorer', desc: 'Deep dive into local traditions' },
  { id: 'street', label: 'Street Eater', desc: 'Culinary journeys and flavors' },
  { id: 'urban', label: 'Urban Escapist', desc: 'City vibes and nightlife' },
  { id: 'nature', label: 'Nature Romantic', desc: 'Scenic beauty and tranquility' },
];

// Voyance Guides (blog articles)
const guides = [
  {
    id: '1',
    title: 'Best Time to Book Flights in 2025',
    excerpt: 'Discover the optimal booking windows and save up to 40%.',
    readTime: '5 min read',
    image: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=600&q=80',
    category: 'Tips',
  },
  {
    id: '2',
    title: 'How to Travel Like a Local',
    excerpt: 'Expert tips to discover authentic experiences without the tourist crowds.',
    readTime: '8 min read',
    image: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=600&q=80',
    category: 'Guide',
  },
  {
    id: '3',
    title: 'Hidden Gems in Big Cities',
    excerpt: 'Uncover secret spots and local favorites in the world\'s most popular destinations.',
    readTime: '6 min read',
    image: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=600&q=80',
    category: 'Discovery',
  },
];

// Spotlight destinations
const spotlightDestinations = [
  { id: 'kyoto', city: 'Kyoto', desc: 'A harmony of ancient temples, seasonal cuisine, and craft traditions.', tags: ['Culture', 'History', 'Cuisine'] },
  { id: 'rome', city: 'Rome', desc: 'Layers of centuries where art, architecture, and dolce vita converge.', tags: ['Art', 'History', 'Food'] },
  { id: 'barcelona', city: 'Barcelona', desc: 'Sun-drenched coastline meets creative spirit — beaches, tapas, and modernist wonders.', tags: ['Beach', 'Art', 'Nightlife'] },
  { id: 'bangkok', city: 'Bangkok', desc: 'A symphony of flavors and cultures where street vendors become Michelin stars.', tags: ['Food', 'Culture', 'Temples'] },
];

export default function Explore() {
  const [showFilters, setShowFilters] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState('luxe');

  // Get destination data by ID
  const getDestination = (id: string) => destinations.find(d => d.id === id) || destinations[0];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center">
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1920&q=80" 
            alt="Scenic landscape"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-background" />
        </div>

        <div className="relative z-10 container mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm text-white text-sm font-medium mb-6">
              Discover your next adventure
            </span>
            <h1 className="font-serif text-5xl md:text-6xl font-semibold text-white mb-4">
              Explore the World<br />
              <span className="text-accent">with Style</span>
            </h1>
            <p className="text-white/80 text-lg max-w-2xl mx-auto mb-8">
              Discover destinations curated to your travel preferences — from hidden gems to iconic landmarks.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button 
                variant="outline" 
                className="bg-white/10 backdrop-blur-sm border-white/30 text-white hover:bg-white/20"
                onClick={() => setShowFilters(!showFilters)}
              >
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                Show Filters
              </Button>
              <Button variant="accent">
                Browse Destinations
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div 
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <div className="w-6 h-10 border-2 border-white/40 rounded-full flex justify-center pt-2">
            <div className="w-1.5 h-1.5 bg-white/60 rounded-full" />
          </div>
        </motion.div>
      </section>

      {/* Seasonal Collections */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl font-semibold">Seasonal Collections</h2>
            <p className="text-muted-foreground mt-2">Perfect destinations for every time of year</p>
            <button className="text-accent text-sm font-medium mt-3 hover:underline">
              View all Seasons →
            </button>
          </div>

          {seasonalCollections.map((collection, collectionIdx) => (
            <div key={collection.id} className="mb-12 last:mb-0">
              <div className="flex items-center gap-2 mb-4">
                <span>{collection.emoji}</span>
                <h3 className="font-semibold">{collection.title}</h3>
                {collection.isNew && (
                  <span className="px-2 py-0.5 rounded text-xs bg-accent text-accent-foreground font-medium">NEW SEASON</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-4">{collection.description}</p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {collection.destinations.map((destId) => {
                  const dest = getDestination(destId);
                  return (
                    <Link 
                      key={destId}
                      to={`/destinations/${dest.id}`}
                      className="group relative rounded-xl overflow-hidden aspect-[4/5]"
                    >
                      <img 
                        src={dest.imageUrl} 
                        alt={dest.city}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-4">
                        <p className="text-white font-semibold">{dest.city}</p>
                        <p className="text-white/70 text-sm line-clamp-2">{dest.tagline}</p>
                        <Button variant="accent" size="sm" className="mt-3 h-7 text-xs">
                          Plan Your Trip
                        </Button>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Explore by Travel Style */}
      <section className="py-20 bg-secondary/30">
        <div className="container mx-auto px-6">
          <div className="text-center mb-8">
            <h2 className="font-serif text-3xl font-semibold">Explore by Travel Style</h2>
            <p className="text-muted-foreground mt-2">Discover destinations that match your travel personality</p>
            <button className="text-accent text-sm font-medium mt-3 hover:underline">
              Take our quiz →
            </button>
          </div>

          {/* Style Tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {travelStyles.map((style) => (
              <button
                key={style.id}
                onClick={() => setSelectedStyle(style.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedStyle === style.id
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-card border border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                {style.label}
              </button>
            ))}
          </div>

          {/* Selected style description */}
          <div className="text-center mb-8">
            <h3 className="font-semibold">{travelStyles.find(s => s.id === selectedStyle)?.label}</h3>
            <p className="text-sm text-muted-foreground">
              {travelStyles.find(s => s.id === selectedStyle)?.desc}
            </p>
          </div>

          {/* Destinations grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
            {destinations.slice(0, 4).map((dest) => (
              <Link
                key={dest.id}
                to={`/destinations/${dest.id}`}
                className="group relative rounded-xl overflow-hidden aspect-[3/4]"
              >
                <img 
                  src={dest.imageUrl} 
                  alt={dest.city}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3">
                  <p className="text-white font-medium">{dest.city}</p>
                  <Button variant="accent" size="sm" className="mt-2 h-6 text-xs">
                    Plan Trip →
                  </Button>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Voyance Guides */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl font-semibold">Voyance Guides</h2>
            <p className="text-muted-foreground mt-2">
              Expert insights and curated guides from seasoned travelers. Everything you<br />
              need to know before you go.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {guides.map((guide) => (
              <article key={guide.id} className="group">
                <div className="relative rounded-xl overflow-hidden aspect-[16/10] mb-4">
                  <img 
                    src={guide.image} 
                    alt={guide.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <span className="absolute top-3 left-3 px-2 py-1 rounded bg-accent text-accent-foreground text-xs font-medium">
                    {guide.category}
                  </span>
                </div>
                <h3 className="font-semibold mb-1 group-hover:text-accent transition-colors">{guide.title}</h3>
                <p className="text-sm text-muted-foreground mb-2">{guide.excerpt}</p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {guide.readTime}
                  </span>
                  <button className="text-accent font-medium hover:underline">Read more →</button>
                </div>
              </article>
            ))}
          </div>

          <div className="text-center mt-10">
            <Button variant="outline">
              View all Travel Guides
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Voyage Spotlight */}
      <section className="py-20 bg-secondary/30">
        <div className="container mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="font-serif text-3xl font-semibold">Voyage Spotlight</h2>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
              Handpicked destinations where extraordinary moments await. Each one<br />
              chosen for its unique ability to transform travelers.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {spotlightDestinations.map((spotlight) => {
              const dest = getDestination(spotlight.id);
              return (
                <Link
                  key={spotlight.id}
                  to={`/destinations/${dest.id}`}
                  className="group relative rounded-xl overflow-hidden aspect-[4/3]"
                >
                  <img 
                    src={dest.imageUrl} 
                    alt={spotlight.city}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <h3 className="text-white text-xl font-semibold mb-1">{spotlight.city}</h3>
                    <p className="text-white/80 text-sm mb-3">{spotlight.desc}</p>
                    <div className="flex flex-wrap gap-2">
                      {spotlight.tags.map((tag) => (
                        <span key={tag} className="px-2 py-1 rounded bg-white/20 text-white text-xs">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          <div className="text-center mt-10">
            <button className="text-muted-foreground text-sm hover:text-foreground">
              Explore all destinations →
            </button>
          </div>
        </div>
      </section>

      {/* Feeling Adventurous CTA */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6 text-center">
          <h2 className="font-serif text-2xl font-semibold mb-3">Feeling Adventurous?</h2>
          <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
            Based on your travel DNA, we'll find your perfect destination that match your<br />
            style, dates, and budget.
          </p>
          <Button variant="accent">
            <Sparkles className="h-4 w-4 mr-2" />
            Surprise Me
          </Button>
        </div>
      </section>

      {/* Quote Section */}
      <section className="py-16 bg-secondary/30">
        <div className="container mx-auto px-6 text-center max-w-3xl">
          <div className="text-5xl text-muted-foreground/30 mb-4">"</div>
          <blockquote className="font-serif text-xl md:text-2xl text-foreground italic mb-4">
            Travel is the only thing you buy that makes you richer. Every journey adds a new story, a new perspective, a new piece to your soul.
          </blockquote>
          <cite className="text-muted-foreground text-sm">— Anonymous Wanderer</cite>
          <p className="text-muted-foreground text-sm mt-8">
            Your next adventure is waiting. Where will Voyance take you?
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-primary text-primary-foreground">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-5 gap-8 mb-8">
            <div className="md:col-span-2">
              <span className="font-serif text-xl font-semibold"><span className="text-accent">V</span>oyance</span>
              <p className="text-sm opacity-70 mt-2 mb-4">Personalized travel experiences powered by research, not influencers.</p>
            </div>
            <div>
              <h4 className="font-medium mb-3">Travel</h4>
              <ul className="space-y-2 text-sm opacity-70">
                <li>How It Works</li>
                <li>Destinations</li>
                <li>Curated</li>
                <li>Trips</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-3">Destinations</h4>
              <ul className="space-y-2 text-sm opacity-70">
                <li>Popular Routes</li>
                <li>Travel Styles</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-3">Help Center</h4>
              <ul className="space-y-2 text-sm opacity-70">
                <li>Contact Us</li>
                <li>FAQ</li>
                <li>Privacy Policy</li>
                <li>Terms of Service</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-primary-foreground/20 pt-8 flex items-center justify-between text-sm opacity-70">
            <p>© 2026 Voyance. All rights reserved.</p>
            <div className="flex gap-4">
              <span>Privacy</span>
              <span>Terms</span>
              <span>Cookies</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
