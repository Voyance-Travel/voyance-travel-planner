import { Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { sanitizeActivityName } from "@/utils/activityNameSanitizer";

interface LockedActivity {
  id: string;
  name: string;
  day: number;
}

interface MyLockedActivitiesProps {
  lockedActivities: LockedActivity[];
  onUnlock?: (activityId: string) => void;
}

export const MyLockedActivities: React.FC<MyLockedActivitiesProps> = ({
  lockedActivities,
  onUnlock
}) => {
  if (lockedActivities.length === 0) {
    return null;
  }

  return (
    <div className="bg-card rounded-lg border border-border p-4">
      <h3 className="text-lg font-medium text-foreground mb-3 flex items-center">
        <Lock className="w-4 h-4 mr-2 text-primary" />
        Locked Activities
      </h3>
      <p className="text-xs text-muted-foreground mb-3">
        Locked activities won't be changed when regenerating the itinerary
      </p>
      <div className="space-y-2">
        {lockedActivities.map((activity) => (
          <div
            key={activity.id}
            className="flex items-center justify-between p-2.5 bg-muted/50 rounded-md"
          >
            <div>
              <p className="text-sm font-medium text-foreground">{sanitizeActivityName(activity.name, { category: (activity as any).category, startTime: (activity as any).startTime, activity: activity as any })}</p>
              <p className="text-xs text-muted-foreground">Day {activity.day}</p>
            </div>
            {onUnlock && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onUnlock(activity.id)}
                className="text-xs h-7"
              >
                <Unlock className="w-3 h-3 mr-1" />
                Unlock
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MyLockedActivities;
