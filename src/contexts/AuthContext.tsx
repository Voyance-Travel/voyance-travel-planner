import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  homeAirport?: string;
  createdAt: string;
  quizCompleted?: boolean;
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
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, name?: string) => Promise<void>;
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
  preferences?: { budget_tier?: string; travel_pace?: string; accommodation_style?: string; home_airport?: string } | null
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

// Demo mode for preview testing (dev only)
const DEMO_MODE_KEY = 'voyance_demo_mode';
const DEMO_USER: User = {
  id: '00000000-0000-0000-0000-000000000001', // Valid UUID for demo user
  email: 'demo@voyance.travel',
  name: 'Demo Traveler',
  avatar: undefined,
  homeAirport: 'JFK',
  createdAt: new Date().toISOString(),
  quizCompleted: true,
  preferences: {
    style: 'boutique',
    budget: 'moderate',
    pace: 'relaxed',
    accommodation: 'boutique',
  },
  travelDNA: {
    type: 'Explorer',
    secondary: 'Relaxer',
    confidence: 85,
  },
};

export function isDemoModeEnabled(): boolean {
  return localStorage.getItem(DEMO_MODE_KEY) === 'true';
}

export function toggleDemoMode(enabled: boolean): void {
  if (enabled) {
    localStorage.setItem(DEMO_MODE_KEY, 'true');
  } else {
    localStorage.removeItem(DEMO_MODE_KEY);
  }
  window.location.reload();
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Check for demo mode on mount
  useEffect(() => {
    if (isDemoModeEnabled()) {
      setIsDemoMode(true);
      setUser(DEMO_USER);
      setSession({ user: { id: DEMO_USER.id, email: DEMO_USER.email } } as Session);
      setIsLoading(false);
    }
  }, []);

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

  // Sync profile to Supabase on sign in
  const syncProfile = async (supabaseUser: SupabaseUser) => {
    try {
      console.log('[Auth] Syncing profile to Supabase for:', supabaseUser.id);
      await supabase.from('profiles').upsert({
        id: supabaseUser.id,
        display_name: supabaseUser.user_metadata?.name || supabaseUser.user_metadata?.full_name,
        avatar_url: supabaseUser.user_metadata?.avatar_url,
      }, { onConflict: 'id' });
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
    // Skip if demo mode
    if (isDemoMode) return;

    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { profile, preferences } = await loadUserData(session.user);
        setUser(transformProfile(session.user, profile, preferences));
      }
      setSession(session);
      setIsLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('[Auth] Auth state changed:', event);
      
      if (session?.user) {
        // On sign in, sync profile and load data
        if (event === 'SIGNED_IN') {
          await syncProfile(session.user);
        }
        
        const { profile, preferences } = await loadUserData(session.user);
        setUser(transformProfile(session.user, profile, preferences));
      } else {
        setUser(null);
      }
      
      setSession(session);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [isDemoMode]);

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
    }
  };

  const signup = async (email: string, password: string, name?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name,
          full_name: name,
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
  };

  const logout = async () => {
    // Handle demo mode logout
    if (isDemoMode) {
      toggleDemoMode(false);
      return;
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
    
    // Save to Supabase
    const { error } = await supabase.from('user_preferences').upsert({
      user_id: session.user.id,
      budget_tier: preferences.budget,
      travel_pace: preferences.pace,
      accommodation_style: preferences.accommodation,
    }, { onConflict: 'user_id' });
    
    if (error) {
      console.error('[Auth] Error saving preferences:', error);
      throw error;
    }
    
    console.log('[Auth] Preferences saved successfully');
    
    // Update local state
    setUser({ 
      ...user, 
      preferences: { ...user.preferences, ...preferences } 
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
