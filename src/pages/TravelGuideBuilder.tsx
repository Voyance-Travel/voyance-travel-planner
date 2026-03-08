/**
 * Travel Guide Builder
 * "Everything selected, uncheck what you don't want"
 */

import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft, BookOpen, Check, Coffee, MapPin, Utensils,
  Music, ShoppingBag, Camera, Plane, Hotel, StickyNote,
  Lightbulb, Loader2, ChevronDown, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useTrip } from '@/services/supabase/trips';
import { supabase } from '@/integrations/supabase/client';
import { generateTravelGuide } from '@/services/travelGuideService';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface Activity {
  id: string;
  title: string;
  description: string | null;
  type: string;
  start_time: string | null;
  itinerary_day_id: string | null;
}

interface ItineraryDay {
  id: string;
  day_number: number;
  date: string;
  city: string | null;
  theme: string | null;
}

const activityIcons: Record<string, any> = {
  dining: Utensils,
  restaurant: Utensils,
  food: Utensils,
  coffee: Coffee,
  cafe: Coffee,
  music: Music,
  nightlife: Music,
  shopping: ShoppingBag,
  sightseeing: MapPin,
  attraction: MapPin,
  activity: MapPin,
  transport: Plane,
  flight: Plane,
  hotel: Hotel,
  accommodation: Hotel,
};

function getActivityIcon(type: string) {
  const key = type?.toLowerCase() || '';
  for (const [k, Icon] of Object.entries(activityIcons)) {
    if (key.includes(k)) return Icon;
  }
  return MapPin;
}

export default function TravelGuideBuilder() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const { data: trip, isLoading: tripLoading } = useTrip(tripId);

  const [activities, setActivities] = useState<Activity[]>([]);
  const [days, setDays] = useState<ItineraryDay[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includePhotos, setIncludePhotos] = useState(true);
  const [includeHotel, setIncludeHotel] = useState(true);
  const [includeFlights, setIncludeFlights] = useState(true);
  const [includeTips, setIncludeTips] = useState(true);
  const [collapsedDays, setCollapsedDays] = useState<Set<number>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [noteCount, setNoteCount] = useState(0);
  const [photoCount, setPhotoCount] = useState(0);

  // Load trip activities and days
  useEffect(() => {
    if (!tripId) return;

    async function load() {
      setLoading(true);
      const [daysRes, activitiesRes, notesRes, photosRes] = await Promise.all([
        supabase.from('itinerary_days').select('id, day_number, date, city, theme').eq('trip_id', tripId!).order('day_number'),
        supabase.from('trip_activities').select('id, title, description, type, start_time, itinerary_day_id').eq('trip_id', tripId!).order('start_time'),
        supabase.from('trip_notes').select('id').eq('trip_id', tripId!),
        supabase.from('trip_photos').select('id').eq('trip_id', tripId!),
      ]);

      const loadedDays = (daysRes.data || []) as ItineraryDay[];
      const loadedActivities = (activitiesRes.data || []) as Activity[];

      setDays(loadedDays);
      setActivities(loadedActivities);
      setSelectedIds(new Set(loadedActivities.map(a => a.id)));
      setNoteCount(notesRes.data?.length || 0);
      setPhotoCount(photosRes.data?.length || 0);
      setLoading(false);
    }

    load();
  }, [tripId]);

  // Group activities by day
  const activitiesByDay = useMemo(() => {
    const map = new Map<string, Activity[]>();
    for (const day of days) {
      map.set(day.id, activities.filter(a => a.itinerary_day_id === day.id));
    }
    // Unmatched activities
    const unmatched = activities.filter(a => !a.itinerary_day_id || !days.some(d => d.id === a.itinerary_day_id));
    if (unmatched.length > 0) {
      map.set('unmatched', unmatched);
    }
    return map;
  }, [activities, days]);

  const allSelected = selectedIds.size === activities.length;

  function toggleAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(activities.map(a => a.id)));
    }
  }

  function toggleActivity(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleDayCollapse(dayNumber: number) {
    setCollapsedDays(prev => {
      const next = new Set(prev);
      if (next.has(dayNumber)) next.delete(dayNumber);
      else next.add(dayNumber);
      return next;
    });
  }

  async function handleBuild() {
    if (selectedIds.size === 0) {
      toast.error('Select at least one activity to include');
      return;
    }
    setGenerating(true);
    try {
      const result = await generateTravelGuide(
        tripId!,
        Array.from(selectedIds),
        { includeNotes, includeHotel, includeFlights }
      );
      toast.success('Travel guide generated!');
      navigate(`/trip/${tripId}/travel-guide/edit/${result.guideId}`);
    } catch (err: any) {
      if (err.message === 'INSUFFICIENT_CREDITS') {
        toast.error('Not enough credits. Guide generation costs 15 credits.');
      } else {
        toast.error('Failed to generate guide. Please try again.');
      }
      console.error('[TravelGuideBuilder] Error:', err);
    } finally {
      setGenerating(false);
    }
  }

  if (tripLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading trip data...</div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4">
        <h2 className="text-xl font-semibold mb-2">Trip not found</h2>
        <Link to="/trip/dashboard"><Button>Back to Trips</Button></Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Build Your {trip.destination || ''} Travel Guide</h1>
            <p className="text-sm text-muted-foreground">Everything's selected — uncheck what you don't want</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Select All / Deselect All */}
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={toggleAll}>
            {allSelected ? 'Deselect All' : 'Select All'}
          </Button>
          <span className="text-sm text-muted-foreground">
            {selectedIds.size} of {activities.length} activities selected
          </span>
        </div>

        {/* Day-by-day activities */}
        {days.map(day => {
          const dayActivities = activitiesByDay.get(day.id) || [];
          if (dayActivities.length === 0) return null;
          const isCollapsed = collapsedDays.has(day.day_number);
          const daySelectedCount = dayActivities.filter(a => selectedIds.has(a.id)).length;

          return (
            <motion.div
              key={day.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="border rounded-lg overflow-hidden"
            >
              <button
                onClick={() => toggleDayCollapse(day.day_number)}
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted/80 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  <span className="font-medium">📅 Day {day.day_number}</span>
                  {day.date && <span className="text-sm text-muted-foreground">— {day.date}</span>}
                  {day.city && <span className="text-sm text-muted-foreground">· {day.city}</span>}
                </div>
                <span className="text-xs text-muted-foreground">
                  {daySelectedCount}/{dayActivities.length}
                </span>
              </button>

              {!isCollapsed && (
                <div className="divide-y">
                  {dayActivities.map(activity => {
                    const Icon = getActivityIcon(activity.type);
                    return (
                      <label
                        key={activity.id}
                        className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors"
                      >
                        <Checkbox
                          checked={selectedIds.has(activity.id)}
                          onCheckedChange={() => toggleActivity(activity.id)}
                          className="mt-0.5"
                        />
                        <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-sm font-medium",
                            !selectedIds.has(activity.id) && "text-muted-foreground line-through"
                          )}>
                            {activity.title}
                          </p>
                          {activity.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {activity.description}
                            </p>
                          )}
                        </div>
                        {activity.start_time && (
                          <span className="text-xs text-muted-foreground shrink-0">
                            {activity.start_time}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </motion.div>
          );
        })}

        {/* Unmatched activities */}
        {activitiesByDay.has('unmatched') && (
          <div className="border rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-muted/50 font-medium">📌 Other Activities</div>
            <div className="divide-y">
              {(activitiesByDay.get('unmatched') || []).map(activity => {
                const Icon = getActivityIcon(activity.type);
                return (
                  <label
                    key={activity.id}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selectedIds.has(activity.id)}
                      onCheckedChange={() => toggleActivity(activity.id)}
                      className="mt-0.5"
                    />
                    <Icon className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-medium",
                        !selectedIds.has(activity.id) && "text-muted-foreground line-through"
                      )}>
                        {activity.title}
                      </p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* Additional Content Toggles */}
        <div className="border rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-muted/50 font-medium">── Additional Content ──</div>
          <div className="divide-y">
            {noteCount > 0 && (
              <label className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors">
                <Checkbox checked={includeNotes} onCheckedChange={() => setIncludeNotes(!includeNotes)} />
                <StickyNote className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">📝 Trip Notes ({noteCount} notes)</span>
              </label>
            )}
            {photoCount > 0 && (
              <label className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors">
                <Checkbox checked={includePhotos} onCheckedChange={() => setIncludePhotos(!includePhotos)} />
                <Camera className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">📸 Trip Photos ({photoCount} photos)</span>
              </label>
            )}
            <label className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors">
              <Checkbox checked={includeHotel} onCheckedChange={() => setIncludeHotel(!includeHotel)} />
              <Hotel className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">🏨 Hotel / Accommodation</span>
            </label>
            <label className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors">
              <Checkbox checked={includeFlights} onCheckedChange={() => setIncludeFlights(!includeFlights)} />
              <Plane className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">✈️ Flight Details</span>
            </label>
            <label className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 cursor-pointer transition-colors">
              <Checkbox checked={includeTips} onCheckedChange={() => setIncludeTips(!includeTips)} />
              <Lightbulb className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">💡 Tips & Recommendations</span>
            </label>
          </div>
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t p-4">
        <div className="max-w-2xl mx-auto">
          <Button
            className="w-full h-12 text-base"
            onClick={handleBuild}
            disabled={generating || selectedIds.size === 0}
          >
            {generating ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Generating your guide...
              </>
            ) : (
              <>
                <BookOpen className="h-5 w-5 mr-2" />
                Build My Guide ({selectedIds.size} items · 15 credits)
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
