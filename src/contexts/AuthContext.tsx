import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
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
  signup: (email: string, password: string, name?: { firstName: string; lastName: string }) => Promise<{ needsEmailConfirmation?: boolean }>;
  logout: () => Promise<void>;
  updateUser: (updates: Partial<User>) => void;
  setPreferences: (preferences: TravelPreferences) => Promise<void>;
  refreshUserData: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

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

// Singleton guard on globalThis — survives Vite HMR module re-evaluation
const AUTH_GLOBAL_KEY = '__voyance_auth_singleton';
interface AuthSingleton {
  initialized: boolean;
  cachedSession: Session | null;
  cachedUser: User | null;
  mountCount: number;
}
function getAuthSingleton(): AuthSingleton {
  if (!(globalThis as any)[AUTH_GLOBAL_KEY]) {
    (globalThis as any)[AUTH_GLOBAL_KEY] = {
      initialized: false,
      cachedSession: null,
      cachedUser: null,
      mountCount: 0,
    };
  }
  return (globalThis as any)[AUTH_GLOBAL_KEY];
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const singleton = getAuthSingleton();
  const [user, setUser] = useState<User | null>(() => singleton.cachedUser);
  const [session, setSession] = useState<Session | null>(() => singleton.cachedSession);
  const [isLoading, setIsLoading] = useState(() => !singleton.initialized);

  // Load user data directly from Supabase
  const loadUserData = async (supabaseUser: SupabaseUser) => {
    try {
      // Auth data load (silent in production)

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

      // Profile and preferences loaded

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
      // Local trips migrated
    } catch (error) {
      console.error('[Auth] Failed to migrate local trips:', error);
    }
  };

  // Sync profile to Supabase on sign in
  const syncProfile = async (supabaseUser: SupabaseUser) => {
    try {
      // Sync profile
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

  // Initialize auth state - SEPARATED initial load from ongoing changes
  // to prevent race condition where isLoading becomes false before user data loads
  // Ref to track initial load completion — survives across closures & re-renders
  const initialLoadCompleteRef = useRef(false);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Prevent onAuthStateChange from triggering redundant loads while initializeAuth runs
  const isProcessingAuthRef = useRef(false);
  // Queue for OAuth SIGNED_IN events that fire before initial load completes
  const pendingOAuthSessionRef = useRef<any>(null);
  // Track current user ID to skip redundant SIGNED_IN events for the same user
  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const sg = getAuthSingleton();
    sg.mountCount += 1;
    // AuthProvider mounted
    
    isProcessingAuthRef.current = false;
    
    // If auth already initialized in a previous mount, restore cached state and skip
    if (sg.initialized) {
      // Auth already initialized, restoring cached state
      initialLoadCompleteRef.current = true;
      setIsLoading(false);
      // Still set up the listener below, but don't run initializeAuth again
    } else {
      initialLoadCompleteRef.current = false;
    }

    // Safety timeout: never show loading spinner for more than 8 seconds
    if (!sg.initialized) {
      loadingTimeoutRef.current = setTimeout(() => {
        if (initialLoadCompleteRef.current) {
          // Timeout fired but auth already complete
          return;
        }
        if (isMounted) {
          // Loading timeout - forcing completion
          setIsLoading(false);
        }
      }, 8000);
    }
    
    // LISTENER for ONGOING auth changes (does NOT control isLoading after initial)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      // Auth state change event
      
      // During initial load, queue SIGNED_IN events from OAuth returns instead of dropping them.
      // Race condition: getSession() may return null before Supabase processes the OAuth hash,
      // then SIGNED_IN fires but gets dropped because initialLoadCompleteRef is still false.
      if (!initialLoadCompleteRef.current) {
        if (event === 'SIGNED_IN' && newSession?.user) {
          pendingOAuthSessionRef.current = newSession;
        }
        return;
      }

      // Skip if we're already processing an auth change (prevents cascading re-entry)
      if (isProcessingAuthRef.current) {
        // Already processing auth change
        return;
      }

      // After initial load, only handle meaningful events
      if (event === 'SIGNED_OUT') {
        currentUserIdRef.current = null;
        setSession(null);
        setUser(null);
        return;
      }

      // For TOKEN_REFRESHED, update session only — no user data reload needed
      if (event === 'TOKEN_REFRESHED') {
        setSession(newSession);
        return;
      }

      // For INITIAL_SESSION after initial load is complete, skip entirely
      if (event === 'INITIAL_SESSION') {
        return;
      }
      
      // Handle ongoing SIGNED_IN (e.g. OAuth callback, tab focus re-auth)
      if (event === 'SIGNED_IN' && newSession?.user) {
        // Skip if this is the same user we already loaded during initializeAuth
        // This prevents redundant setUser/setSession calls that cause re-renders
        if (currentUserIdRef.current === newSession.user.id) {
          // Same user already loaded
          setSession(newSession); // Update session token silently
          return;
        }
        isProcessingAuthRef.current = true;
        setSession(newSession);
        
        (async () => {
          if (!isMounted) {
            isProcessingAuthRef.current = false;
            return;
          }
          
          try {
            await syncProfile(newSession.user);
            await migrateLocalTripsToAccount(newSession.user);
            
            const provider = newSession.user.app_metadata?.provider;
            if (provider && provider !== 'email') {
              logOAuthLogin(provider).catch(console.error);
            }

            const { profile, preferences } = await loadUserData(newSession.user);
            if (isMounted) {
              currentUserIdRef.current = newSession.user.id;
              setUser(transformProfile(newSession.user, profile, preferences));
            }
          } catch (error) {
            console.error('[Auth] Error loading user data:', error);
          } finally {
            isProcessingAuthRef.current = false;
          }
        })();
      }
    });

    // INITIAL load - this controls isLoading
    const initializeAuth = async () => {
      try {
        // Starting initial auth check
        
        let { data: { session: initialSession } } = await supabase.auth.getSession();
        
        if (!isMounted) return;
        
        if (!initialSession?.user) {
          // No session found
          currentUserIdRef.current = null;
          setSession(null);
          setUser(null);
          return;
        }
        
        // Session found, validating user
        setSession(initialSession);
        
        const { data: userData, error: userError } = await supabase.auth.getUser();
        if (userError) {
          const isAuthError = userError.message?.toLowerCase().includes('invalid') ||
                              userError.message?.toLowerCase().includes('expired') ||
                              userError.message?.toLowerCase().includes('not authorized') ||
                              userError.status === 401 || userError.status === 403;
          
          if (isAuthError) {
            // Access token expired — attempt silent refresh before signing out
            console.debug('[Auth] Access token expired, attempting silent refresh…');
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            
            if (refreshError || !refreshData?.session) {
              // Refresh failed — session is truly dead, sign out
              console.debug('[Auth] Refresh failed, signing out:', refreshError?.message);
              await supabase.auth.signOut();
              if (isMounted) {
                currentUserIdRef.current = null;
                setSession(null);
                setUser(null);
              }
              return;
            }
            
            // Refresh succeeded — continue with the new session
            console.debug('[Auth] Silent refresh succeeded');
            initialSession = refreshData.session;
            if (isMounted) {
              setSession(refreshData.session);
            }
          }
          
          // getUser failed (non-auth error), continuing with session
        }
        
        // User valid, loading profile data
        const { profile, preferences } = await loadUserData(initialSession.user);
        
        if (isMounted) {
          currentUserIdRef.current = initialSession.user.id;
          setUser(transformProfile(initialSession.user, profile, preferences));
          // Initial load complete
        }
      } catch (error) {
        console.error('[Auth] Error during initial auth:', error);
      } finally {
        // Cancel the safety timeout — auth completed normally
        if (loadingTimeoutRef.current) {
          clearTimeout(loadingTimeoutRef.current);
          loadingTimeoutRef.current = null;
        }
        initialLoadCompleteRef.current = true;
        getAuthSingleton().initialized = true;
        // Cache for potential re-mounts
        if (isMounted) {
          setIsLoading(false);
          // Auth loading complete
        }
      }
    };

    // Only run initial auth check if not already done in a previous mount
    if (!getAuthSingleton().initialized) {
      initializeAuth();
    }

    return () => {
      // AuthProvider cleanup
      isMounted = false;
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
      subscription.unsubscribe();
    };
  }, []);

  // Keep singleton cache in sync so re-mounts get current state
  useEffect(() => {
    const sg = getAuthSingleton();
    sg.cachedUser = user;
    sg.cachedSession = session;
  }, [user, session]);

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

  const signup = async (email: string, password: string, name?: { firstName: string; lastName: string }): Promise<{ needsEmailConfirmation?: boolean }> => {
    const fullName = name ? `${name.firstName} ${name.lastName}` : undefined;

    // Build emailRedirectTo — include invite token so email confirmation
    // lands on /?inviteToken=xyz and OAuthReturnHandler picks it up
    let redirectUrl = `${window.location.origin}/`;
    try {
      const { peekPendingInviteToken } = await import('@/utils/inviteTokenPersistence');
      const pendingToken = peekPendingInviteToken();
      if (pendingToken) {
        redirectUrl = `${window.location.origin}/?inviteToken=${encodeURIComponent(pendingToken)}`;
      }
    } catch { /* ignore */ }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
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
    
    // Supabase returns an empty identities array for repeated signups
    // (user already exists). Surface a helpful message instead of a generic one.
    if (data.user && (!data.user.identities || data.user.identities.length === 0)) {
      throw new Error('An account with this email already exists. Please sign in instead.');
    }
    
    // Email confirmation required — return gracefully instead of throwing
    if (data.user && !data.session) {
      return { needsEmailConfirmation: true };
    }
    
    // Profile is created automatically via trigger
    setSession(data.session);
    setUser(transformProfile(data.user, null, null));
    
    // Log signup event (don't await to not block signup)
    if (data.user) {
      logSignup().catch(console.error);
    }

    return {};
  };

  const logout = async () => {
    // Reset singleton cache so next login starts fresh
    const sg = getAuthSingleton();
    sg.initialized = false;
    sg.cachedUser = null;
    sg.cachedSession = null;
    // Log logout before signing out (user is still authenticated)
    if (user) {
      logLogout().catch(console.error);
    }

    // Preserve onboarding/tour keys BEFORE signOut clears localStorage
    const TOUR_KEYS = [
      'voyance_site_tour_completed',
      'voyance_itinerary_tour_completed',
      'voyance_welcome_shown',
      'voyance_onboarding_nudge_shown',
      'voyance_welcome_bonus_claimed',
    ] as const;
    const savedTourState: Record<string, string> = {};
    TOUR_KEYS.forEach(key => {
      const val = localStorage.getItem(key);
      if (val) savedTourState[key] = val;
    });
    
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Logout error:', error);
    }
    
    // Clean up legacy localStorage keys to prevent stale token issues
    const legacyKeys = [
      'voyance_token',
      'voyance_access_token',
      'voyance_anonymous_session',
      'voyance_demo_trips',
      'voyance_local_trips',
      'authTokenExpiry',
    ];
    legacyKeys.forEach(key => localStorage.removeItem(key));
    
    // Clean up quiz-related keys
    Object.keys(localStorage)
      .filter(key => key.startsWith('voyance_quiz_'))
      .forEach(key => localStorage.removeItem(key));

    // Restore tour/onboarding keys so they survive logout
    Object.entries(savedTourState).forEach(([key, val]) => {
      localStorage.setItem(key, val);
    });
    
    currentUserIdRef.current = null;
    setSession(null);
    setUser(null);
  };

  const updateUser = (updates: Partial<User>) => {
    if (user) {
      // Validate name and email before saving
      if (updates.name !== undefined && !updates.name.trim()) {
        console.error('[Auth] Cannot save empty name');
        return;
      }
      if (updates.email !== undefined && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)) {
        console.error('[Auth] Cannot save invalid email');
        return;
      }

      setUser({ ...user, ...updates });
      
      // Sync to Supabase using upsert to prevent "0 rows updated" failures
      if (session?.user) {
        supabase.from('profiles').upsert({
          id: session.user.id,
          display_name: updates.name,
          avatar_url: updates.avatar,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' }).then(({ error }) => {
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
