/**
 * PersonalizationProof - Homepage "Same Destination. Different Journey."
 * 
 * Interactive toggle between 3 archetype itineraries for Tokyo,
 * proving personalization is real and tangible.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, MapPin, Sparkles, Zap, Leaf, Palette,
  Star, DollarSign, ArrowRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/config/routes';

// ============================================================================
// DATA
// ============================================================================

interface Activity {
  time: string;
  title: string;
  type: 'adventure' | 'relaxation' | 'dining' | 'cultural' | 'sightseeing';
  duration: string;
  cost: number;
  why: string;
}

interface ArchetypeDay {
  id: string;
  name: string;
  tagline: string;
  icon: typeof Zap;
  colorClass: string;
  accentBg: string;
  pace: string;
  style: string;
  dailyBudget: number;
  firstActivity: string;
  activities: Activity[];
}

const ARCHETYPES: ArchetypeDay[] = [
  {
    id: 'slow_traveler',
    name: 'The Present Traveler',
    tagline: 'Savor every moment',
    icon: Leaf,
    colorClass: 'text-emerald-600 dark:text-emerald-400',
    accentBg: 'from-emerald-500/10 to-teal-500/5',
    pace: 'Relaxed',
    style: 'Comfort',
    dailyBudget: 180,
    firstActivity: '10:00',
    activities: [
      {
        time: '10:00',
        title: 'Matcha Ceremony at Sakurai',
        type: 'cultural',
        duration: '90 min',
        cost: 35,
        why: 'Late start, deep cultural immersion over speed',
      },
      {
        time: '12:00',
        title: 'Stroll Through Yanaka District',
        type: 'sightseeing',
        duration: '2 hours',
        cost: 0,
        why: 'Old Tokyo neighborhoods at your own pace',
      },
      {
        time: '14:30',
        title: 'Lunch at Afuri Ramen (Ebisu)',
        type: 'dining',
        duration: '75 min',
        cost: 18,
        why: 'Quiet location, no tourist rush',
      },
      {
        time: '16:30',
        title: 'Nezu Museum Gardens',
        type: 'relaxation',
        duration: '2 hours',
        cost: 12,
        why: 'Contemplative garden time, not museum sprinting',
      },
      {
        time: '19:00',
        title: 'Omakase at Sushi Saito',
        type: 'dining',
        duration: '2 hours',
        cost: 115,
        why: 'One extraordinary meal over three average ones',
      },
    ],
  },
  {
    id: 'adrenaline_architect',
    name: 'The Adrenaline Architect',
    tagline: 'Pack every day with thrills',
    icon: Zap,
    colorClass: 'text-orange-600 dark:text-orange-400',
    accentBg: 'from-orange-500/10 to-red-500/5',
    pace: 'Fast',
    style: 'Adventure',
    dailyBudget: 320,
    firstActivity: '06:30',
    activities: [
      {
        time: '06:30',
        title: 'Tsukiji Outer Market Dawn Run',
        type: 'adventure',
        duration: '90 min',
        cost: 25,
        why: 'Beat the crowds, street food breakfast on the go',
      },
      {
        time: '08:30',
        title: 'Go-Kart Through Shibuya Streets',
        type: 'adventure',
        duration: '2 hours',
        cost: 85,
        why: 'Your adrenaline score demands real thrills',
      },
      {
        time: '11:00',
        title: 'TeamLab Borderless Speedrun',
        type: 'sightseeing',
        duration: '75 min',
        cost: 32,
        why: 'Hit 8 installations in record time',
      },
      {
        time: '12:30',
        title: 'Standing Soba at Kaoriya',
        type: 'dining',
        duration: '20 min',
        cost: 8,
        why: 'Eat like a local, 20 min max then move',
      },
      {
        time: '13:30',
        title: 'Rock Climbing at B-Pump Ogikubo',
        type: 'adventure',
        duration: '2 hours',
        cost: 28,
        why: 'Physical challenge between sightseeing blocks',
      },
      {
        time: '16:00',
        title: 'Harajuku to Shibuya Crossing Sprint',
        type: 'sightseeing',
        duration: '2 hours',
        cost: 15,
        why: 'High-energy neighborhood crawl',
      },
      {
        time: '19:00',
        title: 'Robot Restaurant Show + Dinner',
        type: 'adventure',
        duration: '2 hours',
        cost: 75,
        why: 'Peak sensory overload to end the day',
      },
    ],
  },
  {
    id: 'culture_curator',
    name: 'The Culture Curator',
    tagline: 'Every place tells a story',
    icon: Palette,
    colorClass: 'text-violet-600 dark:text-violet-400',
    accentBg: 'from-violet-500/10 to-purple-500/5',
    pace: 'Moderate',
    style: 'Cultural',
    dailyBudget: 220,
    firstActivity: '08:30',
    activities: [
      {
        time: '08:30',
        title: 'Morning Zazen at Engaku-ji Temple',
        type: 'cultural',
        duration: '90 min',
        cost: 5,
        why: 'Authentic Zen practice, not tourist meditation',
      },
      {
        time: '10:30',
        title: 'Sword-Making Workshop in Asakusa',
        type: 'cultural',
        duration: '2 hours',
        cost: 65,
        why: 'Hands-on craft heritage, not just looking',
      },
      {
        time: '13:00',
        title: 'Kaiseki Lunch at Kozue (Park Hyatt)',
        type: 'dining',
        duration: '90 min',
        cost: 80,
        why: 'Cuisine as cultural expression, seasonal ingredients',
      },
      {
        time: '15:00',
        title: 'Mori Art Museum + City View',
        type: 'cultural',
        duration: '2 hours',
        cost: 22,
        why: 'Contemporary Japanese art in global context',
      },
      {
        time: '17:30',
        title: 'Golden Gai Bar Crawl with Historian',
        type: 'cultural',
        duration: '3 hours',
        cost: 48,
        why: 'Postwar history through sake and conversation',
      },
    ],
  },
];

const typeStyles: Record<string, string> = {
  adventure: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  relaxation: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  dining: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  cultural: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
  sightseeing: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function PersonalizationProof() {
  const [activeIdx, setActiveIdx] = useState(0);
  const navigate = useNavigate();
  const active = ARCHETYPES[activeIdx];

  return (
    <section className="py-16 md:py-24 bg-gradient-to-b from-muted/30 to-background">
      <div className="container max-w-5xl mx-auto px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-10"
        >
          <Badge variant="outline" className="mb-4 px-3 py-1">
            <Sparkles className="h-3 w-3 mr-1.5" />
            Personalization in Action
          </Badge>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-3 text-foreground">
            Same Destination. <span className="text-primary">Different Journey.</span>
          </h2>
          <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto">
            Three travelers visit Tokyo. Each gets a completely different day 
            based on their Travel DNA. Toggle to see the proof.
          </p>
        </motion.div>

        {/* 3-Way Archetype Toggle */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-muted rounded-full p-1 gap-1 w-full max-w-lg overflow-hidden">
            {ARCHETYPES.map((arch, idx) => {
              const Icon = arch.icon;
              const isActive = activeIdx === idx;
              return (
                <button
                  key={arch.id}
                  onClick={() => setActiveIdx(idx)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 flex-1 min-w-0 px-2 md:px-4 py-2.5 rounded-full text-[11px] md:text-sm font-medium transition-all duration-200",
                    isActive 
                      ? "bg-background shadow-md text-foreground" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", isActive && arch.colorClass)} />
                  <span className="truncate">{arch.name.replace('The ', '')}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Itinerary Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={active.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            <div className={cn(
              "rounded-2xl border border-border bg-gradient-to-br p-5 md:p-6 shadow-sm",
              active.accentBg
            )}>
              {/* Card Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                <div className="flex items-center gap-3">
                  <div className={cn("p-2 rounded-xl bg-background/80 shadow-sm")}>
                    <active.icon className={cn("h-5 w-5", active.colorClass)} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm md:text-base">{active.name}</h3>
                    <p className="text-xs text-muted-foreground italic">"{active.tagline}"</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <div className="flex items-center gap-3 px-3 py-1.5 bg-background/60 rounded-lg">
                    <span className="text-muted-foreground">Pace: <strong className="text-foreground">{active.pace}</strong></span>
                    <span className="text-border">|</span>
                    <span className="text-muted-foreground">Style: <strong className="text-foreground">{active.style}</strong></span>
                    <span className="text-border">|</span>
                    <span className="text-muted-foreground">Budget: <strong className="text-foreground">${active.dailyBudget}/day</strong></span>
                  </div>
                </div>
              </div>

              {/* Location */}
              <div className="flex items-center gap-2 mb-4 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5" />
                <span>Tokyo, Japan</span>
                <span>·</span>
                <span>Day 2</span>
                <span>·</span>
                <span>{active.activities.length} activities</span>
              </div>

              {/* Timeline */}
              <div className="space-y-2">
                {active.activities.map((act, idx) => (
                  <motion.div
                    key={`${active.id}-${idx}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="flex gap-3 bg-background/80 rounded-xl p-3 border border-border/40 hover:border-border/80 transition-colors"
                  >
                    {/* Time */}
                    <div className="text-xs font-mono text-muted-foreground w-11 pt-0.5 shrink-0">
                      {act.time}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm text-foreground leading-tight">{act.title}</h4>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <Badge variant="outline" className={cn("text-[10px] py-0 border-0", typeStyles[act.type])}>
                          {act.type}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" /> {act.duration}
                        </span>
                        {act.cost > 0 && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <DollarSign className="h-2.5 w-2.5" /> {act.cost}
                          </span>
                        )}
                      </div>
                      {/* Why this fits */}
                      <div className="mt-1.5 flex items-start gap-1.5 text-[10px] text-primary/80">
                        <Sparkles className="h-3 w-3 shrink-0 mt-px" />
                        <span>{act.why}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>


        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mt-10 text-center"
        >
          <Button 
            size="lg" 
            className="hidden sm:inline-flex gap-2 rounded-full px-8"
            onClick={() => navigate(ROUTES.QUIZ)}
          >
            Discover Your Travel DNA
            <ArrowRight className="h-4 w-4" />
          </Button>
          <button
            onClick={() => navigate(ROUTES.QUIZ)}
            className="sm:hidden inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
          >
            Discover Your Travel DNA
            <ArrowRight className="h-4 w-4" />
          </button>
          <p className="text-xs text-muted-foreground mt-2">
            5-minute quiz. No account required to start.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
