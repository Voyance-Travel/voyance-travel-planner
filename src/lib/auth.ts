import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface TravelPreferences {
  pace?: string;
  interests?: string[];
  budget?: string;
  accommodation?: string;
  planning?: string;
}

export interface User {
  id: string;
  email: string;
  createdAt: string;
  preferences?: TravelPreferences;
  isNewUser?: boolean;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string) => Promise<void>;
  logout: () => void;
  setPreferences: (preferences: Record<string, string | string[]>) => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      
      login: async (email: string) => {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const user: User = {
          id: crypto.randomUUID(),
          email,
          createdAt: new Date().toISOString(),
          isNewUser: true,
        };
        
        set({ user, isAuthenticated: true });
      },
      
      logout: () => {
        set({ user: null, isAuthenticated: false });
      },

      setPreferences: (preferences: Record<string, string | string[]>) => {
        set((state) => ({
          user: state.user ? {
            ...state.user,
            preferences: preferences as TravelPreferences,
            isNewUser: false,
          } : null,
        }));
      },
    }),
    {
      name: 'voyance-auth',
    }
  )
);
