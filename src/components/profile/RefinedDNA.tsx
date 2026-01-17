import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface TravelDNA {
  primary_goal: string;
  emotional_drivers: string[];
  emotional_triggers: string[];
  aesthetic_bias: string;
  luxury_tolerance: string;
  taste_graph: string[];
  pace_identity: string;
  trip_structure_preference: string;
  dietary_needs: string[];
  mobility_flags: string[];
  loyalty_programs: string[];
  budget_consciousness?: string;
  adventure_level?: string;
  personality_type?: string;
}

interface RefinedDNAProps {
  className?: string;
  travelDNA?: TravelDNA | null;
}

const formatValue = (value: string): string => {
  return value
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

export default function RefinedDNA({ className = '', travelDNA }: RefinedDNAProps) {
  if (!travelDNA) {
    return (
      <div className={`bg-card rounded-xl border border-border p-6 ${className}`}>
        <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          Your Travel DNA
        </h3>
        <p className="text-muted-foreground text-sm">
          Complete the quiz to discover your unique travel personality
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-card rounded-xl border border-border p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-foreground mb-6 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-primary" />
        Your Travel DNA
      </h3>
      
      <div className="space-y-5">
        {/* Primary Goal */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-1">Primary Travel Goal</h4>
          <p className="text-base font-medium text-foreground">
            {formatValue(travelDNA.primary_goal)}
          </p>
        </div>

        {/* Travel Style */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Travel Style</h4>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary" className="bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
              {formatValue(travelDNA.pace_identity)}
            </Badge>
            <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
              {formatValue(travelDNA.trip_structure_preference)}
            </Badge>
            <Badge variant="secondary" className="bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300">
              {formatValue(travelDNA.aesthetic_bias)}
            </Badge>
          </div>
        </div>

        {/* Emotional Drivers */}
        {travelDNA.emotional_drivers.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">What Drives You</h4>
            <div className="flex flex-wrap gap-2">
              {travelDNA.emotional_drivers.map((driver, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                >
                  {formatValue(driver)}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Taste Graph */}
        {travelDNA.taste_graph.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Interests</h4>
            <div className="flex flex-wrap gap-2">
              {travelDNA.taste_graph.map((taste, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                >
                  {formatValue(taste)}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Budget & Luxury */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-1">Travel Budget</h4>
          <p className="text-base font-medium text-foreground">
            {formatValue(travelDNA.luxury_tolerance)}
            {travelDNA.budget_consciousness && (
              <span className="text-sm text-muted-foreground ml-2">
                ({formatValue(travelDNA.budget_consciousness)})
              </span>
            )}
          </p>
        </div>

        {/* Special Requirements */}
        {(travelDNA.dietary_needs.length > 0 || travelDNA.mobility_flags.length > 0) && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Special Requirements</h4>
            <div className="flex flex-wrap gap-2">
              {travelDNA.dietary_needs.map((need, index) => (
                <Badge
                  key={`diet-${index}`}
                  variant="secondary"
                  className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                >
                  {formatValue(need)}
                </Badge>
              ))}
              {travelDNA.mobility_flags.map((flag, index) => (
                <Badge
                  key={`mobility-${index}`}
                  variant="secondary"
                  className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                >
                  {formatValue(flag)}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 pt-4 border-t border-border">
        <p className="text-xs text-muted-foreground">
          Your Travel DNA helps us create personalized trip recommendations just for you
        </p>
      </div>
    </div>
  );
}

export type { TravelDNA };
