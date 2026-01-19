import { useEffect, useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Component that scrolls to top on route changes (including query param changes)
 * Uses useLayoutEffect for immediate scroll before paint
 * Should be placed inside BrowserRouter
 */
export function ScrollToTop() {
  const { pathname, search } = useLocation();

  // Use useLayoutEffect to scroll before the browser paints
  // This prevents the "flash" of content at the bottom
  useLayoutEffect(() => {
    // Use instant scroll to ensure immediate positioning
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname, search]);

  return null;
}
