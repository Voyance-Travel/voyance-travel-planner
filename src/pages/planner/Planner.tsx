import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import Head from '@/components/common/Head';
import TopNav from '@/components/common/TopNav';
import Footer from '@/components/common/Footer';
import PlannerHeader from '@/components/planner/PlannerHeader';
import TripContext from '@/components/planner/steps/TripContext';
// FlightSelection removed - we're a "bring your own flight" platform
import HotelSelection from '@/components/planner/steps/HotelSelection';
import BookingOptions from '@/components/planner/steps/BookingOptions';
import ItineraryPreview from '@/components/planner/steps/ItineraryPreview';
import { scrollToTop } from '@/utils/scrollUtils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTripPlanner } from '@/contexts/TripPlannerContext';
import { format } from 'date-fns';
import { getDestinationById } from '@/lib/destinations';
import { enrichHotel } from '@/services/hotelAPI';

type PlannerStep = 'context' | 'flights' | 'hotels' | 'booking' | 'itinerary';

interface Companion {
  id: string;
  name: string;
  type: 'adult' | 'child';
}

interface BudgetAllocation {
  hotel: number;
  flight: number;
  activities: number;
}

interface SelectedHotelData {
  id: string;
  name: string;
  rating: number;
  pricePerNight: number;
  location: string;
  amenities: string[];
  image: string;
}

interface PlannerFormData {
  destination: string;
  name: string;
  startDate: string;
  endDate: string;
  travelers: number;
  departureCity: string;
  budget: string;
  budgetAllocation: BudgetAllocation;
  tripType: string;
  companions: Companion[];
  selectedDepartureFlight: string | null;
  selectedReturnFlight: string | null;
  selectedHotel: string | null;
  selectedHotelData: SelectedHotelData | null;
  tripId: string | null;
}

const STEPS = [
  { title: 'Trip Context', description: 'Travelers & budget' },
  { title: 'Hotels', description: 'Select accommodation' },
  { title: 'Book', description: 'Confirm your trip' },
];

export default function Planner() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isAuthenticated } = useAuth();
  const { state: tripPlannerState } = useTripPlanner();
  const destinationQuery = searchParams.get('destination');
  
  const [currentStep, setCurrentStep] = useState<PlannerStep>('context');
  const [isLoading, setIsLoading] = useState(false);

  // Keep destination in sync with the URL when explicitly provided.
  // This prevents a previously-saved destination from "sticking" when navigating from Explore.
  useEffect(() => {
    if (!destinationQuery) return;
    const destinationData = getDestinationById(destinationQuery);
    const destinationName = destinationData?.city || destinationQuery;
    setFormData(prev => (prev.destination === destinationName ? prev : { ...prev, destination: destinationName }));
  }, [destinationQuery]);
  
  // Initialize form data from TripPlannerContext, query params, and user preferences
  const [formData, setFormData] = useState<PlannerFormData>(() => {
    // Read from context first
    const contextData = tripPlannerState.basics;
    
    // Check for destination in query params (from Explore/Destinations pages)
    // IMPORTANT: if a destination is explicitly provided in the URL, it should win over any
    // previously-saved context destination (prevents "stuck" destinations like Casablanca).
    const destinationParam = searchParams.get('destination');
    let destinationName = contextData.destination || '';

    if (destinationParam) {
      const destinationData = getDestinationById(destinationParam);
      destinationName = destinationData?.city || destinationParam;
    }
    
    // Generate companion slots based on traveler count
    const travelers = contextData.travelers || 2;
    const companions: Companion[] = Array.from({ length: travelers }, (_, i) => ({
      id: `companion-${i}`,
      name: '',
      type: 'adult' as const,
    }));
    
    return {
      destination: destinationName,
      name: '',
      startDate: contextData.startDate || '',
      endDate: contextData.endDate || '',
      travelers: travelers,
      departureCity: contextData.originCity || '',
      budget: contextData.budgetTier || '',
      budgetAllocation: { hotel: 40, flight: 40, activities: 20 },
      tripType: contextData.tripType || '',
      companions,
      selectedDepartureFlight: null,
      selectedReturnFlight: null,
      selectedHotel: null,
      selectedHotelData: null,
      tripId: tripPlannerState.tripId,
    };
  });

  // Prefill departure city from user preferences if not already set
  useEffect(() => {
    const prefillHomeAirport = async () => {
      if (formData.departureCity || !isAuthenticated || !user) return;
      
      try {
        // First check user_preferences
        const { data: prefs } = await supabase
          .from('user_preferences')
          .select('home_airport')
          .eq('user_id', user.id)
          .single();
        
        if (prefs?.home_airport) {
          setFormData(prev => ({ ...prev, departureCity: prefs.home_airport }));
          return;
        }
        
        // Fallback to profiles table
        const { data: profile } = await supabase
          .from('profiles')
          .select('home_airport')
          .eq('id', user.id)
          .single();
        
        if (profile?.home_airport) {
          setFormData(prev => ({ ...prev, departureCity: profile.home_airport }));
        }
      } catch (err) {
        console.log('Could not prefill home airport:', err);
      }
    };
    
    prefillHomeAirport();
  }, [isAuthenticated, user, formData.departureCity]);

  // Check if we have basic trip info, if not check localStorage or redirect with destination preserved
  useEffect(() => {
    if (!formData.destination || !formData.startDate || !formData.endDate) {
      const destinationParam = searchParams.get('destination');

      // If a destination is explicitly provided in the URL, treat this as a new planning intent.
      // Do NOT restore an unrelated previous trip from localStorage (prevents "stuck" destinations).
      if (destinationParam) {
        const destinationData = getDestinationById(destinationParam);
        const destinationName = destinationData?.city || destinationParam;
        if (!formData.destination || formData.destination !== destinationName) {
          setFormData(prev => ({ ...prev, destination: destinationName }));
        }
        navigate(`/start?destination=${encodeURIComponent(destinationName)}`);
        return;
      }

      // Check localStorage for saved trip
      const savedTrip = localStorage.getItem('voyance-current-trip');
      if (savedTrip) {
        try {
          const parsed = JSON.parse(savedTrip);
          if (parsed.destination && parsed.startDate && parsed.endDate) {
            const travelers = parsed.travelers || 2;
            const companions: Companion[] = Array.from({ length: travelers }, (_, i) => ({
              id: `companion-${i}`,
              name: parsed.companions?.[i]?.name || '',
              type: parsed.companions?.[i]?.type || 'adult',
            }));
            setFormData(prev => ({ ...prev, ...parsed, companions }));
            return;
          }
        } catch (e) {
          console.error('Failed to parse saved trip:', e);
        }
      }
      
      // If we have a destination but no dates, redirect to /start with destination preserved
      if (formData.destination) {
        // Navigate to Start with the destination pre-selected
        navigate(`/start?destination=${encodeURIComponent(formData.destination)}`);
        return;
      }
      
      // No valid data, redirect to start
      toast.error('Please start by selecting your destination and dates');
      navigate('/start');
    }
  }, [searchParams, formData.destination, formData.startDate, formData.endDate, navigate]);

  // Update companions when traveler count changes
  useEffect(() => {
    if (formData.travelers !== formData.companions.length) {
      const newCompanions: Companion[] = Array.from({ length: formData.travelers }, (_, i) => ({
        id: `companion-${i}`,
        name: formData.companions[i]?.name || '',
        type: formData.companions[i]?.type || 'adult',
      }));
      setFormData(prev => ({ ...prev, companions: newCompanions }));
    }
  }, [formData.travelers]);

  // Save form data to localStorage on changes
  useEffect(() => {
    if (formData.destination) {
      localStorage.setItem('voyance-current-trip', JSON.stringify(formData));
    }
  }, [formData]);

  const updateFormData = (updates: Partial<PlannerFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const getStepIndex = (step: PlannerStep): number => {
    const steps: PlannerStep[] = ['context', 'hotels', 'booking'];
    return steps.indexOf(step);
  };

  // Save trip to database
  const saveTrip = async (): Promise<string | null> => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    let sessionId = localStorage.getItem('voyance_anonymous_session');
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem('voyance_anonymous_session', sessionId);
    }

    try {
      if (isAuthenticated && user) {
        // Serialize companions to JSON-compatible format
        const companionsJson = formData.companions.map(c => ({
          id: c.id,
          name: c.name,
          type: c.type,
        }));

        const tripData = {
          user_id: user.id,
          name: formData.name || `Trip to ${formData.destination}`,
          destination: formData.destination,
          start_date: formData.startDate,
          end_date: formData.endDate,
          travelers: formData.travelers,
          origin_city: formData.departureCity,
          budget_tier: formData.budget,
          trip_type: formData.tripType,
          status: 'planning' as const,
          metadata: JSON.parse(JSON.stringify({ companions: companionsJson })),
        };

        if (formData.tripId) {
          const { error } = await supabase
            .from('trips')
            .update({ ...tripData, updated_at: new Date().toISOString() })
            .eq('id', formData.tripId);
          
          if (error) throw error;
          return formData.tripId;
        } else {
          const { data, error } = await supabase
            .from('trips')
            .insert([tripData])
            .select('id')
            .single();

          if (error) throw error;
          updateFormData({ tripId: data.id });
          return data.id;
        }
      } else {
        // Anonymous users - save trip to localStorage only
        const tripData = {
          sessionId,
          origin: formData.departureCity,
          destination: formData.destination,
          startDate: formData.startDate,
          endDate: formData.endDate,
          travelers: formData.travelers,
          budget: formData.budget,
          tripType: formData.tripType,
          companions: formData.companions,
        };
        
        // Store in localStorage for anonymous users
        localStorage.setItem(`trip_${sessionId}`, JSON.stringify(tripData));
        console.log('[Planner] Saved to localStorage:', sessionId);
        return sessionId;
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
      case 'context': {
        const tripId = await saveTrip();

        const params = new URLSearchParams();
        params.set('destination', formData.destination);
        if (formData.departureCity) params.set('origin', formData.departureCity);
        params.set('startDate', formData.startDate);
        params.set('endDate', formData.endDate);
        params.set('travelers', String(formData.travelers || 1));
        if (tripId) params.set('tripId', tripId);

        // Skip flights - go directly to hotels
        setCurrentStep('hotels');
        return;
      }
      case 'hotels': {
        // Save hotel selection to database before moving on
        if (formData.tripId && formData.selectedHotelData && isAuthenticated) {
          const nights = Math.ceil(
            (new Date(formData.endDate).getTime() - new Date(formData.startDate).getTime()) / (1000 * 60 * 60 * 24)
          );
          
          // Enrich hotel with address, photos, etc. from Google Places
          const cleanDestination = formData.destination
            .replace(/\s*\([A-Z]{3}\)\s*$/i, '')
            .trim();
          
          const enrichment = await enrichHotel(
            formData.selectedHotelData.name, 
            cleanDestination
          );
          
          const hotelSelection = {
            id: formData.selectedHotelData.id,
            name: formData.selectedHotelData.name,
            location: formData.selectedHotelData.location,
            neighborhood: formData.selectedHotelData.location,
            rating: formData.selectedHotelData.rating,
            pricePerNight: formData.selectedHotelData.pricePerNight,
            roomType: 'Standard Room',
            amenities: formData.selectedHotelData.amenities,
            imageUrl: enrichment?.photos?.[0] || formData.selectedHotelData.image,
            images: enrichment?.photos,
            address: enrichment?.address,
            website: enrichment?.website,
            googleMapsUrl: enrichment?.googleMapsUrl,
            placeId: enrichment?.placeId,
            checkIn: formData.startDate,
            checkOut: formData.endDate,
            nights,
            isEnriched: !!enrichment,
          };
          
          await supabase
            .from('trips')
            .update({ 
              hotel_selection: hotelSelection,
              updated_at: new Date().toISOString() 
            })
            .eq('id', formData.tripId);
        }
        setCurrentStep('booking');
        break;
      }
      default:
        break;
    }
  };

  const handleSkipToItinerary = async () => {
    scrollToTop();
    const tripId = await saveTrip();
    
    if (tripId) {
      // Navigate directly to trip detail which handles itinerary generation
      const params = new URLSearchParams();
      params.set('generate', 'true'); // Signal to auto-generate itinerary
      navigate(`/trip/${tripId}?${params.toString()}`);
    } else {
      toast.error('Failed to save trip. Please try again.');
    }
  };

  const handleBack = () => {
    scrollToTop();

    switch (currentStep) {
      case 'hotels':
        setCurrentStep('context');
        break;
      case 'booking':
        setCurrentStep('hotels');
        break;
      case 'itinerary':
        setCurrentStep('booking');
        break;
    }
  };

  const handleBook = async () => {
    if (!formData.tripId) {
      const tripId = await saveTrip();
      if (!tripId) return;
    }

    setIsLoading(true);
    try {
      // Update trip status to booked
      if (isAuthenticated && formData.tripId) {
        await supabase
          .from('trips')
          .update({ status: 'booked', updated_at: new Date().toISOString() })
          .eq('id', formData.tripId);
      }

      localStorage.removeItem('voyance-current-trip');
      toast.success('Trip booked successfully!');
      navigate(`/trip/${formData.tripId}`);
    } catch (error) {
      console.error('Failed to book trip:', error);
      toast.error('Failed to book trip');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    const tripId = await saveTrip();
    if (tripId) {
      toast.success('Trip saved! You can access it from your dashboard.');
      navigate('/trips');
    }
  };

  const handleBuildItinerary = () => {
    setCurrentStep('itinerary');
  };

  const handleTripSubmission = async () => {
    // From itinerary preview, go back to booking options
    setCurrentStep('booking');
  };

  // Calculate trip summary for booking options
  const calculateTripSummary = () => {
    const flightPrice = 650; // Mock price per person
    const hotelPrice = 189; // Mock price per night
    const startDate = new Date(formData.startDate);
    const endDate = new Date(formData.endDate);
    const nights = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    
    return {
      destination: formData.destination,
      dates: `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`,
      travelers: formData.travelers,
      flightTotal: flightPrice * formData.travelers * 2, // Round trip
      hotelTotal: hotelPrice * nights,
      grandTotal: (flightPrice * formData.travelers * 2) + (hotelPrice * nights),
    };
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Head
        title="Trip Planner | Voyance"
        description="Plan your perfect trip with Voyance's intelligent trip planner"
      />

      <TopNav />

      <PlannerHeader 
        activeStep={getStepIndex(currentStep)} 
        steps={STEPS} 
      />

      <main className="container mx-auto px-4 py-12 max-w-6xl">
        {currentStep === 'context' && (
          <TripContext
            formData={formData}
            companions={formData.companions}
            budget={formData.budget}
            budgetAllocation={formData.budgetAllocation}
            tripType={formData.tripType}
            updateCompanions={(companions) => updateFormData({ companions })}
            updateBudget={(budget) => updateFormData({ budget })}
            updateBudgetAllocation={(budgetAllocation) => updateFormData({ budgetAllocation })}
            updateTripType={(tripType) => updateFormData({ tripType })}
            onContinue={() => handleStepComplete('context')}
            onSkipToItinerary={handleSkipToItinerary}
            onBack={() => navigate('/start')}
          />
        )}

        {/* Flight selection removed - customers bring their own flights */}

        {currentStep === 'hotels' && (
          <HotelSelection
            formData={formData}
            selectedHotel={formData.selectedHotel}
            onSelectHotel={(id, hotel) => updateFormData({ 
              selectedHotel: id, 
              selectedHotelData: hotel 
            })}
            onContinue={() => handleStepComplete('hotels')}
            onBack={handleBack}
          />
        )}

        {currentStep === 'booking' && (
          <BookingOptions
            tripSummary={calculateTripSummary()}
            onBook={handleBook}
            onSave={handleSave}
            onBuildItinerary={handleBuildItinerary}
            onBack={handleBack}
            isLoading={isLoading}
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
