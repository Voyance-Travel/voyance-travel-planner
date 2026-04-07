import { motion } from "framer-motion";
import { safeFormatDate } from "@/utils/dateUtils";
import { Sun, Cloud, CloudRain, CloudSun } from "lucide-react";
import type { TripActivity } from "@/types/trip";
import { DayRegenerateButton } from "./DayRegenerateButton";
import TripActivityCard from "./TripActivityCard";

interface DayTimelineProps {
  activities: TripActivity[];
  date: string;
  dayNumber?: number;
  onActivityUpdate?: (activities: TripActivity[]) => void;
  currency?: string;
  onRegenerateDay?: (dayNumber: number, options?: { keepActivities?: string[] }) => void;
  isRegenerating?: boolean;
  weather?: {
    high: number;
    low: number;
    condition: string;
    icon: string;
  };
  onToggleLock?: (activityId: string, locked: boolean) => void;
  onOpenConcierge?: (activity: TripActivity) => void;
}

const DayTimeline: React.FC<DayTimelineProps> = ({
  activities,
  date,
  dayNumber = 1,
  onActivityUpdate: _onActivityUpdate,
  currency = "USD",
  onRegenerateDay,
  isRegenerating = false,
  weather,
  onToggleLock
}) => {
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  const getWeatherIcon = (condition: string) => {
    switch (condition.toLowerCase()) {
      case "sunny":
      case "clear":
        return <Sun className="w-5 h-5 text-yellow-500" />;
      case "partly cloudy":
      case "partly-cloudy":
        return <CloudSun className="w-5 h-5 text-muted-foreground" />;
      case "cloudy":
        return <Cloud className="w-5 h-5 text-muted-foreground" />;
      case "rain":
      case "light rain":
        return <CloudRain className="w-5 h-5 text-blue-400" />;
      default:
        return <Cloud className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const handleRegenerateDay = () => {
    if (onRegenerateDay) {
      onRegenerateDay(dayNumber);
    }
  };

  const formattedDate = safeFormatDate(date, "EEEE, MMMM d", `Day ${dayNumber}`);

  return (
    <div className="bg-muted/30 rounded-xl p-6">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground">
            Day {dayNumber}
          </h2>
          <span className="text-sm text-muted-foreground">
            {formattedDate}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Weather */}
          {weather && (
            <div className="bg-card rounded-lg px-3 py-2 flex items-center text-sm shadow-sm border border-border">
              {getWeatherIcon(weather.condition)}
              <span className="font-medium ml-2">{weather.high}°</span>
              <span className="text-muted-foreground mx-1">/</span>
              <span className="text-muted-foreground">{weather.low}°</span>
              <span className="mx-2 text-border">•</span>
              <span className="text-muted-foreground">{weather.condition}</span>
            </div>
          )}

          {/* Regenerate Button */}
          {onRegenerateDay && (
            <DayRegenerateButton
              dayNumber={dayNumber}
              onClick={handleRegenerateDay}
              isLoading={isRegenerating}
            />
          )}
        </div>
      </div>

      <motion.div
        className="space-y-4"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No activities planned for this day yet.
          </div>
        ) : (
          activities.map((activity) => (
            <motion.div key={activity.id} variants={item}>
              <TripActivityCard
                activity={activity}
                currency={currency}
                onToggleLock={onToggleLock}
              />
            </motion.div>
          ))
        )}
      </motion.div>
    </div>
  );
};

export default DayTimeline;
