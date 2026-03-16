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
        <div className="bg-white min-h-[200px] md:min-h-[300px] relative overflow-hidden">
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
            className="absolute top-4 right-2 w-24 md:w-48 bg-white rounded-lg shadow-xl border border-[#e5e5e5] overflow-hidden rotate-[3deg] opacity-95 hidden md:block"
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
            className="absolute bottom-8 right-8 w-44 bg-white rounded-lg shadow-xl border border-[#e5e5e5] overflow-hidden rotate-[-2deg] opacity-95 hidden md:block"
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
            className="absolute bottom-16 left-4 w-24 h-20 bg-[#fff475] rounded shadow-lg p-2 text-[8px] text-[#3c4043] rotate-[-4deg] hidden md:block"
            animate={{ rotate: [-4, -3, -4] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <div className="font-bold mb-1">Still need to:</div>
            <div>• Compare hotel options</div>
            <div>• Read more reviews</div>
            <div>• Confirm dates w/ group</div>
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
        <div className="p-2 md:p-6 bg-background min-h-[200px] md:min-h-[320px] relative overflow-hidden">
          {/* Decorative gradient */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-full" />
          
          {/* Trip header */}
          <div className="flex items-start justify-between mb-5 relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 text-xs text-primary font-medium uppercase tracking-wider mb-2 bg-primary/10 px-3 py-1 rounded-full">
                <Sparkles className="w-3 h-3" />
                Your Curated Itinerary
              </div>
              <h3 className="text-lg md:text-2xl font-serif font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">5 Days in Paris</h3>
              <p className="text-xs text-muted-foreground mt-1">May 15-20, 2025 • 2 travelers • Premium Experience</p>
            </div>
          </div>
          
          {/* Quick summary cards - Premium style */}
          <div className="grid grid-cols-3 gap-1.5 md:gap-3 mb-3 md:mb-5">
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg md:rounded-xl p-1.5 md:p-3 text-center border border-primary/20">
              <div className="text-xs md:text-lg font-bold text-foreground">$2,840</div>
              <div className="text-[8px] md:text-[10px] text-muted-foreground">All-inclusive</div>
            </div>
            <div className="bg-gradient-to-br from-accent/50 to-accent/30 rounded-lg md:rounded-xl p-1.5 md:p-3 text-center border border-accent/30">
              <div className="text-xs md:text-lg font-bold text-foreground">12</div>
              <div className="text-[8px] md:text-[10px] text-muted-foreground">Activities</div>
            </div>
            <div className="bg-gradient-to-br from-secondary to-secondary/50 rounded-lg md:rounded-xl p-1.5 md:p-3 text-center border border-secondary/30">
              <div className="flex items-center justify-center gap-0.5 text-xs md:text-lg font-bold text-foreground">
                <Star className="w-2 h-2 md:w-3 md:h-3 fill-primary text-primary" />
                4.8
              </div>
              <div className="text-[8px] md:text-[10px] text-muted-foreground">Hotel</div>
            </div>
          </div>
          
          {/* Day preview - Timeline style */}
          <div className="relative pl-4 border-l-2 border-primary/30 space-y-3">
            <div className="text-xs font-semibold text-foreground mb-3 -ml-4 pl-4">Day 1 · Arrival & Culture</div>
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
  return (
    <MainLayout>
      <Head
        title="About | Travel Designed, Not Consumed"
        description="Voyance started because travel planning online isn't planning. It's being marketed to. We built the opposite."
      />
      
      {/* Hero Section - Your Vision */}
      <section className="relative pt-28 pb-20 md:pt-44 md:pb-36 lg:pt-52 lg:pb-44 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/10 to-transparent" />
        
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl"
          >


            <h1 className="font-serif text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-bold mb-6 md:mb-10 leading-[1.08]">
              Travel{' '}
              <span className="text-primary italic">designed</span>,
              <br />
              not consumed.
            </h1>
            <p className="text-lg md:text-2xl text-muted-foreground leading-relaxed max-w-2xl">
              Voyance started because travel planning online isn't planning. It's being marketed to. 
              Endless lists. Sponsored content. 40 tabs of noise.
            </p>
            <p className="text-lg md:text-2xl text-foreground font-medium mt-5 md:mt-8 max-w-2xl">
              We built the opposite: research-backed itineraries designed around you, not trends.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Before/After Visual Comparison */}
      <section className="py-12 md:py-24 bg-gradient-to-b from-muted/50 to-muted/20 relative overflow-hidden">
        {/* Background decorations */}
        <div className="absolute top-0 left-0 w-64 h-64 bg-destructive/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-8 md:mb-16"
          >
            <span className="text-primary text-xs md:text-sm font-medium uppercase tracking-[0.2em]">The Problem</span>
            <h2 className="font-serif text-2xl md:text-5xl font-bold mt-3 md:mt-4 mb-3 md:mb-6">
              Clarity instead of chaos
            </h2>
            <p className="text-sm md:text-lg text-muted-foreground max-w-2xl mx-auto">
              People spend money, waste time in lines, do what everyone else did, 
              and still feel like something was missing. We built the opposite.
            </p>
          </motion.div>

          {/* Visual Before/After with VS indicator */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 max-w-6xl mx-auto relative">
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

      {/* Why Voyance Exists */}
      <section className="py-12 md:py-24 bg-background relative overflow-hidden">
        <div className="absolute top-20 left-10 w-32 h-32 bg-primary/5 rounded-full blur-2xl" />
        
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <span className="text-primary text-xs md:text-sm font-medium uppercase tracking-[0.2em]">Why Voyance Exists</span>
              <div className="mt-4 md:mt-8 space-y-4 md:space-y-6 text-base md:text-lg leading-relaxed">
                <p className="text-foreground font-medium text-lg md:text-xl">
                  Voyance started because we kept having the same experience.
                </p>
                <p className="text-muted-foreground text-sm md:text-lg">
                  We'd spend hours planning a trip, make thoughtful choices, and still end up wasting time and 
                  money in ways that didn't feel obvious until we were already there.
                </p>
                <p className="text-foreground font-medium text-sm md:text-lg">
                  We wanted a better way to plan, one that protects your vacation time, respects your budget, 
                  and actually reflects you.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* What We're Building */}
      <section className="py-12 md:py-24 bg-muted/20 relative overflow-hidden">
        <div className="absolute bottom-10 right-10 w-40 h-40 bg-accent/5 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <span className="text-primary text-xs md:text-sm font-medium uppercase tracking-[0.2em]">What We're Building</span>
              <div className="mt-4 md:mt-8 space-y-4 md:space-y-6 text-base md:text-lg leading-relaxed">
                <p className="text-foreground font-medium text-lg md:text-xl">
                  Voyance is a travel design platform.
                </p>
                <p className="text-muted-foreground text-sm md:text-lg">
                  It helps you turn preferences into a trip that makes sense in real life:
                </p>
                <ul className="space-y-2 md:space-y-3 text-muted-foreground text-sm md:text-base">
                  <li className="flex items-start gap-2 md:gap-3">
                    <Check className="w-4 h-4 md:w-5 md:h-5 text-primary mt-0.5 shrink-0" />
                    <span><strong className="text-foreground">Smart timing</strong> so you're not accidentally choosing the busiest, most expensive windows</span>
                  </li>
                  <li className="flex items-start gap-2 md:gap-3">
                    <Check className="w-4 h-4 md:w-5 md:h-5 text-primary mt-0.5 shrink-0" />
                    <span><strong className="text-foreground">Geographically coherent plans</strong> so you're not zig-zagging across a city</span>
                  </li>
                  <li className="flex items-start gap-2 md:gap-3">
                    <Check className="w-4 h-4 md:w-5 md:h-5 text-primary mt-0.5 shrink-0" />
                    <span><strong className="text-foreground">Budget applied across the whole trip</strong>, with day-by-day balance</span>
                  </li>
                  <li className="flex items-start gap-2 md:gap-3">
                    <Check className="w-4 h-4 md:w-5 md:h-5 text-primary mt-0.5 shrink-0" />
                    <span><strong className="text-foreground">Clear reasoning</strong> behind recommendations, so you can trust the plan</span>
                  </li>
                </ul>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* The People Behind Voyance */}
      <section className="py-12 md:py-24 bg-background relative overflow-hidden">
        <div className="absolute top-1/2 left-1/4 w-64 h-64 bg-primary/3 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <div className="max-w-3xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <span className="text-primary text-xs md:text-sm font-medium uppercase tracking-[0.2em]">Meet the Founders</span>
              <div className="mt-4 md:mt-8 space-y-4 md:space-y-6 text-sm md:text-lg leading-relaxed">
                <p className="text-foreground font-medium text-lg md:text-xl">
                  We're the two people (and one Yorkie) behind Voyance.
                </p>
                <p className="text-muted-foreground">
                  People work too hard for their money. Too hard for their vacation. And they have too little of both. When you finally take that trip, you shouldn't be stuck in a tourist trap. You shouldn't be handing your money to something that wasn't worth it. And you definitely shouldn't have spent hours planning just to end up disappointed.
                </p>
                <p className="text-muted-foreground">
                  We built Voyance because we lived that frustration ourselves - and we decided to fix it. You tell us who you are one time. We remember you. We plan your trip around you. And the more you use Voyance, the better we get at knowing exactly what you want.
                </p>
              </div>
            </motion.div>


            {/* Ashton */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mt-12 md:mt-16"
            >
              <div className="space-y-3 text-sm md:text-base leading-relaxed">
                <h3 className="text-foreground font-display font-bold text-lg md:text-xl">Ashton Lightfoot, Co-Founder</h3>
                <p className="text-muted-foreground">
                  I work to travel. That's just who I am. If I'm not moving, it's because I'm home spending time with Graham or planning my next trip. I come from product management in the tech industry, and I'm currently earning my Executive MBA at Georgia Tech with a specialization in technology - so when I'm not building Voyance, I'm studying how to build it better.
                </p>
                <p className="text-muted-foreground">
                  I built Voyance because I spent too much time planning my own travel. Hours and hours of research - not just "does this hotel look good," but examining five or six sets of user images to figure out if it's actually the place to go. Not just picking a 4.8-star restaurant because the rating looks good, but reading through the menu to see if it's something I could really see myself eating. What do the reviews truly say? That level of detail takes time, and most people don't have it.
                </p>
                <p className="text-muted-foreground">
                  And then there's the other side of it - I'd do all that work, plan the perfect trip, and still end up disappointed because one detail didn't work out. That's when it hit me. People work too hard for their money. Too hard for their vacation. And they have too little of both. It's not fair to spend your limited time off stuck somewhere that wasn't worth it.
                </p>
                <p className="text-muted-foreground">
                  Friends and family always ask me for travel recommendations because they know the care I put in. I wanted to give that same care to everyone. I tried using AI to help, and it gave me generic lists with paid ads - recommendations that didn't know me, didn't remember me, and didn't care who I was.
                </p>
                <p className="text-muted-foreground">
                  So I built Voyance to be different. Tell us who you are one time. We lock it in forever. We're your dedicated travel agent in your pocket. We consider the real you - the authentic spots, not just what seems to be popular. But hey, we'll tell you the popular spots too if that's who you are. We watch your budget so the credit card bill doesn't surprise you. We watch your time so you're not spending hours in spreadsheets. And we watch your peace of mind so planning a trip doesn't drive you crazy.
                </p>
                <p className="text-muted-foreground">
                  We want to always get it right, but the beauty is we only get better. Keep using Voyance and it keeps learning you. Bring someone else along and we'll blend them with who you are so everyone gets what they want.
                </p>
                <p className="text-foreground font-medium italic">
                  London has my heart. I'm a Paris girly. I would fly back to Vienna tomorrow just to eat cheese-stuffed hot dogs from a street stand. The Founder's Guides I've written across seven cities are exactly how I talk about travel with my friends - honest, specific, and always leading with what I actually loved.
                </p>
              </div>
            </motion.div>

            {/* Clinton */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mt-12 md:mt-16"
            >
              <div className="space-y-3 text-sm md:text-base leading-relaxed">
                <h3 className="text-foreground font-display font-bold text-lg md:text-xl">The Other Half of Voyance, Co-Founder</h3>
                <p className="text-muted-foreground">
                  The other half of Voyance is the finance side. While Ashton is obsessing over which tiny sushi counter in London has only 20 seats, the co-founder makes sure the business behind it all actually works.
                </p>
                <p className="text-muted-foreground">
                  But he's also part of the reason Voyance exists. He got tired of being told a trip would cost one thing and the credit card bill saying something different. He got tired of sitting in spreadsheets, planning everything out line by line, changing one small thing and having to redo all the price calculations. That's why Voyance tracks your budget and trip totals in real time - because they lived that pain.
                </p>
                <p className="text-muted-foreground">
                  And then there was the other problem - whose turn was it? How do you make sure both people are getting what they want out of a trip when they're both working equally hard? That's where blended travel DNA comes in. Voyance plans trips for everyone in the group from the start, not just one person's preferences.
                </p>
                <p className="text-muted-foreground">
                  They've traveled together across the US, Europe, North Africa, the Caribbean, and Japan. A lot of the places in Voyance's curator picks are spots they discovered side by side - from a hidden yakiniku restaurant in Vienna that seats six people to a legendary food market in Barcelona they both want to go back to.
                </p>
                <p className="text-foreground font-medium italic">
                  His background in finance means Voyance is built to last, not just built to launch. He handles the business strategy and operations so the product can stay focused on what matters - making sure your time and your money are valued.
                </p>
              </div>
            </motion.div>

            {/* Graham - hidden for now, can be restored later
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mt-12 md:mt-16"
            >
              <div className="space-y-3 text-sm md:text-base leading-relaxed">
                <h3 className="text-foreground font-display font-bold text-lg md:text-xl">Graham, Chief Inspiration Officer</h3>
                <p className="text-muted-foreground">
                  He's the Yorkie who's been there for every late-night building session, every trip-planning marathon, and every "should we really do this?" conversation. He hasn't been to all the cities in our guides (yet), but he's been part of making Voyance happen from day one. And yes, he has his own travel wardrobe.
                </p>
              </div>
            </motion.div>
            */}

            {/* Signature */}
            <div className="mt-10 md:mt-14 pt-6 md:pt-8 border-t border-border/50">
              <p className="text-foreground font-serif text-lg md:text-xl">The Voyance Team</p>
            </div>
          </div>
        </div>
      </section>

      {/* Find Out What We Love CTA */}
      <section className="py-10 md:py-16 bg-gradient-to-br from-primary/5 via-accent/5 to-muted">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-3xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <Heart className="w-8 h-8 text-primary mx-auto mb-4" />
              <h2 className="text-2xl md:text-3xl font-display font-bold text-foreground mb-3">
                Find Out What We Love
              </h2>
              <p className="text-muted-foreground text-sm md:text-base mb-6 max-w-xl mx-auto">
                Our founders personally test every recommendation. Read their honest, 
                opinionated guides to cities they can't stop going back to.
              </p>
              <Button asChild size="lg">
                <Link to="/guides?tab=founders">Read Founder's Guides</Link>
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Company Credibility Block */}
      <section className="py-10 md:py-16 bg-muted/30 border-y border-border/50">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="grid grid-cols-3 gap-4 md:gap-8 text-center"
            >
              <div>
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2 md:mb-4">
                  <Shield className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                </div>
                <h4 className="font-medium text-foreground text-xs md:text-base mb-0.5 md:mb-1">Voyance Travel, LLC</h4>
                <p className="text-[10px] md:text-sm text-muted-foreground">Registered US company</p>
              </div>
              <div>
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2 md:mb-4">
                  <Globe className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                </div>
                <h4 className="font-medium text-foreground text-xs md:text-base mb-0.5 md:mb-1">Voyance™</h4>
                <p className="text-[10px] md:text-sm text-muted-foreground">Registered trademark</p>
              </div>
              <div>
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-2 md:mb-4">
                  <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                </div>
                <h4 className="font-medium text-foreground text-xs md:text-base mb-0.5 md:mb-1">Patent Pending</h4>
                <p className="text-[10px] md:text-sm text-muted-foreground">Travel DNA technology</p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Product Capabilities Table */}
      <section className="py-12 md:py-24 bg-background relative overflow-hidden">
        <div className="container mx-auto px-4 md:px-6">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-8 md:mb-12"
            >
              <span className="text-primary text-xs md:text-sm font-medium uppercase tracking-[0.2em]">Transparency</span>
              <h2 className="font-serif text-2xl md:text-4xl font-bold mt-3 md:mt-4">
                What works today
              </h2>
              <p className="text-muted-foreground mt-2 md:mt-4 max-w-lg mx-auto text-sm md:text-base">
                We believe in being upfront about our capabilities.
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="rounded-xl md:rounded-2xl border border-border overflow-hidden"
            >
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-3 md:p-4 font-medium text-foreground text-xs md:text-base">Feature</th>
                    <th className="text-center p-3 md:p-4 font-medium text-foreground w-16 md:w-24 text-xs md:text-base">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {[
                    { feature: 'Travel DNA Quiz (29 unique types)', status: 'live' },
                    { feature: 'AI-generated personalized itineraries', status: 'live' },
                    { feature: 'Real-time activity swapping', status: 'live' },
                    { feature: 'Multi-source review aggregation', status: 'live' },
                    { feature: 'Group travel preference blending', status: 'live' },
                    { feature: 'Budget tracking & expense management', status: 'live' },
                    { feature: 'Weather-aware scheduling', status: 'live' },
                    { feature: 'Direct booking via Viator', status: 'live' },
                    { feature: 'Flight tracking & sync', status: 'coming', note: 'Soon' },
                    { feature: 'Mobile app', status: 'coming', note: '2026' },
                    { feature: 'Offline access', status: 'coming', note: '2026' },
                  ].map((item, idx) => (
                    <tr key={idx} className="hover:bg-muted/20 transition-colors">
                      <td className="p-3 md:p-4 text-foreground text-xs md:text-base">
                        {item.feature}
                        {item.note && <span className="text-muted-foreground text-[10px] md:text-sm ml-1">({item.note})</span>}
                      </td>
                      <td className="p-3 md:p-4 text-center">
                        {item.status === 'live' && (
                          <span className="inline-flex items-center gap-0.5 md:gap-1 px-1.5 md:px-2 py-0.5 md:py-1 rounded-full bg-emerald-500/10 text-emerald-600 text-[10px] md:text-xs font-medium">
                            <Check className="w-2.5 h-2.5 md:w-3 md:h-3" />
                            Live
                          </span>
                        )}
                        {item.status === 'coming' && (
                          <span className="inline-flex items-center gap-0.5 md:gap-1 px-1.5 md:px-2 py-0.5 md:py-1 rounded-full bg-amber-500/10 text-amber-600 text-[10px] md:text-xs font-medium">
                            <Clock className="w-2.5 h-2.5 md:w-3 md:h-3" />
                            Soon
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Core Principles - Your Killer Lines */}
      <section className="py-12 md:py-24 bg-gradient-to-b from-muted/30 to-background relative overflow-hidden">
        <div className="absolute bottom-20 right-10 w-48 h-48 bg-accent/10 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-8 md:mb-16"
          >
            <span className="text-primary text-xs md:text-sm font-medium uppercase tracking-[0.2em]">Our Standards</span>
            <h2 className="font-serif text-2xl md:text-5xl font-bold mt-3 md:mt-4">
              Nothing exists without a reason
            </h2>
          </motion.div>

          {/* Killer Lines Grid - side by side on mobile */}
          <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-2 gap-3 md:gap-6">
            {/* We design your time - spans full width on mobile */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="col-span-2 md:row-span-2 relative group"
            >
              <div className="h-full bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-xl md:rounded-3xl border border-primary/20 p-5 md:p-10 transition-all duration-300 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/10">
                <div className="w-10 h-10 md:w-16 md:h-16 rounded-xl md:rounded-2xl bg-primary/20 flex items-center justify-center mb-4 md:mb-8">
                  <Clock className="w-5 h-5 md:w-8 md:h-8 text-primary" />
                </div>
                <h3 className="font-serif text-lg md:text-3xl font-bold mb-2 md:mb-4">We design your time</h3>
                <p className="text-muted-foreground leading-relaxed text-sm md:text-lg">
                  Not just destinations. Not just bookings. We craft how you spend your hours abroad.
                  <span className="block mt-2 md:mt-4 text-foreground font-medium">That's the difference.</span>
                </p>
              </div>
            </motion.div>

            {/* No fake trust */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 }}
              className="relative group"
            >
              <div className="h-full bg-gradient-to-br from-accent/20 via-accent/10 to-transparent rounded-xl md:rounded-3xl border border-accent/30 p-4 md:p-8 transition-all duration-300 hover:border-accent/50 hover:shadow-xl">
                <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-accent/20 flex items-center justify-center mb-3 md:mb-4">
                  <Shield className="w-4 h-4 md:w-6 md:h-6 text-foreground" />
                </div>
                <h3 className="font-serif text-base md:text-xl font-bold mb-1 md:mb-2">No fake trust</h3>
                <p className="text-muted-foreground text-xs md:text-sm">
                  Honesty isn't a marketing angle. It's how we operate.
                </p>
              </div>
            </motion.div>

            {/* Taste instead of trends */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.2 }}
              className="relative group"
            >
              <div className="h-full bg-gradient-to-br from-secondary via-secondary/80 to-secondary/50 rounded-xl md:rounded-3xl border border-border/50 p-4 md:p-8 transition-all duration-300 hover:shadow-xl">
                <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-background/50 backdrop-blur flex items-center justify-center mb-3 md:mb-4">
                  <Heart className="w-4 h-4 md:w-6 md:h-6 text-foreground" />
                </div>
                <h3 className="font-serif text-base md:text-xl font-bold mb-1 md:mb-2">Taste over trends</h3>
                <p className="text-muted-foreground text-xs md:text-sm">
                  We recommend what fits you, not what's viral.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* How It Works - Interactive Timeline */}
      <section className="py-12 md:py-24 bg-gradient-to-b from-muted/40 via-background to-background relative overflow-hidden">
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10 md:mb-20"
          >
            <span className="text-primary text-xs md:text-sm font-medium uppercase tracking-[0.2em]">The Process</span>
            <h2 className="font-serif text-2xl md:text-5xl font-bold mt-3 md:mt-4">
              How Voyance works
            </h2>
          </motion.div>

          {/* Timeline as 2-col grid on mobile */}
          <div className="max-w-4xl mx-auto grid grid-cols-2 gap-3 md:gap-8">
            {[
              {
                step: '01',
                title: 'Discover Your Travel DNA',
                description: 'Our quiz understands your preferences, pace, budget, and style.',
                icon: <Search className="w-4 h-4 md:w-6 md:h-6" />,
                image: 'https://images.unsplash.com/photo-1501555088652-021faa106b9b?w=400&q=80',
              },
              {
                step: '02',
                title: 'AI-Curated Picks',
                description: 'We surface only what matches your unique profile. No generic suggestions.',
                icon: <Sparkles className="w-4 h-4 md:w-6 md:h-6" />,
                image: 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=400&q=80',
              },
              {
                step: '03',
                title: 'Customize & Perfect',
                description: 'Get a complete itinerary. Add flights and we sync everything.',
                icon: <Calendar className="w-4 h-4 md:w-6 md:h-6" />,
                image: 'https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=400&q=80',
              },
              {
                step: '04',
                title: 'Book with Confidence',
                description: 'Transparent pricing, verified options. No surprises.',
                icon: <CreditCard className="w-4 h-4 md:w-6 md:h-6" />,
                image: 'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=400&q=80',
              },
            ].map((item, idx) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="relative"
              >
                <div className="aspect-[4/3] rounded-lg md:rounded-2xl overflow-hidden shadow-md md:shadow-xl mb-2 md:mb-4">
                  <img 
                    src={item.image} 
                    alt={item.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="flex items-center gap-1.5 md:gap-3 mb-1 md:mb-2">
                  <div className="w-7 h-7 md:w-10 md:h-10 rounded-lg md:rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    {item.icon}
                  </div>
                  <span className="text-[10px] md:text-sm font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{item.step}</span>
                </div>
                <h3 className="font-serif text-sm md:text-xl font-bold mb-1">{item.title}</h3>
                <p className="text-muted-foreground text-xs md:text-sm leading-relaxed">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Who We Serve */}
      <section className="py-12 md:py-24 bg-gradient-to-br from-background via-background to-accent/5 relative overflow-hidden">
        <div className="absolute top-1/2 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/2" />
        
        <div className="container mx-auto px-4 md:px-6 relative z-10">
          <div className="grid grid-cols-[1fr_1fr] lg:grid-cols-2 gap-4 md:gap-16 items-start max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
            >
              <span className="inline-flex items-center gap-1.5 md:gap-2 text-primary text-[10px] md:text-sm font-medium uppercase tracking-[0.2em] mb-3 md:mb-4 bg-primary/10 px-2 md:px-4 py-1 md:py-2 rounded-full">
                <Users className="w-3 h-3 md:w-4 md:h-4" />
                Built For You
              </span>
              <h2 className="font-serif text-xl md:text-5xl font-bold mt-2 md:mt-4 mb-3 md:mb-8 leading-tight">
                Thoughtful travelers deserve{' '}
                <span className="text-primary">better tools</span>
              </h2>
              <p className="text-xs md:text-lg text-muted-foreground mb-4 md:mb-8">
                We built Voyance for people who value their time as much as their experiences.
              </p>
              <Link to="/quiz">
                <Button size="sm" className="gap-1.5 md:gap-2 text-xs md:text-base shadow-lg shadow-primary/20">
                  Discover Your Travel DNA
                  <ArrowRight className="w-3 h-3 md:w-4 md:h-4" />
                </Button>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="space-y-2 md:space-y-4"
            >
              {[
                {
                  title: 'Experience Seekers',
                  desc: 'You travel for moments, not just photos.',
                  icon: <Sparkles className="w-4 h-4 md:w-5 md:h-5" />,
                  gradient: 'from-primary/20 to-primary/5',
                },
                {
                  title: 'Busy Professionals',
                  desc: 'Amazing trips without research rabbit holes.',
                  icon: <Clock className="w-4 h-4 md:w-5 md:h-5" />,
                  gradient: 'from-accent/30 to-accent/10',
                },
                {
                  title: 'Group Travelers',
                  desc: 'Tools that make everyone happy.',
                  icon: <Users className="w-4 h-4 md:w-5 md:h-5" />,
                  gradient: 'from-secondary to-secondary/50',
                },
              ].map((persona, idx) => (
                <motion.div 
                  key={persona.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.1 }}
                >
                  <div className={`bg-gradient-to-br ${persona.gradient} rounded-lg md:rounded-2xl border border-border/50 p-3 md:p-6`}>
                    <div className="flex gap-2 md:gap-4">
                      <div className="w-8 h-8 md:w-12 md:h-12 rounded-lg md:rounded-xl bg-background/80 backdrop-blur flex items-center justify-center shrink-0">
                        <div className="text-primary">{persona.icon}</div>
                      </div>
                      <div>
                        <h4 className="font-serif text-sm md:text-lg font-bold mb-0.5">{persona.title}</h4>
                        <p className="text-[10px] md:text-sm text-muted-foreground">{persona.desc}</p>
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
      <section className="py-16 md:py-32 relative overflow-hidden">
        {/* Rich gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-accent/10" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        
        <div className="container mx-auto px-4 md:px-6 text-center relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto"
          >
            <Compass className="w-10 h-10 md:w-16 md:h-16 text-primary mx-auto mb-4 md:mb-6" />
            <h2 className="font-serif text-2xl md:text-6xl font-bold mb-4 md:mb-6 leading-tight">
              Travel should be{' '}
              <span className="text-primary italic">designed</span>
            </h2>
            <p className="text-base md:text-xl text-muted-foreground mb-4 md:mb-6">
              Not consumed. Not endured. Designed.
            </p>
            
            <p className="text-xs md:text-sm text-muted-foreground mb-6 md:mb-10 max-w-md mx-auto bg-muted/50 rounded-lg px-3 md:px-4 py-2 md:py-3 border border-border/50">
              We're early. We don't have thousands of users yet. 
              But we're building something we'd actually use ourselves.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center">
              <Link to="/quiz">
                <Button size="lg" className="gap-2 w-full sm:w-auto md:text-lg md:px-8 md:py-6 shadow-xl shadow-primary/25">
                  Take the Quiz
                  <ArrowRight className="h-4 w-4 md:h-5 md:w-5" />
                </Button>
              </Link>
              <Link to="/explore">
                <Button size="lg" variant="outline" className="w-full sm:w-auto md:text-lg md:px-8 md:py-6 border-2">
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
