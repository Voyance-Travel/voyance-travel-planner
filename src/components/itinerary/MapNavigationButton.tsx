import { Navigation, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { 
  openMapNavigation, 
  openMapLocation, 
  getMapAppName,
  type MapLocation,
  type MapProvider 
} from '@/utils/mapNavigation';
import { cn } from '@/lib/utils';

interface MapNavigationButtonProps {
  /** Starting point (previous activity location) */
  origin?: MapLocation;
  /** Destination (current activity location) */
  destination: MapLocation;
  /** Compact mode for inline usage */
  compact?: boolean;
  /** Custom className */
  className?: string;
  /** Preferred map provider */
  provider?: MapProvider;
}

/**
 * Button that opens native map navigation between two activities.
 * If no origin is provided, opens the destination location view.
 */
export function MapNavigationButton({
  origin,
  destination,
  compact = false,
  className,
  provider = 'auto',
}: MapNavigationButtonProps) {
  const handleClick = () => {
    if (origin) {
      openMapNavigation(origin, destination, provider);
    } else {
      openMapLocation(destination, provider);
    }
  };

  const mapName = getMapAppName(provider);
  const hasDirections = !!origin;
  
  if (compact) {
    return (
      <button
        onClick={handleClick}
        className={cn(
          "inline-flex items-center gap-1 px-2 py-1 text-xs font-medium",
          "text-primary hover:text-primary/80 hover:bg-primary/5 rounded-md transition-colors",
          className
        )}
        title={hasDirections ? `Get directions in ${mapName}` : `View in ${mapName}`}
      >
        <Navigation className="h-3 w-3" />
        <span>{hasDirections ? 'Navigate' : 'View Map'}</span>
      </button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      className={cn("gap-2", className)}
    >
      {hasDirections ? (
        <>
          <Navigation className="h-4 w-4" />
          <span>Get Directions</span>
        </>
      ) : (
        <>
          <MapPin className="h-4 w-4" />
          <span>View in {mapName}</span>
        </>
      )}
    </Button>
  );
}

/**
 * Transit badge that shows distance/time and opens navigation
 */
interface TransitNavigationProps {
  origin: MapLocation;
  destination: MapLocation;
  duration?: string;
  distance?: string;
  mode?: 'walk' | 'drive' | 'transit';
  className?: string;
}

export function TransitNavigation({
  origin,
  destination,
  duration,
  distance,
  mode = 'walk',
  className,
}: TransitNavigationProps) {
  const handleClick = () => {
    openMapNavigation(origin, destination, 'auto');
  };

  const modeIcons = {
    walk: '🚶',
    drive: '🚗',
    transit: '🚇',
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        "flex items-center gap-2 px-3 py-1.5 text-xs",
        "bg-muted/50 hover:bg-muted border border-border/50 rounded-full",
        "text-muted-foreground hover:text-foreground transition-colors",
        className
      )}
      title="Tap to open navigation"
    >
      <span>{modeIcons[mode]}</span>
      {duration && <span className="font-medium">{duration}</span>}
      {distance && <span className="text-muted-foreground">• {distance}</span>}
      <Navigation className="h-3 w-3 ml-1" />
    </button>
  );
}
