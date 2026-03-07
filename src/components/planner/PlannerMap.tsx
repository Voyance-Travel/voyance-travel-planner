import React, { useRef, useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { loadMapKit } from '@/utils/mapkit';

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
  center,
  className = ""
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [failed, setFailed] = useState(false);

  const validActivities = activities.filter(a => a.location?.lat && a.location?.lng);

  useEffect(() => {
    if (validActivities.length === 0) return;

    let cancelled = false;

    async function init() {
      try {
        await loadMapKit();
        if (cancelled || !containerRef.current) return;

        const map = new mapkit.Map(containerRef.current, {
          showsCompass: mapkit.FeatureVisibility.Hidden,
          showsScale: mapkit.FeatureVisibility.Hidden,
          showsMapTypeControl: false,
          isZoomEnabled: true,
          isScrollEnabled: true,
        });
        mapRef.current = map;

        if (center) {
          map.center = new mapkit.Coordinate(center.lat, center.lng);
        }

        const annotations = validActivities.map((a) => {
          const coord = new mapkit.Coordinate(a.location!.lat!, a.location!.lng!);
          return new mapkit.MarkerAnnotation(coord, {
            title: a.name || 'Activity',
            color: '#E63946',
          });
        });

        map.addAnnotations(annotations);

        if (annotations.length > 0) {
          map.showItems(annotations, {
            padding: new mapkit.Padding(30, 30, 30, 30),
            animate: true,
          });
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    }

    init();
    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.destroy();
        mapRef.current = null;
      }
    };
  }, [validActivities, center]);

  if (validActivities.length === 0 || failed) {
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
  }

  return (
    <div className={`w-full h-64 rounded-lg overflow-hidden ${className}`}>
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};

export default PlannerMap;
