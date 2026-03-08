/**
 * GuideTripMap — Leaflet map with activity pins colored by day.
 * Clicking a pin scrolls to that activity in the guide.
 */
import { useEffect, useMemo, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

interface MapActivity {
  id?: string;
  name?: string;
  title?: string;
  day_number?: number;
  location?: { lat?: number; lng?: number; name?: string; address?: string };
}

interface Props {
  activities: MapActivity[];
}

const DAY_COLORS = [
  '#3b82f6', // blue
  '#22c55e', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

function getDayColor(day: number): string {
  if (day <= 0) return '#6b7280';
  return DAY_COLORS[(day - 1) % DAY_COLORS.length];
}

function FitBounds({ positions }: { positions: [number, number][] }) {
  const map = useMap();
  useEffect(() => {
    if (positions.length > 0) {
      const L = require('leaflet');
      const bounds = L.latLngBounds(positions);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [positions, map]);
  return null;
}

function scrollToActivity(activityId?: string) {
  if (!activityId) return;
  const el = document.getElementById(`guide-activity-${activityId}`);
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

export default function GuideTripMap({ activities }: Props) {
  const pins = useMemo(() => {
    return activities.filter(
      (a) => a.location?.lat != null && a.location?.lng != null
    );
  }, [activities]);

  if (pins.length === 0) return null;

  const positions: [number, number][] = pins.map((a) => [
    a.location!.lat!,
    a.location!.lng!,
  ]);

  const center = positions[0];

  // Collect unique days for legend
  const uniqueDays = [...new Set(pins.map((p) => p.day_number || 0))].sort();

  return (
    <div className="space-y-3">
      <div className="rounded-xl overflow-hidden border border-border" style={{ height: 320 }}>
        <MapContainer
          center={center}
          zoom={12}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds positions={positions} />
          {pins.map((activity, i) => (
            <CircleMarker
              key={activity.id || i}
              center={[activity.location!.lat!, activity.location!.lng!]}
              radius={8}
              pathOptions={{
                fillColor: getDayColor(activity.day_number || 0),
                color: '#fff',
                weight: 2,
                fillOpacity: 0.85,
              }}
              eventHandlers={{
                click: () => scrollToActivity(activity.id),
              }}
            >
              <Popup>
                <div className="text-xs">
                  <p className="font-semibold">{activity.name || activity.title}</p>
                  {activity.day_number && activity.day_number > 0 && (
                    <p className="text-muted-foreground">Day {activity.day_number}</p>
                  )}
                </div>
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {/* Legend */}
      {uniqueDays.length > 1 && (
        <div className="flex flex-wrap gap-3 px-1">
          {uniqueDays.map((day) => (
            <div key={day} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="w-3 h-3 rounded-full inline-block"
                style={{ backgroundColor: getDayColor(day) }}
              />
              {day > 0 ? `Day ${day}` : 'General'}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
