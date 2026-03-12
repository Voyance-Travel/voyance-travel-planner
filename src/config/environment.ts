/**
 * =============================================================================
 * VOYANCE CONFIGURATION
 * =============================================================================
 * 
 * Frontend configuration - all backend calls now go through Lovable Cloud
 * (Supabase Edge Functions)
 * 
 * LEGEND:
 * ✅ FRONTEND - Safe to put here (exposed in browser anyway)
 * ⚙️ LOVABLE CLOUD - Auto-configured, don't touch
 */

// =============================================================================
// ✅ FRONTEND CONFIG
// =============================================================================

export const FRONTEND_CONFIG = {
  // App URLs
  FRONTEND_URL: import.meta.env.VITE_SUPABASE_URL ? 'https://voyance-travel-planner.lovable.app' : 'http://localhost:3000',
  APP_URL: import.meta.env.VITE_SUPABASE_URL ? 'https://voyance-travel-planner.lovable.app' : 'http://localhost:3002',
  
  // Google OAuth (client IDs are public)
  GOOGLE_CLIENT_ID: '914204616314-dejos0u65hqqg7tmr81pamlg7dcdq3bm.apps.googleusercontent.com',
  GOOGLE_REDIRECT_URI: 'https://travelwithvoyance.com/auth/callback/google',
  
  // Stripe Publishable Key (starts with pk_, meant to be public)
  STRIPE_PUBLIC_KEY: 'pk_test_51RJaxRFYxIg9jcJUN8zjlbkV6EvhmoOTFSM8AEjOz39tlPqR1LMatSJ3xqhZFspooBLVJP6SpwbVbA3cbp4sLpFE00dmLeI4mG',
  
  // Google Maps (client-restricted key, safe for frontend)
  // ⚠️ PRE-LAUNCH: Configure referrer restrictions in Google Cloud Console:
  //    https://console.cloud.google.com/apis/credentials → Restrict key to:
  //    - voyance-travel-planner.lovable.app/*
  //    - travelwithvoyance.com/*
  //    - localhost:* (for dev)
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
  USE_AMADEUS_API: false, // Removed Feb 2026 — hotels now credit-gated AI feature
  USE_STRICT_GENERATOR: false,  // Disabled — using legacy generation path
  
  // Debug/Dev Settings
  NODE_ENV: (import.meta.env.PROD ? 'production' : 'development') as 'development' | 'production',
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
// ⚙️ LOVABLE CLOUD AUTO-CONFIGURED - Don't modify
// =============================================================================

export const SUPABASE_CONFIG = {
  URL: import.meta.env.VITE_SUPABASE_URL,
  ANON_KEY: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  PROJECT_ID: import.meta.env.VITE_SUPABASE_PROJECT_ID,
} as const;

// =============================================================================
// EXPORTS - Use these in your components
// =============================================================================

export const CONFIG = {
  ...FRONTEND_CONFIG,
  supabase: SUPABASE_CONFIG,
  
  // Computed values
  isDev: FRONTEND_CONFIG.NODE_ENV === 'development',
  isProd: FRONTEND_CONFIG.NODE_ENV === 'production',
} as const;

export default CONFIG;
