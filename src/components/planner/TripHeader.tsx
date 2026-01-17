import { MapPin, Calendar, Users } from "lucide-react";
import { format, parseISO } from "date-fns";

interface TripHeaderProps {
  tripName: string;
  destination: string;
  startDate: string;
  endDate: string;
  travelers: number;
  className?: string;
}

export const TripHeader: React.FC<TripHeaderProps> = ({
  tripName,
  destination,
  startDate,
  endDate,
  travelers,
  className = ""
}) => {
  const formatDateRange = (start: string, end: string) => {
    const startD = parseISO(start);
    const endD = parseISO(end);

    if (startD.getFullYear() === endD.getFullYear()) {
      return `${format(startD, "MMM d")} – ${format(endD, "MMM d, yyyy")}`;
    }

    return `${format(startD, "MMM d, yyyy")} – ${format(endD, "MMM d, yyyy")}`;
  };

  return (
    <div className={`bg-card border-b border-border ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h1 className="text-3xl font-serif font-bold text-foreground">{tripName}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center">
            <MapPin className="w-4 h-4 mr-1.5" />
            {destination}
          </div>
          <div className="flex items-center">
            <Calendar className="w-4 h-4 mr-1.5" />
            {formatDateRange(startDate, endDate)}
          </div>
          <div className="flex items-center">
            <Users className="w-4 h-4 mr-1.5" />
            {travelers} {travelers === 1 ? "traveler" : "travelers"}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TripHeader;
