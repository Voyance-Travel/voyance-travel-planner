import { Navigate, useParams } from 'react-router-dom';
import { useTrip } from '@/services/supabase/trips';
import { parseLocalDate, getLocalToday } from '@/utils/dateUtils';

export default function ItineraryView() {
  const { id } = useParams();
  const { data: trip, isLoading } = useTrip(id);

  // Wait for trip data before choosing redirect target
  if (isLoading) {
    return null;
  }

  // Check if trip is currently active (status or date window)
  if (trip) {
    const isActive = trip.status === 'active';
    const today = getLocalToday();
    const inDateWindow =
      trip.start_date && trip.end_date &&
      today >= trip.start_date &&
      today <= trip.end_date;

    if (isActive || inDateWindow) {
      return <Navigate to={`/trip/${id}/active`} replace />;
    }
  }

  return <Navigate to={`/trip/${id}`} replace />;
}
