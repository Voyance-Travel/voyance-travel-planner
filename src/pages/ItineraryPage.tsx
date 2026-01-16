import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Users, MapPin, Download } from 'lucide-react';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { ItineraryView } from '@/components/ItineraryView';
import { getDestinationById } from '@/lib/destinations';
import { useTripStore } from '@/lib/tripStore';
import { formatDate, type Itinerary, type ItineraryDay, type ItineraryItem } from '@/lib/trips';

// Fallback itinerary generator for prototype
function generateFallbackItinerary(destinationId: string, startDate: string, endDate: string): Omit<Itinerary, 'id' | 'tripId' | 'createdAt' | 'updatedAt'> {
  const destination = getDestinationById(destinationId);
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dayCount = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const days: ItineraryDay[] = Array.from({ length: Math.min(dayCount, 5) }, (_, i) => {
    const date = new Date(start);
    date.setDate(date.getDate() + i);
    
    const items: ItineraryItem[] = [
      { id: `${i}-1`, type: 'ACTIVITY', title: i === 0 ? 'Arrival & neighborhood orientation' : 'Morning cultural exploration', startTime: '09:00', endTime: '11:30', neighborhood: 'Historic Center', notes: 'Start with the area closest to your hotel to ease into the rhythm.', rationale: ['Morning light is best for photography', 'Crowds build after 11am'] },
      { id: `${i}-2`, type: 'BREAK', title: 'Coffee & recovery', startTime: '11:30', endTime: '12:00', notes: 'A short pause helps maintain energy for the afternoon.' },
      { id: `${i}-3`, type: 'FOOD', title: 'Lunch at local favorite', startTime: '12:30', endTime: '14:00', neighborhood: 'Market District', notes: 'Ask for daily specials—seasonal ingredients shine here.', rationale: ['Midday dining avoids dinner rush'] },
      { id: `${i}-4`, type: 'ACTIVITY', title: 'Afternoon discovery', startTime: '15:00', endTime: '17:30', neighborhood: 'Arts Quarter', notes: 'This area rewards slow wandering.', rationale: ['Afternoon shade makes outdoor exploration comfortable'] },
      { id: `${i}-5`, type: 'BREAK', title: 'Hotel rest or optional spa', startTime: '17:30', endTime: '19:00', notes: 'Recharge before evening activities.' },
      { id: `${i}-6`, type: 'FOOD', title: 'Dinner experience', startTime: '19:30', endTime: '21:30', neighborhood: 'Waterfront', notes: 'Reservations recommended for weekend evenings.', rationale: ['Sunset views enhance the dining experience'] },
    ];

    return {
      id: `day-${i}`,
      dayNumber: i + 1,
      date: date.toISOString().split('T')[0],
      headline: i === 0 ? `Arrival & ${destination?.city} Introduction` : i === dayCount - 1 ? 'Departure Day Highlights' : `Exploring ${destination?.city}'s Hidden Corners`,
      rationale: ['Timing optimized for crowd avoidance', 'Built-in recovery periods prevent burnout', 'Neighborhood clustering minimizes transit time'],
      items,
    };
  });

  return {
    summary: `Your ${dayCount}-day journey through ${destination?.city} balances iconic experiences with local discoveries. Each day includes built-in recovery time and considers peak hours for popular sites. The itinerary clusters activities by neighborhood to minimize transit and maximize immersion.`,
    days,
  };
}

export default function ItineraryPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const { getTrip, getItinerary, saveItinerary, hasItinerary } = useTripStore();
  const [isGenerating, setIsGenerating] = useState(false);

  const trip = tripId ? getTrip(tripId) : undefined;
  const destination = trip ? getDestinationById(trip.destinationId) : undefined;
  const itinerary = tripId ? getItinerary(tripId) : undefined;

  useEffect(() => {
    if (tripId && trip && !hasItinerary(tripId) && !isGenerating) {
      setIsGenerating(true);
      // Simulate generation delay
      setTimeout(() => {
        const generated = generateFallbackItinerary(trip.destinationId, trip.startDate, trip.endDate);
        saveItinerary(tripId, generated);
        setIsGenerating(false);
      }, 1500);
    }
  }, [tripId, trip, hasItinerary, saveItinerary, isGenerating]);

  if (!trip || !destination) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-serif text-2xl mb-4">Trip not found</h1>
          <Link to="/profile"><Button>Back to Profile</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero */}
      <section className="relative h-[40vh] min-h-[300px]">
        <img src={destination.imageUrl} alt={destination.city} className="w-full h-full object-cover" />
        <div className="absolute inset-0 hero-overlay" />
        <div className="absolute inset-0 flex items-end">
          <div className="container mx-auto px-6 pb-8">
            <Link to="/profile" className="inline-flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground mb-4">
              <ArrowLeft className="h-4 w-4" /> Back to My Trips
            </Link>
            <h1 className="font-serif text-4xl md:text-5xl font-semibold text-primary-foreground mb-2">
              {destination.city} Itinerary
            </h1>
            <div className="flex flex-wrap gap-4 text-primary-foreground/90 text-sm">
              <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {formatDate(trip.startDate)} - {formatDate(trip.endDate)}</span>
              <span className="flex items-center gap-1"><Users className="h-4 w-4" /> {trip.travelersCount} traveler{trip.travelersCount > 1 ? 's' : ''}</span>
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> From {trip.departureCity}</span>
            </div>
          </div>
        </div>
      </section>

      <main className="py-12">
        <div className="container mx-auto px-6 max-w-4xl">
          {isGenerating ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
              <div className="inline-block h-12 w-12 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4" />
              <h2 className="font-serif text-2xl font-semibold mb-2">Crafting your itinerary...</h2>
              <p className="text-muted-foreground">Optimizing timing and selecting experiences</p>
            </motion.div>
          ) : itinerary ? (
            <ItineraryView itinerary={itinerary} isLocked={trip.status !== 'BOOKED'} />
          ) : (
            <div className="text-center py-16">
              <p className="text-muted-foreground">Unable to generate itinerary. Please try again.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
