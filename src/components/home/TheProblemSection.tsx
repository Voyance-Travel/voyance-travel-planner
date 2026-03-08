import { motion } from 'framer-motion';
import { strangerCopy } from '@/lib/strangerCopy';
import { X, Clock, Compass, Heart, Zap, Shield, Check, Sparkles, Globe, Map, Calendar, CreditCard, Search, Star, Users } from 'lucide-react';

// Visual mockup of chaos (before) - Real website style (from About page)
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
            ].map((tab) => (
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

// Visual mockup of Voyance (after) - Polished app style (from About page)
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
              <p className="text-xs text-muted-foreground mt-1">May 15-20, 2026 • 2 travelers • Premium Experience</p>
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

export default function TheProblemSection() {
  const { problem } = strangerCopy.homepage;

  return (
    <section className="py-12 sm:py-16 md:py-24 lg:py-32 relative overflow-hidden bg-gradient-to-b from-muted/50 to-muted/20">
      {/* Background decorations */}
      <div className="absolute top-0 left-0 w-64 h-64 bg-destructive/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-16 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8 sm:mb-12 md:mb-16"
        >
          {/* Eyebrow with icon */}
          <div className="flex items-center justify-center gap-2 sm:gap-3 mb-4 sm:mb-6">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <X className="w-4 h-4 sm:w-5 sm:h-5 text-destructive" />
            </div>
            <span className="text-xs sm:text-sm tracking-[0.15em] sm:tracking-[0.2em] uppercase text-muted-foreground font-medium">
              {problem.eyebrow}
            </span>
          </div>

          {/* Headline - mobile-optimized */}
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-serif font-normal text-foreground mb-4 sm:mb-6 leading-tight max-w-3xl mx-auto px-2">
            {problem.headline}
          </h2>

          {/* Punchy copy - simplified for mobile */}
          <p className="text-base sm:text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto px-2">
            Whether it's a weekend getaway or a month abroad, you research for <span className="font-semibold text-foreground">HOURS</span>
            <span className="hidden sm:inline"> and still end up disappointed.</span>
            <span className="sm:hidden"> and still miss the mark.</span>
          </p>
        </motion.div>

        {/* Before/After Comparison with VS indicator */}
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

        {/* Closing statement - mobile-optimized */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="text-lg sm:text-xl md:text-2xl font-serif text-foreground text-center mt-8 sm:mt-10 md:mt-14 italic px-4"
        >
          Your vacation. Wasted on someone else's idea of a good time.
        </motion.p>
      </div>
    </section>
  );
}
