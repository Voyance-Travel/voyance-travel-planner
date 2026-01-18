import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import Head from '@/components/common/Head';
import TopNav from '@/components/common/TopNav';
import Footer from '@/components/common/Footer';
import PlannerHeader from '@/components/planner/PlannerHeader';
import TripSetup from '@/components/planner/steps/TripSetup';
import FlightSelection from '@/components/planner/steps/FlightSelection';
import HotelSelection from '@/components/planner/steps/HotelSelection';
import ItineraryPreview from '@/components/planner/steps/ItineraryPreview';
import { scrollToTop } from '@/utils/scrollUtils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type PlannerStep = 'setup' | 'flights' | 'hotels' | 'itinerary';

interface PlannerFormData {
  destination: string;
  name: string;
  startDate: string;
  endDate: string;
  travelers: number;
  departureCity: string;
  selectedDepartureFlight: string | null;
  selectedReturnFlight: string | null;
  selectedHotel: string | null;
  tripId: string | null;
}

const initialFormData: PlannerFormData = {
  destination: '',
  name: '',
  startDate: '',
  endDate: '',
  travelers: 2,
  departureCity: '',
  selectedDepartureFlight: null,
  selectedReturnFlight: null,
  selectedHotel: null,
  tripId: null,
};

const STEPS = [
  { title: 'Trip Details', description: 'Set up your trip basics' },
  { title: 'Flights', description: 'Choose your flights' },
  { title: 'Hotels', description: 'Select accommodation' },
  { title: 'Itinerary', description: 'Review your trip' },
];

export default function Planner() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const [currentStep, setCurrentStep] = useState<PlannerStep>('setup');
  const [formData, setFormData] = useState<PlannerFormData>(initialFormData);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize from URL params or localStorage
  useEffect(() => {
    const destination = searchParams.get('destination');
    const tripId = searchParams.get('tripId');
    const savedTrip = localStorage.getItem('voyance-current-trip');

    let initialData = { ...initialFormData };

    if (savedTrip) {
      try {
        const parsed = JSON.parse(savedTrip);
        initialData = { ...initialData, ...parsed };
      } catch (e) {
        console.error('Failed to parse saved trip:', e);
      }
    }

    if (destination) {
      initialData.destination = destination;
    }
    
    if (tripId) {
      initialData.tripId = tripId;
      // Load trip from Supabase
      loadTripFromDB(tripId, initialData);
    } else {
      setFormData(initialData);
    }
  }, [searchParams]);

  // Load existing trip from database
  const loadTripFromDB = async (tripId: string, fallbackData: PlannerFormData) => {
    try {
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .single();

      if (data && !error) {
        setFormData({
          ...fallbackData,
          tripId: data.id,
          destination: data.destination,
          name: data.name,
          startDate: data.start_date,
          endDate: data.end_date,
          travelers: data.travelers || 2,
          departureCity: data.origin_city || '',
        });
      } else {
        setFormData(fallbackData);
      }
    } catch (err) {
      console.error('Failed to load trip:', err);
      setFormData(fallbackData);
    }
  };

  // Save form data to localStorage
  useEffect(() => {
    if (formData.destination || formData.name) {
      localStorage.setItem('voyance-current-trip', JSON.stringify(formData));
    }
  }, [formData]);

  const updateFormData = (updates: Partial<PlannerFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const getStepIndex = (step: PlannerStep): number => {
    const steps: PlannerStep[] = ['setup', 'flights', 'hotels', 'itinerary'];
    return steps.indexOf(step);
  };

  // Save trip to Supabase and get tripId
  const saveTrip = async (): Promise<string | null> => {
    if (!isAuthenticated || !user) {
      toast.error('Please sign in to continue');
      navigate('/signin');
      return null;
    }

    try {
      const tripData = {
        user_id: user.id,
        name: formData.name || `Trip to ${formData.destination}`,
        destination: formData.destination,
        start_date: formData.startDate,
        end_date: formData.endDate,
        travelers: formData.travelers,
        origin_city: formData.departureCity,
        status: 'planning' as const,
      };

      if (formData.tripId) {
        // Update existing
        const { error } = await supabase
          .from('trips')
          .update({ ...tripData, updated_at: new Date().toISOString() })
          .eq('id', formData.tripId);
        
        if (error) throw error;
        return formData.tripId;
      } else {
        // Create new
        const { data, error } = await supabase
          .from('trips')
          .insert([tripData])
          .select('id')
          .single();

        if (error) throw error;
        updateFormData({ tripId: data.id });
        return data.id;
      }
    } catch (err) {
      console.error('Failed to save trip:', err);
      toast.error('Failed to save trip');
      return null;
    }
  };

  const handleStepComplete = async (step: PlannerStep) => {
    scrollToTop();

    switch (step) {
      case 'setup':
        // Save trip when leaving setup
        const tripId = await saveTrip();
        if (tripId) {
          setCurrentStep('flights');
        }
        break;
      case 'flights':
        setCurrentStep('hotels');
        break;
      case 'hotels':
        setCurrentStep('itinerary');
        break;
      case 'itinerary':
        handleTripSubmission();
        break;
    }
  };

  const handleBack = () => {
    scrollToTop();

    switch (currentStep) {
      case 'flights':
        setCurrentStep('setup');
        break;
      case 'hotels':
        setCurrentStep('flights');
        break;
      case 'itinerary':
        setCurrentStep('hotels');
        break;
    }
  };

  const handleTripSubmission = async () => {
    if (!formData.tripId) {
      toast.error('Trip not saved yet');
      return;
    }

    setIsLoading(true);

    try {
      // Update trip status to booked
      const { error } = await supabase
        .from('trips')
        .update({ status: 'booked', updated_at: new Date().toISOString() })
        .eq('id', formData.tripId);

      if (error) throw error;

      // Clear saved trip data
      localStorage.removeItem('voyance-current-trip');

      toast.success('Trip booked successfully!');
      navigate(`/trip/${formData.tripId}`);
    } catch (error) {
      console.error('Failed to book trip:', error);
      toast.error('Failed to book trip. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Head
        title="Trip Planner | Voyance"
        description="Plan your perfect trip with Voyance's intelligent trip planner"
      />

      <TopNav />

      <PlannerHeader activeStep={getStepIndex(currentStep)} steps={STEPS} />

      <main className="container mx-auto px-4 py-12 max-w-6xl">
        {currentStep === 'setup' && (
          <TripSetup
            formData={formData}
            updateFormData={updateFormData}
            onContinue={() => handleStepComplete('setup')}
          />
        )}

        {currentStep === 'flights' && (
          <FlightSelection
            formData={formData}
            selectedDeparture={formData.selectedDepartureFlight}
            selectedReturn={formData.selectedReturnFlight}
            onSelectDeparture={(id) =>
              updateFormData({ selectedDepartureFlight: id })
            }
            onSelectReturn={(id) =>
              updateFormData({ selectedReturnFlight: id })
            }
            onContinue={() => handleStepComplete('flights')}
            onBack={handleBack}
          />
        )}

        {currentStep === 'hotels' && (
          <HotelSelection
            formData={formData}
            selectedHotel={formData.selectedHotel}
            onSelectHotel={(id) => updateFormData({ selectedHotel: id })}
            onContinue={() => handleStepComplete('hotels')}
            onBack={handleBack}
          />
        )}

        {currentStep === 'itinerary' && (
          <ItineraryPreview
            tripId={formData.tripId || undefined}
            tripDetails={{
              name: formData.name,
              destination: formData.destination,
              departureCity: formData.departureCity,
              startDate: formData.startDate,
              endDate: formData.endDate,
              travelers: formData.travelers,
            }}
            onComplete={() => handleStepComplete('itinerary')}
            onBack={handleBack}
            isLoading={isLoading}
          />
        )}
      </main>

      <Footer />
    </div>
  );
}
