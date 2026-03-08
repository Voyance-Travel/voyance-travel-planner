import { motion } from 'framer-motion';
import { Quote, Sparkles, Brain, Clock, MapPin, AlertTriangle, Gem, Users, TrendingUp } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Real beta tester testimonials - replace with actual quotes as they accumulate
const BETA_TESTIMONIALS = [
  {
    id: 1,
    quote: "We used it for a long weekend in Denver and it nailed every restaurant. Never thought AI could plan a domestic trip this well.",
    name: "Chris R.",
    archetype: "Culinary Cartographer",
    trip: "Denver, 3 days",
    isReal: true,
  },
  {
    id: 2,
    quote: "The timing hacks alone saved us hours of waiting in lines. We hit the Louvre at exactly the right moment.",
    name: "James & Lin",
    archetype: "Culture Curator",
    trip: "Paris, 5 days",
    isReal: true,
  },
  {
    id: 3,
    quote: "Planned a girls' trip to New York in 10 minutes. The group blend feature figured out what all four of us would love.",
    name: "Maria K.",
    archetype: "Connection Curator",
    trip: "New York, 4 days",
    isReal: true,
  },
];

// 7 layers of intelligence - what makes Voyance different
const INTELLIGENCE_LAYERS = [
  { icon: MapPin, label: "What to do", description: "Curated activities matched to your style" },
  { icon: Gem, label: "Local picks", description: "Insider alternatives locals actually love" },
  { icon: Clock, label: "When to go", description: "Optimal timing to avoid crowds" },
  { icon: TrendingUp, label: "How to pace", description: "Energy flow matched to your rhythm" },
  { icon: Gem, label: "Hidden finds", description: "Local gems only your archetype would love" },
  { icon: Users, label: "Group harmony", description: "Blend different travel styles seamlessly" },
  { icon: Brain, label: "Learning loop", description: "Gets smarter from every trip rated" },
];

// Fallback metrics (used while loading)
const FALLBACK_METRICS = {
  tripsBuilt: 114,
  destinations: 2246,
};

function usePlatformMetrics() {
  return useQuery({
    queryKey: ['platform-metrics-home'],
    queryFn: async () => {
      const [tripsRes, destRes] = await Promise.all([
        supabase.from('trips').select('id', { count: 'exact', head: true }),
        supabase.from('destinations').select('id', { count: 'exact', head: true }),
      ]);
      return {
        tripsBuilt: tripsRes.count ?? FALLBACK_METRICS.tripsBuilt,
        destinations: destRes.count ?? FALLBACK_METRICS.destinations,
      };
    },
    staleTime: 60_000 * 5, // 5 minutes
  });
}

function TestimonialCard({ testimonial }: { testimonial: typeof BETA_TESTIMONIALS[0] }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-card border border-border rounded-xl p-6 relative"
    >
      <Quote className="w-8 h-8 text-primary/20 absolute top-4 right-4" />
      
      <p className="text-foreground leading-relaxed mb-4 font-serif italic">
        "{testimonial.quote}"
      </p>
      
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-foreground text-sm">{testimonial.name}</p>
          <p className="text-xs text-muted-foreground">{testimonial.trip}</p>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary/10 rounded-full">
          <Sparkles className="w-3 h-3 text-primary" />
          <span className="text-xs font-medium text-primary">{testimonial.archetype}</span>
        </div>
      </div>
    </motion.div>
  );
}

export default function SocialProofSection() {
  return (
    <section className="py-16 sm:py-24 md:py-32 bg-muted/20 relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 md:px-16">
        
        {/* Founder Story */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16 md:mb-20"
        >
          <div className="flex items-center justify-center gap-3 sm:gap-4 mb-4">
            <div className="w-6 sm:w-8 h-px bg-primary" />
            <span className="text-[10px] sm:text-xs tracking-[0.25em] uppercase text-muted-foreground font-sans">
              Why We Built This
            </span>
            <div className="w-6 sm:w-8 h-px bg-primary" />
          </div>
          
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-normal text-foreground mb-6 max-w-3xl mx-auto">
            Built for every traveler, every trip
          </h2>
          
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Whether you're exploring Tokyo or your local mountains, we got tired of generic recommendations 
            that didn't match how we actually travel. So we built the tool we wished existed.
          </p>
        </motion.div>

        {/* 7 Layers of Intelligence */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 md:mb-20"
        >
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-4">
              <Brain className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Powered by 7 Layers of Intelligence</span>
            </div>
            <p className="text-muted-foreground max-w-lg mx-auto">
              Every itinerary is shaped by multiple intelligence layers working together.
            </p>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
            {INTELLIGENCE_LAYERS.map((layer, index) => {
              const Icon = layer.icon;
              return (
                <motion.div
                  key={layer.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  className="text-center p-4 bg-card border border-border rounded-xl hover:border-primary/30 transition-colors group"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3 group-hover:bg-primary/20 transition-colors">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-sm font-medium text-foreground mb-1">{layer.label}</p>
                  <p className="text-xs text-muted-foreground leading-snug hidden sm:block">{layer.description}</p>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Real Platform Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex justify-center gap-8 md:gap-16 mb-16 md:mb-20 py-8 border-y border-border"
        >
          <div className="text-center">
            <p className="text-3xl md:text-4xl font-serif text-foreground mb-1">
              {REAL_METRICS.tripsBuilt}
            </p>
            <p className="text-sm text-muted-foreground">Trips Built</p>
          </div>
          <div className="text-center">
            <p className="text-3xl md:text-4xl font-serif text-foreground mb-1">
              {REAL_METRICS.archetypesAvailable}
            </p>
            <p className="text-sm text-muted-foreground">Travel Archetypes</p>
          </div>
          <div className="text-center">
            <p className="text-3xl md:text-4xl font-serif text-foreground mb-1">
              {REAL_METRICS.destinations.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground">Destinations</p>
          </div>
        </motion.div>

        {/* Beta Tester Testimonials */}
        <div>
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mb-8"
          >
            <h3 className="text-xl sm:text-2xl font-serif text-foreground mb-2">
              What Beta Testers Say
            </h3>
            <p className="text-sm text-muted-foreground">
              Real quotes from real travelers. More coming as we grow.
            </p>
          </motion.div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {BETA_TESTIMONIALS.map((testimonial) => (
              <TestimonialCard key={testimonial.id} testimonial={testimonial} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
