import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Compass, Clock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import TopNav from '@/components/common/TopNav';
import Footer from '@/components/common/Footer';
import { useState } from 'react';
import { ROUTES } from '@/config/routes';

const sampleItineraries = [
  {
    id: 'bali',
    destination: 'Bali, Indonesia',
    days: 7,
    category: 'Wellness & Culture',
    price: 1890,
    includes: [
      'Private villa with infinity pool',
      'Daily yoga & meditation',
      'Authentic Balinese experiences',
      'Wellness-focused dining',
    ],
    dayHighlights: [
      { day: 1, title: 'Arrival in Paradise', description: 'Private villa, sunset yoga' },
      { day: 2, title: 'Sacred Temples', description: 'Tanah Lot, traditional ceremony' },
      { day: 3, title: 'Rice Terrace Trek', description: 'Jatiluwih, local cooking class' },
    ],
  },
  {
    id: 'tokyo',
    destination: 'Tokyo, Japan',
    days: 5,
    category: 'Urban Exploration',
    price: 2450,
    includes: [
      'Boutique hotel in Shibuya',
      'Private food tour',
      'Skip-the-line temple access',
      'Local neighborhood guides',
    ],
    dayHighlights: [
      { day: 1, title: 'Arrival & Shibuya', description: 'Check-in, Shibuya Crossing' },
      { day: 2, title: 'Traditional Tokyo', description: 'Senso-ji, tea ceremony' },
      { day: 3, title: 'Hidden Gems', description: 'Yanaka, local izakayas' },
    ],
  },
  {
    id: 'iceland',
    destination: 'Reykjavik, Iceland',
    days: 6,
    category: 'Adventure & Nature',
    price: 3200,
    includes: [
      'Cozy downtown guesthouse',
      'Golden Circle private tour',
      'Northern Lights expedition',
      'Blue Lagoon priority access',
    ],
    dayHighlights: [
      { day: 1, title: 'Arctic Arrival', description: 'Reykjavik exploration' },
      { day: 2, title: 'Golden Circle', description: 'Geysir, Gullfoss, Thingvellir' },
      { day: 3, title: 'South Coast', description: 'Black sand beaches, waterfalls' },
    ],
  },
];

export default function Home() {
  const [activeItinerary, setActiveItinerary] = useState(sampleItineraries[0]);

  return (
    <div className="min-h-screen flex flex-col">
      <TopNav />
      
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1920&q=80" 
            alt="Cinematic travel landscape"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 hero-overlay" />
          <div className="absolute inset-0 radial-glow opacity-60" />
        </div>

        {/* Content */}
        <div className="relative z-10 container mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <h1 className="font-serif text-5xl md:text-7xl font-semibold text-primary-foreground mb-6 text-balance">
              Travel designed with intention
            </h1>
            <p className="text-xl md:text-2xl text-primary-foreground/90 mb-10 max-w-2xl mx-auto text-balance">
              Research-driven itineraries that respect your time. No hype, no overclaiming—just thoughtful recommendations with clear reasoning.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/explore">
                <Button variant="hero" size="xl">
                  Design a Trip
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
              </Link>
              <Link to="/explore">
                <Button variant="heroOutline" size="xl">
                  Explore Destinations
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Scroll indicator */}
        <motion.div 
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
          animate={{ y: [0, 10, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <div className="w-6 h-10 border-2 border-primary-foreground/40 rounded-full flex justify-center pt-2">
            <div className="w-1.5 h-1.5 bg-primary-foreground/60 rounded-full" />
          </div>
        </motion.div>
      </section>

      {/* Real Itineraries Section */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-accent text-accent-foreground text-sm font-medium mb-6">
              Real Itineraries
            </span>
            <h2 className="font-serif text-4xl md:text-5xl font-semibold mb-4">
              Trips That Actually<br />
              <span className="text-accent">Make Sense</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              Real itineraries from real travelers. No generic templates, no filler days.
            </p>
          </motion.div>

          {/* Destination Tabs */}
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            {sampleItineraries.map((itinerary) => (
              <button
                key={itinerary.id}
                onClick={() => setActiveItinerary(itinerary)}
                className={`px-6 py-3 rounded-full font-medium transition-all ${
                  activeItinerary.id === itinerary.id
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-card border border-border text-foreground hover:border-accent/50'
                }`}
              >
                {itinerary.destination}
              </button>
            ))}
          </div>

          {/* Itinerary Preview Card */}
          <motion.div
            key={activeItinerary.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto"
          >
            {/* Left Column - Day Highlights */}
            <div>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="px-3 py-1 rounded-full bg-secondary text-sm">{activeItinerary.days} days</span>
                <span className="px-3 py-1 rounded-full bg-secondary text-sm">{activeItinerary.category}</span>
                <span className="px-3 py-1 rounded-full bg-accent text-accent-foreground text-sm font-medium">
                  from ${activeItinerary.price.toLocaleString()}
                </span>
              </div>
              
              <h3 className="font-serif text-2xl font-semibold mb-6">
                {activeItinerary.destination} in {activeItinerary.days} days
              </h3>

              <div className="space-y-4">
                {activeItinerary.dayHighlights.map((day) => (
                  <div key={day.day} className="flex gap-4 p-4 rounded-xl border border-border bg-card">
                    <div className="w-10 h-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-semibold shrink-0">
                      {day.day}
                    </div>
                    <div>
                      <h4 className="font-semibold">{day.title}</h4>
                      <p className="text-muted-foreground text-sm">{day.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Column - What's Included */}
            <div className="lg:pl-8">
              <h4 className="font-serif text-xl font-semibold mb-6">What's Included</h4>
              <ul className="space-y-4 mb-8">
                {activeItinerary.includes.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <span className="w-2 h-2 rounded-full bg-accent shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="space-y-3">
                <Link to={`/explore`}>
                  <Button variant="accent" size="lg" className="w-full">
                    View Full Itinerary
                  </Button>
                </Link>
                <Link to="/trip/new">
                  <Button variant="outline" size="lg" className="w-full">
                    Create Your Own
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>


      {/* How It Works */}
      <section className="py-24 bg-secondary/30">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent text-sm font-medium mb-6">
              How It Works
            </span>
            <h2 className="font-serif text-4xl md:text-5xl font-semibold mb-4">Travel Made Simple</h2>
            <p className="text-muted-foreground text-lg max-w-xl mx-auto">
              From dream to departure in three effortless steps
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: 1,
                emoji: '✨',
                title: 'Tell Us Your Dreams',
                description: 'Share your travel style through our smart quiz, or just tell us where you want to go. We learn what makes you tick.',
                cta: 'Take the Quiz',
                link: '/explore',
              },
              {
                step: 2,
                emoji: '🗺️',
                title: 'Get Your Perfect Plan',
                description: 'We craft a complete itinerary — flights, stays, experiences — tailored specifically to your vibe and budget.',
                cta: 'See Sample',
                link: '/explore',
              },
              {
                step: 3,
                emoji: '🚀',
                title: 'Book & Go',
                description: "Love it as-is? Book instantly. Want to tweak? Customize everything. Save for later? We've got you covered.",
                cta: 'Start Planning',
                link: '/explore',
              },
            ].map((item, index) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="bg-card rounded-2xl p-8 shadow-soft border border-border"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-accent text-accent-foreground flex items-center justify-center text-lg font-semibold">
                    {item.step}
                  </div>
                  <span className="text-2xl">{item.emoji}</span>
                </div>
                <h3 className="font-serif text-2xl font-semibold mb-3">{item.title}</h3>
                <p className="text-muted-foreground mb-6 leading-relaxed">{item.description}</p>
                <Link to={item.link}>
                  <Button variant="accent" className="w-full">
                    {item.cta}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Value Props */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="font-serif text-4xl font-semibold mb-4">A different approach to travel planning</h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              We believe the best trips are built on honest information, not viral recommendations.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: <Compass className="h-8 w-8" />,
                title: 'Explainable curation',
                description: 'Every recommendation comes with clear reasoning. Understand why we suggest what we suggest.',
              },
              {
                icon: <Clock className="h-8 w-8" />,
                title: 'Time-optimized',
                description: 'Itineraries consider peak hours, travel time between locations, and natural energy rhythms.',
              },
              {
                icon: <Sparkles className="h-8 w-8" />,
                title: 'Truth-first',
                description: 'No fabricated reviews, no paid placements. We distinguish verified facts from helpful suggestions.',
              },
            ].map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-8 bg-card rounded-xl border border-border shadow-soft text-center"
              >
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent/10 text-accent mb-6">
                  {item.icon}
                </div>
                <h3 className="font-serif text-xl font-semibold mb-3">{item.title}</h3>
                <p className="text-muted-foreground">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-secondary">
        <div className="container mx-auto px-6 text-center">
          <h2 className="font-serif text-4xl font-semibold mb-4">Ready to plan your next journey?</h2>
          <p className="text-muted-foreground text-lg mb-8">
            Start exploring destinations curated for curious travelers.
          </p>
          <Link to="/explore">
            <Button variant="accent" size="xl">
              Explore Destinations
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  );
}
