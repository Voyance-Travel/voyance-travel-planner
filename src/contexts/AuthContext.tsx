import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logLogin, logSignup, logLogout, logOAuthLogin } from '@/services/authAuditAPI';

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  homeAirport?: string;
  createdAt: string;
  quizCompleted?: boolean;
  travelAgentMode?: boolean;
  preferences?: TravelPreferences;
  travelDNA?: {
    type: string;
    secondary?: string;
    confidence?: number;
  };
}

export interface TravelPreferences {
  style?: string;
  budget?: string;
  pace?: string;
  interests?: string[];
  accommodation?: string;
  planning?: string;
  // Quiz question IDs map to these fields
  traveler_type?: string;
  travel_vibes?: string[];
  travel_companions?: string[];
  primary_goal?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: { firstName: string; lastName: string }) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  setPreferences: (preferences: TravelPreferences) => Promise<void>;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Transform Supabase data to our User type
function transformProfile(
  supabaseUser: SupabaseUser | null, 
  profile?: { display_name?: string; avatar_url?: string; quiz_completed?: boolean; travel_dna?: unknown } | null,
  preferences?: { budget_tier?: string; travel_pace?: string; accommodation_style?: string; home_airport?: string; travel_agent_mode?: boolean } | null
): User | null {
  if (!supabaseUser) return null;
  
  const travelDNA = profile?.travel_dna as Record<string, unknown> | null;
  
  return {
    id: supabaseUser.id,
    email: supabaseUser.email || '',
    name: profile?.display_name || supabaseUser.user_metadata?.name || supabaseUser.user_metadata?.full_name || supabaseUser.email?.split('@')[0],
    avatar: profile?.avatar_url || supabaseUser.user_metadata?.avatar_url,
    homeAirport: preferences?.home_airport || undefined,
    createdAt: supabaseUser.created_at,
    quizCompleted: profile?.quiz_completed || false,
    travelAgentMode: preferences?.travel_agent_mode || false,
    preferences: preferences ? {
      style: preferences.accommodation_style,
      budget: preferences.budget_tier,
      pace: preferences.travel_pace,
      accommodation: preferences.accommodation_style,
    } : undefined,
    travelDNA: travelDNA ? {
      type: typeof travelDNA === 'object' && 'type' in travelDNA ? String(travelDNA.type) : 'Explorer',
      secondary: typeof travelDNA === 'object' && 'archetype' in travelDNA && travelDNA.archetype && typeof travelDNA.archetype === 'object' && 'secondary' in (travelDNA.archetype as Record<string, unknown>) ? String((travelDNA.archetype as Record<string, unknown>).secondary) : undefined,
      confidence: typeof travelDNA === 'object' && 'archetype' in travelDNA && travelDNA.archetype && typeof travelDNA.archetype === 'object' && 'confidence' in (travelDNA.archetype as Record<string, unknown>) ? Number((travelDNA.archetype as Record<string, unknown>).confidence) : undefined,
    } : undefined,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user data directly from Supabase
  const loadUserData = async (supabaseUser: SupabaseUser) => {
    try {
      console.log('[Auth] Loading user data from Supabase for:', supabaseUser.id);

      // Fetch profile and preferences in parallel from Supabase
      const [profileResult, preferencesResult] = await Promise.allSettled([
        supabase.from('profiles').select('*').eq('id', supabaseUser.id).single(),
        supabase.from('user_preferences').select('*').eq('user_id', supabaseUser.id).single(),
      ]);

      const profile = profileResult.status === 'fulfilled' && !profileResult.value.error
        ? profileResult.value.data
        : null;
      const preferences = preferencesResult.status === 'fulfilled' && !preferencesResult.value.error
        ? preferencesResult.value.data
        : null;

      console.log('[Auth] Loaded profile:', profile);
      console.log('[Auth] Loaded preferences:', preferences);

      return { profile, preferences };
    } catch (error) {
      console.error('[Auth] Error loading user data:', error);
      return { profile: null, preferences: null };
    }
  };

  // Migrate locally-saved demo/anonymous trips into the authenticated account
  const migrateLocalTripsToAccount = async (supabaseUser: SupabaseUser) => {
    try {
      // Check both possible storage keys for local trips
      const rawDemo = localStorage.getItem('voyance_demo_trips');
      const rawLocal = localStorage.getItem('voyance_local_trips');
      const raw = rawDemo || rawLocal;
      if (!raw) return;

      const parsed = JSON.parse(raw) as Record<string, any>;
      const trips = Object.values(parsed || {}).filter(Boolean);
      if (!trips.length) return;

      const nowIso = new Date().toISOString();
      const toUpsert = trips.map((t: any) => ({
        id: t.id,
        user_id: supabaseUser.id,
        name: t.name || (t.destination ? `Trip to ${t.destination}` : 'New Trip'),
        destination: t.destination || 'Unknown',
        destination_country: t.destination_country ?? null,
        start_date: t.start_date || t.startDate || new Date().toISOString().split('T')[0],
        end_date: t.end_date || t.endDate || new Date().toISOString().split('T')[0],
        trip_type: t.trip_type ?? t.tripType ?? null,
        travelers: t.travelers ?? 1,
        origin_city: t.origin_city ?? t.originCity ?? null,
        budget_tier: t.budget_tier ?? t.budgetTier ?? null,
        status: t.status || 'draft',
        flight_selection: t.flight_selection ?? t.flights ?? null,
        hotel_selection: t.hotel_selection ?? t.hotel ?? null,
        itinerary_data: t.itinerary_data ?? null,
        itinerary_status: t.itinerary_status ?? null,
        metadata: {
          ...(t.metadata || {}),
          anonymous: false,
          migratedFromLocal: true,
          migratedAt: nowIso,
        },
        updated_at: nowIso,
      }));

      const { error } = await supabase.from('trips').upsert(toUpsert as any, { onConflict: 'id' });
      if (error) throw error;

      // Clean up both possible storage keys
      localStorage.removeItem('voyance_demo_trips');
      localStorage.removeItem('voyance_local_trips');
      console.log('[Auth] Migrated local trips into account:', toUpsert.length);
    } catch (error) {
      console.error('[Auth] Failed to migrate local trips:', error);
    }
  };

  // Sync profile to Supabase on sign in
  const syncProfile = async (supabaseUser: SupabaseUser) => {
    try {
      console.log('[Auth] Syncing profile to Supabase for:', supabaseUser.id);
      await supabase.from('profiles').upsert(
        {
          id: supabaseUser.id,
          display_name: supabaseUser.user_metadata?.name || supabaseUser.user_metadata?.full_name,
          avatar_url: supabaseUser.user_metadata?.avatar_url,
        },
        { onConflict: 'id' }
      );
    } catch (error) {
      console.error('[Auth] Error syncing profile:', error);
    }
  };

  // Refresh user data from Supabase
  const refreshUserData = async () => {
    if (!session?.user) return;
    
    const { profile, preferences } = await loadUserData(session.user);
    setUser(transformProfile(session.user, profile, preferences));
  };

  // Initialize auth state
  useEffect(() => {
    // Get initial session

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        // First, claim any locally-saved trips into this account
        await migrateLocalTripsToAccount(session.user);

        const { profile, preferences } = await loadUserData(session.user);
        setUser(transformProfile(session.user, profile, preferences));
      }
      setSession(session);
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[Auth] Auth state changed:', event);
      
      // Handle synchronous state updates first
      setSession(session);
      
      if (session?.user) {
        // Keep loading true until user data is loaded
        // Defer async operations with setTimeout to avoid deadlock
        setTimeout(async () => {
          // On sign in, sync profile and claim any locally-saved trips
          if (event === 'SIGNED_IN') {
            await syncProfile(session.user);
            await migrateLocalTripsToAccount(session.user);
            
            // Log OAuth logins (email/password logins are logged in login())
            const provider = session.user.app_metadata?.provider;
            if (provider && provider !== 'email') {
              logOAuthLogin(provider).catch(console.error);
            }
          }

          const { profile, preferences } = await loadUserData(session.user);
          setUser(transformProfile(session.user, profile, preferences));
          setIsLoading(false);
        }, 0);
      } else {
        setUser(null);
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      throw new Error(error.message);
    }
    
    setSession(data.session);
    if (data.user) {
      const { profile, preferences } = await loadUserData(data.user);
      setUser(transformProfile(data.user, profile, preferences));
      
      // Log login event (don't await to not block login)
      logLogin().catch(console.error);
    }
  };

  const signup = async (email: string, password: string, name?: { firstName: string; lastName: string }) => {
    const fullName = name ? `${name.firstName} ${name.lastName}` : undefined;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          first_name: name?.firstName,
          last_name: name?.lastName,
          name: fullName,
          full_name: fullName,
        },
      },
    });
    
    if (error) {
      throw new Error(error.message);
    }
    
    // Check if email confirmation is required
    if (data.user && !data.session) {
      throw new Error('Please check your email to confirm your account');
    }
    
    // Profile is created automatically via trigger
    setSession(data.session);
    setUser(transformProfile(data.user, null, null));
    
    // Log signup event (don't await to not block signup)
    if (data.user) {
      logSignup().catch(console.error);
    }
  };

  const logout = async () => {
    // Log logout before signing out (user is still authenticated)
    if (user) {
      logLogout().catch(console.error);
    }
    
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Logout error:', error);
    }
    setSession(null);
    setUser(null);
  };

  const updateUser = (updates: Partial<User>) => {
    if (user) {
      setUser({ ...user, ...updates });
      
      // Sync to Supabase
      if (session?.user) {
        supabase.from('profiles').update({
          display_name: updates.name,
          avatar_url: updates.avatar,
        }).eq('id', session.user.id).then(({ error }) => {
          if (error) console.error('[Auth] Error updating profile:', error);
        });
      }
    }
  };

  const setPreferences = async (preferences: TravelPreferences) => {
    if (!user || !session?.user) return;
    
    console.log('[Auth] Saving preferences to Supabase:', preferences);
    
    // Map quiz answer keys to database columns
    // Quiz uses: pace, interests, budget, accommodation, planning
    const dbPayload: Record<string, unknown> = {
      user_id: session.user.id,
      quiz_completed: true,
      completed_at: new Date().toISOString(),
    };
    
    // Map each quiz field to its database column
    if (preferences.budget) dbPayload.budget_tier = preferences.budget;
    if (preferences.pace) dbPayload.travel_pace = preferences.pace;
    if (preferences.accommodation) dbPayload.accommodation_style = preferences.accommodation;
    if (preferences.planning) dbPayload.planning_preference = preferences.planning;
    if (preferences.interests) dbPayload.interests = preferences.interests;
    if (preferences.travel_companions) dbPayload.travel_companions = preferences.travel_companions;
    if (preferences.travel_vibes) dbPayload.travel_vibes = preferences.travel_vibes;
    if (preferences.traveler_type) dbPayload.traveler_type = preferences.traveler_type;
    if (preferences.primary_goal) dbPayload.primary_goal = preferences.primary_goal;
    
    // Save to Supabase - cast to satisfy TypeScript
    const { error } = await supabase.from('user_preferences').upsert(
      dbPayload as any,
      { onConflict: 'user_id' }
    );
    
    if (error) {
      console.error('[Auth] Error saving preferences:', error);
      throw error;
    }
    
    console.log('[Auth] Preferences saved successfully');
    
    // Update local state
    setUser({ 
      ...user, 
      preferences: { ...user.preferences, ...preferences },
      quizCompleted: true,
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated: !!user,
        isLoading,
        login,
        signup,
        logout,
        updateUser,
        setPreferences,
        refreshUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
