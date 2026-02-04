/**
 * Demo Archetype Comparison Component
 * 
 * Shows two itineraries side-by-side for the same destination,
 * demonstrating how different archetypes get different experiences.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, MapPin, Sparkles, Zap, Leaf, 
  ChevronRight, Star, DollarSign
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

// ============================================================================
// ARCHETYPE COMPARISON DATA
// ============================================================================

interface ComparisonActivity {
  id: string;
  time: string;
  title: string;
  description: string;
  type: 'adventure' | 'relaxation' | 'dining' | 'sightseeing' | 'transportation';
  duration: string;
  cost: number;
  rating?: number;
  whyThisFits: string;
}

interface ArchetypeItinerary {
  archetype: {
    id: string;
    name: string;
    category: string;
    tagline: string;
    icon: typeof Zap;
    color: string;
    bgGradient: string;
  };
  pace: string;
  style: string;
  dailyBudget: number;
  activities: ComparisonActivity[];
}

// Same destination, two very different experiences
const COMPARISON_DATA: Record<string, { destination: string; date: string; archetypes: [ArchetypeItinerary, ArchetypeItinerary] }> = {
  iceland: {
    destination: 'Reykjavik, Iceland',
    date: 'Day 2 • Golden Circle',
    archetypes: [
      {
        archetype: {
          id: 'slow_traveler',
          name: 'The Slow Traveler',
          category: 'RESTORER',
          tagline: 'Savor every moment',
          icon: Leaf,
          color: 'text-emerald-600',
          bgGradient: 'from-emerald-500/10 to-teal-500/10',
        },
        pace: 'Relaxed',
        style: 'Comfort',
        dailyBudget: 280,
        activities: [
          {
            id: 'slow-1',
            time: '10:00',
            title: 'Leisurely Breakfast at Grái Kötturinn',
            description: 'Famous breakfast café with homemade pastries and harbor views',
            type: 'dining',
            duration: '90 min',
            cost: 35,
            rating: 4.8,
            whyThisFits: 'Late start for your relaxed pace preference',
          },
          {
            id: 'slow-2',
            time: '12:00',
            title: 'Secret Lagoon Hot Springs',
            description: 'Iceland\'s oldest natural pool with fewer crowds than Blue Lagoon',
            type: 'relaxation',
            duration: '3 hours',
            cost: 45,
            rating: 4.7,
            whyThisFits: 'Extended soak time for deep restoration',
          },
          {
            id: 'slow-3',
            time: '15:30',
            title: 'Friðheimar Tomato Farm Lunch',
            description: 'Geothermally-heated greenhouse with tomato soup and fresh bread',
            type: 'dining',
            duration: '2 hours',
            cost: 55,
            rating: 4.9,
            whyThisFits: 'Slow food philosophy matches your pace',
          },
          {
            id: 'slow-4',
            time: '18:00',
            title: 'Golden Hour at Gullfoss',
            description: 'Private viewing of Iceland\'s most powerful waterfall at sunset',
            type: 'sightseeing',
            duration: '90 min',
            cost: 0,
            rating: 4.9,
            whyThisFits: 'Timed for fewer crowds and best light',
          },
          {
            id: 'slow-5',
            time: '20:00',
            title: 'Farm-to-Table Dinner at Efstidalur',
            description: 'Historic dairy farm with views of the cows that made your ice cream',
            type: 'dining',
            duration: '2 hours',
            cost: 65,
            rating: 4.6,
            whyThisFits: 'Authentic, unhurried countryside dining',
          },
        ],
      },
      {
        archetype: {
          id: 'adrenaline_architect',
          name: 'The Adrenaline Architect',
          category: 'ACHIEVER',
          tagline: 'Pack every day with thrills',
          icon: Zap,
          color: 'text-orange-600',
          bgGradient: 'from-orange-500/10 to-red-500/10',
        },
        pace: 'Active',
        style: 'Adventure',
        dailyBudget: 450,
        activities: [
          {
            id: 'adrenaline-1',
            time: '07:00',
            title: 'Sunrise Glacier Hike on Sólheimajökull',
            description: 'Technical ice climbing with crampons and ice axes',
            type: 'adventure',
            duration: '4 hours',
            cost: 180,
            rating: 4.9,
            whyThisFits: 'High adventure score demands real challenges',
          },
          {
            id: 'adrenaline-2',
            time: '11:30',
            title: 'Quick Fuel at Friðheimar',
            description: 'Fast tomato soup stop before the next adventure',
            type: 'dining',
            duration: '45 min',
            cost: 35,
            rating: 4.9,
            whyThisFits: 'Efficient refuel between activities',
          },
          {
            id: 'adrenaline-3',
            time: '13:00',
            title: 'Snorkeling Silfra Fissure',
            description: 'Dive between tectonic plates in crystal-clear glacial water',
            type: 'adventure',
            duration: '3 hours',
            cost: 175,
            rating: 4.8,
            whyThisFits: 'Bucket-list adventure, visibility 100m+',
          },
          {
            id: 'adrenaline-4',
            time: '16:30',
            title: 'ATV Ride to Geysir Geothermal Area',
            description: 'Off-road adventure to watch Strokkur erupt',
            type: 'adventure',
            duration: '2 hours',
            cost: 120,
            rating: 4.7,
            whyThisFits: 'Why walk when you can ride?',
          },
          {
            id: 'adrenaline-5',
            time: '19:00',
            title: 'Northern Lights Super Jeep Hunt',
            description: 'Chase the aurora in a modified 4x4 with expert guide',
            type: 'adventure',
            duration: '4 hours',
            cost: 200,
            rating: 4.8,
            whyThisFits: 'Adventure doesn\'t stop at sunset',
          },
        ],
      },
    ],
  },
};

// ============================================================================
// COMPONENT
// ============================================================================

export function DemoArchetypeComparison() {
  const [selectedArchetype, setSelectedArchetype] = useState<0 | 1>(0);
  const data = COMPARISON_DATA.iceland;
  const currentItinerary = data.archetypes[selectedArchetype];
  const otherItinerary = data.archetypes[selectedArchetype === 0 ? 1 : 0];

  const typeColors: Record<string, string> = {
    adventure: 'bg-orange-100 text-orange-700 border-orange-200',
    relaxation: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    dining: 'bg-amber-100 text-amber-700 border-amber-200',
    sightseeing: 'bg-blue-100 text-blue-700 border-blue-200',
    transportation: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <section className="py-16 md:py-24 bg-gradient-to-b from-background to-muted/30">
      <div className="container max-w-6xl mx-auto px-4">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <Badge variant="outline" className="mb-4 px-3 py-1">
            <Sparkles className="h-3 w-3 mr-1.5" />
            Personalization in Action
          </Badge>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">
            Same Destination. <span className="text-primary">Different Journey.</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Watch how the same Iceland trip transforms based on who's traveling.
            Toggle between archetypes to see the difference instantly.
          </p>
        </motion.div>

        {/* Archetype Toggle - Mobile optimized */}
        <div className="flex justify-center mb-8 px-2">
          <div className="inline-flex bg-muted rounded-full p-1 gap-1 w-full max-w-md md:w-auto">
            {data.archetypes.map((arch, idx) => {
              const Icon = arch.archetype.icon;
              const isActive = selectedArchetype === idx;
              return (
                <button
                  key={arch.archetype.id}
                  onClick={() => setSelectedArchetype(idx as 0 | 1)}
                  className={cn(
                    "flex items-center justify-center gap-1.5 md:gap-2 flex-1 md:flex-initial px-3 md:px-4 py-2.5 rounded-full text-xs md:text-sm font-medium transition-all",
                    isActive 
                      ? "bg-background shadow-md text-foreground" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", isActive && arch.archetype.color)} />
                  <span className="truncate">{arch.archetype.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Comparison View */}
        <div className="grid md:grid-cols-2 gap-6 md:gap-8">
          {/* Active Itinerary */}
          <motion.div
            key={currentItinerary.archetype.id}
            initial={{ opacity: 0, x: selectedArchetype === 0 ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="order-1"
          >
            <div className={cn(
              "rounded-2xl border-2 border-primary/50 bg-gradient-to-br p-6 shadow-lg",
              currentItinerary.archetype.bgGradient
            )}>
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {(() => {
                      const Icon = currentItinerary.archetype.icon;
                      return <Icon className={cn("h-5 w-5", currentItinerary.archetype.color)} />;
                    })()}
                    <span className="font-medium text-foreground">
                      {currentItinerary.archetype.name}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground italic">
                    "{currentItinerary.archetype.tagline}"
                  </p>
                </div>
                <Badge variant="secondary" className="text-xs">
                  Active
                </Badge>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3 mb-6 p-3 bg-background/50 rounded-lg">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Pace</p>
                  <p className="font-medium text-sm">{currentItinerary.pace}</p>
                </div>
                <div className="text-center border-x border-border/50">
                  <p className="text-xs text-muted-foreground">Style</p>
                  <p className="font-medium text-sm">{currentItinerary.style}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Daily</p>
                  <p className="font-medium text-sm">${currentItinerary.dailyBudget}</p>
                </div>
              </div>

              {/* Day Header */}
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{data.destination}</span>
                <span className="text-sm text-muted-foreground">•</span>
                <span className="text-sm text-muted-foreground">{data.date}</span>
              </div>

              {/* Activities */}
              <div className="space-y-3">
                <AnimatePresence mode="wait">
                  {currentItinerary.activities.map((activity, idx) => (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="bg-background rounded-lg p-3 shadow-sm border border-border/50"
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-xs font-mono text-muted-foreground w-12 pt-0.5">
                          {activity.time}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className="font-medium text-sm leading-tight">
                              {activity.title}
                            </h4>
                            {activity.rating && (
                              <div className="flex items-center gap-0.5 text-xs text-amber-600">
                                <Star className="h-3 w-3 fill-current" />
                                {activity.rating}
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {activity.description}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <Badge 
                              variant="outline" 
                              className={cn("text-[10px] py-0", typeColors[activity.type])}
                            >
                              {activity.type}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Clock className="h-2.5 w-2.5" />
                              {activity.duration}
                            </span>
                            {activity.cost > 0 && (
                              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                <DollarSign className="h-2.5 w-2.5" />
                                {activity.cost}
                              </span>
                            )}
                          </div>
                          {/* Why This Fits */}
                          <div className="mt-2 flex items-start gap-1.5 p-1.5 bg-primary/5 rounded text-[10px] text-primary">
                            <Sparkles className="h-3 w-3 shrink-0 mt-0.5" />
                            <span>{activity.whyThisFits}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>

          {/* Preview of Other Archetype */}
          <div className="order-2 hidden md:block">
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 p-6 opacity-60 hover:opacity-80 transition-opacity">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  {(() => {
                    const Icon = otherItinerary.archetype.icon;
                    return <Icon className={cn("h-5 w-5", otherItinerary.archetype.color)} />;
                  })()}
                  <span className="font-medium text-muted-foreground">
                    {otherItinerary.archetype.name}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedArchetype(selectedArchetype === 0 ? 1 : 0)}
                  className="text-xs text-primary flex items-center gap-1 hover:underline"
                >
                  Switch to this
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>

              {/* Faded activities preview */}
              <div className="space-y-2">
                {otherItinerary.activities.slice(0, 3).map((activity) => (
                  <div 
                    key={activity.id}
                    className="bg-background/50 rounded-lg p-2.5 border border-border/30"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {activity.time}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {activity.title}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="text-center text-xs text-muted-foreground py-2">
                  +{otherItinerary.activities.length - 3} more activities
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile: Other archetype hint */}
        <div className="md:hidden mt-4 text-center">
          <button
            onClick={() => setSelectedArchetype(selectedArchetype === 0 ? 1 : 0)}
            className="text-sm text-primary flex items-center gap-1 mx-auto hover:underline"
          >
            See how {otherItinerary.archetype.name} would experience this
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Key Differences Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="mt-12 text-center"
        >
          <div className="inline-flex flex-wrap justify-center gap-4 p-4 bg-muted/50 rounded-xl">
            <div className="text-center px-4">
              <p className="text-2xl font-bold text-foreground">
                {data.archetypes[0].activities.length} vs {data.archetypes[1].activities.length}
              </p>
              <p className="text-xs text-muted-foreground">Activities per day</p>
            </div>
            <div className="text-center px-4 border-x border-border">
              <p className="text-2xl font-bold text-foreground">
                ${data.archetypes[0].dailyBudget} vs ${data.archetypes[1].dailyBudget}
              </p>
              <p className="text-xs text-muted-foreground">Daily budget</p>
            </div>
            <div className="text-center px-4">
              <p className="text-2xl font-bold text-foreground">
                10am vs 7am
              </p>
              <p className="text-xs text-muted-foreground">First activity</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
