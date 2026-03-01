import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AccessibilityState {
  largerText: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  differentiateWithoutColor: boolean;
  setLargerText: (v: boolean) => void;
  setHighContrast: (v: boolean) => void;
  setReducedMotion: (v: boolean) => void;
  setDifferentiateWithoutColor: (v: boolean) => void;
}

export const useAccessibilityStore = create<AccessibilityState>()(
  persist(
    (set) => ({
      largerText: false,
      highContrast: false,
      reducedMotion: false,
      differentiateWithoutColor: false,
      setLargerText: (v) => set({ largerText: v }),
      setHighContrast: (v) => set({ highContrast: v }),
      setReducedMotion: (v) => set({ reducedMotion: v }),
      setDifferentiateWithoutColor: (v) => set({ differentiateWithoutColor: v }),
    }),
    { name: 'voyance-a11y' }
  )
);
