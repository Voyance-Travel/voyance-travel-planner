import { useState, useEffect } from 'react';
import { toSiteImageUrlFromPhotoId } from '@/utils/unsplash';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  RefreshCw, MapPin, Lock, 
  ChevronLeft, ChevronRight, Check, Clock, ArrowRight,
  TrendingUp, Zap, Users, UserPlus, DollarSign, CloudSun,
  Heart, Utensils, Camera, Plane
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
    title: 'Curated in Seconds',
    subtitle: 'What takes hours, we do instantly',
    description: 'Our system analyzes thousands of options (restaurants, activities, routes) and builds a day-by-day plan tailored to your preferences.',
    valuePoint: 'Save 8+ hours of research per trip.',
  },
  {
    id: 'budget',
    title: 'Budget Tracking',
    subtitle: 'Know exactly where your money goes',
    description: 'Set your total budget and watch spending across flights, hotels, food, and activities. Real-time tracking keeps you on target without spreadsheets.',
    valuePoint: 'Never overspend or wonder what\'s left.',
  },
  {
    id: 'weather',
    title: 'Weather Intelligence',
    subtitle: 'Plan around the forecast',
    description: 'Live weather data for your destination, plus smart packing suggestions. Outdoor activities automatically adjust to conditions.',
    valuePoint: 'Pack right. Plan smart. No surprises.',
  },
  {
    id: 'customize',
    title: 'Lock & Swap',
    subtitle: 'Your trip, your control',
    description: 'Love something? Lock it in. Not feeling an activity? Swap it instantly. We adapt around your choices while keeping your day optimized.',
    valuePoint: 'The flexibility of DIY with the polish of a travel agent.',
  },
  {
    id: 'optimize',
    title: 'Smart Routing',
    subtitle: 'More time exploring, less commuting',
    description: 'We optimize your daily routes so activities flow naturally. No backtracking, no wasted time between stops.',
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
            onClick={onComplete}
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
  if (feature.id === 'quiz') {
    return <QuizVisual />;
  }
  if (feature.id === 'group') {
    return <GroupTravelVisual />;
  }
  if (feature.id === 'generate') {
    return <GenerationVisual />;
  }
  if (feature.id === 'budget') {
    return <BudgetVisual />;
  }
  if (feature.id === 'weather') {
    return <WeatherVisual />;
  }
  if (feature.id === 'customize') {
    return <CustomizeVisual />;
  }
  if (feature.id === 'optimize') {
    return <RouteVisual />;
  }
  return null;
}

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

function GenerationVisual() {
  const [step, setStep] = useState(0);
  const steps = [
    { label: 'Analyzing your preferences', done: false },
    { label: 'Finding verified venues', done: false },
    { label: 'Optimizing daily routes', done: false },
    { label: 'Itinerary ready', done: false },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setStep(prev => (prev < steps.length - 1 ? prev + 1 : prev));
    }, 700);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-sm">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          >
            <Zap className="h-3.5 w-3.5 text-primary" />
          </motion.div>
          Building "Bali, Indonesia"
        </div>
      </div>
      <div className="space-y-2">
        {steps.map((s, idx) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0.4 }}
            animate={{ opacity: idx <= step ? 1 : 0.4 }}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg transition-colors",
              idx <= step ? "bg-muted/50" : ""
            )}
          >
            <div className={cn(
              "w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors",
              idx < step ? "bg-primary text-primary-foreground" : 
              idx === step ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
            )}>
              {idx < step ? <Check className="h-3.5 w-3.5" /> : idx + 1}
            </div>
            <span className={cn(
              "text-sm",
              idx <= step ? "text-foreground" : "text-muted-foreground"
            )}>{s.label}</span>
          </motion.div>
        ))}
      </div>
      <p className="text-xs text-center text-muted-foreground mt-4">
        <Clock className="h-3 w-3 inline mr-1" />
        Average generation: 12 seconds
      </p>
    </div>
  );
}

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

      {/* Members */}
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

      {/* Interest tags */}
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

      {/* Blend button */}
      {!blended && members.length >= 2 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center pt-2"
        >
          <Button
            size="sm"
            onClick={handleBlend}
            disabled={blending}
            className="gap-2"
          >
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

      {/* Blended result */}
      {blended && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 rounded-lg bg-muted/50 border border-border/50"
        >
          <p className="text-xs text-muted-foreground text-center mb-2">Shared preferences found</p>
          <div className="flex items-center justify-center gap-2">
            <Badge variant="outline" className="gap-1 text-xs">
              <Utensils className="h-3 w-3" /> Food experiences
            </Badge>
            <Badge variant="outline" className="gap-1 text-xs">
              <Camera className="h-3 w-3" /> Cultural sites
            </Badge>
          </div>
          <p className="text-xs text-center text-primary mt-2 font-medium">
            Itinerary will balance everyone's style
          </p>
        </motion.div>
      )}

      <p className="text-xs text-center text-muted-foreground">
        <Users className="h-3 w-3 inline mr-1" />
        Groups up to 12 travelers
      </p>
    </div>
  );
}

function BudgetVisual() {
  const categories = [
    { label: 'Flights', spent: 850, total: 1000, icon: Plane, color: 'bg-primary' },
    { label: 'Hotels', spent: 720, total: 800, icon: MapPin, color: 'bg-emerald-500' },
    { label: 'Food', spent: 180, total: 400, icon: Utensils, color: 'bg-amber-500' },
    { label: 'Activities', spent: 120, total: 300, icon: Camera, color: 'bg-rose-500' },
  ];

  const totalSpent = categories.reduce((sum, c) => sum + c.spent, 0);
  const totalBudget = categories.reduce((sum, c) => sum + c.total, 0);

  return (
    <div className="space-y-4">
      {/* Total budget header */}
      <div className="text-center p-4 rounded-lg bg-muted/30 border border-border/50">
        <p className="text-xs text-muted-foreground mb-1">Trip Budget</p>
        <div className="flex items-baseline justify-center gap-1">
          <span className="text-2xl font-semibold">${totalSpent.toLocaleString()}</span>
          <span className="text-muted-foreground">/ ${totalBudget.toLocaleString()}</span>
        </div>
        <Progress value={(totalSpent / totalBudget) * 100} className="h-2 mt-3" />
        <p className="text-xs text-primary mt-2 font-medium">
          ${(totalBudget - totalSpent).toLocaleString()} remaining
        </p>
      </div>

      {/* Category breakdown */}
      <div className="space-y-2">
        {categories.map((cat, idx) => {
          const Icon = cat.icon;
          const percent = (cat.spent / cat.total) * 100;
          return (
            <motion.div
              key={cat.label}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.08 }}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/30 transition-colors"
            >
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", cat.color)}>
                <Icon className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{cat.label}</span>
                  <span className="text-xs text-muted-foreground">${cat.spent} / ${cat.total}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percent}%` }}
                    transition={{ delay: 0.3 + idx * 0.1, duration: 0.5 }}
                    className={cn("h-full rounded-full", cat.color)}
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <p className="text-xs text-center text-muted-foreground">
        <DollarSign className="h-3 w-3 inline mr-1" />
        Real-time tracking across all expenses
      </p>
    </div>
  );
}

function WeatherVisual() {
  const forecast = [
    { day: 'Mon', icon: '☀️', high: 84, low: 72, condition: 'Sunny' },
    { day: 'Tue', icon: '⛅', high: 82, low: 70, condition: 'Partly Cloudy' },
    { day: 'Wed', icon: '🌧️', high: 78, low: 68, condition: 'Light Rain' },
    { day: 'Thu', icon: '☀️', high: 85, low: 73, condition: 'Sunny' },
    { day: 'Fri', icon: '☀️', high: 86, low: 74, condition: 'Clear' },
  ];

  const packingSuggestions = ['Sunscreen', 'Light rain jacket', 'Sunglasses', 'Hat'];

  return (
    <div className="space-y-4">
      {/* Location header */}
      <div className="text-center mb-2">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted text-sm">
          <CloudSun className="h-3.5 w-3.5 text-amber-500" />
          Bali, Indonesia
        </div>
      </div>

      {/* Forecast strip */}
      <div className="flex justify-between gap-1">
        {forecast.map((day, idx) => (
          <motion.div
            key={day.day}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.08 }}
            className={cn(
              "flex-1 text-center p-2 rounded-lg",
              idx === 0 ? "bg-muted/50 border border-border/50" : ""
            )}
          >
            <p className="text-xs text-muted-foreground">{day.day}</p>
            <p className="text-xl my-1">{day.icon}</p>
            <p className="text-xs font-medium">{day.high}°</p>
            <p className="text-xs text-muted-foreground">{day.low}°</p>
          </motion.div>
        ))}
      </div>

      {/* Smart packing */}
      <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
        <p className="text-xs font-medium mb-2 flex items-center gap-1">
          <Zap className="h-3 w-3 text-primary" />
          Smart Packing Suggestions
        </p>
        <div className="flex flex-wrap gap-1.5">
          {packingSuggestions.map((item) => (
            <Badge key={item} variant="secondary" className="text-xs">
              {item}
            </Badge>
          ))}
        </div>
      </div>

      {/* Activity adjustment note */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex items-start gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20"
      >
        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-foreground">
          <span className="font-medium">Wed:</span> Indoor activities scheduled due to expected rain
        </p>
      </motion.div>

      <p className="text-xs text-center text-muted-foreground">
        <CloudSun className="h-3 w-3 inline mr-1" />
        7-day forecast with daily updates
      </p>
    </div>
  );
}

function CustomizeVisual() {
  const [locked, setLocked] = useState(false);
  const [swapped, setSwapped] = useState(false);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground text-center mb-4">
        Click to interact
      </p>
      
      {/* Activity card 1 */}
      <div className={cn(
        "flex items-center gap-3 p-3 rounded-lg border transition-all",
        locked ? "border-primary bg-primary/5" : "border-border"
      )}>
        <div className="w-12 h-12 rounded-md bg-muted overflow-hidden shrink-0">
          <img 
            src={toSiteImageUrlFromPhotoId('photo-1537996194471-e657df975ab4')} 
            alt="" 
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Tanah Lot Temple</p>
          <p className="text-xs text-muted-foreground">09:00 • 2 hours</p>
        </div>
        <button 
          onClick={() => setLocked(!locked)}
          className={cn(
            "w-8 h-8 rounded-md flex items-center justify-center transition-colors",
            locked ? "bg-primary/10" : "bg-muted hover:bg-muted/80"
          )}
        >
          <Lock className={cn("h-4 w-4", locked ? "text-primary" : "text-muted-foreground")} />
        </button>
      </div>

      {/* Activity card 2 */}
      <motion.div
        animate={swapped ? { scale: [1, 0.98, 1] } : {}}
        className="flex items-center gap-3 p-3 rounded-lg border border-border"
      >
        <div className="w-12 h-12 rounded-md bg-muted overflow-hidden shrink-0">
          <img 
            src={toSiteImageUrlFromPhotoId('photo-1504674900247-0877df9cc836')} 
            alt="" 
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">
            {swapped ? 'Local Warung Experience' : 'Bebek Bengil Restaurant'}
          </p>
          <p className="text-xs text-muted-foreground">12:00 • 1.5 hours</p>
        </div>
        <button 
          onClick={() => setSwapped(!swapped)}
          className="w-8 h-8 rounded-md bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
        >
          <RefreshCw className="h-4 w-4 text-muted-foreground" />
        </button>
      </motion.div>

      <div className="flex items-center justify-center gap-4 pt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Lock className="h-3 w-3" /> Lock to keep
        </span>
        <span className="flex items-center gap-1">
          <RefreshCw className="h-3 w-3" /> Swap to replace
        </span>
      </div>
    </div>
  );
}

function RouteVisual() {
  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <Badge variant="secondary" className="text-xs">
          47 min saved today
        </Badge>
      </div>
      
      {/* Route timeline */}
      <div className="relative pl-6">
        <div className="absolute left-2 top-3 bottom-3 w-px bg-gradient-to-b from-primary via-primary/50 to-primary/20" />
        
        {[
          { time: '09:00', place: 'Hotel Pickup', duration: null },
          { time: '09:15', place: 'Tanah Lot Temple', duration: '15 min drive' },
          { time: '11:30', place: 'Tirta Empul', duration: '20 min drive' },
          { time: '14:00', place: 'Ubud Market', duration: '12 min drive' },
          { time: '16:00', place: 'Rice Terraces', duration: '8 min walk' },
        ].map((stop, idx) => (
          <motion.div
            key={stop.place}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.12 }}
            className="relative mb-4 last:mb-0"
          >
            <div className={cn(
              "absolute -left-4 w-3 h-3 rounded-full border-2 border-background",
              idx === 0 ? "bg-primary" : "bg-primary/60"
            )} />
            <div className="pl-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-10">{stop.time}</span>
                <span className="text-sm font-medium">{stop.place}</span>
              </div>
              {stop.duration && (
                <p className="text-xs text-primary/80 ml-12">{stop.duration}</p>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      <p className="text-xs text-center text-muted-foreground pt-2">
        <MapPin className="h-3 w-3 inline mr-1" />
        Routes optimized for minimal travel time
      </p>
    </div>
  );
}
