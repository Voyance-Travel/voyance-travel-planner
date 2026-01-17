/**
 * API Configuration
 * 
 * This file contains all frontend-accessible API configuration.
 * 
 * IMPORTANT: Only VITE_ prefixed variables are accessible in the frontend.
 * All sensitive backend keys (Amadeus, OpenAI, database, etc.) should be
 * configured in your Railway backend, NOT here.
 * 
 * To add a new frontend variable:
 * 1. Add it to Lovable secrets with VITE_ prefix
 * 2. Reference it here as import.meta.env.VITE_YOUR_KEY
 */

// =============================================================================
// BACKEND CONNECTION (Required)
// =============================================================================

/**
 * Railway backend URL - handles all API calls including:
 * - Amadeus (flights/hotels)
 * - OpenAI (itinerary generation)
 * - Database operations
 * - Stripe payments
 */
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-production.up.railway.app';

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
// SUPABASE (Auto-configured by Lovable Cloud)
// =============================================================================

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const SUPABASE_PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

// =============================================================================
// FEATURE FLAGS
// =============================================================================

export const CONFIG = {
  // Backend
  backendUrl: BACKEND_URL,
  
  // Maps
  googleMapsApiKey: GOOGLE_MAPS_API_KEY,
  
  // Payments  
  stripePublishableKey: STRIPE_PUBLISHABLE_KEY,
  
  // Supabase (auto-configured)
  supabaseUrl: SUPABASE_URL,
  supabaseAnonKey: SUPABASE_ANON_KEY,
  
  // Feature toggles
  features: {
    useRealFlights: true,      // Use Amadeus via Railway
    useRealHotels: true,       // Use Amadeus via Railway  
    enablePayments: true,      // Enable Stripe checkout
    enableMaps: !!GOOGLE_MAPS_API_KEY,
  },
  
  // Debug
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
} as const;

export default CONFIG;
