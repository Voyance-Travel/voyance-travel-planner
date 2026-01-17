import React from 'react';
import { MapPin } from 'lucide-react';

interface Activity {
  id: string;
  name?: string;
  location?: {
    lat?: number;
    lng?: number;
  };
}

interface PlannerMapProps {
  activities?: Activity[];
  center?: { lat: number; lng: number };
  zoom?: number;
  className?: string;
}

const PlannerMap: React.FC<PlannerMapProps> = ({ 
  activities = [],
  className = ""
}) => {
  return (
    <div className={`w-full h-64 bg-muted rounded-lg flex items-center justify-center ${className}`}>
      <div className="text-muted-foreground text-center">
        <MapPin className="w-10 h-10 mx-auto mb-2 text-primary/50" />
        <div className="font-medium">Interactive Map</div>
        <div className="text-sm mt-1">
          {activities.length} {activities.length === 1 ? 'location' : 'locations'}
        </div>
      </div>
    </div>
  );
};

export default PlannerMap;
