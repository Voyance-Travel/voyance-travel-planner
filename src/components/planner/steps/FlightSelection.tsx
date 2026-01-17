import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plane, Clock, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Flight {
  id: string;
  airline: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  stops: number;
  price: number;
  cabinClass: string;
}

interface FlightSelectionProps {
  formData: {
    destination: string;
    departureCity: string;
    startDate: string;
    endDate: string;
  };
  selectedDeparture: string | null;
  selectedReturn: string | null;
  onSelectDeparture: (id: string) => void;
  onSelectReturn: (id: string) => void;
  onContinue: () => void;
  onBack: () => void;
}

// Mock flight data
const generateFlights = (date: string): Flight[] => [
  {
    id: `flight-1-${date}`,
    airline: 'United Airlines',
    departureTime: '06:00 AM',
    arrivalTime: '02:30 PM',
    duration: '8h 30m',
    stops: 0,
    price: 650,
    cabinClass: 'Economy',
  },
  {
    id: `flight-2-${date}`,
    airline: 'Delta',
    departureTime: '10:15 AM',
    arrivalTime: '07:45 PM',
    duration: '9h 30m',
    stops: 1,
    price: 520,
    cabinClass: 'Economy',
  },
  {
    id: `flight-3-${date}`,
    airline: 'Air France',
    departureTime: '08:00 PM',
    arrivalTime: '10:30 AM +1',
    duration: '7h 30m',
    stops: 0,
    price: 890,
    cabinClass: 'Business',
  },
];

function FlightCard({
  flight,
  isSelected,
  onSelect,
}: {
  flight: Flight;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.button
      onClick={onSelect}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={cn(
        'w-full p-4 rounded-xl border-2 text-left transition-all',
        isSelected
          ? 'border-primary bg-primary/5'
          : 'border-slate-200 hover:border-slate-300 bg-white'
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Airline */}
          <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center">
            <Plane className="w-6 h-6 text-slate-600" />
          </div>

          {/* Flight info */}
          <div>
            <p className="font-medium text-slate-900">{flight.airline}</p>
            <p className="text-sm text-slate-500">{flight.cabinClass}</p>
          </div>
        </div>

        {/* Times */}
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="font-semibold text-slate-900">{flight.departureTime}</p>
            <p className="text-xs text-slate-500">Depart</p>
          </div>

          <div className="flex flex-col items-center">
            <div className="flex items-center gap-2 text-slate-400">
              <div className="w-8 h-px bg-slate-300" />
              <Clock className="w-4 h-4" />
              <div className="w-8 h-px bg-slate-300" />
            </div>
            <p className="text-xs text-slate-500">{flight.duration}</p>
            <p className="text-xs text-slate-400">
              {flight.stops === 0 ? 'Nonstop' : `${flight.stops} stop`}
            </p>
          </div>

          <div className="text-center">
            <p className="font-semibold text-slate-900">{flight.arrivalTime}</p>
            <p className="text-xs text-slate-500">Arrive</p>
          </div>
        </div>

        {/* Price & Selection */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="font-semibold text-slate-900">${flight.price}</p>
            <p className="text-xs text-slate-500">per person</p>
          </div>

          <div
            className={cn(
              'w-6 h-6 rounded-full border-2 flex items-center justify-center',
              isSelected ? 'border-primary bg-primary' : 'border-slate-300'
            )}
          >
            {isSelected && <Check className="w-4 h-4 text-primary-foreground" />}
          </div>
        </div>
      </div>
    </motion.button>
  );
}

export default function FlightSelection({
  formData,
  selectedDeparture,
  selectedReturn,
  onSelectDeparture,
  onSelectReturn,
  onContinue,
  onBack,
}: FlightSelectionProps) {
  const departureFlights = generateFlights(formData.startDate);
  const returnFlights = generateFlights(formData.endDate);

  const canContinue = selectedDeparture && selectedReturn;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-4xl mx-auto"
    >
      <div className="text-center mb-10">
        <h1 className="text-3xl font-display font-medium text-slate-900 mb-2">
          Choose your flights
        </h1>
        <p className="text-slate-600">
          {formData.departureCity} <ArrowRight className="inline w-4 h-4" />{' '}
          {formData.destination}
        </p>
      </div>

      {/* Departure Flights */}
      <div className="mb-10">
        <h2 className="text-lg font-medium text-slate-900 mb-4">
          Outbound Flight — {formData.startDate}
        </h2>
        <div className="space-y-3">
          {departureFlights.map((flight) => (
            <FlightCard
              key={flight.id}
              flight={flight}
              isSelected={selectedDeparture === flight.id}
              onSelect={() => onSelectDeparture(flight.id)}
            />
          ))}
        </div>
      </div>

      {/* Return Flights */}
      <div className="mb-10">
        <h2 className="text-lg font-medium text-slate-900 mb-4">
          Return Flight — {formData.endDate}
        </h2>
        <div className="space-y-3">
          {returnFlights.map((flight) => (
            <FlightCard
              key={flight.id}
              flight={flight}
              isSelected={selectedReturn === flight.id}
              onSelect={() => onSelectReturn(flight.id)}
            />
          ))}
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack} className="h-12 px-6">
          Back
        </Button>
        <Button
          onClick={onContinue}
          disabled={!canContinue}
          className="h-12 px-8 bg-slate-900 hover:bg-slate-800 text-white"
        >
          Continue to Hotels
        </Button>
      </div>
    </motion.div>
  );
}
