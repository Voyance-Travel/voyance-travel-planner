import { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, Calendar, Users, MapPin, Plane, Building2 } from 'lucide-react';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FlightSelector } from '@/components/FlightSelector';
import { HotelSelector } from '@/components/HotelSelector';
import { PriceLockTimer } from '@/components/PriceLockTimer';
import { getDestinationById } from '@/lib/destinations';
import { generateFlightOptions, generateHotelOptions, calculateTripDays, type FlightOption, type HotelOption } from '@/lib/trips';
import { useAuth } from '@/lib/auth';
import { useTripStore } from '@/lib/tripStore';

const steps = ['Trip Details', 'Flights', 'Hotels', 'Review'];

export default function TripPlanner() {
  const { tripId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  
  const { createTrip, getTrip, updateTrip, saveSelections, getSelections, hasItinerary } = useTripStore();

  const [currentStep, setCurrentStep] = useState(0);
  const [destinationId, setDestinationId] = useState(searchParams.get('destinationId') || '');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [travelers, setTravelers] = useState(2);
  const [departureCity, setDepartureCity] = useState('');
  const [selectedFlight, setSelectedFlight] = useState<FlightOption | undefined>();
  const [selectedHotel, setSelectedHotel] = useState<HotelOption | undefined>();
  const [activeTripId, setActiveTripId] = useState(tripId);

  const destination = getDestinationById(destinationId);
  const existingTrip = activeTripId ? getTrip(activeTripId) : undefined;
  const existingSelections = activeTripId ? getSelections(activeTripId) : undefined;

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/signin', { state: { from: window.location.pathname + window.location.search } });
    }
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (existingTrip) {
      setDestinationId(existingTrip.destinationId);
      setStartDate(existingTrip.startDate);
      setEndDate(existingTrip.endDate);
      setTravelers(existingTrip.travelersCount);
      setDepartureCity(existingTrip.departureCity);
    }
    if (existingSelections) {
      setSelectedFlight(existingSelections.flight);
      setSelectedHotel(existingSelections.hotel);
    }
  }, [existingTrip, existingSelections]);

  const tripDays = startDate && endDate ? calculateTripDays(startDate, endDate) : 0;
  const flights = destination && departureCity ? generateFlightOptions(departureCity, destination.city, startDate) : [];
  const hotels = destination && tripDays > 0 ? generateHotelOptions(destination.city, tripDays) : [];

  const canProceed = () => {
    switch (currentStep) {
      case 0: return destination && startDate && endDate && travelers > 0 && departureCity;
      case 1: return !!selectedFlight;
      case 2: return !!selectedHotel;
      default: return true;
    }
  };

  const handleNext = () => {
    if (currentStep === 0 && !activeTripId && user) {
      const newTripId = createTrip({
        userId: user.id,
        destinationId,
        startDate,
        endDate,
        travelersCount: travelers,
        departureCity,
        status: 'DRAFT',
      });
      setActiveTripId(newTripId);
    }
    
    if (currentStep === 1 && activeTripId && selectedFlight) {
      saveSelections(activeTripId, selectedFlight, undefined);
    }
    
    if (currentStep === 2 && activeTripId && selectedHotel) {
      saveSelections(activeTripId, selectedFlight, selectedHotel);
    }
    
    setCurrentStep(prev => Math.min(prev + 1, steps.length - 1));
  };

  const handleBook = () => {
    if (activeTripId) {
      updateTrip(activeTripId, { status: 'BOOKED' });
      navigate(`/trip/${activeTripId}/itinerary`);
    }
  };

  const handleSave = () => {
    if (activeTripId) {
      updateTrip(activeTripId, { status: 'SAVED' });
      navigate('/profile');
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="container mx-auto px-6 max-w-4xl">
          {/* Stepper */}
          <div className="flex items-center justify-between mb-12">
            {steps.map((step, index) => (
              <div key={step} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors ${
                  index < currentStep ? 'bg-accent border-accent text-accent-foreground' :
                  index === currentStep ? 'border-accent text-accent' :
                  'border-border text-muted-foreground'
                }`}>
                  {index < currentStep ? <Check className="h-5 w-5" /> : index + 1}
                </div>
                <span className={`ml-2 text-sm hidden sm:inline ${
                  index === currentStep ? 'font-medium' : 'text-muted-foreground'
                }`}>{step}</span>
                {index < steps.length - 1 && (
                  <div className={`stepper-line mx-4 ${index < currentStep ? 'active' : ''}`} />
                )}
              </div>
            ))}
          </div>

          {/* Step Content */}
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            {currentStep === 0 && (
              <div className="space-y-6">
                <h2 className="font-serif text-3xl font-semibold">Trip Details</h2>
                <p className="text-muted-foreground">Tell us about your trip to {destination?.city || 'your destination'}.</p>
                
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="start">Start Date</Label>
                    <Input type="date" id="start" value={startDate} onChange={e => setStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end">End Date</Label>
                    <Input type="date" id="end" value={endDate} onChange={e => setEndDate(e.target.value)} min={startDate} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="travelers">Number of Travelers</Label>
                    <Input type="number" id="travelers" min={1} max={10} value={travelers} onChange={e => setTravelers(Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="departure">Departure City</Label>
                    <Input type="text" id="departure" placeholder="e.g., New York" value={departureCity} onChange={e => setDepartureCity(e.target.value)} />
                  </div>
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-serif text-3xl font-semibold">Select Your Flight</h2>
                    <p className="text-muted-foreground">Recommended options from {departureCity} to {destination?.city}</p>
                  </div>
                  <Plane className="h-8 w-8 text-accent" />
                </div>
                <FlightSelector flights={flights} selectedFlight={selectedFlight} onSelect={setSelectedFlight} />
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="font-serif text-3xl font-semibold">Choose Your Hotel</h2>
                    <p className="text-muted-foreground">Curated stays in {destination?.city} for {tripDays} nights</p>
                  </div>
                  <Building2 className="h-8 w-8 text-accent" />
                </div>
                <HotelSelector hotels={hotels} selectedHotel={selectedHotel} onSelect={setSelectedHotel} />
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-6">
                <h2 className="font-serif text-3xl font-semibold">Review & Book</h2>
                
                {existingTrip?.priceLockExpiresAt && (
                  <PriceLockTimer expiresAt={existingTrip.priceLockExpiresAt} />
                )}

                <div className="bg-card rounded-xl border border-border p-6 space-y-4">
                  <h3 className="font-semibold text-lg">{destination?.city}, {destination?.country}</h3>
                  <div className="grid sm:grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-muted-foreground" /> {startDate} to {endDate}</div>
                    <div className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /> {travelers} traveler{travelers > 1 ? 's' : ''}</div>
                    <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /> From {departureCity}</div>
                  </div>
                  
                  {selectedFlight && (
                    <div className="pt-4 border-t border-border">
                      <p className="text-sm text-muted-foreground mb-1">Flight</p>
                      <p className="font-medium">{selectedFlight.airline} · {selectedFlight.departureTime} → {selectedFlight.arrivalTime}</p>
                      <p className="text-accent font-semibold">${selectedFlight.price} per person</p>
                    </div>
                  )}
                  
                  {selectedHotel && (
                    <div className="pt-4 border-t border-border">
                      <p className="text-sm text-muted-foreground mb-1">Hotel</p>
                      <p className="font-medium">{selectedHotel.name}</p>
                      <p className="text-accent font-semibold">${selectedHotel.totalPrice} total</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-4">
                  <Button variant="outline" size="lg" className="flex-1" onClick={handleSave}>
                    Save for Later
                  </Button>
                  <Button variant="gold" size="lg" className="flex-1" onClick={handleBook}>
                    Book Now
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}
          </motion.div>

          {/* Navigation */}
          {currentStep < 3 && (
            <div className="flex justify-between mt-10">
              <Button variant="ghost" onClick={() => setCurrentStep(prev => Math.max(prev - 1, 0))} disabled={currentStep === 0}>
                <ArrowLeft className="h-4 w-4 mr-2" /> Back
              </Button>
              <Button variant="accent" onClick={handleNext} disabled={!canProceed()}>
                Continue <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
