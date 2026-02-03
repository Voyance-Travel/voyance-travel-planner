import { motion } from 'framer-motion';
import { strangerCopy } from '@/lib/strangerCopy';
import { X, Clock, Gem, AlertTriangle, FileSpreadsheet, Globe, MessageSquare } from 'lucide-react';

// Authentic "Before" chaos - built with real UI elements
function BeforeChaos() {
  return (
    <div className="relative bg-neutral-900 rounded-xl p-4 overflow-hidden">
      {/* Browser-like header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
        </div>
        <div className="flex-1 flex gap-1 overflow-hidden">
          {/* Fake browser tabs */}
          {['Reddit: Best Tokyo...', 'Google Sheets', 'TripAdvisor', 'Blog: 10 Must...', '+ 12 more'].map((tab, i) => (
            <div 
              key={i} 
              className={`text-[9px] px-2 py-1 rounded-t-md truncate ${
                i === 0 ? 'bg-neutral-700 text-white' : 'bg-neutral-800 text-neutral-500'
              } ${i === 4 ? 'text-neutral-600' : ''}`}
              style={{ maxWidth: i === 4 ? '60px' : '80px' }}
            >
              {tab}
            </div>
          ))}
        </div>
      </div>
      
      {/* Chaotic content grid */}
      <div className="grid grid-cols-3 gap-2 text-[8px]">
        {/* Spreadsheet mess */}
        <div className="bg-white rounded p-2 col-span-2">
          <div className="flex items-center gap-1 text-green-700 font-medium mb-1">
            <FileSpreadsheet className="w-3 h-3" />
            tokyo_itinerary_v3_FINAL_v2.xlsx
          </div>
          <div className="grid grid-cols-4 gap-px">
            {['Day', 'Activity', 'Time', 'Notes'].map(h => (
              <div key={h} className="bg-neutral-200 px-1 py-0.5 font-medium text-neutral-700">{h}</div>
            ))}
            {[
              ['1', 'Tsukiji?', '???', 'closed??'],
              ['1', 'Shibuya', '2pm', 'too crowded'],
              ['2', 'Fushimi', 'early', 'WRONG CITY'],
              ['2', '???', '', 'research more'],
            ].map((row, i) => (
              row.map((cell, j) => (
                <div key={`${i}-${j}`} className={`px-1 py-0.5 ${cell.includes('?') || cell.includes('WRONG') ? 'bg-yellow-100 text-red-600' : 'bg-white text-neutral-600'}`}>
                  {cell}
                </div>
              ))
            ))}
          </div>
        </div>
        
        {/* Reddit thread */}
        <div className="bg-white rounded p-2 row-span-2">
          <div className="flex items-center gap-1 text-orange-600 font-medium mb-1">
            <MessageSquare className="w-3 h-3" />
            r/JapanTravel
          </div>
          <div className="space-y-1.5 text-neutral-600">
            <div className="text-[7px]">
              <span className="text-orange-500">user123:</span> Skip Shibuya, it's a tourist trap
            </div>
            <div className="text-[7px]">
              <span className="text-orange-500">tokyo_local:</span> No, Shibuya is essential!
            </div>
            <div className="text-[7px]">
              <span className="text-orange-500">traveler99:</span> Depends on your style...
            </div>
            <div className="text-[7px] text-neutral-400 italic">
              47 conflicting replies...
            </div>
          </div>
        </div>
        
        {/* Blog listicle */}
        <div className="bg-white rounded p-2 col-span-2">
          <div className="flex items-center gap-1 text-blue-600 font-medium mb-1">
            <Globe className="w-3 h-3" />
            10 MUST-DO Things in Tokyo!!!
          </div>
          <div className="text-neutral-500 text-[7px] italic">
            "As a travel influencer with 50K followers..."
          </div>
          <div className="text-neutral-400 text-[7px] mt-1">
            (Sponsored by TourCo™)
          </div>
        </div>
      </div>
      
      {/* Stress indicators */}
      <div className="absolute bottom-2 right-2 bg-red-500/20 text-red-400 text-[8px] px-2 py-1 rounded">
        6 hours researching...
      </div>
      
      {/* BEFORE label */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent pt-8 pb-3">
        <p className="text-center text-white font-serif text-lg tracking-wide">BEFORE</p>
      </div>
    </div>
  );
}

// Clean Voyance "After" - real product representation
function AfterVoyance() {
  return (
    <div className="relative bg-card border border-border rounded-xl p-4 overflow-hidden shadow-lg">
      {/* App header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="text-primary text-xs font-serif font-bold">V</span>
          </div>
          <span className="text-sm font-medium text-foreground">Tokyo · 7 Days</span>
        </div>
        <span className="text-xs text-muted-foreground">The Slow Traveler</span>
      </div>
      
      {/* Intelligence Summary */}
      <div className="bg-muted/50 rounded-lg p-3 mb-4">
        <p className="text-xs text-muted-foreground mb-2">Intelligence Summary</p>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">3 hrs</span>
            <span className="text-xs text-muted-foreground">saved</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Gem className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-foreground">4</span>
            <span className="text-xs text-muted-foreground">hidden gems</span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-destructive/70" />
            <span className="text-sm font-medium text-foreground">3</span>
            <span className="text-xs text-muted-foreground">traps skipped</span>
          </div>
        </div>
      </div>
      
      {/* Day preview */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-muted-foreground">Day 1 · Yanaka & Ueno</div>
        {[
          { time: '8:00', activity: 'Yanaka Cemetery morning walk', tag: 'Voyance Find' },
          { time: '10:30', activity: 'Kayaba Coffee (1938 kissaten)', tag: null },
          { time: '13:00', activity: 'Ueno Park · avoid east entrance', tag: 'Timing Hack' },
        ].map((item, i) => (
          <div key={i} className="flex items-center gap-3 p-2 bg-background rounded-lg border border-border/50">
            <span className="text-xs text-muted-foreground w-10">{item.time}</span>
            <span className="text-sm text-foreground flex-1">{item.activity}</span>
            {item.tag && (
              <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                item.tag === 'Voyance Find' 
                  ? 'bg-primary/10 text-primary' 
                  : 'bg-accent/10 text-accent-foreground'
              }`}>
                {item.tag}
              </span>
            )}
          </div>
        ))}
      </div>
      
      {/* AFTER label */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-card via-card/80 to-transparent pt-8 pb-3">
        <p className="text-center text-foreground font-serif text-lg tracking-wide">AFTER</p>
      </div>
    </div>
  );
}

export default function TheProblemSection() {
  const { problem } = strangerCopy.homepage;

  return (
    <section className="py-16 sm:py-24 md:py-32 relative overflow-hidden bg-muted/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-16 relative z-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12 md:mb-16"
        >
          {/* Eyebrow with icon */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
              <X className="w-5 h-5 text-destructive" />
            </div>
            <span className="text-sm tracking-[0.2em] uppercase text-muted-foreground font-medium">
              {problem.eyebrow}
            </span>
          </div>

          {/* Headline */}
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-normal text-foreground mb-6 leading-tight max-w-3xl mx-auto">
            {problem.headline}
          </h2>

          {/* Punchy copy */}
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            You research for <span className="font-semibold text-foreground">HOURS</span>. 
            Half the recommendations aren't for you. 
            Your itinerary was too packed.
          </p>
        </motion.div>

        {/* Before/After Comparison - Built with real UI */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="grid md:grid-cols-2 gap-6 md:gap-8"
        >
          <BeforeChaos />
          <AfterVoyance />
        </motion.div>

        {/* Closing statement */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="text-xl md:text-2xl font-serif text-foreground text-center mt-10 md:mt-14 italic"
        >
          Your vacation. Wasted on someone else's idea of a good time.
        </motion.p>
      </div>
    </section>
  );
}
