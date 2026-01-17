import { Plane } from 'lucide-react';

interface FlightInfo {
  airline: string;
  flightNumber?: string;
  departureTime: string;
  arrivalTime: string;
  departureAirport?: string;
  arrivalAirport?: string;
  departureCode?: string;
  arrivalCode?: string;
  duration?: string;
  price: number;
  stops?: number;
}

interface SelectedFlightCardProps {
  flight: FlightInfo;
  travelers?: number;
  className?: string;
}

export default function SelectedFlightCard({
  flight,
  travelers = 1,
  className = ''
}: SelectedFlightCardProps) {
  return (
    <div className={`p-4 ${className}`}>
      <div className="bg-card rounded-xl shadow-sm p-6 border border-border">
        <div className="flex items-start gap-4">
          <div className="flex items-center justify-center bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 rounded-full w-12 h-12 flex-shrink-0">
            <Plane size={24} />
          </div>
          
          <div className="flex-1">
            <h3 className="font-semibold text-foreground mb-3">Selected Flight</h3>
            
            <div className="flex justify-between items-center mb-4">
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {flight.departureTime}
                </div>
                <div className="text-sm text-muted-foreground">
                  {flight.departureAirport || flight.departureCode || 'Departure'}
                </div>
              </div>
              
              <div className="flex-1 mx-6">
                <div className="relative flex items-center justify-center">
                  <div className="border-t-2 border-dashed border-border flex-1" />
                  <div className="absolute bg-card px-2">
                    <Plane size={20} className="text-muted-foreground transform rotate-90" />
                  </div>
                </div>
                {flight.duration && (
                  <div className="text-sm text-center text-muted-foreground mt-1">
                    {flight.duration}
                  </div>
                )}
              </div>
              
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {flight.arrivalTime}
                </div>
                <div className="text-sm text-muted-foreground">
                  {flight.arrivalAirport || flight.arrivalCode || 'Arrival'}
                </div>
              </div>
            </div>

            {/* Flight details */}
            <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
              <span>{flight.airline} {flight.flightNumber}</span>
              {flight.stops !== undefined && (
                <span>
                  {flight.stops === 0 ? 'Nonstop' : `${flight.stops} stop${flight.stops > 1 ? 's' : ''}`}
                </span>
              )}
            </div>

            {/* Price */}
            <div className="flex items-center justify-between pt-4 border-t border-border">
              <span className="text-sm text-muted-foreground">
                Total for {travelers} {travelers === 1 ? 'traveler' : 'travelers'}
              </span>
              <span className="text-xl font-bold text-foreground">
                ${(flight.price * travelers).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
