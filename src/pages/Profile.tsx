import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Calendar, Trophy, Compass, Globe, Sparkles, CheckCircle, Plus, ArrowRight } from 'lucide-react';
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
  const completedTrips = trips.filter(t => t.status === 'BOOKED');

  // Mock user stats
  const stats = {
    trips: completedTrips.length || 3,
    countries: 8,
    daysExplored: 28,
  };

  // Travel DNA badges
  const travelDNA = {
    title: 'Explorer',
    description: 'Your thoughtful responses reveal that you travel for curiosity, new horizons, and the thrill of the unknown.',
    stats: [
      { label: '90% Match', value: 'Adventure' },
      { label: '75% Trip Pacing', value: 'Full-day immersion' },
      { label: '75% Milestone', value: 'World Explorer' },
    ],
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-6 max-w-4xl">
          {/* Profile Hero Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative rounded-2xl overflow-hidden mb-8"
          >
            <div className="absolute inset-0">
              <img 
                src="https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=1200&q=80" 
                alt="Profile background"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-primary/90 to-primary/70" />
            </div>
            
            <div className="relative p-8 flex items-center gap-6">
              <div className="w-20 h-20 rounded-full bg-accent flex items-center justify-center text-accent-foreground text-2xl font-semibold shrink-0">
                {user?.email?.charAt(0).toUpperCase() || 'G'}
              </div>
              <div className="flex-1 text-primary-foreground">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs px-2 py-0.5 rounded bg-accent text-accent-foreground font-medium">VOYANCE</span>
                </div>
                <h1 className="font-serif text-2xl font-semibold">{user?.email?.split('@')[0] || 'Guest Traveler'}</h1>
                <p className="text-primary-foreground/70 text-sm">Seasoned Voyager • Member since 2024</p>
              </div>
              <div className="hidden md:flex items-center gap-4 text-primary-foreground/80 text-sm">
                <div className="flex items-center gap-1">
                  <Globe className="h-4 w-4" />
                  <span>{stats.countries}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  <span>{stats.trips}</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Quick Stats Bar */}
          <div className="flex flex-wrap gap-2 mb-8">
            {[
              { icon: <CheckCircle className="h-4 w-4" />, label: 'Draft Plans', count: draftTrips.length },
              { icon: <Calendar className="h-4 w-4" />, label: 'My Trips', count: upcomingTrips.length },
              { icon: <Compass className="h-4 w-4" />, label: 'Destinations', count: stats.countries },
              { icon: <Trophy className="h-4 w-4" />, label: 'Achievements', count: 5 },
              { icon: <Sparkles className="h-4 w-4" />, label: 'Preferences', count: null },
            ].map((item, idx) => (
              <button
                key={idx}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm transition-all ${
                  idx === 0 ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                }`}
              >
                {item.icon}
                <span>{item.label}</span>
                {item.count !== null && <span className="font-medium">{item.count}</span>}
              </button>
            ))}
          </div>

          {/* Travel DNA Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-r from-accent to-accent/80 rounded-2xl p-6 mb-8 text-accent-foreground"
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="w-6 h-6 rounded-full bg-accent-foreground/20 flex items-center justify-center text-sm">🧬</span>
              <span className="text-sm font-medium">Discovering Your Travel DNA</span>
            </div>
            
            <h2 className="font-serif text-2xl font-semibold mb-2">
              Welcome to your journey as a <span className="underline decoration-2">{travelDNA.title}</span>
            </h2>
            <p className="text-accent-foreground/80 text-sm mb-6 max-w-xl">
              {travelDNA.description}
            </p>

            <div className="flex flex-wrap gap-4 mb-4 text-xs">
              {travelDNA.stats.map((stat, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  <span>{stat.label}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" size="sm" className="bg-white/20 hover:bg-white/30 text-accent-foreground border-0">
                📘 Learn More
              </Button>
              <Button variant="secondary" size="sm" className="bg-white/20 hover:bg-white/30 text-accent-foreground border-0">
                📊 Share Journey
              </Button>
              <Button variant="secondary" size="sm" className="bg-white/20 hover:bg-white/30 text-accent-foreground border-0">
                🔄 Refine
              </Button>
            </div>
          </motion.div>

          {/* Start Your Journey CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-center py-8 mb-8"
          >
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 text-accent mb-4">
              <MapPin className="h-6 w-6" />
            </div>
            <h3 className="font-semibold mb-2">Start Your Journey</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Begin your adventure by exploring and finding the trip<br />
              with Voyance.
            </p>
            <Link to="/trip/new">
              <Button variant="accent">
                <Plus className="h-4 w-4 mr-2" />
                Plan Your First Trip
              </Button>
            </Link>
          </motion.div>

          {/* Travel Journey Map */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-card rounded-2xl border border-border p-6 mb-8"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Your Travel Journey</h3>
              <div className="flex gap-2 text-xs">
                <span className="px-2 py-1 rounded bg-secondary">3 Saved</span>
              </div>
            </div>
            
            <div className="flex gap-4 mb-4 text-xs">
              <button className="px-3 py-1 rounded-full bg-accent text-accent-foreground">Map</button>
              <button className="px-3 py-1 rounded-full bg-secondary text-muted-foreground">Timeline</button>
              <button className="px-3 py-1 rounded-full bg-secondary text-muted-foreground">Destinations</button>
              <button className="px-3 py-1 rounded-full bg-secondary text-muted-foreground">Insights</button>
            </div>

            {/* Map placeholder */}
            <div className="relative rounded-xl overflow-hidden aspect-[16/9] bg-accent/5 mb-4">
              <img 
                src="https://images.unsplash.com/photo-1524661135-423995f22d0b?w=1200&q=80" 
                alt="World map"
                className="w-full h-full object-cover opacity-60"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Globe className="h-12 w-12 text-accent mx-auto mb-2" />
                  <p className="text-sm font-medium">Your Travel Footprint</p>
                </div>
              </div>
            </div>

            {/* Journey stats */}
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between text-sm mb-4">
                <span className="text-muted-foreground">Your Travel Journey</span>
              </div>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <div className="flex items-center justify-center gap-1 text-accent text-xs mb-1">
                    <span className="w-2 h-2 rounded-full bg-accent" />
                    Trips: {stats.trips}
                  </div>
                  <p className="text-xs text-muted-foreground">{stats.trips} complete</p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 text-accent text-xs mb-1">
                    <span className="w-2 h-2 rounded-full bg-accent" />
                    Countries: {stats.countries}
                  </div>
                  <p className="text-xs text-muted-foreground">{stats.countries} countries</p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1 text-accent text-xs mb-1">
                    <span className="w-2 h-2 rounded-full bg-accent" />
                    Visited: {stats.daysExplored}
                  </div>
                  <p className="text-xs text-muted-foreground">{stats.daysExplored} days</p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Quick Actions */}
          <div className="grid md:grid-cols-3 gap-4 mb-12">
            {[
              { icon: <Sparkles className="h-5 w-5" />, title: 'AI Surprise', desc: 'Let AI plan your perfect trip' },
              { icon: <Compass className="h-5 w-5" />, title: 'Explore', desc: 'Browse our destinations' },
              { icon: <Trophy className="h-5 w-5" />, title: 'Trophies', desc: 'View your achievements' },
            ].map((action, idx) => (
              <button
                key={idx}
                className="flex items-start gap-3 p-4 bg-card rounded-xl border border-border hover:border-accent/50 transition-colors text-left"
              >
                <div className="text-accent">{action.icon}</div>
                <div>
                  <p className="font-medium text-sm">{action.title}</p>
                  <p className="text-xs text-muted-foreground">{action.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Profile Completion */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-card rounded-2xl border border-border p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-accent" />
                <span className="font-medium">Profile Completion</span>
              </div>
              <span className="text-accent font-semibold">100%</span>
            </div>
            
            <div className="w-full h-2 bg-secondary rounded-full mb-4">
              <div className="h-full bg-accent rounded-full" style={{ width: '100%' }} />
            </div>

            <div className="text-center py-4">
              <div className="text-3xl mb-2">🎉</div>
              <p className="font-medium text-accent">Your profile is complete!</p>
              <p className="text-xs text-muted-foreground">
                You're getting the best personalized recommendations.
              </p>
            </div>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
