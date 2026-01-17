/**
 * =============================================================================
 * VOYANCE CONFIGURATION
 * =============================================================================
 * 
 * Paste your values directly here. This file replaces .env for frontend config.
 * 
 * LEGEND:
 * ✅ FRONTEND - Safe to put here (exposed in browser anyway)
 * 🔒 RAILWAY ONLY - Must stay on Railway backend (sensitive)
 * ⚙️ LOVABLE CLOUD - Auto-configured, don't touch
 * ❌ NOT NEEDED - Placeholder or deprecated
 */

// =============================================================================
// ✅ FRONTEND CONFIG - Paste your values here
// =============================================================================

export const FRONTEND_CONFIG = {
  // App URLs
  FRONTEND_URL: 'http://localhost:3000',
  APP_URL: 'http://localhost:3002',
  
  // Backend Connection (Railway)
  BACKEND_URL: 'https://voyance-production.up.railway.app',
  
  // Google OAuth (client IDs are public)
  GOOGLE_CLIENT_ID: '914204616314-dejos0u65hqqg7tmr81pamlg7dcdq3bm.apps.googleusercontent.com',
  GOOGLE_REDIRECT_URI: 'https://travelwithvoyance.com/auth/callback/google',
  
  // Stripe Publishable Key (starts with pk_, meant to be public)
  STRIPE_PUBLIC_KEY: 'pk_test_51RJaxRFYxIg9jcJUN8zjlbkV6EvhmoOTFSM8AEjOz39tlPqR1LMatSJ3xqhZFspooBLVJP6SpwbVbA3cbp4sLpFE00dmLeI4mG',
  
  // Google Maps (client-restricted key, safe for frontend)
  GOOGLE_MAPS_API_KEY: 'AIzaSyB-IaDfq24xQ1y7hRin3WfmSs_4Iry2DMM',
  
  // Feature Flags
  USE_CHAIN_GENERATION: true,
  ENABLE_CACHE: true,
  ENABLE_STRIPE: true,
  ENABLE_AI: true,
  ENABLE_IMAGE_FETCH: true,
  ENABLE_EMAILS: true,
  ENABLE_EXPLORE_GENERATOR: true,
  USE_ADVANCED_ARCHETYPES: true,
  USE_AMADEUS_API: true,
  USE_STRICT_GENERATOR: true,
  
  // Debug/Dev Settings
  NODE_ENV: 'development' as 'development' | 'production',
  DEBUG: false,
  DEBUG_VALIDATION: true,
  LOG_LEVEL: 'info',
  LOG_ARCHETYPE_COMPARISON: true,
  MOCK_DATA: false,
  
  // AI Model Config (non-sensitive)
  AI_MODEL_NAME: 'gpt-4',
  AI_TIMEOUT_MS: 25000,
  AI_RESPONSE_TTL_SECONDS: 2592000, // 30 days
  CLAUDE_MODEL_NAME: 'claude-3-sonnet-20240229',
  
  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: 900000,
  RATE_LIMIT_MAX_REQUESTS: 100,
  
  // JWT Config
  JWT_EXPIRES_IN: '365d',
  
  // Fallback URLs
  FALLBACK_IMAGE_URL: 'https://cdn.voyance.travel/defaults/destination-placeholder.jpg',
} as const;

// =============================================================================
// 🔒 RAILWAY BACKEND ONLY - These should be on Railway, NOT here
// =============================================================================
// 
// These are listed for reference. Add them to Railway environment variables.
// DO NOT paste actual values here - they would be exposed in the browser!
//
// DATABASE:
//   - DATABASE_URL
//   - DATABASE_SSL
//   - DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
//
// REDIS:
//   - REDIS_URL
//   - REDIS_DISABLE
//
// STRIPE (secret):
//   - STRIPE_SECRET_KEY
//   - STRIPE_WEBHOOK_SECRET
//
// AUTH SECRETS:
//   - JWT_SECRET
//   - SUPABASE_SERVICE_ROLE_KEY
//   - GOOGLE_CLIENT_SECRET
//
// AI APIS:
//   - OPENAI_API_KEY
//   - CLAUDE_API_KEY
//   - CLAUDE_API_BASE_URL
//
// TRAVEL APIS:
//   - AMADEUS_API_KEY
//   - AMADEUS_API_SECRET
//   - TRAVELPAYOUTS_API_TOKEN (Booking.com)
//   - KIWI_API_KEY
//   - VIATOR_API_KEY
//   - TRIP_ADVISOR_API_KEY
//   - FOURSQUARE_API_KEY
//   - FOURSQUARE_CLIENT_ID
//   - FOURSQUARE_CLIENT_SECRET
//   - OPENTRIPMAP_API_KEY
//   - WEATHERSTACK_API_KEY
//   - GEODB_CITIES_API_KEY
//
// IMAGE APIS:
//   - PEXELS_API_KEY
//   - MAPS_STATIC_API_KEY
//   - GOOGLE_GEOCODING_API_KEY
//
// EMAIL:
//   - SENDGRID_API_KEY
//   - EMAIL_FROM, EMAIL_REPLY_TO
//   - EMAIL_HOST, EMAIL_PORT, EMAIL_SECURE
//   - EMAIL_USER, EMAIL_PASS, EMAIL_TO
//
// =============================================================================

// =============================================================================
// ⚙️ LOVABLE CLOUD AUTO-CONFIGURED - Don't modify
// =============================================================================

export const SUPABASE_CONFIG = {
  URL: import.meta.env.VITE_SUPABASE_URL,
  ANON_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  PROJECT_ID: import.meta.env.VITE_SUPABASE_PROJECT_ID,
} as const;

// =============================================================================
// ❌ NOT NEEDED - Placeholders or deprecated
// =============================================================================
//
// - MAGIC_LINK_SECRET (placeholder)
// - PIXABAY_API_KEY (not configured)
// - CLERK_SECRET_KEY (not using Clerk)
// - CLERK_FRONTEND_API (not using Clerk)
// - CLERK_WEBHOOK_SECRET (not using Clerk)
// - PERPLEXITY_API_KEY (placeholder)
// - ANTHROPIC_API_KEY (duplicate of CLAUDE_API_KEY)
// - AWS_* (not configured)
// - LOGFLARE_* (not configured)
// - SENTRY_DSN (placeholder)
//
// =============================================================================

// =============================================================================
// EXPORTS - Use these in your components
// =============================================================================

export const CONFIG = {
  ...FRONTEND_CONFIG,
  supabase: SUPABASE_CONFIG,
  
  // Computed values
  isDev: FRONTEND_CONFIG.NODE_ENV === 'development',
  isProd: FRONTEND_CONFIG.NODE_ENV === 'production',
  
  // API endpoints
  api: {
    backend: FRONTEND_CONFIG.BACKEND_URL,
    trips: `${FRONTEND_CONFIG.BACKEND_URL}/api/v1/trips`,
    itinerary: `${FRONTEND_CONFIG.BACKEND_URL}/api/v1/itinerary`,
    flights: `${FRONTEND_CONFIG.BACKEND_URL}/api/v1/flights`,
    hotels: `${FRONTEND_CONFIG.BACKEND_URL}/api/v1/hotels`,
    preferences: `${FRONTEND_CONFIG.BACKEND_URL}/api/v1/preferences`,
  },
} as const;

export default CONFIG;
