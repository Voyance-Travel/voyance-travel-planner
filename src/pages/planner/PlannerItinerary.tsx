import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import ItineraryPreview from '@/components/planner/steps/ItineraryPreview';
import { useTripPlanner } from '@/contexts/TripPlannerContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export default function PlannerItinerary() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state, saveTrip } = useTripPlanner();
  const { user } = useAuth();
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

  // Build trip details from context (works for both anonymous and authenticated users)
  // Include flight_selection data to avoid re-asking for times
  const [tripDetails, setTripDetails] = useState<{
    name: string;
    destination: string;
    departureCity: string;
    startDate: string;
    endDate: string;
    travelers: number;
    tripType?: string;
    flightSelection?: any;
    hotelLocation?: string;
  }>({
    name: state.basics.destination ? `Trip to ${state.basics.destination}` : '',
    destination: state.basics.destination || '',
    departureCity: state.basics.originCity || '',
    startDate: state.basics.startDate || '',
    endDate: state.basics.endDate || '',
    travelers: state.basics.travelers || 1,
    tripType: state.basics.tripType || undefined,
    flightSelection: state.flights ? (state.flights as any) : undefined,
    hotelLocation: state.hotel?.name || state.hotel?.neighborhood || undefined,
  });

  // Update trip details from context when it changes
  useEffect(() => {
    if (state.basics.destination) {
      setTripDetails({
        name: state.basics.destination ? `Trip to ${state.basics.destination}` : '',
        destination: state.basics.destination || '',
        departureCity: state.basics.originCity || '',
        startDate: state.basics.startDate || '',
        endDate: state.basics.endDate || '',
        travelers: state.basics.travelers || 1,
        tripType: state.basics.tripType || undefined,
        flightSelection: state.flights ? (state.flights as any) : undefined,
        hotelLocation: state.hotel?.name || state.hotel?.neighborhood || undefined,
      });
    }
  }, [state.basics, state.flights, state.hotel]);

  // If authenticated user with tripId but no context data, fetch from Supabase
  useEffect(() => {
    if (tripId && !tripDetails.destination && user) {
      const fetchTrip = async () => {
        const { data, error } = await supabase
          .from('trips')
          .select('*')
          .eq('id', tripId)
          .single();

        if (data && !error) {
          // Extract flight_selection and hotel data to avoid re-asking
          const flightSelection = data.flight_selection as any;
          const hotelSelectionRaw = data.hotel_selection as any;
          const primaryHotel = Array.isArray(hotelSelectionRaw)
            ? hotelSelectionRaw[0]
            : hotelSelectionRaw;
          
          setTripDetails({
            name: data.name,
            destination: data.destination,
            departureCity: data.origin_city || '',
            startDate: data.start_date,
            endDate: data.end_date,
            travelers: data.travelers || 1,
            tripType: data.trip_type || undefined,
            flightSelection: flightSelection || undefined,
            hotelLocation: primaryHotel?.name || primaryHotel?.neighborhood || undefined,
          });
        }
      };
      fetchTrip();
    }
  }, [tripId, tripDetails.destination, user]);

  const handleComplete = async () => {
    if (!tripId) return;
    
    setIsSubmitting(true);
    try {
      // For authenticated users, update trip status in database
      if (user) {
        const { error } = await supabase
          .from('trips')
          .update({ status: 'booked', updated_at: new Date().toISOString() })
          .eq('id', tripId);

        if (error) throw error;
      }

      toast.success('Trip booked successfully!');
      navigate(`/trip/${tripId}`);
    } catch (error) {
      console.error('Failed to book trip:', error);
      // For anonymous users or on error, still navigate
      toast.info('Trip saved! Sign in to save permanently.');
      navigate(`/trip/${tripId}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    const params = new URLSearchParams(searchParams);
    navigate(`/planner/summary?${params.toString()}`);
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
