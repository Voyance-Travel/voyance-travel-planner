/**
 * Map Navigation Utility
 * 
 * Opens native map apps (Apple Maps on iOS, Google Maps on Android/Web)
 * for turn-by-turn navigation between locations.
 */

export interface MapLocation {
  name?: string;
  address?: string;
  lat?: number;
  lng?: number;
}

export type MapProvider = 'apple' | 'google' | 'auto';

/**
 * Detects if user is on iOS (iPhone, iPad, iPod)
 */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * Detects if user is on Android
 */
export function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android/.test(navigator.userAgent);
}

/**
 * Encodes a location for URL usage
 */
function encodeLocation(location: MapLocation): string {
  if (location.lat !== undefined && location.lng !== undefined) {
    return `${location.lat},${location.lng}`;
  }
  if (location.address) {
    return encodeURIComponent(location.address);
  }
  if (location.name) {
    return encodeURIComponent(location.name);
  }
  return '';
}

/**
 * Generates Apple Maps URL for directions
 * https://developer.apple.com/library/archive/featuredarticles/iPhoneURLScheme_Reference/MapLinks/MapLinks.html
 */
function getAppleMapsUrl(origin: MapLocation, destination: MapLocation): string {
  const params = new URLSearchParams();
  
  // Set destination
  if (destination.lat !== undefined && destination.lng !== undefined) {
    params.set('daddr', `${destination.lat},${destination.lng}`);
  } else if (destination.address) {
    params.set('daddr', destination.address);
  } else if (destination.name) {
    params.set('daddr', destination.name);
  }
  
  // Set origin (optional - will use current location if not provided)
  if (origin.lat !== undefined && origin.lng !== undefined) {
    params.set('saddr', `${origin.lat},${origin.lng}`);
  } else if (origin.address) {
    params.set('saddr', origin.address);
  } else if (origin.name) {
    params.set('saddr', origin.name);
  }
  
  // Set transport mode to driving (can be: d=driving, w=walking, r=transit)
  params.set('dirflg', 'd');
  
  return `https://maps.apple.com/?${params.toString()}`;
}

/**
 * Generates Google Maps URL for directions
 * https://developers.google.com/maps/documentation/urls/get-started
 */
function getGoogleMapsUrl(origin: MapLocation, destination: MapLocation): string {
  const params = new URLSearchParams();
  params.set('api', '1');
  
  // Set destination
  if (destination.lat !== undefined && destination.lng !== undefined) {
    params.set('destination', `${destination.lat},${destination.lng}`);
  } else if (destination.address) {
    params.set('destination', destination.address);
  } else if (destination.name) {
    params.set('destination', destination.name);
  }
  
  // Set origin
  if (origin.lat !== undefined && origin.lng !== undefined) {
    params.set('origin', `${origin.lat},${origin.lng}`);
  } else if (origin.address) {
    params.set('origin', origin.address);
  } else if (origin.name) {
    params.set('origin', origin.name);
  }
  
  // Set travel mode (driving, walking, bicycling, transit)
  params.set('travelmode', 'driving');
  
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

/**
 * Opens map navigation from origin to destination
 * 
 * @param origin - Starting location (previous activity)
 * @param destination - Ending location (next activity)  
 * @param provider - Which map app to use ('auto' detects platform)
 */
export function openMapNavigation(
  origin: MapLocation,
  destination: MapLocation,
  provider: MapProvider = 'auto'
): void {
  let url: string;
  
  if (provider === 'auto') {
    // On iOS, prefer Apple Maps; everywhere else use Google Maps
    provider = isIOS() ? 'apple' : 'google';
  }
  
  if (provider === 'apple') {
    url = getAppleMapsUrl(origin, destination);
  } else {
    url = getGoogleMapsUrl(origin, destination);
  }
  
  // Open in new tab/window (will open native app if available)
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Opens map to show a single location (not directions)
 */
export type TravelMode = 'driving' | 'walking' | 'transit' | 'bicycling';

/**
 * Maps internal transport mode names to TravelMode
 */
export function toTravelMode(mode?: string): TravelMode | undefined {
  if (!mode) return undefined;
  const m = mode.toLowerCase();
  if (['walk', 'walking'].includes(m)) return 'walking';
  if (['bus', 'train', 'metro', 'transit', 'public_transport', 'subway'].includes(m)) return 'transit';
  if (['taxi', 'rideshare', 'car', 'drive', 'driving'].includes(m)) return 'driving';
  if (['bike', 'bicycle', 'bicycling', 'cycling'].includes(m)) return 'bicycling';
  return undefined;
}

/**
 * Opens map to show a single location (not directions)
 */
export function openMapLocation(
  location: MapLocation,
  provider: MapProvider = 'auto',
  travelMode?: TravelMode
): void {
  if (provider === 'auto') {
    provider = isIOS() ? 'apple' : 'google';
  }
  
  let url: string;
  
  if (provider === 'apple') {
    const params = new URLSearchParams();
    if (location.lat !== undefined && location.lng !== undefined) {
      params.set('ll', `${location.lat},${location.lng}`);
      params.set('q', location.name || `${location.lat},${location.lng}`);
    } else if (location.address || location.name) {
      params.set('q', location.address || location.name || '');
    }
    if (travelMode) {
      const dirflgMap: Record<TravelMode, string> = { driving: 'd', walking: 'w', transit: 'r', bicycling: 'b' };
      params.set('dirflg', dirflgMap[travelMode] || 'd');
    }
    url = `https://maps.apple.com/?${params.toString()}`;
  } else {
    const params = new URLSearchParams();
    params.set('api', '1');
    if (location.lat !== undefined && location.lng !== undefined) {
      params.set('query', `${location.lat},${location.lng}`);
    } else if (location.address || location.name) {
      params.set('query', location.address || location.name || '');
    }
    if (travelMode) {
      params.set('travelmode', travelMode);
    }
    url = `https://www.google.com/maps/search/?${params.toString()}`;
  }
  
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Gets the display name for the current platform's map app
 */
export function getMapAppName(provider: MapProvider = 'auto'): string {
  if (provider === 'auto') {
    provider = isIOS() ? 'apple' : 'google';
  }
  return provider === 'apple' ? 'Apple Maps' : 'Google Maps';
}
