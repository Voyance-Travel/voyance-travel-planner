import { motion } from 'framer-motion';
import { format, addDays } from 'date-fns';
import { Plane, Hotel, MapPin, Clock, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ItineraryPreviewProps {
  tripDetails: {
    name?: string;
    destination: string;
    departureCity: string;
    startDate: string;
    endDate: string;
    travelers: number;
  };
  onComplete: () => void;
  onBack: () => void;
  isLoading?: boolean;
}

interface DayActivity {
  time: string;
  title: string;
  description: string;
  type: 'activity' | 'meal' | 'transport';
}

// Generate sample itinerary
function generateItinerary(startDate: string, endDate: string): { date: Date; activities: DayActivity[] }[] {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  
  const sampleActivities: DayActivity[][] = [
    [
      { time: '10:00 AM', title: 'Check-in & Explore', description: 'Settle into your hotel and explore the neighborhood', type: 'activity' },
      { time: '1:00 PM', title: 'Local Lunch', description: 'Try local cuisine at a recommended restaurant', type: 'meal' },
      { time: '3:00 PM', title: 'Walking Tour', description: 'Guided tour of historic landmarks', type: 'activity' },
    ],
    [
      { time: '9:00 AM', title: 'Museum Visit', description: 'Explore the city\'s famous art museum', type: 'activity' },
      { time: '12:30 PM', title: 'Café Break', description: 'Coffee and pastries at a local café', type: 'meal' },
      { time: '2:00 PM', title: 'Shopping District', description: 'Browse local boutiques and markets', type: 'activity' },
      { time: '7:00 PM', title: 'Fine Dining', description: 'Dinner at a Michelin-starred restaurant', type: 'meal' },
    ],
    [
      { time: '8:00 AM', title: 'Day Trip', description: 'Full-day excursion to nearby attractions', type: 'transport' },
      { time: '12:00 PM', title: 'Picnic Lunch', description: 'Scenic lunch with local delicacies', type: 'meal' },
      { time: '6:00 PM', title: 'Return & Relax', description: 'Evening at leisure', type: 'activity' },
    ],
  ];

  return Array.from({ length: days }, (_, i) => ({
    date: addDays(start, i),
    activities: sampleActivities[i % sampleActivities.length],
  }));
}

export default function ItineraryPreview({
  tripDetails,
  onComplete,
  onBack,
  isLoading,
}: ItineraryPreviewProps) {
  const itinerary = generateItinerary(tripDetails.startDate, tripDetails.endDate);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto"
    >
      <div className="text-center mb-10">
        <h1 className="text-3xl font-display font-medium text-slate-900 mb-2">
          Your Trip Preview
        </h1>
        <p className="text-slate-600">
          Review your itinerary for {tripDetails.destination}
        </p>
      </div>

      {/* Trip Summary Card */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white mb-8">
        <h2 className="text-2xl font-display font-medium mb-4">
          {tripDetails.name || `Trip to ${tripDetails.destination}`}
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-xs text-slate-400">Destination</p>
              <p className="font-medium">{tripDetails.destination}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Plane className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-xs text-slate-400">From</p>
              <p className="font-medium">{tripDetails.departureCity}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-xs text-slate-400">Dates</p>
              <p className="font-medium">
                {format(new Date(tripDetails.startDate), 'MMM d')} -{' '}
                {format(new Date(tripDetails.endDate), 'MMM d')}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Hotel className="w-5 h-5 text-slate-400" />
            <div>
              <p className="text-xs text-slate-400">Travelers</p>
              <p className="font-medium">{tripDetails.travelers} guests</p>
            </div>
          </div>
        </div>
      </div>

      {/* Day-by-Day Itinerary */}
      <div className="space-y-6 mb-10">
        {itinerary.map((day, dayIndex) => (
          <motion.div
            key={dayIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: dayIndex * 0.1 }}
            className="bg-white rounded-xl border border-slate-200 overflow-hidden"
          >
            {/* Day Header */}
            <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-slate-500">
                    Day {dayIndex + 1}
                  </span>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {format(day.date, 'EEEE, MMMM d')}
                  </h3>
                </div>
              </div>
            </div>

            {/* Activities */}
            <div className="p-6">
              <div className="space-y-4">
                {day.activities.map((activity, actIndex) => (
                  <div key={actIndex} className="flex gap-4">
                    <div className="flex items-center gap-2 text-slate-400 w-24 flex-shrink-0">
                      <Clock className="w-4 h-4" />
                      <span className="text-sm">{activity.time}</span>
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{activity.title}</p>
                      <p className="text-sm text-slate-500">{activity.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} className="h-12 px-6">
          Back
        </Button>
        <Button
          onClick={onComplete}
          disabled={isLoading}
          className="h-12 px-8 bg-slate-900 hover:bg-slate-800 text-white"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              Creating Trip...
            </span>
          ) : (
            'Confirm & Book'
          )}
        </Button>
      </div>
    </motion.div>
  );
}
