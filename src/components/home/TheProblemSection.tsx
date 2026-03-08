import { motion } from 'framer-motion';
import { strangerCopy } from '@/lib/strangerCopy';
import { X, Clock, Gem, AlertTriangle, FileSpreadsheet, Globe, MessageSquare, Search, BookmarkX, MapPin, Star, Calendar, ChevronRight } from 'lucide-react';

// Authentic "Before" chaos - realistic research hell
function BeforeChaos() {
  return (
    <div className="relative bg-neutral-950 rounded-xl overflow-hidden shadow-2xl border border-neutral-800">
      {/* macOS window chrome */}
      <div className="flex items-center gap-2 px-3 py-2 bg-neutral-900 border-b border-neutral-800">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500/90" />
          <div className="w-3 h-3 rounded-full bg-yellow-500/90" />
          <div className="w-3 h-3 rounded-full bg-green-500/90" />
        </div>
        {/* Browser tabs */}
        <div className="flex-1 flex gap-0.5 overflow-hidden ml-2">
          {[
            { name: 'Reddit: Best Barcelona...', active: true },
            { name: 'TripAdvisor', active: false },
            { name: 'Google Flights', active: false },
            { name: 'Blog: Hidden...', active: false },
          ].map((tab, i) => (
            <div 
              key={i} 
              className={`text-[8px] px-2 py-1 rounded-t-md truncate max-w-[70px] ${
                tab.active 
                  ? 'bg-neutral-800 text-white' 
                  : 'bg-neutral-900 text-neutral-500 hover:bg-neutral-850'
              }`}
            >
              {tab.name}
            </div>
          ))}
          <div className="text-[8px] px-2 py-1 text-neutral-600">+14</div>
        </div>
      </div>
      
      {/* Chaotic content */}
      <div className="p-3 space-y-2">
        {/* Search bar */}
        <div className="flex items-center gap-2 bg-neutral-800 rounded-lg px-2 py-1.5">
          <Search className="w-3 h-3 text-neutral-500" />
          <span className="text-[9px] text-neutral-400 truncate">best barcelona restaurants authentic local 2024 reddit not touristy</span>
        </div>
        
        {/* Messy grid of content */}
        <div className="grid grid-cols-5 gap-2 text-[7px]">
          {/* Spreadsheet chaos */}
          <div className="col-span-3 bg-white rounded-md p-1.5 shadow-sm">
            <div className="flex items-center gap-1 text-green-700 font-medium mb-1 text-[8px]">
              <FileSpreadsheet className="w-2.5 h-2.5" />
              Barcelona_Trip_v4_FINAL_REAL.xlsx
            </div>
            <div className="space-y-px">
              <div className="grid grid-cols-4 gap-px text-[6px]">
                <div className="bg-neutral-200 px-1 py-0.5 font-semibold text-neutral-700">Day</div>
                <div className="bg-neutral-200 px-1 py-0.5 font-semibold text-neutral-700">Place</div>
                <div className="bg-neutral-200 px-1 py-0.5 font-semibold text-neutral-700">Time</div>
                <div className="bg-neutral-200 px-1 py-0.5 font-semibold text-neutral-700">Status</div>
              </div>
              {[
                ['1', 'La Boqueria', '9am?', '❌ PACKED'],
                ['1', 'Sagrada Familia', '??', 'sold out'],
                ['2', 'Park Güell', 'morning', '⚠️ TICKETS'],
                ['2', 'Casa Batlló', '???', 'need tix'],
                ['3', '???', '', 'research'],
              ].map((row, i) => (
                <div key={i} className="grid grid-cols-4 gap-px text-[6px]">
                  {row.map((cell, j) => (
                    <div 
                      key={j} 
                      className={`px-1 py-0.5 ${
                        cell.includes('❌') || cell.includes('⚠️') 
                          ? 'bg-red-50 text-red-600' 
                          : cell.includes('???') || cell === 'research'
                            ? 'bg-yellow-50 text-yellow-700'
                            : 'bg-white text-neutral-600'
                      }`}
                    >
                      {cell}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          
          {/* Reddit thread */}
          <div className="col-span-2 bg-white rounded-md p-1.5 shadow-sm">
            <div className="flex items-center gap-1 text-orange-600 font-medium mb-1 text-[8px]">
              <MessageSquare className="w-2.5 h-2.5" />
              r/Barcelona
            </div>
            <div className="space-y-1 text-[6px]">
              <div className="flex items-start gap-1">
                <span className="text-orange-500 font-medium">↑47</span>
                <span className="text-neutral-600">Skip La Rambla, tourist trap</span>
              </div>
              <div className="flex items-start gap-1">
                <span className="text-orange-500 font-medium">↑89</span>
                <span className="text-neutral-600">No! La Rambla is essential</span>
              </div>
              <div className="flex items-start gap-1">
                <span className="text-neutral-400 font-medium">↑23</span>
                <span className="text-neutral-500">Depends on your style...</span>
              </div>
              <div className="text-neutral-400 italic text-[5px]">
                127 conflicting replies...
              </div>
            </div>
          </div>
        </div>
        
        {/* Bottom chaos row */}
        <div className="grid grid-cols-2 gap-2">
          {/* Blog listicle */}
          <div className="bg-white rounded-md p-1.5 shadow-sm">
            <div className="flex items-center gap-1 text-blue-600 font-medium text-[8px] mb-0.5">
              <Globe className="w-2.5 h-2.5" />
              10 MUST-DO Things Barcelona!
            </div>
            <div className="text-neutral-500 text-[6px] italic">
              "As a travel influencer..."
            </div>
            <div className="text-neutral-400 text-[5px] mt-0.5">
              #Sponsored #Ad #Gifted
            </div>
          </div>
          
          {/* Bookmarks mess */}
          <div className="bg-neutral-800 rounded-md p-1.5">
            <div className="flex items-center gap-1 text-neutral-400 font-medium text-[8px] mb-1">
              <BookmarkX className="w-2.5 h-2.5" />
              Saved (47 links)
            </div>
            <div className="space-y-0.5 text-[5px] text-neutral-500">
              <div className="truncate">• barcelona-guide.com/best-r...</div>
              <div className="truncate">• reddit.com/r/barcelona/...</div>
              <div className="truncate">• youtube.com/watch?...</div>
              <div className="text-neutral-600">+ 44 more tabs</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Stress indicator */}
      <div className="absolute bottom-2 right-2 bg-red-500/20 backdrop-blur-sm text-red-400 text-[8px] px-2 py-1 rounded-full border border-red-500/30">
        8+ hours researching...
      </div>
      
      {/* BEFORE label */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent pt-10 pb-4">
        <p className="text-center text-white font-serif text-lg tracking-wide">BEFORE</p>
      </div>
    </div>
  );
}

// Clean Voyance "After" - actual app representation
function AfterVoyance() {
  return (
    <div className="relative bg-card rounded-xl overflow-hidden shadow-2xl border border-border">
      {/* Voyance app header */}
      <div className="flex items-center justify-between px-4 py-3 bg-background border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center border border-primary/20">
            <span className="text-primary text-xs font-serif font-bold">V</span>
          </div>
          <div>
             <span className="text-sm font-medium text-foreground">Barcelona</span>
            <span className="text-xs text-muted-foreground ml-1.5">5 Days</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary/10 border border-primary/20">
          <span className="text-[10px] text-primary font-medium">The Present Traveler</span>
        </div>
      </div>
      
      {/* Intelligence metrics */}
      <div className="px-4 py-3 bg-muted/30 border-b border-border">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">Intelligence Summary</p>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
              <Clock className="w-3 h-3 text-primary" />
            </div>
            <div>
              <span className="text-sm font-semibold text-foreground">3 hrs</span>
              <span className="text-[10px] text-muted-foreground ml-1">saved</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
              <Gem className="w-3 h-3 text-primary" />
            </div>
            <div>
              <span className="text-sm font-semibold text-foreground">4</span>
              <span className="text-[10px] text-muted-foreground ml-1">hidden gems</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-3 h-3 text-destructive" />
            </div>
            <div>
              <span className="text-sm font-semibold text-foreground">3</span>
              <span className="text-[10px] text-muted-foreground ml-1">traps avoided</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Day itinerary preview */}
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">Day 1</span>
            <span className="text-xs text-muted-foreground">El Born & Gothic Quarter</span>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </div>
        
        <div className="space-y-2">
          {[
            { time: '9:00', activity: 'Santa Caterina Market, early', badge: 'Voyance Find', badgeType: 'primary' },
            { time: '11:00', activity: 'Picasso Museum (skip the line)', badge: null, badgeType: null },
            { time: '14:00', activity: 'El Born backstreet tapas crawl', badge: 'Local Pick', badgeType: 'secondary' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-3 p-2.5 bg-background rounded-lg border border-border/60 hover:border-primary/30 transition-colors">
              <div className="flex items-center justify-center w-8">
                <span className="text-[11px] font-medium text-muted-foreground">{item.time}</span>
              </div>
              <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
              <div className="flex-1 flex items-center gap-2">
                <MapPin className="w-3 h-3 text-muted-foreground" />
                <span className="text-sm text-foreground">{item.activity}</span>
              </div>
              {item.badge && (
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
                  item.badgeType === 'primary' 
                    ? 'bg-primary/15 text-primary border border-primary/20' 
                    : 'bg-accent/15 text-accent-foreground border border-accent/20'
                }`}>
                  {item.badge}
                </span>
              )}
            </div>
          ))}
        </div>
        
        {/* Quick action hint */}
        <div className="flex items-center justify-center gap-2 pt-2">
          <Star className="w-3 h-3 text-primary/50" />
          <span className="text-[10px] text-muted-foreground">Personalized to your travel style</span>
        </div>
      </div>
      
      {/* AFTER label */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-card via-card/90 to-transparent pt-10 pb-4">
        <p className="text-center text-foreground font-serif text-lg tracking-wide">AFTER</p>
      </div>
    </div>
  );
}

export default function TheProblemSection() {
  const { problem } = strangerCopy.homepage;

  return (
    <section className="py-12 sm:py-16 md:py-24 lg:py-32 relative overflow-hidden bg-muted/30">
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

        {/* Before/After Comparison - stack on mobile */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 md:gap-8"
        >
          <BeforeChaos />
          <AfterVoyance />
        </motion.div>

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
