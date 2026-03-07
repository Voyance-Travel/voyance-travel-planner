/**
 * DayRouteMap — Interactive map showing activity pins for a day's itinerary.
 * Uses Apple MapKit JS for rendering, with fallback to pin list.
 */

import { useMemo, useRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Navigation, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { loadMapKit, isMapKitLoaded } from '@/utils/mapkit';

interface ActivityPin {
  id: string;
  title: string;
  lat: number;
  lng: number;
  index: number;
}

interface DayRouteMapProps {
  activities: Array<{
    id: string;
    title: string;
    location?: {
      name?: string;
      address?: string;
      lat?: number;
      lng?: number;
      coordinates?: { lat: number; lng: number };
    };
  }>;
  className?: string;
}

const PIN_COLORS = [
  '#E63946', '#457B9D', '#2A9D8F', '#E9C46A',
  '#F4A261', '#264653', '#A8DADC', '#6D6875',
];

const LABEL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const NON_ROUTABLE_KEYWORDS = [
  'free time', 'downtime', 'leisure time', 'at leisure', 'rest', 'sleep',
  'check-in', 'check-out', 'checkin', 'checkout', 'check in', 'check out',
  'packing', 'arrival at', 'departure from',
];
const NON_ROUTABLE_CATEGORIES = ['downtime', 'free_time', 'transportation', 'transport'];

function isRoutableActivity(activity: DayRouteMapProps['activities'][number]): boolean {
  const title = activity.title?.toLowerCase() || '';
  if (NON_ROUTABLE_KEYWORDS.some(kw => title.includes(kw))) return false;
  const cat = (activity as any).category?.toLowerCase() || (activity as any).timeBlockType?.toLowerCase() || '';
  if (NON_ROUTABLE_CATEGORIES.includes(cat)) return false;
  return true;
}

function buildDirectionsUrl(pins: ActivityPin[]): string {
  if (pins.length === 0) return '';
  if (pins.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${pins[0].lat},${pins[0].lng}`;
  }
  const origin = `${pins[0].lat},${pins[0].lng}`;
  const destination = `${pins[pins.length - 1].lat},${pins[pins.length - 1].lng}`;
  const waypoints = pins.slice(1, -1).map(p => `${p.lat},${p.lng}`).join('|');
  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ''}&travelmode=walking`;
}

/** Visual pin list fallback (used when MapKit can't load or no coords) */
function PinList({ items, directionsUrl, label }: {
  items: Array<{ id: string; title: string; subtitle?: string; color: string; letter: string }>;
  directionsUrl: string;
  label: string;
}) {
  return (
    <div className="p-4 space-y-2">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {directionsUrl && (
          <a href={directionsUrl} target="_blank" rel="noopener noreferrer"
            className="text-xs text-primary hover:text-primary/80 flex items-center gap-1">
            <ExternalLink className="h-3 w-3" />Open in Maps
          </a>
        )}
      </div>
      {items.map((item, i) => (
        <div key={item.id} className="flex items-center gap-2">
          <div className="flex flex-col items-center">
            <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
              style={{ backgroundColor: item.color }}>
              {item.letter}
            </div>
            {i < items.length - 1 && (
              <div className="w-px h-4 border-l-2 border-dashed border-border" />
            )}
          </div>
          <div className="min-w-0">
            <span className="text-xs text-foreground truncate block">{item.title}</span>
            {item.subtitle && (
              <span className="text-[10px] text-muted-foreground truncate block">{item.subtitle}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Interactive Apple MapKit map */
function AppleMap({ pins, directionsUrl }: { pins: ActivityPin[]; directionsUrl: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await loadMapKit();
        if (cancelled || !containerRef.current) return;

        // Create map
        const map = new mapkit.Map(containerRef.current, {
          showsCompass: mapkit.FeatureVisibility.Hidden,
          showsScale: mapkit.FeatureVisibility.Hidden,
          showsMapTypeControl: false,
          isZoomEnabled: true,
          isScrollEnabled: true,
          colorScheme: mapkit.Map.ColorSchemes.Dark,
        });
        mapRef.current = map;

        // Add annotations
        const annotations = pins.map((pin, i) => {
          const coord = new mapkit.Coordinate(pin.lat, pin.lng);
          const color = PIN_COLORS[i % PIN_COLORS.length];
          const letter = LABEL_CHARS[i % LABEL_CHARS.length];

          const annotation = new mapkit.MarkerAnnotation(coord, {
            glyphText: letter,
            color,
            title: pin.title,
          });
          return annotation;
        });

        map.addAnnotations(annotations);

        // Add polyline connecting pins
        if (pins.length > 1) {
          const coords = pins.map(p => new mapkit.Coordinate(p.lat, p.lng));
          const polyline = new mapkit.PolylineOverlay(coords, {
            style: new mapkit.Style({
              lineWidth: 3,
              strokeColor: '#457B9D',
              strokeOpacity: 0.6,
              lineDash: [6, 4],
            }),
          });
          map.addOverlay(polyline);
        }

        // Fit to show all pins with padding
        if (annotations.length > 0) {
          map.showItems(annotations, {
            padding: new mapkit.Padding(40, 40, 40, 40),
            animate: true,
          });
        }
      } catch (err) {
        console.warn('[DayRouteMap] MapKit failed, using fallback:', err);
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
  }, [pins]);

  if (failed) {
    return (
      <PinList
        items={pins.map((p, i) => ({
          id: p.id,
          title: p.title,
          color: PIN_COLORS[i % PIN_COLORS.length],
          letter: LABEL_CHARS[i % LABEL_CHARS.length],
        }))}
        directionsUrl={directionsUrl}
        label="Route Overview"
      />
    );
  }

  return (
    <div className="relative">
      <div ref={containerRef} className="w-full h-[180px] sm:h-[220px]" />
      {/* Open in Maps overlay */}
      <a href={directionsUrl} target="_blank" rel="noopener noreferrer"
        className="absolute bottom-2 right-2 bg-background/90 backdrop-blur-sm text-foreground text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg opacity-80 hover:opacity-100 transition-opacity">
        <Navigation className="h-3 w-3" />
        Open in Maps
      </a>
    </div>
  );
}

export function DayRouteMap({ activities, className }: DayRouteMapProps) {
  const pins: ActivityPin[] = useMemo(() => {
    return activities
      .filter(isRoutableActivity)
      .map((a, i) => {
        const lat = a.location?.lat ?? a.location?.coordinates?.lat;
        const lng = a.location?.lng ?? a.location?.coordinates?.lng;
        if (!lat || !lng) return null;
        return { id: a.id, title: a.title, lat, lng, index: i };
      })
      .filter(Boolean) as ActivityPin[];
  }, [activities]);

  const directionsUrl = useMemo(() => buildDirectionsUrl(pins), [pins]);

  // No coordinates — try address-based directions link
  if (pins.length === 0) {
    const addressActivities = activities.filter(a =>
      a.location?.address || a.location?.name
    );

    if (addressActivities.length >= 2) {
      const addresses = addressActivities.map(a =>
        encodeURIComponent(a.location?.address || a.location?.name || '')
      );
      const origin = addresses[0];
      const destination = addresses[addresses.length - 1];
      const waypoints = addresses.slice(1, -1).join('|');
      const addrUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ''}&travelmode=walking`;

      return (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}
          className={cn("overflow-hidden", className)}>
          <div className="mx-4 sm:mx-6 my-3">
            <div className="rounded-xl overflow-hidden border border-border/50 bg-muted/30">
              <PinList
                items={addressActivities.map((a, i) => ({
                  id: a.id,
                  title: a.title,
                  subtitle: a.location?.name || a.location?.address,
                  color: PIN_COLORS[i % PIN_COLORS.length],
                  letter: LABEL_CHARS[i % LABEL_CHARS.length],
                }))}
                directionsUrl={addrUrl}
                label="Today's Route"
              />
            </div>
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}
        className={cn("overflow-hidden", className)}>
        <div className="mx-6 my-3 p-4 rounded-xl bg-muted/50 border border-border/50 text-center">
          <MapPin className="h-5 w-5 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground">
            Location data unavailable for route visualization
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}
      className={cn("overflow-hidden", className)}>
      <div className="mx-4 sm:mx-6 my-3">
        <div className="rounded-xl overflow-hidden border border-border/50 bg-muted/30">
          <AppleMap pins={pins} directionsUrl={directionsUrl} />
        </div>
      </div>
    </motion.div>
  );
}

export default DayRouteMap;
