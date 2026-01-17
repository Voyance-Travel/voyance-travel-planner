/**
 * Supabase Services Index
 * 
 * Centralized exports for all Supabase-based services
 * These replace the Railway backend calls for core functionality
 */

// Profiles
export * from './profiles';

// Friends
export * from './friends';

// Trips
export * from './trips';

// Re-export supabase client for convenience
export { supabase } from '@/integrations/supabase/client';
