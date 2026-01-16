import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Compass, Clock, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Header } from '@/components/Header';

export default function Home() {
  return (
    <div className="min-h-screen">
      <Header />
      
      {/* Hero Section */}
      <section className="relative h-screen flex items-center justify-center overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <img 
            src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1920&q=80" 
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
      <footer className="py-8 bg-primary text-primary-foreground">
        <div className="container mx-auto px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5" />
            <span className="font-serif font-semibold">Voyance</span>
          </div>
          <p className="text-sm opacity-70">© 2026 Voyance. Thoughtful travel planning.</p>
        </div>
      </footer>
    </div>
  );
}
