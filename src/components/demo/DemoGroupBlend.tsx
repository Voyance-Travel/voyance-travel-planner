/**
 * Demo Group Blend Component
 * 
 * Shows how two different traveler profiles blend into
 * a single optimized group itinerary.
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, Sparkles, Zap, Leaf, Heart,
  Clock, MapPin, Star, DollarSign, ArrowRight
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { formatTime12h } from '@/utils/timeFormat';

interface TravelerProfile {
  name: string;
  archetype: string;
  icon: typeof Zap;
  color: string;
  dailyBudget: number;
  traits: {
    pace: number; // 1-10, 1=slow, 10=fast
    adventure: number;
    comfort: number;
    social: number;
  };
}

interface BlendedActivity {
  id: string;
  time: string;
  title: string;
  type: 'adventure' | 'relaxation' | 'dining' | 'sightseeing';
  satisfies: ('alex' | 'jordan')[];
  compromise?: string;
  cost: number;
}

const TRAVELERS: [TravelerProfile, TravelerProfile] = [
  {
    name: 'Alex',
    archetype: 'Adrenaline Architect',
    icon: Zap,
    color: 'text-orange-600',
    dailyBudget: 450,
    traits: { pace: 9, adventure: 10, comfort: 6, social: 6 },
  },
  {
    name: 'Jordan',
    archetype: 'Slow Traveler',
    icon: Leaf,
    color: 'text-emerald-600',
    dailyBudget: 280,
    traits: { pace: 3, adventure: 4, comfort: 8, social: 8 },
  },
];

const BLENDED_ITINERARY: BlendedActivity[] = [
  {
    id: 'blend-1',
    time: '09:00',
    title: 'Scenic Glacier Walk (Beginner-Friendly)',
    type: 'adventure',
    satisfies: ['alex', 'jordan'],
    compromise: 'Adventure for Alex, gentle pace for Jordan',
    cost: 95,
  },
  {
    id: 'blend-2',
    time: '13:00',
    title: 'Friðheimar Tomato Farm Lunch',
    type: 'dining',
    satisfies: ['alex', 'jordan'],
    cost: 55,
  },
  {
    id: 'blend-3',
    time: '15:30',
    title: 'Secret Lagoon Hot Springs',
    type: 'relaxation',
    satisfies: ['jordan'],
    compromise: 'Jordan\'s restoration time while Alex explores nearby',
    cost: 45,
  },
  {
    id: 'blend-4',
    time: '15:30',
    title: 'ATV Exploration (Solo Add-On)',
    type: 'adventure',
    satisfies: ['alex'],
    compromise: 'Alex gets extra thrills during Jordan\'s downtime',
    cost: 120,
  },
  {
    id: 'blend-5',
    time: '18:30',
    title: 'Northern Lights Viewing Dinner',
    type: 'dining',
    satisfies: ['alex', 'jordan'],
    compromise: 'Shared experience with aurora backdrop',
    cost: 85,
  },
];

const COMPATIBILITY_SCORE = 72;

export function DemoGroupBlend() {
  const [showBlend, setShowBlend] = useState(false);

  const typeColors: Record<string, string> = {
    adventure: 'bg-orange-100 text-orange-700 border-orange-200',
    relaxation: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    dining: 'bg-amber-100 text-amber-700 border-amber-200',
    sightseeing: 'bg-blue-100 text-blue-700 border-blue-200',
  };

  return (
    <section className="py-16 md:py-24 bg-muted/20">
      <div className="container max-w-5xl mx-auto px-4">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <Badge variant="outline" className="mb-4 px-3 py-1">
            <Users className="h-3 w-3 mr-1.5" />
            Group Travel
          </Badge>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">
            Traveling Together? <span className="text-primary">We Blend Preferences.</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            When two different travelers plan together, our AI finds the perfect balance - 
            shared experiences and solo moments that make everyone happy.
          </p>
        </motion.div>

        {/* Traveler Profiles */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {TRAVELERS.map((traveler, idx) => {
            const Icon = traveler.icon;
            return (
              <motion.div
                key={traveler.name}
                initial={{ opacity: 0, x: idx === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="bg-card rounded-xl border p-5"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      idx === 0 ? "bg-orange-100" : "bg-emerald-100"
                    )}>
                      <Icon className={cn("h-5 w-5", traveler.color)} />
                    </div>
                    <div>
                      <h3 className="font-semibold">{traveler.name}</h3>
                      <p className="text-sm text-muted-foreground">{traveler.archetype}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold">${traveler.dailyBudget}</p>
                    <p className="text-xs text-muted-foreground">per day</p>
                  </div>
                </div>

                {/* Trait Bars */}
                <div className="space-y-3">
                  {Object.entries(traveler.traits).map(([trait, value]) => (
                    <div key={trait} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground capitalize">{trait}</span>
                        <span className="font-medium">{value}/10</span>
                      </div>
                      <Progress 
                        value={value * 10} 
                        className={cn(
                          "h-1.5",
                          idx === 0 ? "[&>div]:bg-orange-500" : "[&>div]:bg-emerald-500"
                        )}
                      />
                    </div>
                  ))}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Compatibility Score */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="flex flex-col items-center mb-8"
        >
          <button
            onClick={() => setShowBlend(!showBlend)}
            className="group flex items-center gap-3 px-6 py-3 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-all shadow-lg hover:shadow-xl"
          >
            <Heart className="h-5 w-5" />
            <span className="font-medium">Compatibility: {COMPATIBILITY_SCORE}%</span>
            <ArrowRight className={cn(
              "h-4 w-4 transition-transform",
              showBlend && "rotate-90"
            )} />
          </button>
          <p className="text-sm text-muted-foreground mt-2">
            {showBlend ? 'See how we blend their preferences' : 'Click to see the blended itinerary'}
          </p>
        </motion.div>

        {/* Blended Itinerary */}
        {showBlend && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-card rounded-2xl border-2 border-primary/30 p-6 shadow-lg"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h3 className="font-semibold text-lg">Blended Day in Iceland</h3>
                <Badge variant="secondary">Golden Circle</Badge>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-muted rounded-full">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">$365</span>
                <span className="text-xs text-muted-foreground">blended budget</span>
              </div>
            </div>

            <div className="space-y-4">
              {BLENDED_ITINERARY.map((activity, idx) => {
                const isShared = activity.satisfies.length === 2;
                const isAlexOnly = activity.satisfies.length === 1 && activity.satisfies[0] === 'alex';
                const isJordanOnly = activity.satisfies.length === 1 && activity.satisfies[0] === 'jordan';

                return (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.08 }}
                    className={cn(
                      "rounded-lg p-4 border",
                      isShared && "bg-gradient-to-r from-orange-50/50 via-background to-emerald-50/50 border-primary/20",
                      isAlexOnly && "bg-orange-50/50 border-orange-200 ml-0 md:mr-24",
                      isJordanOnly && "bg-emerald-50/50 border-emerald-200 ml-0 md:ml-24"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="text-xs font-mono text-muted-foreground w-14 pt-0.5">
                        {activity.time}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-medium text-sm">{activity.title}</h4>
                          <Badge 
                            variant="outline" 
                            className={cn("text-[10px] py-0", typeColors[activity.type])}
                          >
                            {activity.type}
                          </Badge>
                          {activity.cost > 0 && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 ml-auto">
                              <DollarSign className="h-2.5 w-2.5" />
                              {activity.cost}
                            </span>
                          )}
                        </div>

                        {/* Who this satisfies */}
                        <div className="flex items-center gap-2 mt-2">
                          {isShared ? (
                            <div className="flex items-center gap-1.5 text-xs">
                              <div className="flex -space-x-1">
                                <div className="w-5 h-5 rounded-full bg-orange-100 flex items-center justify-center border-2 border-white">
                                  <Zap className="h-2.5 w-2.5 text-orange-600" />
                                </div>
                                <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center border-2 border-white">
                                  <Leaf className="h-2.5 w-2.5 text-emerald-600" />
                                </div>
                              </div>
                              <span className="text-muted-foreground">Both travelers</span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-xs">
                              <div className={cn(
                                "w-5 h-5 rounded-full flex items-center justify-center",
                                isAlexOnly ? "bg-orange-100" : "bg-emerald-100"
                              )}>
                                {isAlexOnly ? (
                                  <Zap className="h-2.5 w-2.5 text-orange-600" />
                                ) : (
                                  <Leaf className="h-2.5 w-2.5 text-emerald-600" />
                                )}
                              </div>
                              <span className="text-muted-foreground">
                                {isAlexOnly ? 'Alex only' : 'Jordan only'}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Compromise note */}
                        {activity.compromise && (
                          <div className="mt-2 flex items-start gap-1.5 p-2 bg-primary/5 rounded text-[11px] text-primary">
                            <Sparkles className="h-3 w-3 shrink-0 mt-0.5" />
                            <span>{activity.compromise}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Summary */}
            <div className="mt-6 pt-4 border-t flex flex-wrap gap-4 justify-center text-sm">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-1">
                  <div className="w-4 h-4 rounded-full bg-orange-100 border border-white" />
                  <div className="w-4 h-4 rounded-full bg-emerald-100 border border-white" />
                </div>
                <span className="text-muted-foreground">3 shared experiences</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-orange-100" />
                <span className="text-muted-foreground">1 Alex solo add-on</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full bg-emerald-100" />
                <span className="text-muted-foreground">1 Jordan solo time</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </section>
  );
}
