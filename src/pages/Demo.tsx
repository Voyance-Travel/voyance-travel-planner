import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Play, ChevronRight, MapPin, Calendar, Users, 
  Check, Wand2, RefreshCw, Lock, Download, Share2,
  Clock, DollarSign, Plane, Hotel, Utensils, Camera
} from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getItineraryBySlug } from '@/data/sampleItineraries';

// Demo feature sections
const DEMO_FEATURES = [
  {
    id: 'quiz',
    title: 'Travel DNA Quiz',
    description: 'Personalized preferences in 2 minutes',
    icon: Sparkles,
    color: 'from-violet-500 to-purple-600',
  },
  {
    id: 'generate',
    title: 'AI Itinerary Generation',
    description: 'Watch AI build your perfect trip',
    icon: Wand2,
    color: 'from-blue-500 to-cyan-500',
  },
  {
    id: 'customize',
    title: 'Smart Customization',
    description: 'Swap activities, lock favorites',
    icon: RefreshCw,
    color: 'from-emerald-500 to-teal-500',
  },
  {
    id: 'optimize',
    title: 'Route Optimization',
    description: 'AI-powered logistics planning',
    icon: MapPin,
    color: 'from-orange-500 to-amber-500',
  },
];

const SAMPLE_DESTINATIONS = [
  { slug: 'bali-wellness', name: 'Bali, Indonesia', days: 5, style: 'Wellness & Luxury' },
  { slug: 'kyoto-culture', name: 'Kyoto, Japan', days: 7, style: 'Cultural Immersion' },
  { slug: 'santorini-romance', name: 'Santorini, Greece', days: 4, style: 'Romantic Escape' },
  { slug: 'iceland-adventure', name: 'Iceland', days: 6, style: 'Adventure' },
];

// Activity card component for demo
function DemoActivityCard({ 
  activity,
  isLocked,
  onLock,
  onSwap 
}: { 
  activity: { 
    id: string;
    title: string;
    time: string;
    duration: string;
    type: string;
    cost: number;
    rating?: number;
    location?: { name: string };
  };
  isLocked: boolean;
  onLock: () => void;
  onSwap: () => void;
}) {
  const typeIcons: Record<string, React.ReactNode> = {
    transportation: <Plane className="h-4 w-4" />,
    accommodation: <Hotel className="h-4 w-4" />,
    dining: <Utensils className="h-4 w-4" />,
    cultural: <Camera className="h-4 w-4" />,
    activity: <Camera className="h-4 w-4" />,
    relaxation: <Sparkles className="h-4 w-4" />,
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "p-4 bg-card border rounded-lg transition-all group",
        isLocked && "border-primary/50 bg-primary/5"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="p-2 bg-secondary rounded-lg">
            {typeIcons[activity.type] || <MapPin className="h-4 w-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-medium text-sm truncate">{activity.title}</h4>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <Clock className="h-3 w-3" />
              <span>{activity.time} · {activity.duration}</span>
            </div>
            {activity.location?.name && (
              <p className="text-xs text-muted-foreground mt-1 truncate">
                {activity.location.name}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onLock}>
            <Lock className={cn("h-3.5 w-3.5", isLocked && "text-primary")} />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onSwap}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {activity.cost > 0 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
          <DollarSign className="h-3 w-3" />
          <span>${activity.cost}</span>
        </div>
      )}
    </motion.div>
  );
}

export default function Demo() {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [selectedDestination, setSelectedDestination] = useState(SAMPLE_DESTINATIONS[0]);
  const [itineraryData, setItineraryData] = useState<ReturnType<typeof getItineraryBySlug> | null>(null);
  const [lockedActivities, setLockedActivities] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);

  // Load sample itinerary
  useEffect(() => {
    const data = getItineraryBySlug(selectedDestination.slug);
    setItineraryData(data);
    setLockedActivities(new Set());
  }, [selectedDestination]);

  // Simulate AI generation
  const handleDemoGeneration = () => {
    setIsGenerating(true);
    setGenerationStep(0);
    
    const steps = ['Analyzing preferences...', 'Finding activities...', 'Optimizing schedule...', 'Building itinerary...', 'Complete!'];
    let step = 0;
    
    const interval = setInterval(() => {
      step++;
      setGenerationStep(step);
      if (step >= steps.length) {
        clearInterval(interval);
        setTimeout(() => {
          setIsGenerating(false);
          setActiveSection('itinerary');
        }, 500);
      }
    }, 800);
  };

  const toggleLock = (activityId: string) => {
    setLockedActivities(prev => {
      const next = new Set(prev);
      if (next.has(activityId)) {
        next.delete(activityId);
      } else {
        next.add(activityId);
      }
      return next;
    });
  };

  const handleSwapDemo = () => {
    // Just show toast for demo
    import('sonner').then(({ toast }) => {
      toast.info('In the full version, AI suggests alternatives based on your preferences');
    });
  };

  const generationSteps = [
    'Analyzing preferences...',
    'Finding activities...',
    'Optimizing schedule...',
    'Building itinerary...',
    'Complete!'
  ];

  return (
    <MainLayout>
      <Head 
        title="Demo | Voyance"
        description="Experience Voyance's AI-powered trip planning capabilities. See how we build personalized itineraries in minutes."
      />

      {/* Hero Section */}
      <section className="relative py-20 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-accent/5 to-background" />
        <div className="max-w-7xl mx-auto px-4 relative">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center max-w-3xl mx-auto"
          >
            <Badge variant="secondary" className="mb-4">
              <Sparkles className="h-3 w-3 mr-1" />
              Interactive Demo
            </Badge>
            <h1 className="text-4xl md:text-6xl font-serif font-bold mb-4">
              See Voyance in Action
            </h1>
            <p className="text-lg text-muted-foreground mb-8">
              Experience our AI-powered itinerary builder. No sign-up required. 
              No payment needed. Just pure travel planning magic.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button size="lg" onClick={handleDemoGeneration} disabled={isGenerating}>
                <Play className="h-4 w-4 mr-2" />
                {isGenerating ? 'Generating...' : 'Watch AI Build a Trip'}
              </Button>
              <Button size="lg" variant="outline" onClick={() => navigate('/quiz')}>
                Take the Quiz
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Generation Animation Overlay */}
      <AnimatePresence>
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-card border rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl"
            >
              <div className="text-center mb-6">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="inline-flex p-4 bg-primary/10 rounded-full mb-4"
                >
                  <Wand2 className="h-8 w-8 text-primary" />
                </motion.div>
                <h2 className="text-xl font-serif font-bold mb-2">Building Your Itinerary</h2>
                <p className="text-muted-foreground text-sm">AI is crafting the perfect trip...</p>
              </div>
              <div className="space-y-3">
                {generationSteps.map((step, index) => (
                  <motion.div
                    key={step}
                    initial={{ opacity: 0.5 }}
                    animate={{ 
                      opacity: index <= generationStep ? 1 : 0.5,
                    }}
                    className="flex items-center gap-3"
                  >
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs transition-colors",
                      index < generationStep 
                        ? "bg-primary text-primary-foreground" 
                        : index === generationStep
                          ? "bg-primary/20 text-primary animate-pulse"
                          : "bg-muted text-muted-foreground"
                    )}>
                      {index < generationStep ? <Check className="h-3 w-3" /> : index + 1}
                    </div>
                    <span className={cn(
                      "text-sm",
                      index <= generationStep ? "text-foreground" : "text-muted-foreground"
                    )}>
                      {step}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Feature Cards */}
      <section className="py-16 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-2xl font-serif font-bold text-center mb-8">
            What You Can Do
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {DEMO_FEATURES.map((feature, index) => (
              <motion.div
                key={feature.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group"
                      onClick={() => setActiveSection(feature.id)}>
                  <CardHeader className="pb-3">
                    <div className={cn(
                      "w-10 h-10 rounded-lg bg-gradient-to-br flex items-center justify-center mb-2",
                      feature.color
                    )}>
                      <feature.icon className="h-5 w-5 text-white" />
                    </div>
                    <CardTitle className="text-lg group-hover:text-primary transition-colors">
                      {feature.title}
                    </CardTitle>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardHeader>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive Demo Area */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid lg:grid-cols-12 gap-8">
            {/* Sidebar - Destination Picker */}
            <div className="lg:col-span-3">
              <div className="sticky top-24 space-y-4">
                <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wider">
                  Sample Destinations
                </h3>
                <div className="space-y-2">
                  {SAMPLE_DESTINATIONS.map((dest) => (
                    <button
                      key={dest.slug}
                      onClick={() => setSelectedDestination(dest)}
                      className={cn(
                        "w-full p-3 rounded-lg text-left transition-all",
                        selectedDestination.slug === dest.slug
                          ? "bg-primary text-primary-foreground"
                          : "bg-card border hover:border-primary/50"
                      )}
                    >
                      <div className="font-medium text-sm">{dest.name}</div>
                      <div className={cn(
                        "text-xs mt-1",
                        selectedDestination.slug === dest.slug
                          ? "text-primary-foreground/70"
                          : "text-muted-foreground"
                      )}>
                        {dest.days} days · {dest.style}
                      </div>
                    </button>
                  ))}
                </div>

                <div className="pt-4 border-t">
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={() => navigate('/start?mode=itinerary')}
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Plan Your Own Trip
                  </Button>
                </div>
              </div>
            </div>

            {/* Main Content - Itinerary Preview */}
            <div className="lg:col-span-9">
              {itineraryData && (
                <div className="space-y-6">
                  {/* Trip Header */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <Badge variant="secondary" className="mb-2">Sample Itinerary</Badge>
                          <h2 className="text-2xl font-serif font-bold">{itineraryData.destination}</h2>
                          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {itineraryData.days.length} Days
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              2 Travelers
                            </span>
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-4 w-4" />
                              ~${(itineraryData.flightCost + itineraryData.hotelCost + itineraryData.days.reduce((s, d) => s + d.totalCost, 0)).toLocaleString()}
                            </span>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => {
                            import('sonner').then(({ toast }) => {
                              toast.info('Export available in full version');
                            });
                          }}>
                            <Download className="h-4 w-4 mr-1" />
                            Export
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => {
                            import('sonner').then(({ toast }) => {
                              toast.info('Sharing available in full version');
                            });
                          }}>
                            <Share2 className="h-4 w-4 mr-1" />
                            Share
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Days */}
                  {itineraryData.days.slice(0, 3).map((day, dayIndex) => (
                    <motion.div
                      key={day.dayNumber}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: dayIndex * 0.1 }}
                    >
                      <Card>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <Badge variant="outline" className="mb-2">Day {day.dayNumber}</Badge>
                              <CardTitle className="text-lg">{day.theme}</CardTitle>
                              <CardDescription>{day.description}</CardDescription>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-serif">${day.totalCost}</div>
                              <div className="text-xs text-muted-foreground">estimated</div>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="space-y-3">
                            {day.activities.slice(0, 4).map((activity) => (
                              <DemoActivityCard
                                key={activity.id}
                                activity={activity}
                                isLocked={lockedActivities.has(activity.id)}
                                onLock={() => toggleLock(activity.id)}
                                onSwap={handleSwapDemo}
                              />
                            ))}
                            {day.activities.length > 4 && (
                              <p className="text-center text-sm text-muted-foreground py-2">
                                + {day.activities.length - 4} more activities
                              </p>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}

                  {/* View More CTA */}
                  {itineraryData.days.length > 3 && (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">
                        + {itineraryData.days.length - 3} more days in this itinerary
                      </p>
                      <Button onClick={() => navigate(`/sample-itinerary?destination=${selectedDestination.slug}`)}>
                        View Full Sample
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary/10 via-accent/10 to-background">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">
            Ready to Plan Your Trip?
          </h2>
          <p className="text-lg text-muted-foreground mb-8">
            Create your personalized itinerary in minutes. Start with the Travel DNA Quiz 
            to get recommendations tailored to your travel style.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button size="lg" onClick={() => navigate('/quiz')}>
              <Sparkles className="h-4 w-4 mr-2" />
              Take Travel DNA Quiz
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate('/start?mode=itinerary')}>
              Skip to Planning
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </section>
    </MainLayout>
  );
}
