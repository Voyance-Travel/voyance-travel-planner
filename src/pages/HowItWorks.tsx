import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion } from 'framer-motion';
import { 
  CheckCircle, 
  Sparkles, 
  Calendar, 
  MapPin, 
  Clock, 
  Users, 
  ArrowRight, 
  Dna, 
  Route,
  Star,
  Lock,
  RefreshCw,
  DollarSign,
  Shield,
  Eye
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ROUTES } from '@/config/routes';

const steps = [
  {
    number: '01',
    title: 'Take the Quiz',
    time: '2 min',
    description: 'Answer 10 questions. We identify your archetype from 27 traveler types.',
    icon: Dna,
  },
  {
    number: '02',
    title: 'Tell Us Your Trip',
    time: '1 min',
    description: 'Destination, dates, hotel, arrival time. We need this to optimize your days.',
    icon: MapPin,
  },
  {
    number: '03',
    title: 'Get Your Itinerary',
    time: 'Instant',
    description: 'Day-by-day. Activity-by-activity. Routes optimized. Reviews included.',
    icon: Calendar,
  },
];

const features = [
  {
    icon: Calendar,
    title: 'Day-by-Day Schedule',
    description: 'Every activity timed to your pace',
    color: 'bg-blue-500/10 text-blue-600',
  },
  {
    icon: RefreshCw,
    title: 'Swap & Lock',
    description: "Don't like something? Swap it. Love it? Lock it.",
    color: 'bg-amber-500/10 text-amber-600',
  },
  {
    icon: Star,
    title: 'Real Reviews',
    description: 'Aggregated from Google, TripAdvisor, Foursquare',
    color: 'bg-yellow-500/10 text-yellow-600',
  },
  {
    icon: Route,
    title: 'Route Optimization',
    description: 'We reorder your day to minimize transit time',
    color: 'bg-emerald-500/10 text-emerald-600',
  },
  {
    icon: DollarSign,
    title: 'Budget Tracking',
    description: 'See costs per activity, per day, per trip',
    color: 'bg-green-500/10 text-green-600',
  },
  {
    icon: Users,
    title: 'Group Blending',
    description: 'Traveling together? We merge your Travel DNA',
    color: 'bg-purple-500/10 text-purple-600',
  },
];

const stats = [
  { value: '27', label: 'traveler personalities', icon: Dna },
  { value: '190+', label: 'destinations', icon: MapPin },
  { value: '8', label: 'traits analyzed', icon: Sparkles },
  { value: '30-45', label: 'min saved daily', icon: Clock },
];

const promises = [
  { text: 'No credit card to explore', icon: Shield },
  { text: 'Real reviews, not paid placements', icon: Star },
  { text: "Book direct - we don't mark up prices", icon: DollarSign },
  { text: 'Your data stays yours', icon: Lock },
];

export default function HowItWorks() {
  return (
    <MainLayout>
      <Head
        title="How It Works | Voyance"
        description="From quiz to itinerary in minutes. See how Voyance builds personalized day-by-day travel plans."
      />
      
      {/* Hero - Sharper messaging */}
      <section className="pt-32 pb-20 bg-gradient-to-br from-primary/10 via-background to-accent/10 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="max-w-5xl mx-auto px-4 text-center relative">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block px-4 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium mb-6"
          >
            Quiz → Trip Details → Itinerary
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-display font-bold text-foreground mb-6 leading-tight"
          >
            From Quiz to Itinerary<br />
            <span className="text-primary">in Minutes</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-muted-foreground max-w-2xl mx-auto mb-4"
          >
            Tell us who you are. We'll build your days.
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="text-base text-muted-foreground/80 max-w-xl mx-auto mb-10"
          >
            Every activity timed. Every route optimized. Every recommendation real.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button asChild size="lg" className="text-lg px-8">
              <Link to={ROUTES.QUIZ}>
                Take the Quiz
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-lg px-8">
              <Link to={ROUTES.DEMO}>
                <Eye className="mr-2 h-5 w-5" />
                See a Demo
              </Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* 3 Steps - Sharpened */}
      <section className="py-24 bg-muted/30">
        <div className="max-w-5xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
              Three Steps. That's It.
            </h2>
            <p className="text-lg text-muted-foreground">
              No account required to start. No credit card to explore.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="relative"
              >
                {/* Connector line */}
                {index < steps.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-full w-full h-px bg-gradient-to-r from-border to-transparent z-0" />
                )}
                
                <div className="relative bg-card border border-border rounded-2xl p-8 h-full">
                  {/* Step number */}
                  <div className="flex items-center justify-between mb-6">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <step.icon className="h-7 w-7 text-primary" />
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {step.time}
                    </Badge>
                  </div>
                  
                  <div className="text-5xl font-bold text-primary/20 mb-3">{step.number}</div>
                  <h3 className="text-xl font-bold text-foreground mb-3">{step.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{step.description}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Additional context for step 3 */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-8 text-center"
          >
            <p className="text-sm text-muted-foreground">
              <span className="text-foreground font-medium">Then customize:</span> Swap anything. Lock your favorites. Regenerate what doesn't fit.
            </p>
          </motion.div>
        </div>
      </section>

      {/* What You Actually Get - Visual Feature Grid */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
              <Sparkles className="w-3 h-3 mr-1" />
              What You Get
            </Badge>
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
              What Your Itinerary Includes
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Not just a list of places. A complete day-by-day plan you can actually use.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -4 }}
                className="group"
              >
                <div className="bg-card border border-border rounded-2xl p-6 h-full hover:border-primary/30 transition-all duration-300">
                  <div className={`w-12 h-12 rounded-xl ${feature.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats - Reframed with outcome metric */}
      <section className="py-16 bg-muted/30 border-y border-border">
        <div className="max-w-5xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.1 * index }}
                className="text-center"
              >
                <div className="flex items-center justify-center gap-2 mb-2">
                  <stat.icon className="w-5 h-5 text-primary" />
                  <p className="text-3xl md:text-4xl font-bold text-primary">{stat.value}</p>
                </div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Promise - Simplified */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
        
        <div className="max-w-4xl mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-4">
              Our Promise
            </h2>
          </motion.div>

          <div className="grid sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
            {promises.map((promise, index) => (
              <motion.div
                key={promise.text}
                initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-5 py-4"
              >
                <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <promise.icon className="w-4 h-4 text-primary" />
                </div>
                <span className="text-white/90 text-sm font-medium">{promise.text}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA - Sharpened */}
      <section className="py-24 bg-gradient-to-b from-background to-muted/30">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
              Ready to see your itinerary?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
              Take the quiz, tell us where you're going, and watch your days come together.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="text-lg px-8">
                <Link to={ROUTES.QUIZ}>
                  Build My Itinerary
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="text-lg px-8">
                <Link to={ROUTES.DEMO}>Explore the Demo</Link>
              </Button>
            </div>
            
            {/* Trust indicator */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3 }}
              className="mt-8 flex items-center justify-center gap-2 text-sm text-muted-foreground"
            >
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>No account required to start</span>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </MainLayout>
  );
}
