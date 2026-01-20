import { Navigate, useParams } from 'react-router-dom';

export default function ItineraryView() {
  const { id } = useParams();
  // Redirect to the trip detail page which has full itinerary support
  return <Navigate to={`/trip/${id}`} replace />;
}
