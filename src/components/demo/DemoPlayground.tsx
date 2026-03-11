import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SafeImage from '@/components/SafeImage';
import { 
  MapPin, Clock, Lock, RefreshCw, Star, 
  ChevronDown, Sparkles, 
  DollarSign, Sun, Cloud, Utensils, Camera, Compass, Hotel, Car,
  Route, MessageSquare, CreditCard, Heart, Zap, ExternalLink,
  Users, UserPlus, X, GripVertical, Trash2, Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getItineraryBySlug } from '@/data/sampleItineraries';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const DESTINATIONS = [
  { slug: 'bali-wellness', name: 'Bali', subtitle: 'Wellness & Temples', image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=600' },
  { slug: 'kyoto-culture', name: 'Kyoto', subtitle: 'Culture & Gardens', image: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=600' },
  { slug: 'santorini-romance', name: 'Santorini', subtitle: 'Romance & Sunsets', image: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=600' },
  { slug: 'iceland-adventure', name: 'Iceland', subtitle: 'Adventure & Nature', image: 'https://images.unsplash.com/photo-1504829857797-ddff29c27927?w=600' },
];

const GROUP_MEMBERS = [
  { id: 'you', name: 'You', initials: 'Y', color: 'bg-primary', interests: ['Relaxation', 'Food'] },
  { id: 'alex', name: 'Alex', initials: 'A', color: 'bg-emerald-500', interests: ['Adventure', 'Culture'] },
  { id: 'sam', name: 'Sam', initials: 'S', color: 'bg-amber-500', interests: ['Photography', 'Nature'] },
];

const DEMO_FEATURES = [
  { 
    icon: Users, 
    label: 'Group Travel', 
    description: 'Blend everyone\'s tastes',
    color: 'text-indigo-600'
  },
  { 
    icon: Lock, 
    label: 'Lock Favorites', 
    description: 'Keep activities you love',
    color: 'text-primary'
  },
  { 
    icon: RefreshCw, 
    label: 'Smart Swap', 
    description: 'AI suggests alternatives',
    color: 'text-emerald-600'
  },
  { 
    icon: Star, 
    label: 'Real Reviews', 
    description: 'Aggregated from 3 sources',
    color: 'text-amber-500'
  },
  { 
    icon: Route, 
    label: 'Route Optimization', 
    description: 'Save 45+ mins daily',
    color: 'text-blue-600'
  },
  { 
    icon: Heart, 
    label: 'Learns Your Taste', 
    description: 'Gets smarter over time',
    color: 'text-rose-500'
  },
];

// Convert 24-hour time to 12-hour AM/PM format
const formatTime12h = (time24: string): string => {
  const [hours, minutes] = time24.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  return `${hours12}:${minutes.toString().padStart(2, '0')} ${period}`;
};

export function DemoPlayground() {
  const navigate = useNavigate();
  const [selectedDest, setSelectedDest] = useState(DESTINATIONS[0]);
  const [itinerary, setItinerary] = useState<ReturnType<typeof getItineraryBySlug>>(null);
  const [dayActivities, setDayActivities] = useState<Record<number, typeof itinerary extends { days: infer D } ? D extends Array<{ activities: infer A }> ? A : never : never>>({});
  const [lockedActivities, setLockedActivities] = useState<Set<string>>(new Set());
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([1]));
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showReviewsFor, setShowReviewsFor] = useState<string | null>(null);
  const [groupMembers, setGroupMembers] = useState([GROUP_MEMBERS[0]]);
  const [isBlending, setIsBlending] = useState(false);
  const [hasBlended, setHasBlended] = useState(false);

  // Drag and drop sensors
  const pointerSensor = useSensor(PointerSensor, {
    activationConstraint: { distance: 8 },
  });
  const keyboardSensor = useSensor(KeyboardSensor, {
    coordinateGetter: sortableKeyboardCoordinates,
  });
  const sensors = useSensors(pointerSensor, keyboardSensor);

  useEffect(() => {
    const data = getItineraryBySlug(selectedDest.slug);
    setItinerary(data);
    setLockedActivities(new Set());
    setExpandedDays(new Set([1]));
    setHasBlended(false);
    // Initialize day activities
    if (data) {
      const activities: Record<number, any> = {};
      data.days.forEach(day => {
        activities[day.dayNumber] = [...day.activities];
      });
      setDayActivities(activities);
    }
  }, [selectedDest]);

  const handleDragEnd = (dayNumber: number) => (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const activities = dayActivities[dayNumber] || [];
      const oldIndex = activities.findIndex((a: any) => a.id === active.id);
      const newIndex = activities.findIndex((a: any) => a.id === over.id);
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newActivities = arrayMove(activities, oldIndex, newIndex);
        setDayActivities(prev => ({ ...prev, [dayNumber]: newActivities }));
        toast.success('Activity reordered!', {
          description: 'Drag activities to customize your day.',
          icon: <GripVertical className="h-4 w-4" />,
        });
      }
    }
  };

  const toggleDay = (dayNumber: number) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dayNumber)) {
        next.delete(dayNumber);
      } else {
        next.add(dayNumber);
      }
      return next;
    });
  };

  const { user } = useAuth();
  const demoCta = {
    label: 'Build My Trip',
    onClick: () => navigate(user ? '/start' : '/auth?redirect=/start'),
  };

  const handleOptimize = () => {
    setIsOptimizing(true);
    setTimeout(() => {
      setIsOptimizing(false);
      toast.success('Routes optimized! Save 47 mins daily on your own trip.', {
        description: 'This is a demo itinerary. Create your own trip to use this feature!',
        icon: <Route className="h-4 w-4" />,
        action: demoCta,
      });
    }, 1500);
  };

  const toggleLock = (activityId: string, activityTitle: string) => {
    setLockedActivities(prev => {
      const next = new Set(prev);
      if (next.has(activityId)) {
        next.delete(activityId);
        toast('Unlocked', { description: `"${activityTitle}" can be swapped. Build your own trip to keep your favorites!`, action: demoCta });
      } else {
        next.add(activityId);
        toast.success('Locked!', { description: `"${activityTitle}" stays in your trip. Try it on your own itinerary!`, action: demoCta });
      }
      return next;
    });
  };

  const handleSwap = (activityTitle: string) => {
    toast.info('This is a demo itinerary. Create your own trip to swap activities!', {
      description: 'AI will find alternatives matching your Travel DNA.',
      duration: 4000,
      action: demoCta,
    });
  };

  const handleViewReviews = (activityTitle: string, activityId: string) => {
    setShowReviewsFor(activityId);
    setTimeout(() => setShowReviewsFor(null), 3000);
  };

  const handleBook = (activityTitle: string) => {
    toast.info('This is a demo itinerary. Create your own trip to book activities!', {
      description: `In your trip, you'll book "${activityTitle}" directly through our partners.`,
      action: demoCta,
    });
  };

  const handleDelete = (activityTitle: string) => {
    toast.info('This is a demo itinerary. Create your own trip to customize activities!', {
      icon: <Trash2 className="h-4 w-4" />,
      action: demoCta,
    });
  };

  const handleAddCustom = () => {
    toast.info('This is a demo itinerary. Create your own trip to add custom activities!', {
      description: 'Search any experience, restaurant, or attraction to add.',
      icon: <Plus className="h-4 w-4" />,
      action: demoCta,
    });
  };

  const addGroupMember = () => {
    const available = GROUP_MEMBERS.filter(m => !groupMembers.find(gm => gm.id === m.id));
    if (available.length > 0) {
      setGroupMembers([...groupMembers, available[0]]);
      toast.success(`${available[0].name} joined the trip!`, {
        description: `Interests: ${available[0].interests.join(', ')}`,
      });
    }
  };

  const removeGroupMember = (memberId: string) => {
    if (memberId === 'you') return;
    setGroupMembers(groupMembers.filter(m => m.id !== memberId));
    setHasBlended(false);
  };

  const handleBlendPreferences = () => {
    if (groupMembers.length < 2) {
      toast.error('Add at least one friend to blend preferences');
      return;
    }
    setIsBlending(true);
    setTimeout(() => {
      setIsBlending(false);
      setHasBlended(true);
      toast.success('Preferences blended!', {
        description: 'Itinerary now balances everyone\'s interests.',
        icon: <Heart className="h-4 w-4" />,
      });
    }, 1800);
  };

  if (!itinerary) return null;

  const totalCost = itinerary.days.reduce((sum, d) => sum + (d.totalCost || 0), 0);
  const totalActivities = itinerary.days.reduce((sum, d) => sum + d.activities.length, 0);

  return (
    <section id="playground" className="py-20 bg-background">
      <div className="max-w-5xl mx-auto px-4">
        {/* Section header */}
        <div className="text-center mb-10">
          <Badge variant="outline" className="mb-4 px-3 py-1 text-xs">
            <MapPin className="h-3 w-3 mr-1.5" />
            Sample Itinerary
          </Badge>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-3">
            See It in Action
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            This is exactly how your trip looks. Interact with every feature below.
          </p>
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-10">
          {DEMO_FEATURES.map((feature, idx) => (
            <motion.div
              key={feature.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="text-center p-3 rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
            >
              <feature.icon className={cn("h-5 w-5 mx-auto mb-2", feature.color)} />
              <p className="text-xs font-medium">{feature.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 hidden sm:block">{feature.description}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid lg:grid-cols-[1fr_280px] gap-6">
          {/* Main itinerary */}
          <div>
            {/* Destination selector */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
              {DESTINATIONS.map((dest) => (
                <button
                  key={dest.slug}
                  onClick={() => setSelectedDest(dest)}
                  className={cn(
                    "relative rounded-lg overflow-hidden transition-all aspect-[4/3] group",
                    selectedDest.slug === dest.slug
                      ? "ring-2 ring-primary shadow-lg"
                      : "opacity-60 hover:opacity-100"
                  )}
                >
                  <SafeImage src={dest.image} alt={dest.name} className="absolute inset-0 w-full h-full object-cover" fallbackCategory="sightseeing" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                  <div className="absolute inset-x-0 bottom-0 p-2 text-white text-left">
                    <p className="font-medium text-sm leading-tight">{dest.name}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Trip overview */}
            <Card className="mb-4 overflow-hidden border-border/50">
              <div className="relative h-24">
                <SafeImage src={selectedDest.image} alt={itinerary.destination} className="w-full h-full object-cover" fallbackCategory="sightseeing" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-black/30" />
                <div className="absolute inset-0 p-4 flex flex-col justify-end">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="text-[10px] px-2 py-0.5 bg-white/20 text-white border-0">
                      <Sparkles className="h-2.5 w-2.5 mr-1" />
                      Built for The Slow Traveler
                    </Badge>
                  </div>
                  <h3 className="text-lg font-serif font-bold text-white">{itinerary.destination}</h3>
                  <p className="text-white/80 text-sm">{itinerary.days.length} days • {itinerary.pace} pace</p>
                </div>
              </div>
              <div className="p-3 flex items-center justify-between border-t border-border/50 bg-card">
                <div className="flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <span className="font-medium">${totalCost.toLocaleString()}</span>
                  </span>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    {totalActivities} activities
                  </span>
                </div>
                <Button 
                  onClick={handleOptimize} 
                  disabled={isOptimizing}
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                >
                  {isOptimizing ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                      <Route className="h-3.5 w-3.5" />
                    </motion.div>
                  ) : (
                    <Route className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden sm:inline">Optimize</span>
                </Button>
              </div>
            </Card>

            {/* Days */}
            <div className="space-y-3">
              {itinerary.days.slice(0, 3).map((day) => {
                const isExpanded = expandedDays.has(day.dayNumber);
                const activities = dayActivities[day.dayNumber] || day.activities;
                const activityIds = activities.map((a: any) => a.id);
                
                return (
                  <Card key={day.dayNumber} className="overflow-hidden border-border/50">
                    <button onClick={() => toggleDay(day.dayNumber)} className="w-full text-left">
                      <CardHeader className="p-3 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center font-bold text-primary-foreground text-sm">
                            {day.dayNumber}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-serif text-sm font-semibold truncate">{day.theme}</h4>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              <span>{activities.length} activities</span>
                              {day.weather && (
                                <span className="flex items-center gap-0.5">
                                  {day.weather.condition === 'sunny' ? <Sun className="h-3 w-3 text-amber-500" /> : <Cloud className="h-3 w-3" />}
                                  {day.weather.high}°
                                </span>
                              )}
                              {day.totalCost && <span className="text-primary font-medium">${day.totalCost}</span>}
                            </div>
                          </div>
                          <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isExpanded && "rotate-180")} />
                        </div>
                      </CardHeader>
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                        >
                          <CardContent className="p-0">
                            <div className="border-t border-border/50">
                              <DndContext
                                sensors={sensors}
                                collisionDetection={closestCenter}
                                onDragEnd={handleDragEnd(day.dayNumber)}
                              >
                                <SortableContext items={activityIds} strategy={verticalListSortingStrategy}>
                                  {activities.slice(0, 5).map((activity: any, idx: number) => (
                                    <SortableActivityRow
                                      key={activity.id}
                                      activity={activity}
                                      isLocked={lockedActivities.has(activity.id)}
                                      isLast={idx === Math.min(activities.length - 1, 4)}
                                      showingReviews={showReviewsFor === activity.id}
                                      onLock={() => toggleLock(activity.id, activity.title)}
                                      onSwap={() => handleSwap(activity.title)}
                                      onViewReviews={() => handleViewReviews(activity.title, activity.id)}
                                      onBook={() => handleBook(activity.title)}
                                    />
                                  ))}
                                </SortableContext>
                              </DndContext>
                            </div>
                          </CardContent>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Sidebar - Feature demos */}
          <div className="space-y-4">
            {/* Group travel */}
            <Card className="border-border/50 overflow-hidden">
              <CardHeader className="p-4 pb-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-indigo-600" />
                  Group Travel
                </h4>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                {/* Members row */}
                <div className="flex items-center gap-2 mb-3">
                  {groupMembers.map((member) => (
                    <div key={member.id} className="relative group">
                      <Avatar className={cn("w-9 h-9 border-2 border-background shadow-sm", member.color)}>
                        <AvatarFallback className="text-white text-xs font-medium">{member.initials}</AvatarFallback>
                      </Avatar>
                      {member.id !== 'you' && (
                        <button
                          onClick={() => removeGroupMember(member.id)}
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  {groupMembers.length < GROUP_MEMBERS.length && (
                    <button
                      onClick={addGroupMember}
                      className="w-9 h-9 rounded-full border-2 border-dashed border-border hover:border-primary/50 flex items-center justify-center transition-colors"
                    >
                      <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  )}
                </div>

                {/* Interests preview */}
                {groupMembers.length > 1 && (
                  <div className="space-y-1.5 mb-3">
                    {groupMembers.map((member) => (
                      <div key={member.id} className="flex items-center gap-2 text-xs">
                        <span className={cn("w-2 h-2 rounded-full", member.color)} />
                        <span className="text-muted-foreground w-10">{member.name}</span>
                        <div className="flex gap-1">
                          {member.interests.map((i) => (
                            <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0">{i}</Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Blend button */}
                {groupMembers.length > 1 && !hasBlended && (
                  <Button
                    size="sm"
                    onClick={handleBlendPreferences}
                    disabled={isBlending}
                    className="w-full gap-2"
                  >
                    {isBlending ? (
                      <>
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
                          <Zap className="h-3.5 w-3.5" />
                        </motion.div>
                        Blending...
                      </>
                    ) : (
                      <>
                        <Heart className="h-3.5 w-3.5" />
                        Blend Preferences
                      </>
                    )}
                  </Button>
                )}

                {/* Blended result */}
                {hasBlended && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-2 rounded-lg bg-primary/5 border border-primary/20 text-center"
                  >
                    <p className="text-xs text-primary font-medium">✓ Itinerary balanced for all</p>
                  </motion.div>
                )}

                {groupMembers.length === 1 && (
                  <p className="text-xs text-muted-foreground text-center">
                    Add friends to see preference blending
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Quick actions demo */}
            <Card className="border-border/50">
              <CardHeader className="p-4 pb-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Try These Features
                </h4>
              </CardHeader>
              <CardContent className="p-4 pt-2 space-y-3">
                <button 
                  onClick={() => toggleLock('bali-1-5', 'Sunset Yoga')}
                  className="w-full text-left p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Lock an Activity</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Click lock icon on any activity</p>
                </button>

                <button 
                  onClick={() => handleSwap('Temple Visit')}
                  className="w-full text-left p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-medium">Swap Activity</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Get AI-curated alternatives</p>
                </button>

                <button 
                  onClick={handleOptimize}
                  className="w-full text-left p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <Route className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium">Optimize Routes</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Save walking time between stops</p>
                </button>

                <button 
                  onClick={() => handleDelete('Temple Visit')}
                  className="w-full text-left p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <Trash2 className="h-4 w-4 text-rose-500" />
                    <span className="text-sm font-medium">Remove Activity</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Delete any activity from your day</p>
                </button>

                <button 
                  onClick={handleAddCustom}
                  className="w-full text-left p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group"
                >
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4 text-violet-600" />
                    <span className="text-sm font-medium">Add Custom Activity</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Add your own finds beyond AI picks</p>
                </button>
              </CardContent>
            </Card>

            {/* Reviews preview */}
            <Card className="border-border/50 overflow-hidden">
              <CardHeader className="p-4 pb-2">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-500" />
                  Aggregated Reviews
                </h4>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-muted-foreground">🔍 Google</span>
                    <span className="text-muted-foreground">🦉 TripAdvisor</span>
                    <span className="text-muted-foreground">📍 Foursquare</span>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 border border-border/50">
                    <div className="flex items-center gap-1 mb-1">
                      {[1,2,3,4,5].map(i => (
                        <Star key={i} className={cn("h-3 w-3", i <= 4 ? "fill-amber-500 text-amber-500" : "text-muted-foreground")} />
                      ))}
                      <span className="text-xs font-medium ml-1">4.8</span>
                    </div>
                    <p className="text-xs text-muted-foreground italic">"Absolutely magical experience..."</p>
                    <p className="text-[10px] text-muted-foreground mt-1">- From 2,847 reviews</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Hint */}
        <div className="mt-8 text-center space-y-3">
          <p className="text-xs text-muted-foreground inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted/50">
            <GripVertical className="h-3 w-3" />
            Drag activities to reorder • Lock or swap to customize
          </p>
          
          {/* AI explanation */}
          <p className="text-xs text-muted-foreground max-w-lg mx-auto">
            <span className="font-medium text-foreground">Powered by AI:</span> We blend real-time data from Google, TripAdvisor, Foursquare & Viator with your Travel DNA to build itineraries that flow naturally.
          </p>
          
          {/* Review sources */}
          <p className="text-[10px] text-muted-foreground/70">
            Reviews aggregated from Google, TripAdvisor & Foursquare
          </p>
        </div>
      </div>
    </section>
  );
}

// Sortable wrapper for ActivityRow
interface SortableActivityRowProps {
  activity: {
    id: string;
    title: string;
    description?: string;
    time: string;
    duration: string;
    type: string;
    cost: number;
    rating?: number;
    location?: { name?: string; address?: string };
    photos?: string[];
    tags?: string[];
  };
  isLocked: boolean;
  isLast: boolean;
  showingReviews: boolean;
  onLock: () => void;
  onSwap: () => void;
  onViewReviews: () => void;
  onBook: () => void;
}

function SortableActivityRow(props: SortableActivityRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.activity.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "relative group",
        isDragging && "opacity-60 shadow-lg bg-card"
      )}
    >
      {/* Drag Handle */}
      <div
        {...attributes}
        {...listeners}
        className={cn(
          "absolute left-1 top-1/2 -translate-y-1/2 z-10",
          "opacity-0 group-hover:opacity-100 transition-opacity",
          "cursor-grab active:cursor-grabbing",
          "p-1 rounded bg-background/80 border shadow-sm",
          "hover:bg-muted",
          isDragging && "opacity-100"
        )}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground" />
      </div>
      <ActivityRow {...props} />
    </div>
  );
}

function ActivityRow({ 
  activity, 
  isLocked, 
  isLast,
  showingReviews,
  onLock, 
  onSwap,
  onViewReviews,
  onBook,
}: { 
  activity: {
    id: string;
    title: string;
    description?: string;
    time: string;
    duration: string;
    type: string;
    cost: number;
    rating?: number;
    location?: { name?: string; address?: string };
    photos?: string[];
    tags?: string[];
  };
  isLocked: boolean;
  isLast: boolean;
  showingReviews: boolean;
  onLock: () => void;
  onSwap: () => void;
  onViewReviews: () => void;
  onBook: () => void;
}) {
  const getTypeConfig = (type: string) => {
    const configs: Record<string, { label: string; icon: React.ReactNode; bg: string; text: string }> = {
      cultural: { label: 'Cultural', icon: <Camera className="h-3 w-3" />, bg: 'bg-violet-500/10', text: 'text-violet-600' },
      dining: { label: 'Dining', icon: <Utensils className="h-3 w-3" />, bg: 'bg-orange-500/10', text: 'text-orange-600' },
      activity: { label: 'Activity', icon: <Compass className="h-3 w-3" />, bg: 'bg-emerald-500/10', text: 'text-emerald-600' },
      relaxation: { label: 'Wellness', icon: <Sparkles className="h-3 w-3" />, bg: 'bg-sky-500/10', text: 'text-sky-600' },
      transportation: { label: 'Transfer', icon: <Car className="h-3 w-3" />, bg: 'bg-slate-500/10', text: 'text-slate-500' },
      accommodation: { label: 'Hotel', icon: <Hotel className="h-3 w-3" />, bg: 'bg-amber-500/10', text: 'text-amber-600' },
    };
    return configs[type] || { label: type, icon: <MapPin className="h-3 w-3" />, bg: 'bg-muted', text: 'text-muted-foreground' };
  };

  const config = getTypeConfig(activity.type);
  const isTransport = activity.type === 'transportation';
  const thumbnail = activity.photos?.[0];
  const isBookable = ['dining', 'cultural', 'activity', 'relaxation'].includes(activity.type) && activity.rating;

  return (
    <div className={cn(
      "flex items-stretch transition-colors relative",
      !isLast && "border-b border-border/30",
      isLocked ? "bg-primary/5" : "hover:bg-muted/20"
    )}>
      {/* Reviews overlay */}
      <AnimatePresence>
        {showingReviews && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute inset-x-0 top-0 z-10 p-3 bg-card border-b border-amber-500/30 shadow-lg"
          >
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                {[1,2,3,4,5].map(i => (
                  <Star key={i} className={cn("h-3 w-3", i <= 4 ? "fill-amber-500 text-amber-500" : "text-muted-foreground/30")} />
                ))}
              </div>
              <span className="text-xs font-medium">4.8 from 847 reviews</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              Reviews aggregated from Google, TripAdvisor & Foursquare
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Time column */}
      <div className="w-[68px] shrink-0 py-2.5 px-2.5 border-r border-border/30 bg-muted/20">
        <p className="text-xs font-medium text-foreground">{formatTime12h(activity.time)}</p>
        <p className="text-[10px] text-muted-foreground">{activity.duration}</p>
      </div>

      {/* Thumbnail */}
      {!isTransport && thumbnail && (
        <div className="w-14 h-14 shrink-0 m-2 rounded-md overflow-hidden bg-muted">
          <SafeImage src={thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
        </div>
      )}

      {/* Content */}
      <div className={cn("flex-1 py-2.5 min-w-0", thumbnail && !isTransport ? "pl-0.5 pr-2" : "px-2.5")}>
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className={cn("inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium", config.bg, config.text)}>
            {config.icon}
            {config.label}
          </span>
          {activity.rating && activity.rating > 0 && (
            <button 
              onClick={onViewReviews}
              className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 hover:text-amber-700 transition-colors"
            >
              <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
              {activity.rating.toFixed(1)}
            </button>
          )}
          {isBookable && (
            <div className="ml-auto relative group/book">
              <button
                onClick={onBook}
                className="text-[10px] text-primary hover:underline flex items-center gap-0.5"
              >
                Book <ExternalLink className="h-2.5 w-2.5" />
              </button>
              {/* Tooltip */}
              <div className="absolute right-0 top-full mt-1 w-44 p-2 rounded-md bg-popover border shadow-lg text-[10px] text-muted-foreground opacity-0 group-hover/book:opacity-100 transition-opacity pointer-events-none z-50">
                Opens Viator or restaurant site directly
              </div>
            </div>
          )}
        </div>
        <h5 className="text-sm font-medium text-foreground leading-tight line-clamp-1">{activity.title}</h5>
        {activity.location && (
          <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1 line-clamp-1">
            <MapPin className="h-2.5 w-2.5 shrink-0" />
            {typeof activity.location === 'string' 
              ? activity.location 
              : activity.location?.name || activity.location?.address || ''}
          </p>
        )}
      </div>

      {/* Cost */}
      {activity.cost > 0 && (
        <div className="hidden sm:flex items-center justify-end w-14 pr-1 text-xs text-muted-foreground shrink-0">
          ${activity.cost}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center shrink-0 border-l border-border/30">
        <button
          onClick={(e) => { e.stopPropagation(); onLock(); }}
          className={cn(
            "h-full w-9 flex items-center justify-center transition-colors",
            isLocked ? "bg-primary/10 hover:bg-primary/20" : "hover:bg-muted/50"
          )}
          title={isLocked ? "Unlock" : "Lock"}
        >
          <Lock className={cn("h-3.5 w-3.5", isLocked ? "text-primary" : "text-muted-foreground/50")} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onSwap(); }}
          disabled={isLocked}
          className={cn(
            "h-full w-9 flex items-center justify-center transition-colors border-l border-border/30",
            isLocked ? "opacity-30 cursor-not-allowed" : "hover:bg-muted/50"
          )}
          title="Swap"
        >
          <RefreshCw className="h-3.5 w-3.5 text-muted-foreground/50" />
        </button>
      </div>
    </div>
  );
}
