import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Compass } from 'lucide-react';
import { Header } from '@/components/Header';
import { TripCard } from '@/components/TripCard';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { useTripStore } from '@/lib/tripStore';

export default function Profile() {
  const { user } = useAuth();
  const { getUserTrips } = useTripStore();
  
  const trips = user ? getUserTrips(user.id) : [];
  const draftTrips = trips.filter(t => t.status === 'DRAFT');
  const upcomingTrips = trips.filter(t => t.status === 'SAVED' || t.status === 'BOOKED');

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-6">
          {/* Header */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <h1 className="font-serif text-4xl font-semibold mb-2">My Trips</h1>
            <p className="text-muted-foreground">Welcome back, {user?.email}</p>
          </motion.div>

          {/* Quick action */}
          <Link to="/explore">
            <Button variant="accent" className="mb-10">
              <Plus className="h-4 w-4 mr-2" />
              Plan a New Trip
            </Button>
          </Link>

          {/* Draft Trips */}
          <section className="mb-12">
            <h2 className="font-serif text-2xl font-semibold mb-6">Draft Trips</h2>
            {draftTrips.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {draftTrips.map((trip, index) => (
                  <TripCard key={trip.id} trip={trip} index={index} />
                ))}
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border p-8 text-center">
                <Compass className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No drafts yet. Start planning your next adventure!</p>
              </div>
            )}
          </section>

          {/* Upcoming Trips */}
          <section>
            <h2 className="font-serif text-2xl font-semibold mb-6">Upcoming Trips</h2>
            {upcomingTrips.length > 0 ? (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {upcomingTrips.map((trip, index) => (
                  <TripCard key={trip.id} trip={trip} index={index} />
                ))}
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border p-8 text-center">
                <p className="text-muted-foreground">No upcoming trips. Complete a booking to see it here!</p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
