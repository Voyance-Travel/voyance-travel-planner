import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Calendar, Users, ArrowRight, Sparkles } from 'lucide-react';
import MainLayout from '@/components/layout/MainLayout';
import Head from '@/components/common/Head';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { useTripPlanner } from '@/contexts/TripPlannerContext';
import { ROUTES } from '@/config/routes';

export default function Start() {
  const { isAuthenticated } = useAuth();
  const { setBasics } = useTripPlanner();
  const navigate = useNavigate();
  
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [travelers, setTravelers] = useState(2);

  const handleStart = () => {
    if (!isAuthenticated) {
      navigate(ROUTES.SIGNIN);
      return;
    }
    
    setBasics({
      destination,
      startDate,
      endDate,
      travelers,
    });
    
    navigate(ROUTES.PLANNER.ROOT);
  };

  return (
    <MainLayout>
      <Head
        title="Start Planning | Voyance"
        description="Start planning your dream trip with Voyance's AI-powered travel planner."
      />
      
      {/* Hero */}
      <section className="pt-24 pb-16 bg-gradient-to-b from-primary/5 to-background">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full text-primary text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" />
              AI-Powered Planning
            </div>
            
            <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground mb-4">
              Where To Next?
            </h1>
            
            <p className="text-lg text-muted-foreground">
              Tell us a bit about your dream trip and we'll create a personalized itinerary.
            </p>
          </motion.div>
        </div>
      </section>
      
      {/* Form */}
      <section className="py-12">
        <div className="max-w-xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-6"
          >
            {/* Destination */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Destination
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Where do you want to go?"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  Start Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-2">
                  End Date
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>
            
            {/* Travelers */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Number of Travelers
              </label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={travelers}
                  onChange={(e) => setTravelers(parseInt(e.target.value) || 1)}
                  className="pl-10"
                />
              </div>
            </div>
            
            {/* Submit */}
            <Button
              onClick={handleStart}
              size="lg"
              className="w-full gap-2"
              disabled={!destination}
            >
              Start Planning
              <ArrowRight className="h-4 w-4" />
            </Button>
            
            {!isAuthenticated && (
              <p className="text-center text-sm text-muted-foreground">
                You'll need to{' '}
                <Link to={ROUTES.SIGNIN} className="text-primary hover:underline">
                  sign in
                </Link>
                {' '}to continue planning.
              </p>
            )}
          </motion.div>
        </div>
      </section>
    </MainLayout>
  );
}
