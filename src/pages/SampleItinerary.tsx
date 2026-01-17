import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Calendar, Users, MapPin, Plane, Hotel, 
  Clock, ArrowRight, Sparkles, ChevronLeft
} from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ItineraryView } from '@/components/ItineraryView';
import { getSampleTrip } from '@/utils/sampleItinerary';
import { format, parseISO } from 'date-fns';

export default function SampleItinerary() {
  const navigate = useNavigate();
  const sampleTrip = getSampleTrip();
  const [showFullItinerary, setShowFullItinerary] = useState(false);

  const formatDate = (dateStr: string) => {
    return format(parseISO(dateStr), 'MMM d, yyyy');
  };

  return (
    <MainLayout>
      <Head 
        title="Sample Itinerary - Kyoto, Japan | Voyance" 
        description="See what a personalized Voyance travel itinerary looks like. 5 days in Kyoto with curated experiences, local recommendations, and smart pacing."
      />
      
      {/* Hero Section */}
      <section className="relative pt-20 pb-16 bg-gradient-to-b from-secondary to-background overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?w=1920')] bg-cover bg-center opacity-10" />
        
        <div className="relative max-w-5xl mx-auto px-4">
          {/* Back Button */}
          <Button 
            variant="ghost" 
            className="mb-6 -ml-2"
            onClick={() => navigate(-1)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <Badge variant="secondary" className="mb-4">
              <Sparkles className="h-3 w-3 mr-1" />
              Sample Itinerary
            </Badge>
            <h1 className="text-4xl md:text-5xl font-serif font-bold mb-4">
              {sampleTrip.destination}
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Experience ancient temples, serene gardens, and authentic cuisine 
              in Japan's cultural heart. Here's what your trip could look like.
            </p>
          </motion.div>

          {/* Trip Quick Stats */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="flex flex-wrap justify-center gap-4 md:gap-8"
          >
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-accent" />
              <span>{formatDate(sampleTrip.startDate)} - {formatDate(sampleTrip.endDate)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-accent" />
              <span>{sampleTrip.itinerary.days.length} Days</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Users className="h-4 w-4 text-accent" />
              <span>{sampleTrip.travelers} Travelers</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Itinerary Content */}
      <section className="py-12 max-w-4xl mx-auto px-4">
        {/* Trip Summary Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8 p-6 bg-card rounded-xl border border-border"
        >
          <h2 className="font-serif text-2xl font-semibold mb-4">What's Included</h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-accent/10 rounded-lg">
                <Plane className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h3 className="font-medium">Flight Options</h3>
                <p className="text-sm text-muted-foreground">
                  Curated flight recommendations with optimal timing
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-accent/10 rounded-lg">
                <Hotel className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h3 className="font-medium">Hotel Selection</h3>
                <p className="text-sm text-muted-foreground">
                  Handpicked stays matching your preferences
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 bg-accent/10 rounded-lg">
                <MapPin className="h-5 w-5 text-accent" />
              </div>
              <div>
                <h3 className="font-medium">Daily Activities</h3>
                <p className="text-sm text-muted-foreground">
                  Experiences tailored to your travel style
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Itinerary Days */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-serif text-2xl font-semibold">Day-by-Day Itinerary</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFullItinerary(!showFullItinerary)}
            >
              {showFullItinerary ? 'Show Preview' : 'Expand All'}
            </Button>
          </div>
          
          <ItineraryView 
            itinerary={sampleTrip.itinerary} 
            isLocked={!showFullItinerary}
          />
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-12 text-center p-8 bg-gradient-to-br from-accent/10 to-accent/5 rounded-2xl border border-accent/20"
        >
          <h2 className="font-serif text-2xl font-semibold mb-3">
            Ready to Plan Your Own Trip?
          </h2>
          <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
            Take our quick travel quiz and we'll create a personalized itinerary 
            just for you—complete with flights, hotels, and experiences.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button 
              size="lg" 
              className="gap-2"
              onClick={() => navigate('/quiz')}
            >
              Start Planning
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => navigate('/explore')}
            >
              Explore Destinations
            </Button>
          </div>
        </motion.div>
      </section>
    </MainLayout>
  );
}
