import { useState, useEffect } from 'react';
import { toSiteImageUrlFromPhotoId } from '@/utils/unsplash';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  RefreshCw, MapPin, Lock, 
  ChevronLeft, ChevronRight, Check, Clock, ArrowRight,
  TrendingUp, Zap, Users, UserPlus, DollarSign,
  Heart, Utensils, Camera, Plane, MoreHorizontal,
  MessageCircle, Send, Footprints, Train, Car,
  ChevronDown, Shield, Activity, Share2, Download,
  Sparkles, ArrowUpDown, Pencil, Trash2, Landmark
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';

const FEATURES = [
  {
    id: 'quiz',
    title: 'Your Travel Profile',
    subtitle: '5 minutes to unlock personalized trips',
    description: 'Answer a few questions about how you like to travel. We learn your pace, interests, and style to build trips that actually fit you.',
    valuePoint: 'No more generic itineraries that don\'t match your style.',
  },
  {
    id: 'group',
    title: 'Travel Together',
    subtitle: 'Group trips made effortless',
    description: 'Invite friends or family to collaborate. We blend everyone\'s preferences into one cohesive itinerary. No more endless group chats trying to plan.',
    valuePoint: 'Turn conflicting tastes into a trip everyone loves.',
  },
  {
    id: 'generate',
    title: 'AI-Curated Itinerary',
    subtitle: 'A magazine-quality plan, built for you',
    description: 'Our AI analyzes thousands of options and builds a day-by-day editorial itinerary — complete with insider tips, time-of-day flow, and curated activity cards.',
    valuePoint: 'Save 8+ hours of research per trip.',
  },
  {
    id: 'command',
    title: 'Your Trip Command Center',
    subtitle: 'Everything at a glance',
    description: 'Track your total budget with real-time currency conversion, monitor Trip Health score, and access quick actions — all from one dashboard.',
    valuePoint: 'Full control without the spreadsheets.',
  },
  {
    id: 'customize',
    title: 'Customize Any Activity',
    subtitle: 'Your trip, your control',
    description: 'Every activity card is fully editable. Lock favorites, swap suggestions, move items between days, or ask the AI to replace them — all while keeping your day optimized.',
    valuePoint: 'The flexibility of DIY with the polish of a travel agent.',
  },
  {
    id: 'assistant',
    title: 'AI Trip Assistant',
    subtitle: 'Chat with your itinerary',
    description: 'Ask questions, request changes, or get recommendations in natural language. "Make Day 3 more relaxed" — and watch the AI restructure your plan instantly.',
    valuePoint: 'Like having a personal travel consultant on call.',
  },
  {
    id: 'transit',
    title: 'Smart Routing & Transit',
    subtitle: 'More time exploring, less commuting',
    description: 'See transit times between every activity — walking, metro, rideshare. Tap to switch modes, expand for step-by-step directions. Routes are pre-optimized to eliminate backtracking.',
    valuePoint: 'Average 45 minutes saved per day.',
  },
];

interface DemoFeatureShowcaseProps {
  onComplete: () => void;
  onSkipToPlayground?: () => void;
}

export function DemoFeatureShowcase({ onComplete, onSkipToPlayground }: DemoFeatureShowcaseProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const currentFeature = FEATURES[currentIndex];
  const isLast = currentIndex === FEATURES.length - 1;

  const goNext = () => {
    if (isLast) {
      onComplete();
    } else {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  return (
    <section className="min-h-screen flex items-center py-16 bg-gradient-to-b from-secondary/20 via-background to-background">
      <div className="max-w-5xl mx-auto px-4 w-full">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-12">
          {FEATURES.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className="group"
            >
              <div className={cn(
                "h-1 rounded-full transition-all duration-400",
                idx === currentIndex 
                  ? "w-12 bg-primary" 
                  : idx < currentIndex 
                    ? "w-6 bg-primary/50" 
                    : "w-6 bg-border"
              )} />
            </button>
          ))}
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentFeature.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.35 }}
            className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center"
          >
            {/* Left: Content */}
            <div className="order-2 lg:order-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">
                Step {currentIndex + 1} of {FEATURES.length}
              </p>

              <h2 className="text-3xl md:text-4xl font-serif font-bold mb-3 text-foreground">
                {currentFeature.title}
              </h2>
              <p className="text-lg text-primary font-medium mb-4">
                {currentFeature.subtitle}
              </p>
              <p className="text-muted-foreground leading-relaxed mb-6">
                {currentFeature.description}
              </p>

              {/* Value proposition */}
              <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/30 border border-border/50 mb-8">
                <TrendingUp className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <p className="text-sm text-foreground font-medium">
                  {currentFeature.valuePoint}
                </p>
              </div>

              {/* Navigation */}
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  onClick={goPrev}
                  disabled={currentIndex === 0}
                  className="gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </Button>

                <Button onClick={goNext} size="lg" className="gap-2 min-w-[160px]">
                  {isLast ? (
                    <>
                      Try It Yourself
                      <ArrowRight className="h-4 w-4" />
                    </>
                  ) : (
                    <>
                      Continue
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* Right: Visual */}
            <div className="order-1 lg:order-2">
              <Card className="p-6 bg-card border-border/50 shadow-lg">
                <FeatureVisual feature={currentFeature} />
              </Card>
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Skip */}
        <div className="text-center mt-12">
          <Button
            variant="link"
            onClick={onSkipToPlayground || onComplete}
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            Skip to playground →
          </Button>
        </div>
      </div>
    </section>
  );
}

function FeatureVisual({ feature }: { feature: typeof FEATURES[0] }) {
  switch (feature.id) {
    case 'quiz': return <QuizVisual />;
    case 'group': return <GroupTravelVisual />;
    case 'generate': return <GenerationVisual />;
    case 'command': return <CommandCenterVisual />;
    case 'customize': return <CustomizeVisual />;
    case 'assistant': return <AssistantVisual />;
    case 'transit': return <TransitVisual />;
    default: return null;
  }
}

/* ─── Quiz (keep as-is) ─── */
function QuizVisual() {
  const [selected, setSelected] = useState<number | null>(null);
  const options = [
    { label: 'Relaxed Explorer', desc: 'Take it slow, savor each moment' },
    { label: 'Culture Enthusiast', desc: 'Museums, history, local traditions' },
    { label: 'Adventure Seeker', desc: 'Active experiences, off the beaten path' },
    { label: 'Foodie Traveler', desc: 'Culinary experiences are the priority' },
  ];

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <p className="text-xs text-muted-foreground mb-1">Question 3 of 8</p>
        <h3 className="text-base font-medium">What describes you best?</h3>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option, idx) => (
          <motion.button
            key={option.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08 }}
            onClick={() => setSelected(idx)}
            className={cn(
              "p-3 rounded-lg border text-left transition-all",
              selected === idx 
                ? "border-primary bg-primary/5" 
                : "border-border hover:border-primary/50"
            )}
          >
            <span className="text-sm font-medium block">{option.label}</span>
            <span className="text-xs text-muted-foreground">{option.desc}</span>
          </motion.button>
        ))}
      </div>
      <p className="text-xs text-center text-muted-foreground mt-4">
        <Users className="h-3 w-3 inline mr-1" />
        12,000+ travelers profiled
      </p>
    </div>
  );
}

/* ─── Group Travel (keep as-is) ─── */
function GroupTravelVisual() {
  const [members, setMembers] = useState([
    { name: 'You', initials: 'Y', interests: ['Food', 'Culture'], color: 'bg-primary' },
    { name: 'Alex', initials: 'A', interests: ['Adventure', 'Nature'], color: 'bg-emerald-500' },
  ]);
  const [blending, setBlending] = useState(false);
  const [blended, setBlended] = useState(false);

  const addMember = () => {
    if (members.length < 4) {
      const newMembers = [
        { name: 'Sam', initials: 'S', interests: ['Relaxation', 'Food'], color: 'bg-amber-500' },
        { name: 'Jordan', initials: 'J', interests: ['Culture', 'Nightlife'], color: 'bg-rose-500' },
      ];
      setMembers([...members, newMembers[members.length - 2]]);
    }
  };

  const handleBlend = () => {
    setBlending(true);
    setTimeout(() => {
      setBlending(false);
      setBlended(true);
    }, 1500);
  };

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <p className="text-xs text-muted-foreground">Your travel group</p>
      </div>
      <div className="flex items-center justify-center gap-3">
        {members.map((member, idx) => (
          <motion.div
            key={member.name}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: idx * 0.1 }}
            className="text-center"
          >
            <Avatar className={cn("w-12 h-12 border-2 border-background shadow-md", member.color)}>
              <AvatarFallback className="text-white font-medium">{member.initials}</AvatarFallback>
            </Avatar>
            <p className="text-xs mt-1.5 font-medium">{member.name}</p>
          </motion.div>
        ))}
        {members.length < 4 && (
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            onClick={addMember}
            className="w-12 h-12 rounded-full border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center transition-colors"
          >
            <UserPlus className="h-4 w-4 text-muted-foreground" />
          </motion.button>
        )}
      </div>
      <div className="space-y-2">
        {members.map((member) => (
          <div key={member.name} className="flex items-center gap-2 justify-center">
            <span className="text-xs text-muted-foreground w-12">{member.name}:</span>
            <div className="flex gap-1">
              {member.interests.map((interest) => (
                <Badge key={interest} variant="secondary" className="text-xs px-2 py-0">
                  {interest}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
      {!blended && members.length >= 2 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center pt-2">
          <Button size="sm" onClick={handleBlend} disabled={blending} className="gap-2">
            {blending ? (
              <>
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                  <Zap className="h-3.5 w-3.5" />
                </motion.div>
                Blending preferences...
              </>
            ) : (
              <>
                <Heart className="h-3.5 w-3.5" />
                Blend Group Preferences
              </>
            )}
          </Button>
        </motion.div>
      )}
      {blended && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-lg bg-muted/50 border border-border/50">
          <p className="text-xs text-muted-foreground text-center mb-2">Shared preferences found</p>
          <div className="flex items-center justify-center gap-2">
            <Badge variant="outline" className="gap-1 text-xs"><Utensils className="h-3 w-3" /> Food experiences</Badge>
            <Badge variant="outline" className="gap-1 text-xs"><Camera className="h-3 w-3" /> Cultural sites</Badge>
          </div>
          <p className="text-xs text-center text-primary mt-2 font-medium">Itinerary will balance everyone's style</p>
        </motion.div>
      )}
      <p className="text-xs text-center text-muted-foreground">
        <Users className="h-3 w-3 inline mr-1" />Groups up to 12 travelers
      </p>
    </div>
  );
}

/* ─── AI-Curated Itinerary (editorial style) ─── */
function GenerationVisual() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setStep(prev => (prev < 3 ? prev + 1 : prev));
    }, 800);
    return () => clearInterval(timer);
  }, []);

  const activities = [
    { time: '9:00 AM', name: 'Fushimi Inari Shrine', type: 'Culture', tip: 'Arrive early to walk the torii gates with fewer crowds' },
    { time: '12:30 PM', name: 'Nishiki Market', type: 'Food', tip: 'Try the dashimaki tamago at Marutama, a local staple' },
    { time: '3:00 PM', name: 'Arashiyama Bamboo Grove', type: 'Nature', tip: 'The light is magical between 3–4 PM for photos' },
  ];

  const showItinerary = step >= 3;

  return (
    <div className="space-y-4">
      {!showItinerary ? (
        <>
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-sm">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
                <Zap className="h-3.5 w-3.5 text-primary" />
              </motion.div>
              Building "Kyoto, Japan"
            </div>
          </div>
          <div className="space-y-2">
            {['Analyzing your preferences', 'Curating local experiences', 'Optimizing daily flow', 'Composing your itinerary'].map((label, idx) => (
              <motion.div
                key={label}
                initial={{ opacity: 0.4 }}
                animate={{ opacity: idx <= step ? 1 : 0.4 }}
                className={cn("flex items-center gap-3 p-3 rounded-lg", idx <= step ? "bg-muted/50" : "")}
              >
                <div className={cn(
                  "w-6 h-6 rounded-full flex items-center justify-center text-xs",
                  idx < step ? "bg-primary text-primary-foreground" : idx === step ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                )}>
                  {idx < step ? <Check className="h-3.5 w-3.5" /> : idx + 1}
                </div>
                <span className={cn("text-sm", idx <= step ? "text-foreground" : "text-muted-foreground")}>{label}</span>
              </motion.div>
            ))}
          </div>
        </>
      ) : (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          {/* Day header — editorial style */}
          <div className="flex items-center gap-3 mb-1">
            <span className="font-serif text-2xl font-bold text-primary/80">01</span>
            <div>
              <p className="text-xs text-muted-foreground">Monday, April 14</p>
              <p className="font-serif text-sm font-semibold">Temples & Traditions</p>
            </div>
          </div>

          {/* Section header */}
          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-gradient-to-r from-primary/30 to-transparent" />
            <span className="text-[10px] uppercase tracking-wider text-primary/60 font-medium">Morning</span>
            <div className="h-px flex-1 bg-gradient-to-l from-primary/30 to-transparent" />
          </div>

          {/* Activity cards */}
          {activities.map((act, idx) => (
            <motion.div
              key={act.name}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.15 }}
              className="flex gap-3"
            >
              {/* Time column */}
              <div className="flex flex-col items-center pt-1">
                <div className="w-2 h-2 rounded-full bg-primary/60" />
                {idx < activities.length - 1 && <div className="w-px flex-1 bg-border/50 mt-1" />}
              </div>
              {/* Card */}
              <div className="flex-1 p-3 rounded-lg border border-border/50 bg-card">
                <div className="flex items-start gap-2.5">
                  <div className="w-11 h-11 rounded-md bg-muted shrink-0 overflow-hidden">
                    <img 
                      src={toSiteImageUrlFromPhotoId(
                        idx === 0 ? 'photo-1478436127897-769e1b3f0f36' :
                        idx === 1 ? 'photo-1504674900247-0877df9cc836' :
                        'photo-1537996194471-e657df975ab4'
                      )} 
                      alt="" className="w-full h-full object-cover" 
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-mono text-muted-foreground">{act.time}</span>
                    <p className="font-serif text-sm font-medium leading-tight">{act.name}</p>
                    <Badge variant="secondary" className="text-[10px] mt-1 px-1.5 py-0">{act.type}</Badge>
                  </div>
                </div>
                {/* Voyance Tip */}
                <div className="mt-2 pl-3 border-l-2 border-primary/20">
                  <p className="text-[11px] italic text-muted-foreground">
                    <span className="text-primary font-medium not-italic">Voyance Tip</span> · {act.tip}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      <p className="text-xs text-center text-muted-foreground mt-4">
        <Clock className="h-3 w-3 inline mr-1" />
        Average generation: 12 seconds
      </p>
    </div>
  );
}

/* ─── Trip Command Center ─── */
function CommandCenterVisual() {
  return (
    <div className="space-y-4">
      {/* Top: Trip total + currency */}
      <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-muted-foreground">Trip Total</p>
          <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-[10px] text-muted-foreground">
            USD ↔ JPY
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="text-2xl font-semibold text-foreground">$2,340</span>
          <span className="text-sm text-muted-foreground">/ $3,000</span>
        </div>
        <Progress value={78} className="h-1.5 mt-2.5" />
        <p className="text-xs text-primary mt-1.5 font-medium">$660 remaining</p>
      </div>

      {/* Action row */}
      <div className="flex gap-2">
        {[
          { icon: Share2, label: 'Share' },
          { icon: Sparkles, label: 'Optimize' },
          { icon: Download, label: 'Export' },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex-1 flex flex-col items-center gap-1 p-2.5 rounded-lg border border-border/50 bg-card hover:bg-muted/30 transition-colors">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <span className="text-[10px] text-muted-foreground">{label}</span>
          </div>
        ))}
      </div>

      {/* Trip Health */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="p-3 rounded-lg border border-border/50 bg-card"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-medium">Trip Health</span>
          </div>
          <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/20 text-xs">
            92 / 100
          </Badge>
        </div>
        <div className="mt-2 space-y-1.5">
          {[
            { label: 'Pace Balance', value: 95, color: 'bg-emerald-500' },
            { label: 'Budget Fit', value: 88, color: 'bg-primary' },
            { label: 'Route Efficiency', value: 92, color: 'bg-emerald-500' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground w-24">{item.label}</span>
              <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${item.value}%` }}
                  transition={{ delay: 0.5, duration: 0.6 }}
                  className={cn("h-full rounded-full", item.color)}
                />
              </div>
              <span className="text-[10px] text-muted-foreground w-6 text-right">{item.value}</span>
            </div>
          ))}
        </div>
      </motion.div>

      <p className="text-xs text-center text-muted-foreground">
        <Shield className="h-3 w-3 inline mr-1" />
        Real-time budget & quality tracking
      </p>
    </div>
  );
}

/* ─── Customize Any Activity ─── */
function CustomizeVisual() {
  const [locked, setLocked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [swapped, setSwapped] = useState(false);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground text-center mb-2">Click to interact</p>

      {/* Activity 1 — lockable, editorial style */}
      <div className="flex gap-3">
        <div className="flex flex-col items-center pt-1">
          <div className={cn("w-2 h-2 rounded-full", locked ? "bg-primary" : "bg-primary/60")} />
          <div className="w-px flex-1 bg-border/50 mt-1" />
        </div>
        <div className={cn(
          "flex-1 p-3 rounded-lg border transition-all",
          locked ? "border-primary bg-primary/5" : "border-border/50 bg-card"
        )}>
          <div className="flex items-start gap-2.5">
            <div className="w-11 h-11 rounded-md bg-muted shrink-0 overflow-hidden">
              <img src={toSiteImageUrlFromPhotoId('photo-1478436127897-769e1b3f0f36')} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-mono text-muted-foreground">9:00 AM</span>
              <p className="font-serif text-sm font-medium">Fushimi Inari Shrine</p>
              <Badge variant="secondary" className="text-[10px] mt-0.5 px-1.5 py-0">Culture</Badge>
            </div>
            <button
              onClick={() => setLocked(!locked)}
              className={cn(
                "w-7 h-7 rounded-md flex items-center justify-center transition-colors",
                locked ? "bg-primary/10" : "bg-muted hover:bg-muted/80"
              )}
            >
              <Lock className={cn("h-3.5 w-3.5", locked ? "text-primary" : "text-muted-foreground")} />
            </button>
          </div>
          {/* Voyance Tip */}
          <div className="mt-2 pl-3 border-l-2 border-primary/20">
            <p className="text-[11px] italic text-muted-foreground">
              <span className="text-primary font-medium not-italic">Voyance Tip</span> — Arrive by 8:45 AM to walk the upper trails almost solo
            </p>
          </div>
        </div>
      </div>

      {/* Transit badge between cards */}
      <div className="flex items-center gap-2 pl-4">
        <div className="flex-1 border-t border-dashed border-border/30" />
        <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
          <Footprints className="h-2.5 w-2.5" /> 12 min
        </span>
        <div className="flex-1 border-t border-dashed border-border/30" />
      </div>

      {/* Activity 2 — with menu */}
      <div className="flex gap-3">
        <div className="flex flex-col items-center pt-1">
          <div className="w-2 h-2 rounded-full bg-primary/60" />
        </div>
        <div className="flex-1 p-3 rounded-lg border border-border/50 bg-card relative">
          <div className="flex items-start gap-2.5">
            <div className="w-11 h-11 rounded-md bg-muted shrink-0 overflow-hidden">
              <img src={toSiteImageUrlFromPhotoId('photo-1504674900247-0877df9cc836')} alt="" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-mono text-muted-foreground">12:30 PM</span>
              <p className="font-serif text-sm font-medium">
                {swapped ? 'Izuju Sushi — Kyoto Style' : 'Nishiki Market Lunch'}
              </p>
              <Badge variant="secondary" className="text-[10px] mt-0.5 px-1.5 py-0">Food</Badge>
            </div>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="w-7 h-7 rounded-md bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
            >
              <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>

          {/* Dropdown menu */}
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                className="absolute right-3 top-12 z-10 w-36 bg-popover border border-border rounded-lg shadow-lg py-1"
              >
                {[
                  { icon: RefreshCw, label: 'Swap', action: () => { setSwapped(!swapped); setMenuOpen(false); } },
                  { icon: ArrowUpDown, label: 'Move', action: () => setMenuOpen(false) },
                  { icon: Pencil, label: 'Edit', action: () => setMenuOpen(false) },
                  { icon: Trash2, label: 'Remove', action: () => setMenuOpen(false), destructive: true },
                ].map(item => (
                  <button
                    key={item.label}
                    onClick={item.action}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted transition-colors",
                      (item as any).destructive ? "text-destructive" : "text-foreground"
                    )}
                  >
                    <item.icon className="h-3 w-3" />
                    {item.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex items-center justify-center gap-4 pt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> Lock to keep</span>
        <span className="flex items-center gap-1"><MoreHorizontal className="h-3 w-3" /> Menu for options</span>
      </div>
    </div>
  );
}

/* ─── AI Trip Assistant ─── */
function AssistantVisual() {
  const [messages, setMessages] = useState([
    { role: 'user', text: 'Make Day 3 more relaxed' },
  ]);
  const [typing, setTyping] = useState(true);
  const [showSuggestion, setShowSuggestion] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: "I'll swap the morning temple tour for a zen garden visit and push lunch to 1 PM. Here's the updated plan:"
      }]);
      setTyping(false);
    }, 1800);
    const t2 = setTimeout(() => setShowSuggestion(true), 2500);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div className="space-y-3">
      <div className="text-center mb-3">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-sm text-primary font-medium">
          <MessageCircle className="h-3.5 w-3.5" />
          Trip Assistant
        </div>
      </div>

      {/* Chat messages */}
      <div className="space-y-2 max-h-[260px]">
        {messages.map((msg, idx) => (
          <motion.div
            key={idx}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className={cn(
              "max-w-[85%] p-2.5 rounded-xl text-xs leading-relaxed",
              msg.role === 'user'
                ? "ml-auto bg-primary text-primary-foreground rounded-br-md"
                : "bg-muted rounded-bl-md"
            )}
          >
            {msg.text}
          </motion.div>
        ))}

        {typing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-muted rounded-xl rounded-bl-md p-2.5 w-16"
          >
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40"
                  animate={{ y: [0, -3, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Suggestion card */}
      <AnimatePresence>
        {showSuggestion && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-3 rounded-lg border border-primary/20 bg-primary/5"
          >
            <p className="text-[10px] font-medium text-primary mb-2">Proposed changes for Day 3:</p>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-destructive/60" />
                <span className="text-muted-foreground line-through">Kinkaku-ji Temple Tour, 3 hrs</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-foreground font-medium">Zen Garden Meditation, 1.5 hrs</span>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-foreground font-medium">Lunch moved to 1:00 PM</span>
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <Button size="sm" className="h-6 text-[10px] gap-1 flex-1">
                <Check className="h-3 w-3" /> Apply
              </Button>
              <Button size="sm" variant="outline" className="h-6 text-[10px] flex-1">
                Dismiss
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar */}
      <div className="flex items-center gap-2 p-2 rounded-lg border border-border/50 bg-muted/30">
        <input
          type="text"
          readOnly
          placeholder="Ask about your trip..."
          className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
        />
        <Send className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
    </div>
  );
}

/* ─── Smart Routing & Transit ─── */
function TransitVisual() {
  const [expanded, setExpanded] = useState(false);

  const stops = [
    { time: '9:00 AM', name: 'Fushimi Inari Shrine', icon: Landmark },
    { transit: { mode: 'train', label: 'JR Nara Line', duration: '15 min', cost: '¥150' } },
    { time: '11:30 AM', name: 'Kiyomizu-dera Temple', icon: Landmark },
    { transit: { mode: 'walking', label: 'Walk through Higashiyama', duration: '8 min', cost: 'Free' } },
    { time: '12:30 PM', name: 'Nishiki Market', icon: Utensils },
    { transit: { mode: 'uber', label: 'Rideshare', duration: '12 min', cost: '¥800' } },
    { time: '3:00 PM', name: 'Arashiyama Bamboo Grove', icon: MapPin },
  ];

  const transitIcons: Record<string, React.ReactNode> = {
    walking: <Footprints className="h-2.5 w-2.5" />,
    train: <Train className="h-2.5 w-2.5" />,
    uber: <Car className="h-2.5 w-2.5" />,
  };

  return (
    <div className="space-y-1">
      <div className="text-center mb-4">
        <Badge variant="secondary" className="text-xs gap-1">
          <Zap className="h-3 w-3 text-primary" />
          47 min saved today
        </Badge>
      </div>

      <div className="relative">
        {stops.map((item, idx) => {
          if ('transit' in item && item.transit) {
            const t = item.transit;
            const isExpandTarget = t.mode === 'train';
            return (
              <div key={idx} className="my-0.5">
                <button
                  onClick={() => isExpandTarget && setExpanded(!expanded)}
                  className="w-full flex items-center gap-2 py-1 group"
                >
                  <div className="flex-1 border-t border-dashed border-border/30" />
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
                    {transitIcons[t.mode] || <MapPin className="h-2.5 w-2.5" />}
                    <span>{t.duration}</span>
                    <span className="text-muted-foreground/30">·</span>
                    <span className={t.cost === 'Free' ? 'text-emerald-600/70' : ''}>{t.cost}</span>
                    {isExpandTarget && (
                      <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.15 }}>
                        <ChevronDown className="h-2 w-2" />
                      </motion.div>
                    )}
                  </span>
                  <div className="flex-1 border-t border-dashed border-border/30" />
                </button>

                {/* Expanded transit details */}
                <AnimatePresence>
                  {isExpandTarget && expanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="py-1.5 px-3 ml-6">
                        <div className="pl-3 border-l-2 border-primary/20 space-y-1">
                          <div className="flex items-start gap-2 text-xs">
                            <div className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] font-medium flex items-center justify-center shrink-0 mt-0.5">1</div>
                            <span className="text-muted-foreground">Walk to Inari Station (3 min)</span>
                          </div>
                          <div className="flex items-start gap-2 text-xs">
                            <div className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] font-medium flex items-center justify-center shrink-0 mt-0.5">2</div>
                            <span className="text-muted-foreground">JR Nara Line → Tōfukuji (2 stops)</span>
                          </div>
                          <div className="flex items-start gap-2 text-xs">
                            <div className="w-4 h-4 rounded-full bg-primary/20 text-primary text-[10px] font-medium flex items-center justify-center shrink-0 mt-0.5">3</div>
                            <span className="text-muted-foreground">Walk uphill to Kiyomizu-dera (10 min)</span>
                          </div>
                        </div>
                        <div className="flex gap-2 mt-2">
                          {['walking', 'train', 'uber'].map(mode => (
                            <button
                              key={mode}
                              className={cn(
                                "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] border transition-colors",
                                mode === 'train'
                                  ? "bg-primary/10 text-primary border-primary/30 font-medium"
                                  : "bg-background border-border hover:border-primary/50 text-muted-foreground"
                              )}
                            >
                              {transitIcons[mode]}
                              {mode === 'walking' ? 'Walk' : mode === 'train' ? 'Train' : 'Ride'}
                            </button>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          }

          const stop = item as { time: string; name: string; icon: React.ComponentType<{ className?: string }> };
          const Icon = stop.icon;
          return (
            <motion.div
              key={idx}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.06 }}
              className="flex items-center gap-3 py-2"
            >
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-mono text-muted-foreground">{stop.time}</span>
                <p className="text-sm font-medium leading-tight">{stop.name}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <p className="text-xs text-center text-muted-foreground pt-2">
        <MapPin className="h-3 w-3 inline mr-1" />
        Tap transit badges to expand details & switch modes
      </p>
    </div>
  );
}
