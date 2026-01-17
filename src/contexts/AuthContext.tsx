import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User as SupabaseUser, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

export interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
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
  setPreferences: (preferences: TravelPreferences) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PREFERENCES_STORAGE_KEY = 'voyance-preferences';

// Transform Supabase user to our User type
function transformUser(supabaseUser: SupabaseUser | null, storedPrefs?: TravelPreferences): User | null {
  if (!supabaseUser) return null;
  
  return {
    id: supabaseUser.id,
    email: supabaseUser.email || '',
    name: supabaseUser.user_metadata?.name || supabaseUser.user_metadata?.full_name || supabaseUser.email?.split('@')[0],
    avatar: supabaseUser.user_metadata?.avatar_url,
    createdAt: supabaseUser.created_at,
    quizCompleted: !!storedPrefs,
    preferences: storedPrefs,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load preferences from localStorage
  const loadPreferences = (userId: string): TravelPreferences | undefined => {
    try {
      const stored = localStorage.getItem(`${PREFERENCES_STORAGE_KEY}-${userId}`);
      return stored ? JSON.parse(stored) : undefined;
    } catch {
      return undefined;
    }
  };

  // Save preferences to localStorage
  const savePreferences = (userId: string, prefs: TravelPreferences) => {
    localStorage.setItem(`${PREFERENCES_STORAGE_KEY}-${userId}`, JSON.stringify(prefs));
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession);
        const prefs = newSession?.user ? loadPreferences(newSession.user.id) : undefined;
        setUser(transformUser(newSession?.user ?? null, prefs));
        setIsLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      const prefs = existingSession?.user ? loadPreferences(existingSession.user.id) : undefined;
      setUser(transformUser(existingSession?.user ?? null, prefs));
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
    
    const prefs = data.user ? loadPreferences(data.user.id) : undefined;
    setSession(data.session);
    setUser(transformUser(data.user, prefs));
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
    
    setSession(data.session);
    setUser(transformUser(data.user, undefined));
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
    }
  };

  const setPreferences = (preferences: TravelPreferences) => {
    if (user) {
      savePreferences(user.id, preferences);
      setUser({ 
        ...user, 
        preferences,
        quizCompleted: true,
      });
    }
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
