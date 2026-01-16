import { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Calendar, Users, MapPin, Clock, ChevronDown, ChevronRight, Star, Coffee, Utensils, Camera, Bus, Bed, Download, Share2, Edit, Printer } from 'lucide-react';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { getDestinationById } from '@/lib/destinations';
import { useTripStore } from '@/lib/tripStore';
import { formatDate, type Itinerary, type ItineraryDay, type ItineraryItem } from '@/lib/trips';

// Type icons
const typeIcons: Record<string, React.ReactNode> = {
  ACTIVITY: <Camera className="h-4 w-4" />,
  FOOD: <Utensils className="h-4 w-4" />,
  TRANSIT: <Bus className="h-4 w-4" />,
  BREAK: <Coffee className="h-4 w-4" />,
};

const typeColors: Record<string, string> = {
  ACTIVITY: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  FOOD: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  TRANSIT: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  BREAK: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

// Fallback itinerary generator for prototype
function generateDetailedItinerary(destinationId: string, startDate: string, endDate: string): Omit<Itinerary, 'id' | 'tripId' | 'createdAt' | 'updatedAt'> {
  const destination = getDestinationById(destinationId);
  const start = new Date(startDate);
  const end = new Date(endDate);
  const dayCount = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const sampleDays: ItineraryDay[] = [
    {
      id: 'day-1',
      dayNumber: 1,
      date: startDate,
      headline: `Arrival & Sacred Beginnings`,
      rationale: ['Gentle introduction to local culture', 'Built-in rest time after travel'],
      items: [
        { id: '1-1', type: 'ACTIVITY', title: 'Arrival at Ngurah Rai International Airport', startTime: '14:00', endTime: '15:00', neighborhood: 'Denpasar', notes: 'Land in Denpasar and meet your private driver for a personalized vehicle to the airport.', rationale: ['Pre-arranged pickup eliminates stress'] },
        { id: '1-2', type: 'TRANSIT', title: 'Private Transfer to Ubud', startTime: '15:00', endTime: '16:30', notes: 'Scenic drive past rice terraces and traditional villages on a route less travelled in a comfortable air-conditioned vehicle.', rationale: ['Avoid busy southern traffic routes'] },
        { id: '1-3', type: 'ACTIVITY', title: 'Villa Arria Check-In & Welcome Ceremony', startTime: '17:00', endTime: '18:00', neighborhood: 'Ubud', notes: 'Settle into your private villa with infinity pool, panorama views, and traditional Balinese blessing ceremony.', rationale: ['Traditional welcome sets the tone for authentic experiences'] },
        { id: '1-4', type: 'FOOD', title: 'Lunch at Bebek Bengil (Dirty Duck)', startTime: '12:30', endTime: '14:00', neighborhood: 'Ubud', notes: 'Famous crispy duck with rice paddies view and traditional sambal. Balinese cooking class also available.', rationale: ['Iconic Ubud dining experience', 'Best visited during lunch to avoid dinner crowds'] },
        { id: '1-5', type: 'ACTIVITY', title: 'Sunset Yoga & Meditation with Made Suryanata', startTime: '17:30', endTime: '19:00', neighborhood: 'Ubud', notes: 'Private session with renowned local yoga master at Villa\'s floating pavilion.', rationale: ['Evening practice aids jet lag recovery'] },
        { id: '1-6', type: 'FOOD', title: 'Dinner at Locavore Restaurant', startTime: '19:30', endTime: '21:30', neighborhood: 'Ubud', notes: 'A tasting experience of modern Indonesian cuisine with 7-course seasonal tasting menu. Reservations required.', rationale: ['Award-winning restaurant requires advance booking'] },
      ],
    },
    {
      id: 'day-2',
      dayNumber: 2,
      date: new Date(new Date(startDate).setDate(new Date(startDate).getDate() + 1)).toISOString().split('T')[0],
      headline: `Sacred Temples & Artisan Culture`,
      rationale: ['Morning temple visits beat the heat and crowds', 'Afternoon cultural immersion'],
      items: [
        { id: '2-1', type: 'FOOD', title: 'Traditional Balinese Breakfast', startTime: '07:30', endTime: '08:30', neighborhood: 'Villa', notes: 'Fresh tropical fruits, jamu (traditional herbal drinks), and nasi goreng at the villa.', rationale: ['In-villa breakfast maximizes relaxation'] },
        { id: '2-2', type: 'ACTIVITY', title: 'Tirta Empul Water Temple', startTime: '09:00', endTime: '11:00', neighborhood: 'Tampaksiring', notes: 'Sacred purification ritual at 1000-year-old spring temple. Bring sarong (provided).', rationale: ['Early morning visits are most spiritual', 'Fewer tourists before 10am'] },
        { id: '2-3', type: 'ACTIVITY', title: 'Tegallalang Rice Terraces Walk', startTime: '11:30', endTime: '13:00', neighborhood: 'Tegallalang', notes: 'Guided walk through iconic terraces with local farmer storytelling.', rationale: ['Midday light creates dramatic photography'] },
        { id: '2-4', type: 'FOOD', title: 'Lunch at Sari Organik', startTime: '13:30', endTime: '15:00', neighborhood: 'Ubud', notes: 'Farm-to-table organic restaurant overlooking rice paddies.', rationale: ['Supports local organic farming community'] },
        { id: '2-5', type: 'BREAK', title: 'Villa Relaxation & Spa', startTime: '15:30', endTime: '17:30', notes: 'Traditional Balinese massage at the villa spa or pool time.', rationale: ['Mid-afternoon break prevents exhaustion'] },
        { id: '2-6', type: 'ACTIVITY', title: 'Balinese Cooking Class', startTime: '18:00', endTime: '21:00', neighborhood: 'Ubud', notes: 'Learn to prepare authentic dishes with local chef, then enjoy your creation for dinner.', rationale: ['Evening cooking combines activity with dinner'] },
      ],
    },
  ];

  // Generate remaining days with similar structure
  const days: ItineraryDay[] = Array.from({ length: Math.min(dayCount, 5) }, (_, i) => {
    if (i < sampleDays.length) {
      return sampleDays[i];
    }
    return {
      id: `day-${i + 1}`,
      dayNumber: i + 1,
      date: new Date(new Date(startDate).setDate(new Date(startDate).getDate() + i)).toISOString().split('T')[0],
      headline: i === dayCount - 1 ? 'Departure Day' : `Day ${i + 1} Adventures`,
      rationale: ['Balanced mix of activities and rest', 'Optimized for local timing'],
      items: [
        { id: `${i + 1}-1`, type: 'ACTIVITY' as const, title: 'Morning Exploration', startTime: '09:00', endTime: '12:00', notes: 'Discover hidden gems in the area.', rationale: ['Best morning light'] },
        { id: `${i + 1}-2`, type: 'FOOD' as const, title: 'Local Lunch Experience', startTime: '12:30', endTime: '14:00', notes: 'Authentic local cuisine.', rationale: ['Midday dining'] },
        { id: `${i + 1}-3`, type: 'BREAK' as const, title: 'Afternoon Rest', startTime: '14:30', endTime: '16:00', notes: 'Recharge for evening activities.', rationale: ['Prevents travel fatigue'] },
        { id: `${i + 1}-4`, type: 'ACTIVITY' as const, title: 'Sunset Activity', startTime: '16:30', endTime: '18:30', notes: 'Evening exploration or relaxation.', rationale: ['Golden hour experiences'] },
        { id: `${i + 1}-5`, type: 'FOOD' as const, title: 'Dinner', startTime: '19:00', endTime: '21:00', notes: 'Evening dining experience.', rationale: ['Optimal dinner timing'] },
      ],
    };
  });

  return {
    summary: `Your ${dayCount}-day journey through ${destination?.city} has been crafted to balance authentic cultural immersion with thoughtful rest periods. Each day flows from morning exploration through midday discoveries to evening experiences, with built-in recovery time.`,
    days,
  };
}

export default function ItineraryPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const [searchParams] = useSearchParams();
  const { getTrip, getItinerary, saveItinerary, hasItinerary } = useTripStore();
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set([1]));
  const [activeTab, setActiveTab] = useState<'overview' | 'cultural' | 'itinerary'>('itinerary');

  // Support for sample itinerary from home page
  const isSample = searchParams.get('destination');
  
  const trip = tripId ? getTrip(tripId) : undefined;
  const destination = trip ? getDestinationById(trip.destinationId) : isSample ? { city: 'Bali', country: 'Indonesia', imageUrl: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=1200&q=80' } : undefined;
  const itinerary = tripId ? getItinerary(tripId) : undefined;

  // Generate itinerary if needed
  useEffect(() => {
    if (tripId && trip && !hasItinerary(tripId) && !isGenerating) {
      setIsGenerating(true);
      setTimeout(() => {
        const generated = generateDetailedItinerary(trip.destinationId, trip.startDate, trip.endDate);
        saveItinerary(tripId, generated);
        setIsGenerating(false);
      }, 1500);
    }
  }, [tripId, trip, hasItinerary, saveItinerary, isGenerating]);

  // Sample data for preview
  const sampleItinerary = isSample ? generateDetailedItinerary('bali', '2026-01-05', '2026-01-12') : null;
  const displayItinerary = itinerary || sampleItinerary;

  const toggleDay = (dayNumber: number) => {
    setExpandedDays(prev => {
      const next = new Set(prev);
      if (next.has(dayNumber)) {
        next.delete(dayNumber);
      } else {
        next.add(dayNumber);
      }
      return next;
    });
  };

  if (!destination && !isSample) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-serif text-2xl mb-4">Trip not found</h1>
          <Link to="/profile"><Button>Back to Profile</Button></Link>
        </div>
      </div>
    );
  }

  const tripDays = displayItinerary?.days.length || 5;
  const totalActivities = displayItinerary?.days.reduce((acc, day) => acc + day.items.length, 0) || 28;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Compact Header */}
      <section className="pt-24 pb-8 bg-background border-b border-border">
        <div className="container mx-auto px-6">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
            <Link to="/profile" className="hover:text-foreground">Profile</Link>
            <ChevronRight className="h-4 w-4" />
            <span>{destination?.city}, {destination?.country}</span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-serif text-3xl font-semibold">{destination?.city}, {destination?.country}</h1>
              <p className="text-muted-foreground">Complete Itinerary</p>
              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {tripDays} nights • Jan 05 - Jan 27, 2026</span>
                <span className="flex items-center gap-1"><Users className="h-4 w-4" /> 2 Travelers</span>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mt-6">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'cultural', label: 'Cultural Travel Tips' },
              { id: 'itinerary', label: 'Itinerary' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="py-4 bg-secondary/30 border-b border-border">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between">
            <div className="grid grid-cols-4 gap-8">
              <div>
                <p className="text-2xl font-semibold">{tripDays}</p>
                <p className="text-xs text-muted-foreground">Days planned</p>
              </div>
              <div>
                <p className="text-2xl font-semibold">{totalActivities}</p>
                <p className="text-xs text-muted-foreground">Curated activities</p>
              </div>
              <div>
                <p className="text-2xl font-semibold">4</p>
                <p className="text-xs text-muted-foreground">Destinations</p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-accent">$6,030</p>
                <p className="text-xs text-muted-foreground">Total cost</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="py-8">
        <div className="container mx-auto px-6">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Content */}
            <div className="lg:col-span-2">
              {/* Flight Details Card */}
              <div className="bg-card rounded-xl border border-border p-6 mb-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">Flight Details</h3>
                  <span className="text-xs text-muted-foreground">Your journey to Bali, Indonesia</span>
                </div>
                
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">OUTBOUND</span>
                      <span>Jan 05, 2026</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div>
                        <p className="text-lg font-semibold">LAX</p>
                        <p className="text-xs text-muted-foreground">Los Angeles, CA</p>
                      </div>
                      <div className="flex-1 relative">
                        <div className="border-t border-dashed border-border" />
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-2 text-xs text-muted-foreground">
                          1 stop in Singapore
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold">DPS</p>
                        <p className="text-xs text-muted-foreground">Denpasar, Bali</p>
                      </div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>11:25 PM</span>
                      <span className="text-muted-foreground">→ 17:30 (+2d)</span>
                      <span>11:30 AM</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Total Duration: 24h 05minutes</p>
                  </div>

                  {/* Hotel Preview */}
                  <div className="rounded-lg overflow-hidden">
                    <img 
                      src="https://images.unsplash.com/photo-1582719508461-905c673771fd?w=600&q=80" 
                      alt="Hotel"
                      className="w-full h-32 object-cover"
                    />
                    <div className="p-3 bg-secondary/50">
                      <p className="text-xs text-muted-foreground">Your Ubud Stay • Arriving Jan 05</p>
                      <p className="font-medium text-sm">Four Seasons Resort Bali at Sayan</p>
                      <div className="flex items-center gap-1 text-xs mt-1">
                        <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                        <span>5 Star Luxury Resort</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Day-by-Day Itinerary */}
              {isGenerating ? (
                <div className="text-center py-16">
                  <div className="inline-block h-12 w-12 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4" />
                  <h2 className="font-serif text-2xl font-semibold mb-2">Crafting your itinerary...</h2>
                </div>
              ) : displayItinerary ? (
                <div className="space-y-4">
                  {displayItinerary.days.map((day) => (
                    <motion.div
                      key={day.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="bg-card rounded-xl border border-border overflow-hidden"
                    >
                      {/* Day Header */}
                      <button
                        onClick={() => toggleDay(day.dayNumber)}
                        className="w-full p-4 flex items-center justify-between text-left hover:bg-secondary/30 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-accent text-accent-foreground flex items-center justify-center font-semibold">
                            {String(day.dayNumber).padStart(2, '0')}
                          </div>
                          <div>
                            <h3 className="font-semibold">Day {day.dayNumber}: {day.headline}</h3>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                              <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {day.date}</span>
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {day.items.length} activities</span>
                              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> 4 locations</span>
                            </div>
                          </div>
                        </div>
                        <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${expandedDays.has(day.dayNumber) ? 'rotate-180' : ''}`} />
                      </button>

                      {/* Day Content */}
                      {expandedDays.has(day.dayNumber) && (
                        <div className="border-t border-border">
                          <div className="p-4 space-y-4">
                            {day.items.map((item, idx) => (
                              <div key={item.id} className="flex gap-4">
                                <div className="text-sm text-muted-foreground w-16 shrink-0 text-right pt-1">
                                  {item.startTime}
                                </div>
                                <div className="flex-1 pb-4 border-b border-border last:border-0 last:pb-0">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <h4 className="font-medium">{item.title}</h4>
                                        {idx === 0 && <span className="text-xs px-2 py-0.5 rounded bg-accent/10 text-accent">Featured</span>}
                                      </div>
                                      <p className="text-sm text-muted-foreground mb-2">{item.notes}</p>
                                      <div className="flex flex-wrap gap-2 text-xs">
                                        {item.neighborhood && (
                                          <span className="flex items-center gap-1 text-muted-foreground">
                                            <MapPin className="h-3 w-3" /> {item.neighborhood}
                                          </span>
                                        )}
                                        {item.startTime && item.endTime && (
                                          <span className="flex items-center gap-1 text-muted-foreground">
                                            <Clock className="h-3 w-3" /> {item.startTime} - {item.endTime}
                                          </span>
                                        )}
                                      </div>
                                      <div className="flex gap-2 mt-3">
                                        <Button variant="outline" size="sm" className="h-7 text-xs">
                                          View Alternative
                                        </Button>
                                        <Button variant="ghost" size="sm" className="h-7 text-xs">
                                          <MapPin className="h-3 w-3 mr-1" /> Save to Maps
                                        </Button>
                                      </div>
                                    </div>
                                    <div className={`px-2 py-1 rounded text-xs ${typeColors[item.type]}`}>
                                      {item.type.toLowerCase()}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </motion.div>
                  ))}
                </div>
              ) : null}
            </div>

            {/* Sidebar */}
            <div className="lg:col-span-1 space-y-6">
              {/* Quick Navigation */}
              <div className="bg-card rounded-xl border border-border p-4 sticky top-24">
                <h3 className="font-semibold mb-4">Quick Navigation</h3>
                <div className="space-y-2">
                  {displayItinerary?.days.map((day) => (
                    <button
                      key={day.id}
                      onClick={() => {
                        setExpandedDays(prev => new Set(prev).add(day.dayNumber));
                      }}
                      className="w-full text-left p-2 rounded-lg hover:bg-secondary/50 transition-colors text-sm"
                    >
                      <p className="font-medium">Day {day.dayNumber}</p>
                      <p className="text-xs text-muted-foreground truncate">{day.headline}</p>
                    </button>
                  ))}
                </div>

                {/* Cost Breakdown */}
                <div className="mt-6 pt-4 border-t border-border">
                  <h4 className="font-semibold mb-3">Cost Breakdown</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Flights × 2 travelers</span>
                      <span>$1960</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Accommodations (5 nights)</span>
                      <span>$2750</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Activities & Experiences</span>
                      <span>$1320</span>
                    </div>
                    <div className="flex justify-between font-semibold pt-2 border-t border-border">
                      <span>Total Cost</span>
                      <span className="text-accent">$6,030</span>
                    </div>
                    <p className="text-xs text-muted-foreground">$3015 per person</p>
                  </div>
                </div>

                {/* Trip Details */}
                <div className="mt-6 pt-4 border-t border-border">
                  <h4 className="font-semibold mb-3">Trip Details</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Destination</p>
                      <p className="font-medium">Lombok</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Duration</p>
                      <p className="font-medium">5 nights</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Style</p>
                      <p className="font-medium">Relaxed</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Travelers</p>
                      <p className="font-medium">2 guests</p>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-6 space-y-2">
                  <Button variant="accent" className="w-full">
                    Save Itinerary
                  </Button>
                  <Button variant="outline" className="w-full">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit Trip
                  </Button>
                </div>

                <p className="text-xs text-muted-foreground mt-4 text-center">
                  Pro tip: Add activities as placeholders and swap them with others we've designed by using our
                  <span className="text-accent"> Discover</span> feature.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
