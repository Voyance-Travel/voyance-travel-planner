/**
 * Apple MapKit JS loader and token provider
 * 
 * Loads the MapKit JS SDK from Apple's CDN and initializes it
 * with a JWT token fetched from our backend edge function.
 */

let mapkitLoaded = false;
let loadPromise: Promise<void> | null = null;

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
        const { supabase } = await import('@/integrations/supabase/client');
        const { data, error } = await supabase.functions.invoke('mapkit-token');

        if (error || !data?.token) {
          throw new Error(error?.message || 'Failed to get MapKit token');
        }

        mapkit.init({
          authorizationCallback: (done: (token: string) => void) => {
            done(data.token);
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
