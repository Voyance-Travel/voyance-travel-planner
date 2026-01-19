import { useEffect, useMemo } from 'react';
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
  const { state, setBasics, saveTrip } = useTripPlanner();

  // Ensure basics are set even if user refreshes
  useEffect(() => {
    const destination = searchParams.get('destination');
    const origin = searchParams.get('origin');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const travelers = searchParams.get('travelers');

    if (destination && (!state.basics.destination || state.basics.destination !== destination)) {
      setBasics({
        destination,
        originCity: origin || state.basics.originCity,
        startDate: startDate || state.basics.startDate,
        endDate: endDate || state.basics.endDate,
        travelers: travelers ? Number(travelers) : state.basics.travelers,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

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
    };
  }, [state.basics, state.flights, state.hotel, travelers, nights, totalCost]);

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
            onSave={async () => {
              const tripId = await ensureTripId();
              if (!tripId) return;
              toast.success('Trip saved! Ready to build your itinerary.');
              const params = new URLSearchParams(searchParams);
              params.set('tripId', tripId);
              navigate(`/planner/itinerary?${params.toString()}`);
            }}
            onBuildItinerary={async () => {
              const tripId = await ensureTripId();
              if (!tripId) return;
              const params = new URLSearchParams(searchParams);
              params.set('tripId', tripId);
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
