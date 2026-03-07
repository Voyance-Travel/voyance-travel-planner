/**
 * API Configuration
 * 
 * This file contains all frontend-accessible API configuration.
 * 
 * Backend services now run on Lovable Cloud (Supabase Edge Functions).
 * All sensitive keys are stored as Cloud secrets.
 */

// =============================================================================
// SUPABASE (Auto-configured by Lovable Cloud)
// =============================================================================

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

// =============================================================================
// FRONTEND-ONLY KEYS (These are safe to expose in browser)
// =============================================================================

/**
 * Google Maps - for displaying maps in the UI
 * This is a client-side restricted key
 */
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

/**
 * Stripe Publishable Key - for Stripe Elements in the browser
 * This is meant to be public (starts with pk_)
 */
export const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '';

// =============================================================================
// FEATURE FLAGS & CONFIG
// =============================================================================

export const CONFIG = {
  // Supabase (auto-configured)
  supabaseUrl: SUPABASE_URL,
  supabaseAnonKey: SUPABASE_ANON_KEY,
  
  // Maps
  googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  
  // Payments  
  stripePublishableKey: STRIPE_PUBLISHABLE_KEY,
  
  // Feature toggles - now using Cloud edge functions
  features: {
    useRealFlights: true,      // Amadeus via Cloud edge function
    useRealHotels: false,      // Amadeus removed — hotels now AI-suggested via credits
    enablePayments: true,      // Stripe via Cloud edge function
    enableMaps: true,          // Apple MapKit JS (primary)
    enableAppleMaps: true,     // Apple MapKit JS is now the primary map provider
    enableGoogleMaps: false,   // Google Maps disabled, Apple Maps is primary
    enableActivities: true,    // Viator via Cloud edge function
  },
  
  // Debug
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
} as const;

export default CONFIG;
