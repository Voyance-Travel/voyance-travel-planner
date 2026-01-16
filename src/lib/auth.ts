import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  createdAt: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string) => Promise<void>;
  logout: () => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      
      login: async (email: string) => {
        // Simulate authentication delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const user: User = {
          id: crypto.randomUUID(),
          email,
          createdAt: new Date().toISOString(),
        };
        
        set({ user, isAuthenticated: true });
      },
      
      logout: () => {
        set({ user: null, isAuthenticated: false });
      },
    }),
    {
      name: 'voyance-auth',
    }
  )
);
