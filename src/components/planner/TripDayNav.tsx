import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface TripDayNavProps {
  currentDay: number;
  totalDays: number;
  onDayChange: (day: number) => void;
}

export const TripDayNav: React.FC<TripDayNavProps> = ({
  currentDay,
  totalDays,
  onDayChange
}) => {
  const canGoPrevious = currentDay > 1;
  const canGoNext = currentDay < totalDays;

  return (
    <div className="flex items-center justify-between bg-card px-4 py-3 border-b border-border">
      <Button
        variant="ghost"
        onClick={() => canGoPrevious && onDayChange(currentDay - 1)}
        disabled={!canGoPrevious}
        className="gap-1"
      >
        <ChevronLeft className="w-5 h-5" />
        Previous
      </Button>

      <div className="text-center">
        <p className="text-sm text-muted-foreground">Day</p>
        <p className="text-xl font-semibold text-foreground">
          {currentDay} <span className="text-muted-foreground font-normal">of</span> {totalDays}
        </p>
      </div>

      <Button
        variant="ghost"
        onClick={() => canGoNext && onDayChange(currentDay + 1)}
        disabled={!canGoNext}
        className="gap-1"
      >
        Next
        <ChevronRight className="w-5 h-5" />
      </Button>
    </div>
  );
};

export default TripDayNav;
