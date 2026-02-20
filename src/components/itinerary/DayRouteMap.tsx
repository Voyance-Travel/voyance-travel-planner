/**
 * DayRouteMap — Static map showing activity pins for a day's itinerary.
 * Uses Google Maps Static API (key stored in Cloud secrets, proxied via edge function).
 * Falls back to a simple visual pin list if no coordinates are available.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Navigation, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GOOGLE_MAPS_API_KEY } from '@/config/api.config';

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
  '0xE63946', '0x457B9D', '0x2A9D8F', '0xE9C46A',
  '0xF4A261', '0x264653', '0xA8DADC', '0x6D6875',
];

const LABEL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Keywords/categories that should never appear as map waypoints
const NON_ROUTABLE_KEYWORDS = [
  'free time', 'downtime', 'leisure time', 'at leisure', 'rest', 'sleep',
  'check-in', 'check-out', 'checkin', 'checkout', 'check in', 'check out',
  'packing', 'arrival at', 'departure from',
];
const NON_ROUTABLE_CATEGORIES = ['downtime', 'free_time', 'transportation', 'transport'];

function isRoutableActivity(activity: DayRouteMapProps['activities'][number]): boolean {
  const title = activity.title?.toLowerCase() || '';
  if (NON_ROUTABLE_KEYWORDS.some(kw => title.includes(kw))) return false;
  // Check category if present on the activity object
  const cat = (activity as any).category?.toLowerCase() || (activity as any).timeBlockType?.toLowerCase() || '';
  if (NON_ROUTABLE_CATEGORIES.includes(cat)) return false;
  return true;
}

export function DayRouteMap({ activities, className }: DayRouteMapProps) {
  const pins: ActivityPin[] = useMemo(() => {
    return activities
      .filter(isRoutableActivity)
      .map((a, i) => {
        // Support both location.lat/lng and location.coordinates.lat/lng
        const lat = a.location?.lat ?? a.location?.coordinates?.lat;
        const lng = a.location?.lng ?? a.location?.coordinates?.lng;
        if (!lat || !lng) return null;
        return { id: a.id, title: a.title, lat, lng, index: i };
      })
      .filter(Boolean) as ActivityPin[];
  }, [activities]);

  // Google Maps directions URL for opening in external maps app
  const directionsUrl = useMemo(() => {
    if (pins.length === 0) return '';
    if (pins.length === 1) {
      return `https://www.google.com/maps/search/?api=1&query=${pins[0].lat},${pins[0].lng}`;
    }
    const origin = `${pins[0].lat},${pins[0].lng}`;
    const destination = `${pins[pins.length - 1].lat},${pins[pins.length - 1].lng}`;
    const waypoints = pins.slice(1, -1).map(p => `${p.lat},${p.lng}`).join('|');
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ''}&travelmode=walking`;
  }, [pins]);

  if (pins.length === 0) {
    // Try to build directions from address strings even without coordinates
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
      const addrDirectionsUrl = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${waypoints ? `&waypoints=${waypoints}` : ''}&travelmode=walking`;

      return (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.3 }}
          className={cn("overflow-hidden", className)}
        >
          <div className="mx-4 sm:mx-6 my-3">
            <div className="rounded-xl overflow-hidden border border-border/50 bg-muted/30 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground">Today's Route</span>
                <a
                  href={addrDirectionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open in Google Maps
                </a>
              </div>
              <div className="space-y-2">
                {addressActivities.map((a, i) => (
                  <div key={a.id} className="flex items-center gap-2">
                    <div className="flex flex-col items-center">
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ backgroundColor: `#${PIN_COLORS[i % PIN_COLORS.length].replace('0x', '')}` }}
                      >
                        {LABEL_CHARS[i]}
                      </div>
                      {i < addressActivities.length - 1 && (
                        <div className="w-px h-4 border-l-2 border-dashed border-border" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs text-foreground truncate block">{a.title}</span>
                      <span className="text-[10px] text-muted-foreground truncate block">
                        {a.location?.name || a.location?.address}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      );
    }

    return (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.3 }}
        className={cn("overflow-hidden", className)}
      >
        <div className="mx-6 my-3 p-4 rounded-xl bg-muted/50 border border-border/50 text-center">
          <MapPin className="h-5 w-5 mx-auto mb-2 text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground">
            Location data unavailable for route visualization
          </p>
        </div>
      </motion.div>
    );
  }

  // Build static map URL
  const markers = pins.map((pin, i) => {
    const color = PIN_COLORS[i % PIN_COLORS.length];
    const label = LABEL_CHARS[i % LABEL_CHARS.length];
    return `markers=color:${color}%7Clabel:${label}%7C${pin.lat},${pin.lng}`;
  }).join('&');

  // Build path to connect pins in order
  const pathCoords = pins.map(p => `${p.lat},${p.lng}`).join('|');
  const path = pins.length > 1 ? `&path=color:0x457B9D80|weight:3|${pathCoords}` : '';

  const apiKey = GOOGLE_MAPS_API_KEY;
  const hasKey = !!apiKey;

  const staticMapUrl = hasKey
    ? `https://maps.googleapis.com/maps/api/staticmap?size=800x300&scale=2&maptype=roadmap&${markers}${path}&key=${apiKey}`
    : null;



  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3 }}
      className={cn("overflow-hidden", className)}
    >
      <div className="mx-4 sm:mx-6 my-3">
        {/* Map image or fallback */}
        <div className="rounded-xl overflow-hidden border border-border/50 bg-muted/30">
          {staticMapUrl ? (
            <a
              href={directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block relative group"
            >
              <img
                src={staticMapUrl}
                alt="Route map showing activity locations"
                className="w-full h-[180px] sm:h-[220px] object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <span className="bg-background/90 backdrop-blur-sm text-foreground text-xs font-medium px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
                  <Navigation className="h-3 w-3" />
                  Open in Google Maps
                </span>
              </div>
            </a>
          ) : (
            /* Fallback: visual pin list when no API key */
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground">Route Overview</span>
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" />
                  Open in Maps
                </a>
              </div>
              {pins.map((pin, i) => (
                <div key={pin.id} className="flex items-center gap-2">
                  <div className="flex flex-col items-center">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ backgroundColor: `#${PIN_COLORS[i % PIN_COLORS.length].replace('0x', '')}` }}
                    >
                      {LABEL_CHARS[i]}
                    </div>
                    {i < pins.length - 1 && (
                      <div className="w-px h-4 border-l-2 border-dashed border-border" />
                    )}
                  </div>
                  <span className="text-xs text-foreground truncate">{pin.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default DayRouteMap;
