import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { motion } from 'framer-motion';
import { CheckCircle, Sparkles, Calendar, Plane, MapPin, Clock, Users, Star, ArrowRight, Compass, Heart, Shield, Dna, Leaf, Trophy, Gem } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ROUTES } from '@/config/routes';
import { ARCHETYPE_NARRATIVES, CATEGORY_COLORS, CATEGORY_DESCRIPTIONS } from '@/data/archetypeNarratives';

const steps = [
  {
    icon: Sparkles,
    title: 'Discover Your Travel DNA',
    description: 'Take our 2-minute quiz to uncover your unique travel personality from 27 distinct archetypes. We learn your pace, interests, and dream experiences.',
    image: 'https://images.unsplash.com/photo-1522199755839-a2bacb67c546?w=600&q=80',
    color: 'from-violet-500 to-purple-600',
  },
  {
    icon: Compass,
    title: 'Get Personalized Recommendations',
    description: 'Our AI matches you with destinations and experiences that resonate with who you are. Every suggestion is tailored to your travel style.',
    image: 'https://images.unsplash.com/photo-1488085061387-422e29b40080?w=600&q=80',
    color: 'from-blue-500 to-cyan-600',
  },
  {
    icon: Calendar,
    title: 'Craft Your Perfect Itinerary',
    description: 'Watch as we build a day-by-day plan with the right mix of activities, dining, and downtime. Customize anything until it feels just right.',
    image: 'https://images.unsplash.com/photo-1527631746610-bca00a040d60?w=600&q=80',
    color: 'from-emerald-500 to-teal-600',
  },
  {
    icon: Plane,
    title: 'We Build It Into Your Plan',
    description: 'Share your flight details and we weave everything together—hotels, activities, and local experiences built around your schedule.',
    image: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=600&q=80',
    color: 'from-orange-500 to-rose-600',
  },
];

const benefits = [
  {
    icon: Clock,
    title: 'Save 15+ Hours',
    description: 'Skip the endless research. We do the heavy lifting so you can focus on dreaming.',
  },
  {
    icon: Heart,
    title: 'Truly Personal',
    description: 'Every recommendation reflects your unique preferences, not generic tourist traps.',
  },
  {
    icon: Users,
    title: 'Group Friendly',
    description: 'Planning with others? We balance everyone\'s preferences for perfect group trips.',
  },
  {
    icon: Shield,
    title: 'Book with Confidence',
    description: 'Transparent pricing and verified booking options you can trust.',
  },
];

const stats = [
  { value: '27', label: 'Unique Travel Archetypes', icon: Dna },
  { value: '190+', label: 'Countries Covered', icon: MapPin },
];

// Featured archetypes to showcase
const FEATURED_ARCHETYPES = [
  'slow_traveler',
  'cultural_anthropologist',
  'adrenaline_architect',
  'culinary_cartographer',
  'family_architect',
  'luxury_luminary',
];

const CATEGORY_ICONS = {
  EXPLORER: Compass,
  CONNECTOR: Users,
  ACHIEVER: Trophy,
  RESTORER: Leaf,
  CURATOR: Gem,
  TRANSFORMER: Sparkles,
};

export default function HowItWorks() {
  return (
    <MainLayout>
      <Head
        title="How It Works | Voyance"
        description="Learn how Voyance uses AI to create your perfect personalized travel itinerary in minutes."
      />
      
      {/* Hero */}
      <section className="pt-32 pb-20 bg-gradient-to-br from-primary/10 via-background to-accent/10 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-transparent to-transparent" />
        <div className="max-w-5xl mx-auto px-4 text-center relative">
          <motion.span
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-block px-4 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium mb-6"
          >
            The Smarter Way to Travel
          </motion.span>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-6xl font-display font-bold text-foreground mb-6 leading-tight"
          >
            Your Dream Trip,<br />
            <span className="text-primary">Perfectly Planned</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl text-muted-foreground max-w-2xl mx-auto mb-10"
          >
            No more endless tabs, conflicting reviews, or overwhelming choices. 
            Voyance learns who you are and builds the journey you've been dreaming of.
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
              <Link to={ROUTES.EXPLORE}>Explore Destinations</Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-12 bg-gradient-to-r from-primary/5 via-card to-primary/5 border-y border-border">
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid grid-cols-2 gap-12">
            {stats.map((stat, index) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
                className="text-center"
              >
                <div className="flex items-center justify-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <stat.icon className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-4xl font-bold text-primary">{stat.value}</p>
                </div>
                <p className="text-muted-foreground">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
      
      {/* Steps - Alternating Layout */}
      <section className="py-24">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
              Four Simple Steps to Your Perfect Trip
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              From dream to departure in less time than it takes to scroll through travel blogs
            </p>
          </motion.div>

          <div className="space-y-24">
            {steps.map((step, index) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6 }}
                className={`grid lg:grid-cols-2 gap-12 items-center ${
                  index % 2 === 1 ? 'lg:flex-row-reverse' : ''
                }`}
              >
                <div className={index % 2 === 1 ? 'lg:order-2' : ''}>
                  <div className={`inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br ${step.color} text-white mb-6`}>
                    <step.icon className="h-7 w-7" />
                  </div>
                  <div className="text-sm font-semibold text-primary mb-2">Step {index + 1}</div>
                  <h3 className="text-2xl md:text-3xl font-bold text-foreground mb-4">{step.title}</h3>
                  <p className="text-lg text-muted-foreground leading-relaxed">{step.description}</p>
                </div>
                <div className={`relative ${index % 2 === 1 ? 'lg:order-1' : ''}`}>
                  <div className={`absolute inset-0 bg-gradient-to-br ${step.color} rounded-3xl blur-2xl opacity-20 -m-4`} />
                  <img
                    src={step.image}
                    alt={step.title}
                    className="relative w-full aspect-[4/3] object-cover rounded-2xl shadow-xl"
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Travel DNA Archetypes Section */}
      <section className="py-20 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <Badge className="mb-4 bg-primary/10 text-primary border-primary/20">
              <Dna className="w-3 h-3 mr-1" />
              27 Unique Types
            </Badge>
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
              Meet the Travel DNA Archetypes
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everyone travels differently. Our system identifies your unique style from 27 distinct personalities.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
            {FEATURED_ARCHETYPES.map((id, index) => {
              const archetype = ARCHETYPE_NARRATIVES[id];
              if (!archetype) return null;
              const categoryStyle = CATEGORY_COLORS[archetype.category];
              const CategoryIcon = CATEGORY_ICONS[archetype.category];
              
              return (
                <motion.div
                  key={id}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.05 }}
                  className={`rounded-xl border p-5 ${categoryStyle.border} ${categoryStyle.bg}`}
                >
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-2xl">{archetype.emoji}</span>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">{archetype.name}</h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <CategoryIcon className={`w-3 h-3 ${categoryStyle.text}`} />
                        <span className={`text-xs ${categoryStyle.text}`}>
                          {CATEGORY_DESCRIPTIONS[archetype.category].name}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-foreground italic mb-2">
                    "{archetype.hookLine}"
                  </p>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {archetype.coreDescription}
                  </p>
                </motion.div>
              );
            })}
          </div>

          <div className="text-center">
            <Button asChild variant="outline" size="lg">
              <Link to={ROUTES.ARCHETYPES}>
                View All 27 Archetypes
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Benefits - Enhanced */}
      <section className="py-24 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        
        <div className="max-w-6xl mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-5xl font-display font-bold text-foreground mb-4">
              Why It Works
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              We handle the complexity so you can enjoy the journey
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {benefits.map((benefit, index) => (
              <motion.div
                key={benefit.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ y: -8, scale: 1.02 }}
                className="group relative"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 rounded-3xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative bg-card/80 backdrop-blur-sm p-8 rounded-3xl border border-border hover:border-primary/30 transition-all duration-300 h-full">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                    <benefit.icon className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground mb-3">{benefit.title}</h3>
                  <p className="text-muted-foreground">{benefit.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Promise Section - Enhanced with imagery */}
      <section className="py-24 relative overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/20 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-accent/20 via-transparent to-transparent" />
        
        {/* Decorative images */}
        <div className="absolute top-0 right-0 w-1/3 h-full opacity-20">
          <img 
            src="https://images.unsplash.com/photo-1507608616759-54f48f0af0ee?w=800&q=80" 
            alt="" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-transparent to-slate-900" />
        </div>
        
        <div className="max-w-5xl mx-auto px-4 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white/80 text-sm font-medium mb-4 border border-white/20">
              <Shield className="w-4 h-4" />
              Built on Trust
            </span>
            <h2 className="text-3xl md:text-5xl font-display font-bold text-white mb-4">
              Our Promise to You
            </h2>
            <p className="text-lg text-white/60 max-w-2xl mx-auto">
              We're building Voyance on a foundation of honesty and transparency
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Shield,
                title: 'No Hidden Fees',
                description: 'What you see is what you pay. We never add surprise charges or markups.',
                color: 'from-emerald-500 to-teal-500',
              },
              {
                icon: Heart,
                title: 'Honest Recommendations',
                description: 'Every suggestion is based on your preferences, not paid partnerships.',
                color: 'from-rose-500 to-pink-500',
              },
              {
                icon: Sparkles,
                title: 'Genuinely Personalized',
                description: 'Your itinerary is crafted for you, not recycled from a template.',
                color: 'from-violet-500 to-purple-500',
              },
            ].map((promise, index) => (
              <motion.div
                key={promise.title}
                initial={{ opacity: 0, y: 30, rotateX: 15 }}
                whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15, duration: 0.6 }}
                whileHover={{ y: -5, scale: 1.02 }}
                className="group"
              >
                <div className="relative h-full bg-white/5 backdrop-blur-lg p-8 rounded-3xl border border-white/10 hover:border-white/30 transition-all duration-300 overflow-hidden">
                  {/* Gradient overlay on hover */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${promise.color} opacity-0 group-hover:opacity-10 transition-opacity duration-500`} />
                  
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${promise.color} flex items-center justify-center mx-auto mb-6 shadow-lg shadow-black/20`}>
                    <promise.icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-3 text-center">{promise.title}</h3>
                  <p className="text-white/60 text-center">{promise.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
          
          {/* Trust indicators */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="mt-16 flex flex-wrap items-center justify-center gap-8 text-white/40 text-sm"
          >
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <span>No credit card required to explore</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <span>Transparent pricing with no hidden fees</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <span>Verified booking options</span>
            </div>
          </motion.div>
        </div>
      </section>
      
      {/* CTA */}
      <section className="py-24 bg-gradient-to-br from-primary/10 via-accent/5 to-background">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-foreground mb-4">
              Ready to Plan Your Next Adventure?
            </h2>
            <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
              Start with our free quiz to discover your Travel DNA. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg" className="text-lg px-8">
                <Link to={ROUTES.QUIZ}>
                  Take the Travel Quiz
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to={ROUTES.DESTINATIONS}>Browse Destinations</Link>
              </Button>
            </div>
          </motion.div>
        </div>
      </section>
    </MainLayout>
  );
}
