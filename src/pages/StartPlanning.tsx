import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Calendar, Users, Minus, Plus, ArrowRight, Compass } from 'lucide-react';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/auth';
import { useTripStore } from '@/lib/tripStore';
import { destinations } from '@/lib/destinations';

const featuredDestinations = destinations.slice(0, 4);

const curatedExperiences = [
  {
    id: 'tokyo-culture',
    city: 'Tokyo',
    title: 'Culture & Cuisine',
    description: 'Explore ancient temples, hidden izakayas, and modern art galleries across 10 days.',
    days: 10,
    price: 4500,
    image: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80',
  },
  {
    id: 'santorini-romance',
    city: 'Santorini',
    title: 'Romantic Getaway',
    description: 'Sunset views, cliffside dining, wine tasting, and private boat tours.',
    days: 6,
    price: 3200,
    image: 'https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?w=800&q=80',
  },
  {
    id: 'marrakech-adventure',
    city: 'Marrakech',
    title: 'Desert Adventure',
    description: 'Medina exploration, Atlas Mountains trek, and Sahara glamping.',
    days: 8,
    price: 2800,
    image: 'https://images.unsplash.com/photo-1597212618440-806262de4f6b?w=800&q=80',
  },
];

type TripType = 'round' | 'oneway' | 'multi';

export default function StartPlanning() {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { createTrip } = useTripStore();

  const [tripType, setTripType] = useState<TripType>('round');
  const [whereTo, setWhereTo] = useState('');
  const [departureCity, setDepartureCity] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [travelers, setTravelers] = useState(2);

  const handleSelectDestination = (city: string) => {
    setWhereTo(city);
  };

  const handleCreateItinerary = () => {
    if (!isAuthenticated) {
      navigate('/signin', { state: { from: '/trip/new' } });
      return;
    }

    // Find destination by city name
    const destination = destinations.find(d => 
      d.city.toLowerCase() === whereTo.toLowerCase()
    );

    if (destination && user && startDate && endDate && departureCity) {
      const tripId = createTrip({
        userId: user.id,
        destinationId: destination.id,
        startDate,
        endDate,
        travelersCount: travelers,
        departureCity,
        status: 'DRAFT',
      });
      navigate(`/trip/${tripId}`);
    } else {
      // Navigate to explore if no destination selected
      navigate('/explore');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="pt-24 pb-16 bg-gradient-to-b from-accent/10 to-background">
        <div className="container mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent text-accent-foreground mb-6">
              <MapPin className="h-8 w-8" />
            </div>
            <h1 className="font-serif text-4xl md:text-5xl font-semibold text-accent mb-4">
              Plan Your Perfect Trip
            </h1>
            <p className="text-muted-foreground text-lg max-w-lg mx-auto">
              Tell us about your travel dreams and we'll craft an unforgettable journey.
            </p>
          </motion.div>

          {/* Stepper Pills */}
          <div className="flex justify-center gap-2 mb-8">
            {['Details', 'Budget', 'Flights', 'Hotels', 'Review'].map((step, idx) => (
              <div
                key={step}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                  idx === 0 ? 'bg-accent text-accent-foreground' : 'bg-secondary text-muted-foreground'
                }`}
              >
                <span className="w-4 h-4 rounded-full bg-current/20 flex items-center justify-center text-[10px]">
                  {idx + 1}
                </span>
                {step}
              </div>
            ))}
          </div>

          {/* Form Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="max-w-2xl mx-auto bg-card rounded-2xl border border-border shadow-soft p-8"
          >
            <div className="mb-6">
              <h2 className="font-semibold text-lg">Your Trip Details</h2>
              <p className="text-sm text-muted-foreground">Let's start with the basics</p>
            </div>

            {/* Trip Type */}
            <div className="mb-6">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
                Trip Type
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { value: 'round', label: 'Round Trip' },
                  { value: 'oneway', label: 'One Way' },
                  { value: 'multi', label: 'Multi-City' },
                ].map((type) => (
                  <button
                    key={type.value}
                    onClick={() => setTripType(type.value as TripType)}
                    className={`px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                      tripType === type.value
                        ? 'border-accent bg-accent/5 text-accent'
                        : 'border-border text-foreground hover:border-accent/50'
                    }`}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Where To */}
            <div className="mb-4">
              <Label htmlFor="whereTo" className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
                Where To
              </Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="whereTo"
                  placeholder="Add a city or airport..."
                  value={whereTo}
                  onChange={(e) => setWhereTo(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Departing From */}
            <div className="mb-4">
              <Label htmlFor="departure" className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
                Departing From
              </Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="departure"
                  placeholder="Enter city or airport"
                  value={departureCity}
                  onChange={(e) => setDepartureCity(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Travel Dates */}
            <div className="mb-4">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
                Travel Dates
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    placeholder="Select start date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    placeholder="Select end date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            {/* Number of Travelers */}
            <div className="mb-6">
              <Label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block">
                Number of Travelers
              </Label>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setTravelers(Math.max(1, travelers - 1))}
                  className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:border-accent transition-colors"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <div className="text-center">
                  <span className="text-2xl font-semibold">{travelers}</span>
                  <p className="text-xs text-muted-foreground">traveler{travelers > 1 ? 's' : ''}</p>
                </div>
                <button
                  onClick={() => setTravelers(Math.min(10, travelers + 1))}
                  className="w-10 h-10 rounded-full border border-border flex items-center justify-center hover:border-accent transition-colors"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Featured Destinations Quick Select */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-accent font-medium">Popular</span>
                <span className="text-xs text-muted-foreground">Featured Destinations</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {featuredDestinations.map((dest) => (
                  <button
                    key={dest.id}
                    onClick={() => handleSelectDestination(dest.city)}
                    className={`relative rounded-lg overflow-hidden aspect-[4/3] group ${
                      whereTo.toLowerCase() === dest.city.toLowerCase() ? 'ring-2 ring-accent' : ''
                    }`}
                  >
                    <img
                      src={dest.imageUrl}
                      alt={dest.city}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-2">
                      <p className="text-white text-xs font-medium">{dest.city}</p>
                    </div>
                    {whereTo.toLowerCase() === dest.city.toLowerCase() && (
                      <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-accent text-accent-foreground flex items-center justify-center">
                        <span className="text-xs">✓</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* CTA Button */}
            <Button
              variant="accent"
              size="lg"
              className="w-full"
              onClick={handleCreateItinerary}
            >
              Create My Itinerary
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>

            <p className="text-center text-xs text-muted-foreground mt-3">
              I have a timeline destination. Explore for chat ideas and tips.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Featured Destinations Grid */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-semibold">Featured Destinations</h2>
            <div className="flex gap-4 text-sm">
              <button className="text-accent font-medium">Trending</button>
              <button className="text-muted-foreground hover:text-foreground">Best Value</button>
              <button className="text-muted-foreground hover:text-foreground">Off Season</button>
            </div>
          </div>
          
          <div className="grid md:grid-cols-3 gap-4">
            {destinations.slice(0, 3).map((dest) => (
              <button
                key={dest.id}
                onClick={() => navigate(`/destinations/${dest.id}`)}
                className="relative rounded-xl overflow-hidden aspect-[4/3] group text-left"
              >
                <img
                  src={dest.imageUrl}
                  alt={dest.city}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute top-3 left-3">
                  <span className="px-2 py-1 rounded bg-accent text-accent-foreground text-xs font-medium">
                    {dest.region || 'Popular'}
                  </span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <h3 className="text-white font-semibold text-lg">{dest.city}</h3>
                  <p className="text-white/80 text-sm">From $999</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Curated Experiences */}
      <section className="py-16 bg-secondary/30">
        <div className="container mx-auto px-6">
          <div className="text-center mb-10">
            <span className="text-xs text-accent uppercase tracking-wider font-medium">Voyance</span>
            <h2 className="font-serif text-3xl font-semibold mt-2">Curated Experiences</h2>
            <p className="text-muted-foreground mt-2">Thoughtfully designed journeys for the discerning traveler</p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {curatedExperiences.map((exp) => (
              <div key={exp.id} className="bg-card rounded-xl overflow-hidden border border-border shadow-soft">
                <div className="relative aspect-[4/3]">
                  <img
                    src={exp.image}
                    alt={exp.city}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-3 left-3">
                    <span className="px-2 py-1 rounded bg-accent text-accent-foreground text-xs font-medium">
                      Curated Experience
                    </span>
                  </div>
                </div>
                <div className="p-4">
                  <h3 className="font-semibold">{exp.city}</h3>
                  <p className="text-sm text-muted-foreground">{exp.title}</p>
                  <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{exp.description}</p>
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-sm">{exp.days} days from <span className="text-accent font-semibold">${exp.price.toLocaleString()}</span></span>
                    <button className="text-accent text-sm font-medium hover:underline">View Details</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 bg-primary text-primary-foreground">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="font-serif text-xl font-semibold"><span className="text-accent">V</span>oyance</span>
              </div>
              <p className="text-sm opacity-70 mb-4">Personalized travel experiences powered by research, not influencers.</p>
            </div>
            <div>
              <h4 className="font-medium mb-3">Travel</h4>
              <ul className="space-y-2 text-sm opacity-70">
                <li>Destinations</li>
                <li>Experiences</li>
                <li>Curated Trips</li>
                <li>Flights</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-3">Learn More</h4>
              <ul className="space-y-2 text-sm opacity-70">
                <li>How It Works</li>
                <li>Travel Guides</li>
                <li>Voyance Blog</li>
                <li>FAQs</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-3">Help Center</h4>
              <ul className="space-y-2 text-sm opacity-70">
                <li>Contact Us</li>
                <li>Terms of Service</li>
                <li>Privacy Policy</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-primary-foreground/20 mt-8 pt-8 text-center text-sm opacity-70">
            © 2026 Voyance. Thoughtful travel planning.
          </div>
        </div>
      </footer>
    </div>
  );
}
