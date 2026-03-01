import { useEffect } from 'react';
import { useAccessibilityStore } from '@/stores/accessibility-store';

/**
 * Syncs accessibility store preferences to <html> class list
 * so CSS layers can respond globally.
 */
export function useAccessibilityClasses() {
  const { largerText, highContrast, reducedMotion, differentiateWithoutColor } = useAccessibilityStore();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('a11y-larger-text', largerText);
    root.classList.toggle('a11y-high-contrast', highContrast);
    root.classList.toggle('a11y-reduced-motion', reducedMotion);
    root.classList.toggle('a11y-no-color-only', differentiateWithoutColor);
  }, [largerText, highContrast, reducedMotion, differentiateWithoutColor]);
}
