import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { 
  Search, DollarSign, MessageSquare, ExternalLink, 
  Clock, MapPin, Star, Sparkles, ArrowRightLeft, Check,
  AlertTriangle, Wallet
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

// ============================================
// FEATURE 1: Activity Swap UI (Simplified from ActivityAlternativesDrawer)
// ============================================
function SwapActivityDemo() {
  const alternatives = [
    { 
      name: 'Sushi Making Class', 
      description: 'Learn from a master chef in Tsukiji',
      rating: 4.8, 
      duration: '2.5 hrs', 
      cost: 65,
      selected: true,
      bestMatch: true,
    },
    { 
      name: 'Izakaya Food Tour', 
      description: 'Hidden gems in Shinjuku backstreets',
      rating: 4.6, 
      duration: '3 hrs', 
      cost: 55,
    },
    { 
      name: 'Street Food Walk', 
      description: 'Explore Asakusa food stalls',
      rating: 4.5, 
      duration: '2 hrs', 
      cost: 40,
    },
  ];

  return (
    <div className="bg-card rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
        <ArrowRightLeft className="w-3 h-3 text-primary" />
        <span className="font-medium">Swap Activity</span>
      </div>
      
      {alternatives.map((alt, i) => (
        <div 
          key={i}
          className={cn(
            "p-2 rounded-md border transition-all",
            alt.selected 
              ? "border-primary bg-primary/5 ring-1 ring-primary" 
              : "border-border/50"
          )}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="font-medium text-xs text-foreground truncate">
                  {alt.name}
                </span>
                {alt.bestMatch && (
                  <Badge className="bg-primary/10 text-primary text-[9px] px-1 py-0 gap-0.5">
                    <Sparkles className="w-2 h-2" />
                    Best
                  </Badge>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground line-clamp-1">{alt.description}</p>
              <div className="flex items-center gap-2 text-[9px] text-muted-foreground mt-1">
                <span className="flex items-center gap-0.5">
                  <Star className="w-2 h-2 fill-amber-500 text-amber-500" />
                  {alt.rating}
                </span>
                <span className="flex items-center gap-0.5">
                  <Clock className="w-2 h-2" />
                  {alt.duration}
                </span>
                <span className="flex items-center gap-0.5">
                  <DollarSign className="w-2 h-2" />
                  ${alt.cost}
                </span>
              </div>
            </div>
            <div className={cn(
              "w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0",
              alt.selected ? "bg-primary" : "bg-muted"
            )}>
              {alt.selected ? (
                <Check className="w-3 h-3 text-primary-foreground" />
              ) : (
                <ArrowRightLeft className="w-2.5 h-2.5 text-muted-foreground" />
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================
// FEATURE 2: Budget Summary (Simplified from BudgetSummaryPanel)
// ============================================
function BudgetTrackerDemo() {
  const summary = {
    total: 2400,
    remaining: 847,
    usedPercent: 65,
    food: 520,
    activities: 680,
    transit: 353,
  };

  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="p-3 flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Wallet className="h-4 w-4 text-green-500" />
          <div>
            <p className="text-xs font-medium">${summary.remaining} remaining</p>
            <p className="text-[10px] text-muted-foreground">of ${summary.total} total</p>
          </div>
        </div>
        <div className="flex-1">
          <Progress value={summary.usedPercent} className="h-1.5" />
        </div>
        <Badge variant="outline" className="text-[10px]">
          {summary.usedPercent}% used
        </Badge>
      </div>
      
      {/* Category breakdown */}
      <div className="border-t border-border p-3 bg-accent/20">
        <p className="text-[9px] text-muted-foreground uppercase tracking-wider mb-2">By Category</p>
        <div className="grid grid-cols-3 gap-1.5 text-center">
          <div className="bg-background rounded p-1.5">
            <p className="text-[9px] text-muted-foreground">Food</p>
            <p className="text-xs font-medium">${summary.food}</p>
          </div>
          <div className="bg-background rounded p-1.5">
            <p className="text-[9px] text-muted-foreground">Activities</p>
            <p className="text-xs font-medium">${summary.activities}</p>
          </div>
          <div className="bg-background rounded p-1.5">
            <p className="text-[9px] text-muted-foreground">Transit</p>
            <p className="text-xs font-medium">${summary.transit}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// FEATURE 3: AI Chat (Simplified from ItineraryAssistant)
// ============================================
function AIChatDemo() {
  return (
    <div className="bg-card rounded-lg border border-border p-3 space-y-2">
      {/* User message */}
      <div className="flex justify-end">
        <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-3 py-1.5 max-w-[85%]">
          <p className="text-[11px]">Make day 3 more relaxed</p>
        </div>
      </div>
      
      {/* Assistant response */}
      <div className="flex justify-start">
        <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2 max-w-[90%] space-y-2">
          <p className="text-[11px] text-foreground">I'll lighten day 3 for you. Here's what I suggest:</p>
          
          {/* Action card */}
          <div className="bg-background border border-border rounded-lg p-2">
            <div className="flex items-start gap-2">
              <div className="p-1 rounded bg-primary/10">
                <ArrowRightLeft className="h-3 w-3 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[10px]">Adjust Day 3 Pacing</p>
                <p className="text-[9px] text-muted-foreground">Remove museum, add garden stroll</p>
              </div>
            </div>
            <div className="flex gap-1.5 mt-2">
              <Button size="sm" className="h-6 text-[10px] flex-1 gap-1">
                <Check className="h-2.5 w-2.5" />
                Apply
              </Button>
              <Button size="sm" variant="outline" className="h-6 text-[10px] px-2">
                ✕
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================
// FEATURE 4: Booking Links (Simplified from VendorBookingLink)
// ============================================
function BookingLinksDemo() {
  return (
    <div className="bg-card rounded-lg border border-border p-3 space-y-2.5">
      {/* Activity header */}
      <div className="flex items-start gap-2">
        <div className="w-10 h-10 rounded-md bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center flex-shrink-0">
          <MapPin className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-xs text-foreground">TeamLab Borderless</p>
          <p className="text-[10px] text-muted-foreground">Digital art museum in Odaiba</p>
        </div>
      </div>
      
      {/* Booking buttons */}
      <div className="flex flex-wrap gap-1.5">
        <Button variant="default" size="sm" className="h-6 text-[10px] gap-1 px-2">
          <ExternalLink className="h-2.5 w-2.5" />
          Reserve
        </Button>
        <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2">
          <ExternalLink className="h-2.5 w-2.5" />
          Viator
        </Button>
        <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2">
          <MapPin className="h-2.5 w-2.5" />
          Maps
        </Button>
      </div>
      
      {/* Price hint */}
      <p className="text-[9px] text-muted-foreground flex items-center gap-1">
        <DollarSign className="w-2.5 h-2.5" />
        ~$32 per person · Opens in new tab
      </p>
    </div>
  );
}

// ============================================
// Feature data with demo components
// ============================================
const FEATURES = [
  {
    id: 'swap',
    title: 'Find Alternatives in Seconds',
    description: 'Search, filter, see 6 options, swap, done. Your itinerary updates instantly.',
    icon: Search,
    Demo: SwapActivityDemo,
  },
  {
    id: 'budget',
    title: 'Budget Updates Instantly',
    description: 'Swap an activity and watch your trip budget recalculate in real-time.',
    icon: DollarSign,
    Demo: BudgetTrackerDemo,
  },
  {
    id: 'ai-chat',
    title: 'Chat With AI to Customize',
    description: 'Tell the Trip Assistant what you want in plain English. It modifies your itinerary for you.',
    icon: MessageSquare,
    Demo: AIChatDemo,
  },
  {
    id: 'book',
    title: 'Reserve & Book Directly',
    description: 'One-click links to Viator, Google Maps, and restaurant sites. Book where you prefer.',
    icon: ExternalLink,
    Demo: BookingLinksDemo,
  },
];

function FeatureCard({ feature, index }: { feature: typeof FEATURES[0]; index: number }) {
  const Icon = feature.icon;
  const DemoComponent = feature.Demo;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      className="group"
    >
      {/* Live Feature Demo */}
      <div className="aspect-[4/3] bg-muted/30 rounded-xl mb-4 overflow-hidden border border-border/50 p-3 flex items-center justify-center">
        <div className="w-full max-w-[280px]">
          <DemoComponent />
        </div>
      </div>
      
      {/* Content */}
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Icon className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
            {feature.title}
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {feature.description}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

export default function CustomizationShowcase() {
  return (
    <section className="py-16 sm:py-24 md:py-32 bg-muted/30 relative overflow-hidden">
      {/* Subtle background */}
      <div className="absolute inset-0 opacity-[0.02]">
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)', backgroundSize: '32px 32px' }} />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-8 md:px-16">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12 md:mb-16"
        >
          <div className="flex items-center justify-center gap-3 sm:gap-4 mb-4">
            <div className="w-6 sm:w-8 h-px bg-primary" />
            <span className="text-[10px] sm:text-xs tracking-[0.25em] uppercase text-muted-foreground font-sans">
              After Generation
            </span>
            <div className="w-6 sm:w-8 h-px bg-primary" />
          </div>
          
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-serif font-normal text-foreground mb-4">
            Full Control. Your Way.
          </h2>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            Your itinerary is a starting point, not a straitjacket.
          </p>
        </motion.div>

        {/* Four-column Feature Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
          {FEATURES.map((feature, index) => (
            <FeatureCard key={feature.id} feature={feature} index={index} />
          ))}
        </div>


      </div>
    </section>
  );
}
