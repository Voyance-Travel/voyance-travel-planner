import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import ItineraryPreview from '@/components/planner/steps/ItineraryPreview';
import { useTripPlanner } from '@/contexts/TripPlannerContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export default function PlannerItinerary() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state, saveTrip } = useTripPlanner();
  const [tripId, setTripId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get tripId from URL or context
  useEffect(() => {
    const urlTripId = searchParams.get('tripId');
    
    if (urlTripId) {
      setTripId(urlTripId);
      setIsLoading(false);
    } else if (state.tripId) {
      setTripId(state.tripId);
      setIsLoading(false);
    } else {
      // Need to save trip first to get an ID
      const initTrip = async () => {
        const savedTripId = await saveTrip();
        if (savedTripId) {
          setTripId(savedTripId);
        } else {
          toast.error('Please complete trip details first');
          navigate('/planner');
        }
        setIsLoading(false);
      };
      initTrip();
    }
  }, [searchParams, state.tripId, saveTrip, navigate]);

  // Build trip details from context or fetch from DB
  const [tripDetails, setTripDetails] = useState({
    name: state.basics.destination ? `Trip to ${state.basics.destination}` : '',
    destination: state.basics.destination || '',
    departureCity: state.basics.originCity || '',
    startDate: state.basics.startDate || '',
    endDate: state.basics.endDate || '',
    travelers: state.basics.travelers || 1,
  });

  // If we have a tripId but no context data, fetch from Supabase
  useEffect(() => {
    if (tripId && !tripDetails.destination) {
      const fetchTrip = async () => {
        const { data, error } = await supabase
          .from('trips')
          .select('*')
          .eq('id', tripId)
          .single();

        if (data && !error) {
          setTripDetails({
            name: data.name,
            destination: data.destination,
            departureCity: data.origin_city || '',
            startDate: data.start_date,
            endDate: data.end_date,
            travelers: data.travelers || 1,
          });
        }
      };
      fetchTrip();
    }
  }, [tripId, tripDetails.destination]);

  const handleComplete = async () => {
    if (!tripId) return;
    
    setIsSubmitting(true);
    try {
      // Update trip status to booked
      const { error } = await supabase
        .from('trips')
        .update({ status: 'booked', updated_at: new Date().toISOString() })
        .eq('id', tripId);

      if (error) throw error;

      toast.success('Trip booked successfully!');
      navigate(`/trip/${tripId}`);
    } catch (error) {
      console.error('Failed to book trip:', error);
      toast.error('Failed to book trip. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    const params = new URLSearchParams(searchParams);
    navigate(`/planner/hotel?${params.toString()}`);
  };

  if (isLoading) {
    return (
      <MainLayout>
        <Head title="Build Itinerary | Voyance" />
        <section className="pt-24 pb-16 min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading your trip...</p>
          </div>
        </section>
      </MainLayout>
    );
  }

  if (!tripDetails.destination) {
    return (
      <MainLayout>
        <Head title="Build Itinerary | Voyance" />
        <section className="pt-24 pb-16 min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
            <p className="text-muted-foreground">Loading trip details...</p>
          </div>
        </section>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <Head title="Build Itinerary | Voyance" />
      <section className="pt-24 pb-16">
        <div className="max-w-4xl mx-auto px-4">
          <ItineraryPreview
            tripId={tripId || undefined}
            tripDetails={tripDetails}
            onComplete={handleComplete}
            onBack={handleBack}
            isLoading={isSubmitting}
          />
        </div>
      </section>
    </MainLayout>
  );
}
