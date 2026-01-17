import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import FullItinerary from '@/components/itinerary/FullItinerary';
import { getItineraryBySlug, SAMPLE_ITINERARIES } from '@/data/sampleItineraries';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { ItineraryActivity } from '@/types/itinerary';

export default function SampleItinerary() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [itineraryData, setItineraryData] = useState<ReturnType<typeof getItineraryBySlug> | null>(null);

  useEffect(() => {
    const destinationParam = searchParams.get('destination') || 'bali-wellness';
    const data = getItineraryBySlug(destinationParam);
    setItineraryData(data);
    setIsLoading(false);
  }, [searchParams]);

  const handleActivityLock = (dayIndex: number, activityId: string, locked: boolean) => {
    if (!itineraryData) return;
    const updatedDays = [...itineraryData.days];
    const activity = updatedDays[dayIndex].activities.find(a => a.id === activityId);
    if (activity) {
      activity.isLocked = locked;
      setItineraryData({ ...itineraryData, days: updatedDays });
      toast.success(locked ? 'Activity locked' : 'Activity unlocked');
    }
  };

  const handleActivityEdit = () => toast.info('Sign in to customize activities');
  const handleActivityRemove = (dayIndex: number, activityId: string) => {
    if (!itineraryData) return;
    const updatedDays = [...itineraryData.days];
    updatedDays[dayIndex].activities = updatedDays[dayIndex].activities.filter(a => a.id !== activityId);
    setItineraryData({ ...itineraryData, days: updatedDays });
    toast.success('Activity removed');
  };

  const handleActivityMove = (dayIndex: number, activityId: string, direction: 'up' | 'down') => {
    if (!itineraryData) return;
    const updatedDays = [...itineraryData.days];
    const activities = updatedDays[dayIndex].activities;
    const index = activities.findIndex(a => a.id === activityId);
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex >= 0 && newIndex < activities.length) {
      [activities[index], activities[newIndex]] = [activities[newIndex], activities[index]];
      setItineraryData({ ...itineraryData, days: updatedDays });
    }
  };

  const handleDayRegenerate = (dayIndex: number) => {
    toast.info(`Sign in to regenerate Day ${dayIndex + 1}`);
  };

  const handleSaveItinerary = () => {
    if (!user) {
      toast.info('Sign in to save and customize this itinerary');
      navigate('/signin?redirect=/sample-itinerary');
      return;
    }
    navigate('/planner');
  };

  if (isLoading || !itineraryData) {
    return (
      <MainLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
        </div>
      </MainLayout>
    );
  }

  const dailyCosts = itineraryData.days.reduce((sum, day) => sum + day.totalCost, 0);
  const totalCost = dailyCosts + itineraryData.flightCost + itineraryData.hotelCost;

  return (
    <MainLayout>
      <Head 
        title={`Sample Itinerary - ${itineraryData.destination} | Voyance`}
        description={`See what a personalized Voyance travel itinerary looks like. ${itineraryData.days.length} days in ${itineraryData.destination}.`}
      />

      {/* Sample Banner */}
      <div className="bg-gradient-to-r from-accent to-primary text-white py-3 mt-16">
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="bg-white/20 text-white border-0">
              <Sparkles className="h-3 w-3 mr-1" />
              Sample
            </Badge>
            <span className="text-sm">Experience how Voyance creates perfect trips</span>
          </div>
          <Button 
            variant="secondary" 
            size="sm"
            onClick={handleSaveItinerary}
          >
            {user ? 'Customize This Trip' : 'Sign In to Customize'}
          </Button>
        </div>
      </div>

      <FullItinerary
        days={itineraryData.days}
        tripSummary={{
          destination: itineraryData.destination,
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + itineraryData.days.length * 86400000).toISOString(),
          travelers: 2,
          totalCost,
          style: itineraryData.style,
          pace: itineraryData.pace,
          flightCost: itineraryData.flightCost,
          hotelCost: itineraryData.hotelCost,
          dailyCosts,
        }}
        destinationInfo={itineraryData.destinationInfo}
        flightInfo={itineraryData.flightInfo}
        hotelInfo={itineraryData.hotelInfo}
        onActivityLock={handleActivityLock}
        onActivityEdit={handleActivityEdit}
        onActivityRemove={handleActivityRemove}
        onActivityMove={handleActivityMove}
        onDayRegenerate={handleDayRegenerate}
        onSaveItinerary={handleSaveItinerary}
        showHeader={true}
      />
    </MainLayout>
  );
}
