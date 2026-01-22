import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'sonner';

import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import EditorialTripSummary from '@/components/planner/summary/EditorialTripSummary';
import { useTripPlanner } from '@/contexts/TripPlannerContext';

function calculateNights(startDate?: string, endDate?: string): number {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

export default function PlannerSummary() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state, setBasics, saveTrip, loadTrip } = useTripPlanner();
  const [activitiesBudget, setActivitiesBudget] = useState(state.basics.budgetAmount || 0);

  // Load trip from tripId in URL (prevents "stuck" summaries when context has old data)
  useEffect(() => {
    const tripIdFromUrl = searchParams.get('tripId');
    if (tripIdFromUrl && tripIdFromUrl !== state.tripId) {
      loadTrip(tripIdFromUrl);
    }
  }, [searchParams, state.tripId, state.basics.destination, loadTrip]);

  // Ensure basics are aligned with URL params (even if user refreshes or deep-links)
  useEffect(() => {
    const destination = searchParams.get('destination') || undefined;
    const originCity = searchParams.get('origin') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const travelersParam = searchParams.get('travelers');
    const tripTypeParam = searchParams.get('tripType') || undefined;

    const nextBasics: Record<string, unknown> = {};

    if (destination && destination !== state.basics.destination) nextBasics.destination = destination;
    if (originCity && originCity !== state.basics.originCity) nextBasics.originCity = originCity;
    if (startDate && startDate !== state.basics.startDate) nextBasics.startDate = startDate;
    if (endDate && endDate !== state.basics.endDate) nextBasics.endDate = endDate;

    const travelers = travelersParam ? Number(travelersParam) : undefined;
    if (typeof travelers === 'number' && !Number.isNaN(travelers) && travelers !== state.basics.travelers) {
      nextBasics.travelers = travelers;
    }

    if (tripTypeParam && tripTypeParam !== state.basics.tripType) {
      // NOTE: TripBasics.tripType is narrower than our planner trip types; allow runtime values.
      nextBasics.tripType = tripTypeParam;
    }

    if (Object.keys(nextBasics).length > 0) {
      setBasics(nextBasics as any);
    }
  }, [searchParams, setBasics, state.basics]);

  const travelers = state.basics.travelers || 1;
  const nights = calculateNights(state.basics.startDate, state.basics.endDate);

  const totalCost = useMemo(() => {
    let total = 0;

    if (state.flights?.departure?.price) total += state.flights.departure.price * travelers;
    if (state.flights?.return?.price) total += state.flights.return.price * travelers;

    if (state.hotel?.pricePerNight && nights > 0) {
      total += state.hotel.pricePerNight * nights;
    }

    // (itinerary activities not included here yet)
    return total;
  }, [state.flights, state.hotel, travelers, nights]);

  const data = useMemo(() => {
    const startDate = state.basics.startDate || '';
    const endDate = state.basics.endDate || '';

    return {
      destination: state.basics.destination || 'Your destination',
      departureCity: state.basics.originCity || 'Your city',
      startDate,
      endDate,
      travelers,
      outboundFlight: state.flights?.departure
        ? {
            airline: state.flights.departure.airline,
            flightNumber: state.flights.departure.flightNumber,
            departure: state.flights.departure.departureTime,
            arrival: state.flights.departure.arrivalTime,
            departureAirport: state.basics.originCity || 'Origin',
            arrivalAirport: state.basics.destination || 'Destination',
            cabin: state.flights.departure.cabin,
            price: state.flights.departure.price,
          }
        : undefined,
      returnFlight: state.flights?.return
        ? {
            airline: state.flights.return.airline,
            flightNumber: state.flights.return.flightNumber,
            departure: state.flights.return.departureTime,
            arrival: state.flights.return.arrivalTime,
            departureAirport: state.basics.destination || 'Destination',
            arrivalAirport: state.basics.originCity || 'Origin',
            cabin: state.flights.return.cabin,
            price: state.flights.return.price,
          }
        : undefined,
      hotel: state.hotel
        ? {
            name: state.hotel.name,
            stars: Math.round(state.hotel.rating / 2) || 4,
            neighborhood: state.hotel.location,
            roomType: state.hotel.roomType,
            checkIn: startDate ? format(new Date(startDate), 'MMM d') : '',
            checkOut: endDate ? format(new Date(endDate), 'MMM d') : '',
            pricePerNight: state.hotel.pricePerNight,
            totalPrice: state.hotel.pricePerNight * nights,
            amenities: state.hotel.amenities,
          }
        : undefined,
      totalCost,
      tripName: state.basics.destination ? `Trip to ${state.basics.destination}` : 'Your Trip',
      activitiesBudget,
    };
  }, [state.basics, state.flights, state.hotel, travelers, nights, totalCost, activitiesBudget]);

  const handleActivitiesBudgetChange = (budget: number) => {
    setActivitiesBudget(budget);
    // Update the context with the budget for itinerary generation
    setBasics({ ...state.basics, budgetAmount: budget });
  };

  const ensureTripId = async (): Promise<string | null> => {
    const tripId = await saveTrip();
    if (!tripId) {
      toast.error('Unable to save your trip. Please try again.');
      return null;
    }
    return tripId;
  };

  return (
    <MainLayout>
      <Head
        title="Trip Summary | Voyance"
        description="Review your flights, hotel, and total cost. Print or share your trip."
      />

      <section className="pt-24 pb-16 min-h-screen bg-background">
        <div className="max-w-6xl mx-auto px-4">
          <EditorialTripSummary
            data={data}
            priceLockExpiry={new Date(Date.now() + 30 * 60 * 1000)}
            isLoading={false}
            onBack={() => navigate(-1)}
            onActivitiesBudgetChange={handleActivitiesBudgetChange}
            onSave={async () => {
              const tripId = await ensureTripId();
              if (!tripId) return;
              toast.success('Trip saved! Ready to build your itinerary.');
              const params = new URLSearchParams(searchParams);
              params.set('tripId', tripId);
              if (activitiesBudget > 0) {
                params.set('activitiesBudget', String(activitiesBudget));
              }
              navigate(`/planner/itinerary?${params.toString()}`);
            }}
            onBuildItinerary={async () => {
              const tripId = await ensureTripId();
              if (!tripId) return;
              const params = new URLSearchParams(searchParams);
              params.set('tripId', tripId);
              if (activitiesBudget > 0) {
                params.set('activitiesBudget', String(activitiesBudget));
              }
              navigate(`/planner/itinerary?${params.toString()}`);
            }}
            onBook={async () => {
              const tripId = await ensureTripId();
              if (!tripId) return;
              navigate(`/planner/booking?tripId=${tripId}`);
            }}
          />
        </div>
      </section>
    </MainLayout>
  );
}
