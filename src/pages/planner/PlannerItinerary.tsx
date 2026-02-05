import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTripPlanner } from '@/contexts/TripPlannerContext';
import { Loader2 } from 'lucide-react';

/**
 * PlannerItinerary - DEPRECATED
 * 
 * This page has been consolidated into the /start flow.
 * It now redirects users to the proper trip generation route.
 */
export default function PlannerItinerary() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state, saveTrip } = useTripPlanner();

  // Redirect to proper route
  useEffect(() => {
    const urlTripId = searchParams.get('tripId');
    
    if (urlTripId) {
      // Redirect to trip page with generate flag
      navigate(`/trip/${urlTripId}?generate=true`, { replace: true });
    } else if (state.tripId) {
      navigate(`/trip/${state.tripId}?generate=true`, { replace: true });
    } else {
      // Save trip first, then redirect
      const initTrip = async () => {
        const savedTripId = await saveTrip();
        if (savedTripId) {
          navigate(`/trip/${savedTripId}?generate=true`, { replace: true });
        } else {
          navigate('/start');
        }
      };
      initTrip();
    }
  }, [searchParams, state.tripId, saveTrip, navigate]);

  // Show loading while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground">Preparing your itinerary...</p>
      </div>
    </div>
  );
}
