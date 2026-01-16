import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin, Clock, Globe, ArrowRight } from 'lucide-react';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ActivityModal } from '@/components/ActivityModal';
import { getDestinationById, getActivitiesByDestination, type Activity } from '@/lib/destinations';
import { useAuth } from '@/lib/auth';

export default function DestinationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  
  const destination = getDestinationById(id || '');
  const activities = getActivitiesByDestination(id || '');

  if (!destination) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-serif text-2xl mb-4">Destination not found</h1>
          <Link to="/explore">
            <Button>Back to Explore</Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleStartTrip = () => {
    if (isAuthenticated) {
      navigate(`/trip/new?destinationId=${destination.id}`);
    } else {
      navigate('/signin', { state: { from: `/trip/new?destinationId=${destination.id}` } });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero */}
      <section className="relative h-[60vh] min-h-[400px]">
        <img 
          src={destination.imageUrl} 
          alt={destination.city}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 hero-overlay" />
        
        <div className="absolute inset-0 flex items-end">
          <div className="container mx-auto px-6 pb-12">
            <Link to="/explore" className="inline-flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground mb-4 transition-colors">
              <ArrowLeft className="h-4 w-4" />
              Back to Explore
            </Link>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <p className="text-primary-foreground/80 uppercase tracking-widest text-sm mb-2">
                {destination.country} · {destination.region}
              </p>
              <h1 className="font-serif text-5xl md:text-6xl font-semibold text-primary-foreground mb-4">
                {destination.city}
              </h1>
              <p className="text-xl text-primary-foreground/90 max-w-2xl">
                {destination.tagline}
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      <main className="py-16">
        <div className="container mx-auto px-6">
          {/* Description & CTA */}
          <div className="grid lg:grid-cols-3 gap-12 mb-16">
            <div className="lg:col-span-2">
              <h2 className="font-serif text-2xl font-semibold mb-4">About {destination.city}</h2>
              <p className="text-muted-foreground text-lg leading-relaxed">{destination.description}</p>
              
              <div className="flex flex-wrap gap-4 mt-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  <span>{destination.timezone}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium">Currency:</span>
                  <span>{destination.currency}</span>
                </div>
              </div>
            </div>
            
            <div className="bg-card p-6 rounded-xl border border-border shadow-soft h-fit">
              <h3 className="font-serif text-xl font-semibold mb-3">Plan your trip</h3>
              <p className="text-muted-foreground text-sm mb-6">
                Get a personalized, time-optimized itinerary with explainable recommendations.
              </p>
              <Button variant="accent" size="lg" className="w-full" onClick={handleStartTrip}>
                Start Planning
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </div>

          {/* Sample Activities */}
          {activities.length > 0 && (
            <section>
              <h2 className="font-serif text-2xl font-semibold mb-6">Sample Experiences</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {activities.map((activity, index) => (
                  <motion.button
                    key={activity.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => setSelectedActivity(activity)}
                    className="text-left p-5 bg-card rounded-xl border border-border hover:border-accent/50 hover:shadow-soft transition-all"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <Badge variant="secondary" className="text-xs capitalize">{activity.category}</Badge>
                      {activity.duration && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {activity.duration}
                        </span>
                      )}
                    </div>
                    <h4 className="font-medium mb-1">{activity.title}</h4>
                    {activity.neighborhood && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {activity.neighborhood}
                      </p>
                    )}
                  </motion.button>
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <ActivityModal
        activity={selectedActivity}
        isOpen={!!selectedActivity}
        onClose={() => setSelectedActivity(null)}
        destinationImage={destination.imageUrl}
      />
    </div>
  );
}
