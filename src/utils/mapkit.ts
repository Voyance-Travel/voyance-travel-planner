/**
 * Apple MapKit JS loader and token provider
 *
 * Loads the MapKit JS SDK from Apple's CDN and initializes it
 * with a JWT token fetched from our backend edge function.
 *
 * The token is refreshed on demand via MapKit's `authorizationCallback`
 * (Apple invokes it whenever auth is needed). We cache the token in-memory
 * for TOKEN_TTL_MS to avoid hammering the edge function — Apple's tokens
 * are valid for ~60 minutes, so we refresh with a 10-minute buffer.
 */

let mapkitLoaded = false;
let loadPromise: Promise<void> | null = null;

const TOKEN_TTL_MS = 50 * 60 * 1000; // 50 min — 10 min buffer under Apple's 60 min cap
let cachedToken: string | null = null;
let cachedAt = 0;
let inflight: Promise<string> | null = null;

async function fetchMapKitToken(): Promise<string> {
  const { supabase } = await import('@/integrations/supabase/client');
  const { data, error } = await supabase.functions.invoke('mapkit-token');
  if (error || !data?.token) {
    throw new Error(error?.message || 'Failed to get MapKit token');
  }
  return data.token as string;
}

async function getValidMapKitToken(): Promise<string> {
  if (cachedToken && Date.now() - cachedAt < TOKEN_TTL_MS) {
    return cachedToken;
  }
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const token = await fetchMapKitToken();
      cachedToken = token;
      cachedAt = Date.now();
      return token;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export async function loadMapKit(): Promise<void> {
  if (mapkitLoaded && typeof mapkit !== 'undefined') return;
  if (loadPromise) return loadPromise;

  loadPromise = new Promise<void>((resolve, reject) => {
    // Check if script already exists
    if (document.querySelector('script[src*="apple-mapkit"]')) {
      if (typeof mapkit !== 'undefined') {
        mapkitLoaded = true;
        resolve();
        return;
      }
    }

    const script = document.createElement('script');
    script.src = 'https://cdn.apple-mapkit.com/mk/5.x.x/mapkit.core.js';
    script.crossOrigin = 'anonymous';
    script.dataset.libraries = 'map,annotations';
    script.dataset.callback = 'initMapKit';

    (window as any).initMapKit = async () => {
      try {
        // Seed the cache so the initial authorizationCallback is synchronous.
        await getValidMapKitToken();

        mapkit.init({
          authorizationCallback: (done: (token: string) => void) => {
            getValidMapKitToken()
              .then(done)
              .catch((err) => {
                console.error('[MapKit] Token refresh failed:', err);
                // Fall back to last-known token rather than breaking the map.
                done(cachedToken ?? '');
              });
          },
        });

        mapkitLoaded = true;
        resolve();
      } catch (err) {
        console.error('[MapKit] Init failed:', err);
        reject(err);
      }
    };

    script.onerror = () => {
      loadPromise = null;
      reject(new Error('Failed to load MapKit JS script'));
    };

    document.head.appendChild(script);
  });

  return loadPromise;
}

export function isMapKitLoaded(): boolean {
  return mapkitLoaded && typeof mapkit !== 'undefined';
}
