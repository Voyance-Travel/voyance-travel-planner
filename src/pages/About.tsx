import { motion } from 'framer-motion';
import MainLayout from '@/components/layout/MainLayout';
import { ArrowRight, Compass, Heart, Zap, Shield, Check, X, Sparkles, Globe, Clock, Users, Map, Calendar, CreditCard, Search, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import Head from '@/components/common/Head';

// Visual mockup of chaos (before)
function ChaosMockup() {
  return (
    <motion.div 
      initial={{ opacity: 0, x: -30 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6 }}
      className="relative"
    >
      {/* Browser window frame */}
      <div className="bg-muted/50 rounded-xl border border-border overflow-hidden shadow-2xl">
        {/* Browser header */}
        <div className="bg-muted px-4 py-3 border-b border-border flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          {/* Multiple tabs - chaos! */}
          <div className="flex-1 flex gap-1 ml-4 overflow-hidden">
            {['Flights', 'Hotels', 'Reviews', 'Maps', 'Blog', 'Insta', 'Reddit', '+12'].map((tab, i) => (
              <div 
                key={tab} 
                className={`px-3 py-1.5 text-xs rounded-t-md flex-shrink-0 ${
                  i === 0 ? 'bg-background text-foreground' : 'bg-muted-foreground/20 text-muted-foreground'
                }`}
              >
                {tab}
              </div>
            ))}
          </div>
        </div>
        
        {/* Content area - messy notes */}
        <div className="p-6 bg-background/50 min-h-[280px]">
          {/* Scattered notes and screenshots */}
          <div className="relative">
            {/* Sticky notes */}
            <motion.div 
              className="absolute top-0 left-0 w-28 h-24 bg-yellow-100 dark:bg-yellow-900/30 rounded shadow-md p-2 text-xs text-yellow-900 dark:text-yellow-100 rotate-[-3deg]"
              animate={{ rotate: [-3, -2, -3] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <div className="font-medium mb-1">Flight Options</div>
              <div className="text-[10px] opacity-70">• 7am - $342</div>
              <div className="text-[10px] opacity-70">• 11am - $489</div>
              <div className="text-[10px] opacity-70">• 3pm - ???</div>
            </motion.div>
            
            <motion.div 
              className="absolute top-2 left-32 w-24 h-20 bg-pink-100 dark:bg-pink-900/30 rounded shadow-md p-2 text-xs text-pink-900 dark:text-pink-100 rotate-[2deg]"
              animate={{ rotate: [2, 3, 2] }}
              transition={{ duration: 2.5, repeat: Infinity }}
            >
              <div className="font-medium mb-1">Hotels??</div>
              <div className="text-[10px] opacity-70">Check reviews!</div>
              <div className="text-[10px] opacity-70">Sarah likes pool</div>
            </motion.div>
            
            <motion.div 
              className="absolute top-20 left-12 w-32 h-20 bg-blue-100 dark:bg-blue-900/30 rounded shadow-md p-2 text-xs text-blue-900 dark:text-blue-100 rotate-[-1deg]"
              animate={{ rotate: [-1, 0, -1] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <div className="font-medium mb-1">Group Chat</div>
              <div className="text-[10px] opacity-70">"I can't do May 15"</div>
              <div className="text-[10px] opacity-70">"Budget???"</div>
              <div className="text-[10px] opacity-70">"Anyone booked yet?"</div>
            </motion.div>
            
            <motion.div 
              className="absolute top-8 right-8 w-28 h-28 bg-muted rounded-lg shadow-md overflow-hidden rotate-[3deg]"
              animate={{ rotate: [3, 4, 3] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <div className="h-full w-full bg-gradient-to-br from-orange-200 to-amber-300 flex items-center justify-center">
                <Map className="w-8 h-8 text-orange-600/60" />
              </div>
            </motion.div>
            
            <motion.div 
              className="absolute bottom-0 right-20 w-24 h-16 bg-green-100 dark:bg-green-900/30 rounded shadow-md p-2 text-xs text-green-900 dark:text-green-100 rotate-[-2deg]"
              animate={{ rotate: [-2, -1, -2] }}
              transition={{ duration: 2.2, repeat: Infinity }}
            >
              <div className="font-medium mb-1">Restaurants</div>
              <div className="text-[10px] opacity-70">• TripAdvisor list</div>
              <div className="text-[10px] opacity-70">• Need reservations</div>
            </motion.div>
            
            {/* Stress indicator */}
            <div className="absolute bottom-2 left-0 flex items-center gap-2 text-red-500 text-xs">
              <Clock className="w-3 h-3" />
              <span>6+ hours spent...</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Label */}
      <div className="mt-4 text-center">
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 text-sm font-medium">
          <X className="w-4 h-4" />
          The Old Way
        </span>
      </div>
    </motion.div>
  );
}

// Visual mockup of Voyance (after)
function VoyanceMockup() {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 30 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="relative"
    >
      {/* Browser window frame */}
      <div className="bg-background rounded-xl border border-border overflow-hidden shadow-2xl ring-2 ring-primary/20">
        {/* Browser header */}
        <div className="bg-muted px-4 py-3 border-b border-border flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          {/* Single Voyance tab */}
          <div className="flex-1 ml-4">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 text-xs rounded-t-md bg-background text-foreground">
              <Compass className="w-3 h-3 text-primary" />
              Voyance — Paris Trip
            </div>
          </div>
        </div>
        
        {/* Clean Voyance interface */}
        <div className="p-6 bg-background min-h-[280px]">
          {/* Trip header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="text-xs text-primary font-medium uppercase tracking-wider mb-1">Your Itinerary</div>
              <h3 className="text-xl font-serif font-bold">5 Days in Paris</h3>
              <p className="text-xs text-muted-foreground mt-1">May 15-20 • 2 travelers • Premium</p>
            </div>
            <div className="flex items-center gap-1 text-xs text-primary bg-primary/10 px-3 py-1.5 rounded-full">
              <Sparkles className="w-3 h-3" />
              Personalized
            </div>
          </div>
          
          {/* Quick summary cards */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-foreground">$2,840</div>
              <div className="text-[10px] text-muted-foreground">Total estimate</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-foreground">12</div>
              <div className="text-[10px] text-muted-foreground">Activities</div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-foreground">4★</div>
              <div className="text-[10px] text-muted-foreground">Hotel</div>
            </div>
          </div>
          
          {/* Day preview */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-muted-foreground mb-2">Day 1 Preview</div>
            {[
              { time: '10:00 AM', activity: 'Louvre Museum', icon: <Globe className="w-3 h-3" /> },
              { time: '1:00 PM', activity: 'Café de Flore', icon: <Star className="w-3 h-3" /> },
              { time: '3:30 PM', activity: 'Seine River Walk', icon: <Map className="w-3 h-3" /> },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground w-16">{item.time}</span>
                <div className="flex items-center gap-2 text-foreground">
                  <span className="text-primary">{item.icon}</span>
                  {item.activity}
                </div>
              </div>
            ))}
          </div>
          
          {/* Time saved indicator */}
          <div className="absolute bottom-6 right-6 flex items-center gap-2 text-primary text-xs">
            <Zap className="w-3 h-3" />
            <span>Ready in 5 minutes</span>
          </div>
        </div>
      </div>
      
      {/* Label */}
      <div className="mt-4 text-center">
        <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium">
          <Check className="w-4 h-4" />
          With Voyance
        </span>
      </div>
    </motion.div>
  );
}

export default function About() {
  const principles = [
    {
      icon: <Heart className="h-6 w-6" />,
      title: 'Anti-Influencer',
      description: 'Real recommendations based on your preferences, not paid partnerships or sponsored content. Transparency is non-negotiable.',
    },
    {
      icon: <Clock className="h-6 w-6" />,
      title: 'Your Time Matters',
      description: 'What takes 10+ hours of research, we compress into minutes. Your vacation planning shouldn\'t feel like a second job.',
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: 'Radical Transparency',
      description: 'No hidden fees, no surprise markups. What you see is what you pay. We believe trust is earned through honesty.',
    },
  ];

  const stats = [
    { value: '10+', label: 'Hours saved per trip' },
    { value: '50k+', label: 'Destinations mapped' },
    { value: '92%', label: 'Match accuracy' },
  ];

  return (
    <MainLayout>
      <Head
        title="About Voyance | AI-Powered Travel Planning"
        description="Learn about Voyance's mission to revolutionize travel planning with AI-powered personalization."
      />
      
      {/* Hero Section - Editorial Style */}
      <section className="relative pt-32 pb-24 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/10 to-transparent" />
        
        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl"
          >
            <motion.span 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-block text-primary text-sm font-medium uppercase tracking-[0.2em] mb-6"
            >
              Our Story
            </motion.span>
            <h1 className="font-serif text-5xl md:text-6xl lg:text-7xl font-bold mb-8 leading-[1.1]">
              Travel planning was{' '}
              <span className="text-primary italic">broken</span>.
              <br />
              We fixed it.
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed max-w-2xl">
              Voyance is an intelligent trip builder that listens, curates, and learns — 
              transforming the chaos of travel planning into a seamless, personalized experience.
            </p>
            
            {/* Stats row */}
            <div className="flex gap-12 mt-12 pt-8 border-t border-border/50">
              {stats.map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                >
                  <div className="text-3xl font-serif font-bold text-foreground">{stat.value}</div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Before/After Visual Comparison */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-primary text-sm font-medium uppercase tracking-[0.2em]">The Transformation</span>
            <h2 className="font-serif text-4xl md:text-5xl font-bold mt-4 mb-6">
              From chaos to clarity
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              See the difference. What used to take dozens of tabs, endless research, 
              and hours of coordination now happens in one intelligent interface.
            </p>
          </motion.div>

          {/* Visual Before/After */}
          <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
            <ChaosMockup />
            <VoyanceMockup />
          </div>
          
          {/* Arrow or VS indicator */}
          <motion.div 
            initial={{ opacity: 0, scale: 0 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 0.4 }}
            className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
          >
            <div className="w-16 h-16 rounded-full bg-background border-2 border-primary flex items-center justify-center shadow-xl">
              <ArrowRight className="w-6 h-6 text-primary" />
            </div>
          </motion.div>
        </div>
      </section>

      {/* Core Principles */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-primary text-sm font-medium uppercase tracking-[0.2em]">Our Principles</span>
            <h2 className="font-serif text-4xl md:text-5xl font-bold mt-4">
              What we believe
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {principles.map((principle, idx) => (
              <motion.div
                key={principle.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.15 }}
                className="relative group"
              >
                {/* Card */}
                <div className="bg-card rounded-2xl border border-border p-8 h-full transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:bg-primary/20 transition-colors">
                    <div className="text-primary">{principle.icon}</div>
                  </div>
                  <h3 className="font-serif text-xl font-bold mb-3">{principle.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{principle.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works - Visual */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <span className="text-primary text-sm font-medium uppercase tracking-[0.2em]">The Process</span>
            <h2 className="font-serif text-4xl md:text-5xl font-bold mt-4">
              How Voyance works
            </h2>
          </motion.div>

          <div className="max-w-4xl mx-auto">
            {[
              {
                step: '01',
                title: 'Discover Your Travel DNA',
                description: 'Our comprehensive quiz understands your preferences, pace, budget, and style — far beyond basic filters.',
                icon: <Search className="w-6 h-6" />,
              },
              {
                step: '02',
                title: 'AI-Curated Recommendations',
                description: 'We analyze thousands of options and surface only what matches your unique profile. No generic suggestions.',
                icon: <Sparkles className="w-6 h-6" />,
              },
              {
                step: '03',
                title: 'Plan, Customize, Perfect',
                description: 'Get a complete itinerary with flights, hotels, and activities. Tweak anything until it\'s exactly right.',
                icon: <Calendar className="w-6 h-6" />,
              },
              {
                step: '04',
                title: 'Book with Confidence',
                description: 'Transparent pricing, verified options, and support when you need it. No surprises, just great trips.',
                icon: <CreditCard className="w-6 h-6" />,
              },
            ].map((item, idx) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, x: idx % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="flex gap-6 mb-12 last:mb-0"
              >
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                    {item.icon}
                  </div>
                </div>
                <div className="flex-1 pt-2">
                  <div className="flex items-baseline gap-3 mb-2">
                    <span className="text-xs font-medium text-primary tracking-wider">{item.step}</span>
                    <h3 className="font-serif text-xl font-bold">{item.title}</h3>
                  </div>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Who We Serve */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <span className="text-primary text-sm font-medium uppercase tracking-[0.2em]">Built For You</span>
              <h2 className="font-serif text-4xl md:text-5xl font-bold mt-4 mb-8">
                Thoughtful travelers deserve better tools
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                We built Voyance for people who value their time as much as their experiences. 
                For those who want meaningful trips, not just destinations.
              </p>
              <Link to="/quiz">
                <Button size="lg" className="gap-2">
                  Discover Your Travel DNA
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-4"
            >
              {[
                {
                  title: 'Experience Seekers',
                  desc: 'Those who travel for moments, not just photos. You want authentic experiences that stay with you.',
                  icon: <Sparkles className="w-5 h-5" />,
                },
                {
                  title: 'Busy Professionals',
                  desc: 'Time is your scarcest resource. You want amazing trips without the research rabbit holes.',
                  icon: <Clock className="w-5 h-5" />,
                },
                {
                  title: 'Group Travelers',
                  desc: 'Coordinating friends and family is hard. You need tools that make everyone happy.',
                  icon: <Users className="w-5 h-5" />,
                },
              ].map((persona, idx) => (
                <motion.div 
                  key={persona.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-card rounded-xl border border-border p-6 hover:border-primary/30 transition-colors"
                >
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <div className="text-primary">{persona.icon}</div>
                    </div>
                    <div>
                      <h4 className="font-serif text-lg font-bold mb-1">{persona.title}</h4>
                      <p className="text-sm text-muted-foreground">{persona.desc}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-b from-primary/5 to-background">
        <div className="container mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto"
          >
            <Compass className="w-12 h-12 text-primary mx-auto mb-6" />
            <h2 className="font-serif text-4xl md:text-5xl font-bold mb-6">
              Ready to plan differently?
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Discover your Travel DNA and let Voyance craft your perfect trip. 
              It takes 5 minutes and changes everything.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/quiz">
                <Button size="lg" className="gap-2 w-full sm:w-auto">
                  Take the Quiz
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/explore">
                <Button size="lg" variant="outline" className="w-full sm:w-auto">
                  Explore Destinations
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </MainLayout>
  );
}
