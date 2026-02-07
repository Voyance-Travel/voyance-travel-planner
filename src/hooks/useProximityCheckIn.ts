/**
 * useProximityCheckIn
 * Detects when user is near an activity venue and suggests check-in.
 * Uses Geolocation API with configurable proximity radius.
 */
import { useState, useEffect, useCallback, useRef } from 'react';

interface VenueLocation {
  id: string;
  lat: number;
  lng: number;
  name: string;
}

interface ProximityState {
  nearbyActivityId: string | null;
  nearbyActivityName: string | null;
  distanceMeters: number | null;
  isTracking: boolean;
  permissionDenied: boolean;
}

const PROXIMITY_RADIUS_METERS = 200;
const CHECK_INTERVAL_MS = 30_000; // every 30s

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useProximityCheckIn(
  venues: VenueLocation[],
  checkedInIds: Set<string>,
  enabled: boolean = true,
) {
  const [state, setState] = useState<ProximityState>({
    nearbyActivityId: null,
    nearbyActivityName: null,
    distanceMeters: null,
    isTracking: false,
    permissionDenied: false,
  });
  const watchIdRef = useRef<number | null>(null);
  const dismissedRef = useRef<Set<string>>(new Set());

  const dismissProximity = useCallback((activityId: string) => {
    dismissedRef.current.add(activityId);
    setState(prev => ({
      ...prev,
      nearbyActivityId: null,
      nearbyActivityName: null,
      distanceMeters: null,
    }));
  }, []);

  const checkProximity = useCallback(
    (position: GeolocationPosition) => {
      const { latitude, longitude } = position.coords;

      let closest: { id: string; name: string; distance: number } | null = null;

      for (const venue of venues) {
        if (checkedInIds.has(venue.id) || dismissedRef.current.has(venue.id)) continue;
        const dist = haversineDistance(latitude, longitude, venue.lat, venue.lng);
        if (dist <= PROXIMITY_RADIUS_METERS && (!closest || dist < closest.distance)) {
          closest = { id: venue.id, name: venue.name, distance: dist };
        }
      }

      setState(prev => ({
        ...prev,
        isTracking: true,
        nearbyActivityId: closest?.id || null,
        nearbyActivityName: closest?.name || null,
        distanceMeters: closest?.distance ?? null,
      }));
    },
    [venues, checkedInIds],
  );

  useEffect(() => {
    if (!enabled || venues.length === 0 || !('geolocation' in navigator)) return;

    // Request permission and start watching
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        checkProximity(pos);
        setState(prev => ({ ...prev, isTracking: true }));
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setState(prev => ({ ...prev, permissionDenied: true }));
        }
      },
      { enableHighAccuracy: true },
    );

    // Periodic check (more battery-friendly than watchPosition for this use case)
    const interval = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        checkProximity,
        () => {},
        { enableHighAccuracy: false, timeout: 10_000 },
      );
    }, CHECK_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [enabled, venues, checkProximity]);

  return { ...state, dismissProximity };
}
