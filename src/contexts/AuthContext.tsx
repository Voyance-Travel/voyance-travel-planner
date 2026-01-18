import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { 
  getProfile, 
  getProfileLite,
  updateProfile as updateProfileAPI,
  type UserProfile,
  type ProfileLite,
} from '@/services/profileAPI';
import {
  getFullPreferences,
  updatePreferences as updatePreferencesAPI,
  type FullPreferences,
} from '@/services/preferencesV1API';

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

// Transform backend profile to our User type
function transformProfile(
  supabaseUser: SupabaseUser | null, 
  profile?: UserProfile | ProfileLite | null,
  preferences?: Partial<FullPreferences> | null
): User | null {
  if (!supabaseUser) return null;
  
  const travelDNA = profile && 'travelDNA' in profile ? profile.travelDNA : null;
  const hasCompletedQuiz = profile && 'hasCompletedQuiz' in profile 
    ? profile.hasCompletedQuiz 
    : profile && 'quizCompleted' in profile 
      ? profile.quizCompleted 
      : false;
  
  return {
    id: supabaseUser.id,
    email: supabaseUser.email || '',
    name: profile?.name || profile?.display_name || supabaseUser.user_metadata?.name || supabaseUser.user_metadata?.full_name || supabaseUser.email?.split('@')[0],
    avatar: profile?.avatarUrl || supabaseUser.user_metadata?.avatar_url,
    homeAirport: preferences?.homeAirport || undefined,
    createdAt: supabaseUser.created_at,
    quizCompleted: hasCompletedQuiz || !!preferences,
    preferences: preferences ? {
      style: preferences.accommodationStyle,
      budget: preferences.budgetTier,
      pace: preferences.travelPace,
      accommodation: preferences.accommodationStyle,
    } : undefined,
    travelDNA: travelDNA ? {
      type: typeof travelDNA === 'object' && 'type' in travelDNA ? String(travelDNA.type) : 'Explorer',
      secondary: typeof travelDNA === 'object' && 'archetype' in travelDNA && travelDNA.archetype && typeof travelDNA.archetype === 'object' && 'secondary' in travelDNA.archetype ? String(travelDNA.archetype.secondary) : undefined,
      confidence: typeof travelDNA === 'object' && 'archetype' in travelDNA && travelDNA.archetype && typeof travelDNA.archetype === 'object' && 'confidence' in travelDNA.archetype ? Number(travelDNA.archetype.confidence) : undefined,
    } : undefined,
  };
}

// Demo mode for preview testing (dev only)
const DEMO_MODE_KEY = 'voyance_demo_mode';
const DEMO_USER: User = {
  id: 'demo-user-001',
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

  // Load user data from backend
  const loadUserData = async (supabaseUser: SupabaseUser) => {
    try {
      console.log('[Auth] Loading user data from backend for:', supabaseUser.id);
      
      // Fetch profile and preferences in parallel from Railway backend
      const [profileResult, preferencesResult] = await Promise.allSettled([
        getProfileLite(),
        getFullPreferences(),
      ]);
      
      const profile = profileResult.status === 'fulfilled' && profileResult.value.success 
        ? profileResult.value.profile 
        : null;
      const preferences = preferencesResult.status === 'fulfilled' 
        ? preferencesResult.value 
        : null;
      
      console.log('[Auth] Loaded profile:', profile);
      console.log('[Auth] Loaded preferences:', preferences);
      
      return { profile, preferences };
    } catch (error) {
      console.error('[Auth] Error loading user data:', error);
      return { profile: null, preferences: null };
    }
  };

  // Sync profile to backend on sign in
  const syncProfile = async (supabaseUser: SupabaseUser) => {
    try {
      console.log('[Auth] Syncing profile to backend for:', supabaseUser.id);
      await updateProfileAPI({
        name: supabaseUser.user_metadata?.name || supabaseUser.user_metadata?.full_name,
        profileImage: supabaseUser.user_metadata?.avatar_url,
      });
    } catch (error) {
      console.error('[Auth] Error syncing profile:', error);
    }
  };

  // Refresh user data from backend
  const refreshUserData = async () => {
    if (!session?.user) return;
    
    const { profile, preferences } = await loadUserData(session.user);
    setUser(transformProfile(session.user, profile, preferences));
  };

  useEffect(() => {
    // Skip real auth if demo mode is active
    if (isDemoMode) return;

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        console.log('[Auth] Auth state changed:', event);
        setSession(newSession);
        
        if (newSession?.user) {
          // Defer backend calls to avoid deadlock
          setTimeout(async () => {
            // On sign up, sync profile to backend
            if (event === 'SIGNED_IN') {
              await syncProfile(newSession.user);
            }
            
            const { profile, preferences } = await loadUserData(newSession.user);
            setUser(transformProfile(newSession.user, profile, preferences));
            setIsLoading(false);
          }, 0);
        } else {
          setUser(null);
          setIsLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      setSession(existingSession);
      
      if (existingSession?.user) {
        const { profile, preferences } = await loadUserData(existingSession.user);
        setUser(transformProfile(existingSession.user, profile, preferences));
      }
      
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
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
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
    
    // Sync profile to backend
    if (data.user) {
      await updateProfileAPI({
        name: name,
      });
    }
    
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
      
      // Sync to backend
      if (session?.user) {
        updateProfileAPI({
          name: updates.name,
          profileImage: updates.avatar,
        }).catch(console.error);
      }
    }
  };

  const setPreferences = async (preferences: TravelPreferences) => {
    if (!user || !session?.user) return;
    
    console.log('[Auth] Saving preferences to backend:', preferences);
    
    // Map to backend format and save
    try {
      await updatePreferencesAPI({
        budgetTier: preferences.budget as 'budget' | 'moderate' | 'luxury' | 'premium',
        travelPace: preferences.pace as 'relaxed' | 'moderate' | 'fast',
        accommodationStyle: preferences.accommodation as 'hostel' | 'budget_hotel' | 'standard_hotel' | 'boutique' | 'luxury',
      });
      
      console.log('[Auth] Preferences saved successfully');
      
      // Update local state
      setUser({ 
        ...user, 
        preferences,
        quizCompleted: true,
      });
    } catch (error) {
      console.error('[Auth] Error saving preferences:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated: !!session || isDemoMode,
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

export default AuthContext;
