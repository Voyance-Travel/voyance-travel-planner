import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { profilesApi, preferencesApi, Profile } from '@/services/neonDb';

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  homeAirport?: string;
  createdAt: string;
  quizCompleted?: boolean;
  preferences?: TravelPreferences;
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

// Transform Supabase user to our User type
function transformUser(
  supabaseUser: SupabaseUser | null, 
  profile?: Profile | null,
  preferences?: TravelPreferences | null
): User | null {
  if (!supabaseUser) return null;
  
  return {
    id: supabaseUser.id,
    email: supabaseUser.email || '',
    name: profile?.name || supabaseUser.user_metadata?.name || supabaseUser.user_metadata?.full_name || supabaseUser.email?.split('@')[0],
    avatar: profile?.avatar_url || supabaseUser.user_metadata?.avatar_url,
    homeAirport: profile?.home_airport || undefined,
    createdAt: supabaseUser.created_at,
    quizCompleted: !!preferences,
    preferences: preferences || undefined,
  };
}

// Transform Neon preferences to our format
function transformPreferences(neonPrefs: Record<string, unknown> | null): TravelPreferences | null {
  if (!neonPrefs) return null;
  return {
    style: neonPrefs.travel_style as string || undefined,
    budget: neonPrefs.budget as string || undefined,
    pace: neonPrefs.pace as string || undefined,
    interests: neonPrefs.interests as string[] || undefined,
    accommodation: neonPrefs.accommodation as string || undefined,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user data from Neon
  const loadUserData = async (supabaseUser: SupabaseUser) => {
    try {
      console.log('[Auth] Loading user data from Neon for:', supabaseUser.id);
      
      // Fetch profile and preferences in parallel
      const [profileResult, prefsResult] = await Promise.all([
        profilesApi.get(supabaseUser.id),
        preferencesApi.get(supabaseUser.id),
      ]);
      
      const profile = profileResult.data?.[0] || null;
      const preferences = transformPreferences(prefsResult.data?.[0] as Record<string, unknown> || null);
      
      console.log('[Auth] Loaded profile:', profile);
      console.log('[Auth] Loaded preferences:', preferences);
      
      return { profile, preferences };
    } catch (error) {
      console.error('[Auth] Error loading user data:', error);
      return { profile: null, preferences: null };
    }
  };

  // Create or update profile in Neon
  const syncProfile = async (supabaseUser: SupabaseUser) => {
    try {
      console.log('[Auth] Syncing profile to Neon for:', supabaseUser.id);
      await profilesApi.update(supabaseUser.id, {
        email: supabaseUser.email || '',
        name: supabaseUser.user_metadata?.name || supabaseUser.user_metadata?.full_name,
        avatarUrl: supabaseUser.user_metadata?.avatar_url,
      });
    } catch (error) {
      console.error('[Auth] Error syncing profile:', error);
    }
  };

  // Refresh user data from backend
  const refreshUserData = async () => {
    if (!session?.user) return;
    
    const { profile, preferences } = await loadUserData(session.user);
    setUser(transformUser(session.user, profile, preferences));
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        console.log('[Auth] Auth state changed:', event);
        setSession(newSession);
        
        if (newSession?.user) {
          // Defer Neon calls to avoid deadlock
          setTimeout(async () => {
            // On sign up, create profile in Neon
            if (event === 'SIGNED_IN') {
              await syncProfile(newSession.user);
            }
            
            const { profile, preferences } = await loadUserData(newSession.user);
            setUser(transformUser(newSession.user, profile, preferences));
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
        setUser(transformUser(existingSession.user, profile, preferences));
      }
      
      setIsLoading(false);
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
      setUser(transformUser(data.user, profile, preferences));
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
      // Email confirmation required - user is created but not logged in
      throw new Error('Please check your email to confirm your account');
    }
    
    // Create profile in Neon
    if (data.user) {
      await profilesApi.update(data.user.id, {
        email: email,
        name: name,
      });
    }
    
    setSession(data.session);
    setUser(transformUser(data.user, null, null));
  };

  const logout = async () => {
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
      
      // Sync to Neon
      if (session?.user) {
        profilesApi.update(session.user.id, {
          name: updates.name,
          avatarUrl: updates.avatar,
          homeAirport: updates.homeAirport,
        }).catch(console.error);
      }
    }
  };

  const setPreferences = async (preferences: TravelPreferences) => {
    if (!user || !session?.user) return;
    
    console.log('[Auth] Saving preferences to Neon:', preferences);
    
    // Save to Neon - cast to Record for API compatibility
    const result = await preferencesApi.update(user.id, preferences as unknown as Record<string, unknown>);
    
    if (result.error) {
      console.error('[Auth] Error saving preferences:', result.error);
      throw new Error(result.error);
    }
    
    console.log('[Auth] Preferences saved successfully');
    
    // Update local state
    setUser({ 
      ...user, 
      preferences,
      quizCompleted: true,
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated: !!session,
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
