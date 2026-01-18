import { motion } from 'framer-motion';
import MainLayout from '@/components/layout/MainLayout';
import { ArrowRight, Compass, Heart, Zap, Shield, Check, X, Sparkles, Globe, Clock, Users, Map, Calendar, CreditCard, Search, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import Head from '@/components/common/Head';

// Visual mockup of chaos (before) - Real website style
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
      <div className="bg-[#f8f9fa] rounded-xl border border-[#dee2e6] overflow-hidden shadow-2xl">
        {/* Browser header - Chrome style */}
        <div className="bg-[#e8eaed] px-3 py-2 border-b border-[#d3d3d3] flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-[#ed6a5e]" />
            <div className="w-3 h-3 rounded-full bg-[#f4bf4f]" />
            <div className="w-3 h-3 rounded-full bg-[#61c554]" />
          </div>
          {/* Multiple tabs - chaos! */}
          <div className="flex-1 flex gap-0.5 ml-3 overflow-hidden">
            {[
              { name: 'Flights', color: 'bg-white', active: true },
              { name: 'Hotels', color: 'bg-blue-50' },
              { name: 'Reviews', color: 'bg-green-50' },
              { name: 'Maps', color: 'bg-amber-50' },
              { name: 'Blog', color: 'bg-purple-50' },
              { name: '+8', color: 'bg-gray-200' },
            ].map((tab, i) => (
              <div 
                key={tab.name} 
                className={`px-2 py-1 text-[10px] rounded-t-lg flex-shrink-0 border-t border-x border-[#d3d3d3] ${
                  tab.active ? 'bg-white text-[#202124] font-medium' : `${tab.color} text-[#5f6368]`
                }`}
              >
                {tab.name}
              </div>
            ))}
          </div>
        </div>
        
        {/* URL bar */}
        <div className="bg-white px-4 py-2 border-b border-[#e5e5e5]">
          <div className="flex items-center gap-3">
            <div className="flex gap-2">
              <div className="w-5 h-5 rounded-full bg-[#dadce0] flex items-center justify-center">
                <span className="text-[8px] text-[#5f6368]">←</span>
              </div>
              <div className="w-5 h-5 rounded-full bg-[#dadce0] flex items-center justify-center">
                <span className="text-[8px] text-[#5f6368]">→</span>
              </div>
            </div>
            <div className="flex-1 bg-[#f1f3f4] rounded-full px-4 py-1.5 text-[10px] text-[#5f6368]">
              google.com/travel/flights?dest=PAR...
            </div>
          </div>
        </div>
        
        {/* Content area - real website feel */}
        <div className="bg-white min-h-[300px] relative overflow-hidden">
          {/* Google Flights mockup */}
          <div className="p-4">
            {/* Search bar */}
            <div className="flex gap-2 mb-4">
              <div className="flex-1 border border-[#dadce0] rounded-lg p-2 text-[10px] text-[#5f6368]">
                <span className="text-[#202124]">NYC</span> → <span className="text-[#202124]">Paris</span>
              </div>
              <div className="border border-[#dadce0] rounded-lg p-2 text-[10px] text-[#5f6368]">
                May 15-20
              </div>
              <div className="bg-[#1a73e8] text-white rounded-lg px-4 py-2 text-[10px]">
                Search
              </div>
            </div>
            
            {/* Flight results */}
            <div className="space-y-2">
              {[
                { airline: 'Delta', time: '7:00 AM - 9:15 PM', stops: '1 stop', price: '$842' },
                { airline: 'Air France', time: '10:30 AM - 11:45 PM', stops: 'Nonstop', price: '$1,247' },
                { airline: 'United', time: '3:15 PM - 6:30 AM+1', stops: '1 stop', price: '$789' },
              ].map((flight, i) => (
                <motion.div 
                  key={i}
                  className="border border-[#dadce0] rounded-lg p-2 flex items-center justify-between text-[10px]"
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 2, delay: i * 0.3, repeat: Infinity }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-[#f1f3f4] rounded-full" />
                    <div>
                      <div className="font-medium text-[#202124]">{flight.time}</div>
                      <div className="text-[#5f6368]">{flight.airline} • {flight.stops}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold text-[#202124]">{flight.price}</div>
                    <div className="text-[8px] text-[#5f6368]">round trip</div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
          
          {/* Overlapping browser windows - generic */}
          <motion.div 
            className="absolute top-4 right-2 w-48 bg-white rounded-lg shadow-xl border border-[#e5e5e5] overflow-hidden rotate-[3deg] opacity-95"
            animate={{ rotate: [3, 4, 3] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <div className="bg-blue-600 text-white px-2 py-1 text-[8px] font-bold">Hotels Site</div>
            <div className="p-2 text-[8px]">
              <div className="text-blue-600 font-bold mb-1">Paris Hotels</div>
              <div className="text-[#5f6368]">1,247 properties</div>
              <div className="text-green-600 font-medium mt-1">From $89/night</div>
            </div>
          </motion.div>
          
          <motion.div 
            className="absolute bottom-8 right-8 w-44 bg-white rounded-lg shadow-xl border border-[#e5e5e5] overflow-hidden rotate-[-2deg] opacity-95"
            animate={{ rotate: [-2, -3, -2] }}
            transition={{ duration: 2.5, repeat: Infinity }}
          >
            <div className="bg-emerald-500 px-2 py-1 text-[8px] font-bold text-white">Reviews Site</div>
            <div className="p-2 text-[8px]">
              <div className="font-bold mb-1">Things to Do</div>
              <div className="text-[#5f6368]">Eiffel Tower ★★★★★</div>
              <div className="text-[#5f6368]">Louvre Museum ★★★★★</div>
            </div>
          </motion.div>
          
          {/* Sticky notes overlaid */}
          <motion.div 
            className="absolute bottom-16 left-4 w-24 h-20 bg-[#fff475] rounded shadow-lg p-2 text-[8px] text-[#3c4043] rotate-[-4deg]"
            animate={{ rotate: [-4, -3, -4] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="font-bold mb-1">TODO:</div>
            <div>• Compare hotels</div>
            <div>• Check reviews</div>
            <div>• Ask Sarah dates</div>
          </motion.div>
          
          {/* Stress indicator */}
          <div className="absolute bottom-2 left-2 flex items-center gap-2 bg-[#fce8e6] text-[#c5221f] text-[10px] px-3 py-1.5 rounded-full">
            <Clock className="w-3 h-3" />
            <span className="font-medium">6+ hours researching...</span>
          </div>
        </div>
      </div>
      
      {/* Label */}
      <div className="mt-6 text-center">
        <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-destructive/10 text-destructive text-sm font-semibold">
          <X className="w-4 h-4" />
          The Old Way
        </span>
      </div>
    </motion.div>
  );
}

// Visual mockup of Voyance (after) - Polished app style
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
      <div className="rounded-xl border-2 border-primary/30 overflow-hidden shadow-2xl shadow-primary/10 bg-gradient-to-br from-background via-background to-primary/5">
        {/* Browser header - Modern style */}
        <div className="bg-gradient-to-r from-primary/10 to-primary/5 px-4 py-3 border-b border-primary/20 flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-primary/40" />
            <div className="w-3 h-3 rounded-full bg-primary/30" />
            <div className="w-3 h-3 rounded-full bg-primary/20" />
          </div>
          {/* Single Voyance tab */}
          <div className="flex-1 ml-4 flex items-center justify-between">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 text-xs rounded-full bg-primary/10 text-primary font-medium">
              <Compass className="w-3 h-3" />
              voyance.travel/trip/paris-adventure
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Synced
            </div>
          </div>
        </div>
        
        {/* Clean Voyance interface */}
        <div className="p-6 bg-background min-h-[320px] relative">
          {/* Decorative gradient */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-full" />
          
          {/* Trip header */}
          <div className="flex items-start justify-between mb-5 relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 text-xs text-primary font-medium uppercase tracking-wider mb-2 bg-primary/10 px-3 py-1 rounded-full">
                <Sparkles className="w-3 h-3" />
                Your Curated Itinerary
              </div>
              <h3 className="text-2xl font-serif font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">5 Days in Paris</h3>
              <p className="text-xs text-muted-foreground mt-1">May 15-20, 2025 • 2 travelers • Premium Experience</p>
            </div>
          </div>
          
          {/* Quick summary cards - Premium style */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-3 text-center border border-primary/20">
              <div className="text-lg font-bold text-foreground">$2,840</div>
              <div className="text-[10px] text-muted-foreground">All-inclusive</div>
            </div>
            <div className="bg-gradient-to-br from-accent/50 to-accent/30 rounded-xl p-3 text-center border border-accent/30">
              <div className="text-lg font-bold text-foreground">12</div>
              <div className="text-[10px] text-muted-foreground">Hand-picked activities</div>
            </div>
            <div className="bg-gradient-to-br from-secondary to-secondary/50 rounded-xl p-3 text-center border border-secondary/30">
              <div className="flex items-center justify-center gap-0.5 text-lg font-bold text-foreground">
                <Star className="w-3 h-3 fill-primary text-primary" />
                4.8
              </div>
              <div className="text-[10px] text-muted-foreground">Boutique Hotel</div>
            </div>
          </div>
          
          {/* Day preview - Timeline style */}
          <div className="relative pl-4 border-l-2 border-primary/30 space-y-3">
            <div className="text-xs font-semibold text-foreground mb-3 -ml-4 pl-4">Day 1 — Arrival & Culture</div>
            {[
              { time: '10:00 AM', activity: 'Louvre Museum', desc: 'Skip-the-line tickets', icon: <Globe className="w-3 h-3" /> },
              { time: '1:00 PM', activity: 'Café de Flore', desc: 'Lunch reservation', icon: <Star className="w-3 h-3" /> },
              { time: '3:30 PM', activity: 'Seine River Walk', desc: 'Golden hour stroll', icon: <Map className="w-3 h-3" /> },
            ].map((item, i) => (
              <motion.div 
                key={i} 
                className="flex items-start gap-3 text-xs relative"
                initial={{ opacity: 0, x: -10 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.1 }}
              >
                {/* Timeline dot */}
                <div className="absolute -left-[1.15rem] top-1 w-2 h-2 rounded-full bg-primary ring-2 ring-background" />
                <span className="text-muted-foreground w-16 flex-shrink-0">{item.time}</span>
                <div className="flex-1 bg-muted/50 rounded-lg p-2 border border-border/50">
                  <div className="flex items-center gap-2 text-foreground font-medium">
                    <span className="text-primary">{item.icon}</span>
                    {item.activity}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{item.desc}</div>
                </div>
              </motion.div>
            ))}
          </div>
          
          {/* Time saved indicator */}
          <div className="absolute bottom-4 right-4 flex items-center gap-2 text-primary text-xs bg-primary/10 px-3 py-2 rounded-full border border-primary/20">
            <Zap className="w-3 h-3" />
            <span className="font-medium">Built in 5 minutes</span>
          </div>
        </div>
      </div>
      
      {/* Label */}
      <div className="mt-6 text-center">
        <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary/15 text-primary text-sm font-semibold border border-primary/20">
          <Check className="w-4 h-4" />
          With Voyance
        </span>
      </div>
    </motion.div>
  );
}

export default function About() {
  const stats = [
    { value: '15+', label: 'Hours saved per trip' },
    { value: '190+', label: 'Countries covered' },
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
      <section className="py-24 bg-gradient-to-b from-muted/50 to-muted/20 relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-destructive/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-6 relative z-10">
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

          {/* Visual Before/After with VS indicator */}
          <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 max-w-6xl mx-auto relative">
            <ChaosMockup />
            
            {/* VS indicator between mockups */}
            <motion.div 
              initial={{ opacity: 0, scale: 0 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.4 }}
              className="hidden lg:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20"
            >
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-background to-muted border-2 border-primary/50 flex items-center justify-center shadow-xl">
                <span className="text-primary font-bold text-sm">VS</span>
              </div>
            </motion.div>
            
            <VoyanceMockup />
          </div>
        </div>
      </section>

      {/* Core Principles - Creative Bento Layout */}
      <section className="py-24 bg-background relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-20 left-10 w-32 h-32 bg-primary/5 rounded-full blur-2xl" />
        <div className="absolute bottom-20 right-10 w-48 h-48 bg-accent/10 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-6 relative z-10">
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

          {/* Bento Grid Layout */}
          <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Large featured card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="md:row-span-2 relative group"
            >
              <div className="h-full bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-3xl border border-primary/20 p-8 md:p-10 transition-all duration-300 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/10">
                <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mb-8">
                  <Heart className="w-8 h-8 text-primary" />
                </div>
                <h3 className="font-serif text-2xl md:text-3xl font-bold mb-4">Anti-Influencer</h3>
                <p className="text-muted-foreground leading-relaxed text-lg">
                  Real recommendations based on your preferences, not paid partnerships or sponsored content. 
                  <span className="block mt-4 text-foreground font-medium">Transparency is non-negotiable.</span>
                </p>
                <div className="absolute bottom-8 right-8 w-24 h-24 rounded-full bg-primary/5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Sparkles className="w-10 h-10 text-primary/40" />
                </div>
              </div>
            </motion.div>

            {/* Time card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="relative group"
            >
              <div className="h-full bg-gradient-to-br from-accent/20 via-accent/10 to-transparent rounded-3xl border border-accent/30 p-8 transition-all duration-300 hover:border-accent/50 hover:shadow-xl">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center">
                    <Clock className="w-6 h-6 text-foreground" />
                  </div>
                  <span className="text-4xl font-bold text-accent/60">15+</span>
                </div>
                <h3 className="font-serif text-xl font-bold mb-2">Your Time Matters</h3>
                <p className="text-muted-foreground text-sm">
                  Hours saved per trip. Your vacation planning shouldn't feel like a second job.
                </p>
              </div>
            </motion.div>

            {/* Transparency card */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="relative group"
            >
              <div className="h-full bg-gradient-to-br from-secondary via-secondary/80 to-secondary/50 rounded-3xl border border-border/50 p-8 transition-all duration-300 hover:shadow-xl">
                <div className="w-12 h-12 rounded-xl bg-background/50 backdrop-blur flex items-center justify-center mb-4">
                  <Shield className="w-6 h-6 text-foreground" />
                </div>
                <h3 className="font-serif text-xl font-bold mb-2">Radical Transparency</h3>
                <p className="text-muted-foreground text-sm">
                  No hidden fees, no surprise markups. What you see is what you pay. Trust is earned through honesty.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works - Interactive Timeline */}
      <section className="py-24 bg-gradient-to-b from-muted/40 via-background to-background relative overflow-hidden">
        <div className="container mx-auto px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <span className="text-primary text-sm font-medium uppercase tracking-[0.2em]">The Process</span>
            <h2 className="font-serif text-4xl md:text-5xl font-bold mt-4">
              How Voyance works
            </h2>
          </motion.div>

          {/* Visual Timeline */}
          <div className="max-w-4xl mx-auto relative">
            {/* Animated connecting line */}
            <div className="absolute left-8 md:left-1/2 top-0 bottom-0 w-0.5 bg-gradient-to-b from-primary via-primary/50 to-primary/20 hidden md:block" />
            
            {[
              {
                step: '01',
                title: 'Discover Your Travel DNA',
                description: 'Our comprehensive quiz understands your preferences, pace, budget, and style — far beyond basic filters.',
                icon: <Search className="w-6 h-6" />,
                image: 'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=400&q=80',
              },
              {
                step: '02',
                title: 'AI-Curated Recommendations',
                description: 'We analyze thousands of options and surface only what matches your unique profile. No generic suggestions.',
                icon: <Sparkles className="w-6 h-6" />,
                image: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400&q=80',
              },
              {
                step: '03',
                title: 'Plan, Customize, Perfect',
                description: 'Get a complete itinerary with flights, hotels, and activities. Tweak anything until it\'s exactly right.',
                icon: <Calendar className="w-6 h-6" />,
                image: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400&q=80',
              },
              {
                step: '04',
                title: 'Book with Confidence',
                description: 'Transparent pricing, verified options, and support when you need it. No surprises, just great trips.',
                icon: <CreditCard className="w-6 h-6" />,
                image: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=400&q=80',
              },
            ].map((item, idx) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: idx * 0.1 }}
                className={`relative grid md:grid-cols-2 gap-8 mb-16 last:mb-0 items-center ${
                  idx % 2 === 1 ? 'md:direction-rtl' : ''
                }`}
              >
                {/* Timeline node */}
                <div className="absolute left-8 md:left-1/2 top-0 w-4 h-4 rounded-full bg-primary ring-4 ring-background transform -translate-x-1/2 hidden md:block" />
                
                {/* Content */}
                <div className={`${idx % 2 === 1 ? 'md:order-2 md:text-right' : ''}`}>
                  <div className={`inline-flex items-center gap-3 mb-4 ${idx % 2 === 1 ? 'md:flex-row-reverse' : ''}`}>
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center text-primary shadow-lg shadow-primary/10">
                      {item.icon}
                    </div>
                    <span className="text-sm font-bold text-primary tracking-wider bg-primary/10 px-3 py-1 rounded-full">{item.step}</span>
                  </div>
                  <h3 className="font-serif text-2xl font-bold mb-3">{item.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{item.description}</p>
                </div>

                {/* Image */}
                <div className={`${idx % 2 === 1 ? 'md:order-1' : ''} relative`}>
                  <div className="aspect-[4/3] rounded-2xl overflow-hidden shadow-xl">
                    <img 
                      src={item.image} 
                      alt={item.title}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="absolute -bottom-3 -right-3 w-20 h-20 bg-primary/10 rounded-2xl -z-10" />
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Who We Serve */}
      <section className="py-24 bg-gradient-to-br from-background via-background to-accent/5 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute top-1/2 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2" />
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <span className="inline-flex items-center gap-2 text-primary text-sm font-medium uppercase tracking-[0.2em] mb-4 bg-primary/10 px-4 py-2 rounded-full">
                <Users className="w-4 h-4" />
                Built For You
              </span>
              <h2 className="font-serif text-4xl md:text-5xl font-bold mt-4 mb-8 leading-tight">
                Thoughtful travelers deserve{' '}
                <span className="text-primary">better tools</span>
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                We built Voyance for people who value their time as much as their experiences. 
                For those who want meaningful trips, not just destinations.
              </p>
              <Link to="/quiz">
                <Button size="lg" className="gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-shadow">
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
                  gradient: 'from-primary/20 to-primary/5',
                },
                {
                  title: 'Busy Professionals',
                  desc: 'Time is your scarcest resource. You want amazing trips without the research rabbit holes.',
                  icon: <Clock className="w-5 h-5" />,
                  gradient: 'from-accent/30 to-accent/10',
                },
                {
                  title: 'Group Travelers',
                  desc: 'Coordinating friends and family is hard. You need tools that make everyone happy.',
                  icon: <Users className="w-5 h-5" />,
                  gradient: 'from-secondary to-secondary/50',
                },
              ].map((persona, idx) => (
                <motion.div 
                  key={persona.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                  className="group"
                >
                  <div className={`bg-gradient-to-br ${persona.gradient} rounded-2xl border border-border/50 p-6 hover:border-primary/30 transition-all hover:shadow-lg hover:-translate-y-0.5`}>
                    <div className="flex gap-4">
                      <div className="w-12 h-12 rounded-xl bg-background/80 backdrop-blur flex items-center justify-center shrink-0 shadow-sm group-hover:shadow-md transition-shadow">
                        <div className="text-primary">{persona.icon}</div>
                      </div>
                      <div>
                        <h4 className="font-serif text-lg font-bold mb-1">{persona.title}</h4>
                        <p className="text-sm text-muted-foreground">{persona.desc}</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-32 relative overflow-hidden">
        {/* Rich gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto"
          >
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="inline-block"
            >
              <Compass className="w-16 h-16 text-primary mx-auto mb-6" />
            </motion.div>
            <h2 className="font-serif text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Ready to plan{' '}
              <span className="text-primary italic">differently?</span>
            </h2>
            <p className="text-xl text-muted-foreground mb-10">
              Discover your Travel DNA and let Voyance craft your perfect trip. 
              It takes 5 minutes and changes everything.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/quiz">
                <Button size="lg" className="gap-2 w-full sm:w-auto text-lg px-8 py-6 shadow-xl shadow-primary/25 hover:shadow-primary/35 transition-shadow">
                  Take the Quiz
                  <ArrowRight className="h-5 w-5" />
                </Button>
              </Link>
              <Link to="/explore">
                <Button size="lg" variant="outline" className="w-full sm:w-auto text-lg px-8 py-6 border-2">
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
