/**
 * Geolocation Hook
 * 
 * Provides real-time user location with proper error handling
 * and permission management for the "What's Nearby" feature.
 */

import { useState, useEffect, useCallback } from 'react';

export interface GeolocationPosition {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: number;
}

export interface GeolocationState {
  position: GeolocationPosition | null;
  error: string | null;
  loading: boolean;
  permissionDenied: boolean;
}

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  watch?: boolean;
}

const defaultOptions: UseGeolocationOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 60000, // 1 minute cache
  watch: false,
};

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const mergedOptions = { ...defaultOptions, ...options };
  
  const [state, setState] = useState<GeolocationState>({
    position: null,
    error: null,
    loading: false,
    permissionDenied: false,
  });

  const updatePosition = useCallback((position: GeolocationPosition) => {
    setState({
      position,
      error: null,
      loading: false,
      permissionDenied: false,
    });
  }, []);

  const handleError = useCallback((error: GeolocationPositionError) => {
    let errorMessage = 'Unable to get your location';
    let permissionDenied = false;

    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'Location access denied. Please enable location in your browser settings.';
        permissionDenied = true;
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Location information is unavailable.';
        break;
      case error.TIMEOUT:
        errorMessage = 'Location request timed out. Please try again.';
        break;
    }

    setState(prev => ({
      ...prev,
      error: errorMessage,
      loading: false,
      permissionDenied,
    }));
  }, []);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setState(prev => ({
        ...prev,
        error: 'Geolocation is not supported by your browser',
        loading: false,
      }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updatePosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });
      },
      handleError,
      {
        enableHighAccuracy: mergedOptions.enableHighAccuracy,
        timeout: mergedOptions.timeout,
        maximumAge: mergedOptions.maximumAge,
      }
    );
  }, [mergedOptions, updatePosition, handleError]);

  // Watch position for continuous updates
  useEffect(() => {
    if (!mergedOptions.watch || !navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        updatePosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp,
        });
      },
      handleError,
      {
        enableHighAccuracy: mergedOptions.enableHighAccuracy,
        timeout: mergedOptions.timeout,
        maximumAge: mergedOptions.maximumAge,
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [mergedOptions, updatePosition, handleError]);

  return {
    ...state,
    requestLocation,
    isSupported: typeof navigator !== 'undefined' && 'geolocation' in navigator,
  };
}
