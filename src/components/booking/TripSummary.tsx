import { motion } from "framer-motion";
import { MapPin, Calendar, Users, Hotel, Plane, Clock, ArrowRight } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getDestinationFallback } from "@/utils/imageUtils";

interface FormDataType {
  tripDetails?: {
    destination?: string;
    departureDate?: string;
    returnDate?: string;
    travelers?: number;
  };
  selectedFlight?: { id?: string; airline?: string; price?: number; };
  selectedHotel?: {
    name?: string;
    price?: number;
  };
}

interface TripSummaryProps {
  destination?: string;
  startDate?: string;
  endDate?: string;
  companions?: number;
  selectedFlight?: string | { id?: string; airline?: string; price?: number; };
  selectedHotel?: string;
  hotelPrice?: number;
  flightPrice?: number;
  className?: string;
  formData?: FormDataType;
}

export default function TripSummary({
  destination: propDestination = "Your Destination",
  startDate: propStartDate,
  endDate: propEndDate,
  companions: propCompanions = 1,
  selectedFlight: propSelectedFlight,
  selectedHotel: propSelectedHotel,
  hotelPrice: propHotelPrice = 0,
  flightPrice: propFlightPrice = 0,
  className = "",
  formData
}: TripSummaryProps) {
  const navigate = useNavigate();
  const location = useLocation();

  // Extract from formData if provided
  const destination = formData?.tripDetails?.destination || propDestination;
  const startDate = formData?.tripDetails?.departureDate || propStartDate;
  const endDate = formData?.tripDetails?.returnDate || propEndDate;
  const companions = formData?.tripDetails?.travelers || propCompanions;
  const selectedFlight = formData?.selectedFlight || propSelectedFlight;
  const selectedHotel = formData?.selectedHotel?.name || propSelectedHotel;
  const hotelPrice = formData?.selectedHotel?.price || propHotelPrice;
  const flightPrice = (formData?.selectedFlight as { price?: number })?.price || propFlightPrice;

  // Calculate trip duration
  const calculateNights = (): number => {
    if (!startDate || !endDate) return 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const nights = calculateNights();

  // Calculate days until the trip starts
  const calculateDaysUntilTrip = (): number => {
    if (!startDate) return 0;
    const today = new Date();
    const tripStart = new Date(startDate);
    const diffTime = tripStart.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const daysUntilTrip = calculateDaysUntilTrip();

  // Format date ranges
  const formatDateRange = (): string => {
    if (!startDate || !endDate) return "";
    const start = new Date(startDate);
    const end = new Date(endDate);
    const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };

    if (start.getFullYear() !== end.getFullYear()) {
      return `${start.toLocaleDateString(undefined, {...options, year: "numeric"})} - ${end.toLocaleDateString(undefined, {...options, year: "numeric"})}`;
    }
    return `${start.toLocaleDateString(undefined, options)} - ${end.toLocaleDateString(undefined, options)}`;
  };

  // Calculate total cost
  const calculateTotalCost = (): number => {
    const totalPrice = (hotelPrice || 0) + (flightPrice || 0);
    return companions > 1 ? totalPrice * companions : totalPrice;
  };

  // Get contextual message
  const getContextualMessage = (): string => {
    if (daysUntilTrip < 0) return "Reflections on";
    if (daysUntilTrip === 0) return "Today you're off to";
    if (daysUntilTrip <= 7) return "Coming soon";
    if (daysUntilTrip <= 30) return "Getting ready for";
    return "Planning ahead for";
  };

  // Handle continue button
  const handleContinue = () => {
    const path = location.pathname;
    if (path.includes("/planner")) {
      if (!selectedFlight) return;
      if (!selectedHotel) return;
      navigate("/planner/itinerary");
    } else {
      navigate("/planner");
    }
  };

  return (
    <motion.div
      className={`bg-card rounded-xl shadow-md overflow-hidden border border-border ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="bg-gradient-to-r from-primary to-primary/80 p-4 text-primary-foreground">
        <div className="flex justify-between items-center">
          <h3 className="font-semibold text-xl">Trip Summary</h3>
          <div className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
            {getContextualMessage()}
          </div>
        </div>
      </div>

      {/* Trip Countdown */}
      {daysUntilTrip > 0 && (
        <motion.div
          className="bg-primary/90 text-primary-foreground p-3 flex justify-between items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <span className="font-medium flex items-center">
            <Clock className="w-4 h-4 mr-1.5" />
            Trip Countdown
          </span>
          <motion.div
            className="bg-white/20 px-3 py-1 rounded-full text-sm font-semibold"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            {daysUntilTrip} {daysUntilTrip === 1 ? "day" : "days"} to go
          </motion.div>
        </motion.div>
      )}

      <div className="p-4 space-y-4">
        {/* Destination image */}
        <div className="rounded-lg h-32 overflow-hidden relative mb-2">
          <img
            src={getDestinationFallback(destination)}
            alt={destination}
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = "/placeholder.svg";
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-transparent to-black/60" />
          <div className="absolute bottom-0 left-0 right-0 p-3 text-white font-medium">
            {destination}
          </div>
        </div>

        {/* Destination and Dates */}
        <div className="space-y-2">
          <div className="flex items-start">
            <MapPin size={16} className="text-muted-foreground mt-0.5 mr-2 flex-shrink-0" />
            <div>
              <div className="font-medium text-foreground">{destination}</div>
              <div className="text-sm text-muted-foreground">
                {nights} {nights === 1 ? "night" : "nights"}
              </div>
            </div>
          </div>
          <div className="flex items-start">
            <Calendar size={16} className="text-muted-foreground mt-0.5 mr-2 flex-shrink-0" />
            <div>
              <div className="font-medium text-foreground">{formatDateRange()}</div>
              <div className="text-sm text-muted-foreground">Check-in after 3:00 PM</div>
            </div>
          </div>
          <div className="flex items-start">
            <Users size={16} className="text-muted-foreground mt-0.5 mr-2 flex-shrink-0" />
            <div>
              <div className="font-medium text-foreground">
                {companions} {companions === 1 ? "traveler" : "travelers"}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Selected Flight */}
        <div>
          <div className="flex items-center mb-2">
            <Plane size={16} className="text-muted-foreground mr-2" />
            <h4 className="font-medium text-foreground">Flight</h4>
          </div>
          {selectedFlight ? (
            <div className="bg-muted rounded-lg p-3">
              <div className="font-medium text-sm text-foreground">
                {typeof selectedFlight === 'object' ? selectedFlight.airline : 'Flight Selected'}
              </div>
              {flightPrice > 0 && (
                <div className="flex justify-between items-center mt-2 pt-2 border-t border-border">
                  <span className="text-sm text-muted-foreground">Flight total</span>
                  <span className="font-medium text-foreground">${flightPrice}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic">No flight selected yet</div>
          )}
        </div>

        {/* Selected Hotel */}
        <div>
          <div className="flex items-center mb-2">
            <Hotel size={16} className="text-muted-foreground mr-2" />
            <h4 className="font-medium text-foreground">Accommodation</h4>
          </div>
          {selectedHotel ? (
            <div className="bg-muted rounded-lg p-3">
              <div className="font-medium text-foreground">{selectedHotel}</div>
              {hotelPrice > 0 && (
                <div className="flex justify-between items-center mt-1">
                  <span className="text-sm text-muted-foreground">
                    {nights} {nights === 1 ? "night" : "nights"}
                  </span>
                  <span className="font-medium text-foreground">${hotelPrice}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted-foreground italic">No hotel selected yet</div>
          )}
        </div>

        {/* Total Price */}
        {(selectedFlight || selectedHotel) && (
          <>
            <div className="border-t border-border" />
            <div className="flex justify-between items-center font-semibold text-foreground">
              <span>Total Price</span>
              <span>${calculateTotalCost()}</span>
            </div>
          </>
        )}

        {/* Continue Button */}
        <Button
          className="w-full mt-2"
          onClick={handleContinue}
          disabled={location.pathname.includes("hotel") && !selectedHotel}
        >
          {location.pathname.includes("flight")
            ? "Continue to Hotel Selection"
            : location.pathname.includes("hotel")
            ? "Continue to Itinerary"
            : "Continue to Trip Planning"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}
