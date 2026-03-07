/**
 * useScrollLockCleanup
 * 
 * Safety net: cleans up stale scroll locks left by Radix Dialog/Sheet/Drawer
 * that may not have properly unmounted. Runs on mount and periodically checks
 * if body scroll is locked without any visible modal overlay.
 */
import { useEffect } from 'react';

function clearStaleScrollLock() {
  const body = document.body;
  
  // Radix uses data-scroll-locked attribute and inline overflow: hidden
  const isLocked = body.hasAttribute('data-scroll-locked') || 
    body.style.overflow === 'hidden' ||
    body.style.getPropertyValue('overflow') === 'hidden';
  
  if (!isLocked) return;
  
  // Check if any modal overlay is actually visible
  const hasVisibleOverlay = document.querySelector(
    '[data-state="open"][role="dialog"], ' +
    '[data-state="open"][data-radix-dialog-overlay], ' +
    '.vaul-overlay[data-state="open"]'
  );
  
  if (!hasVisibleOverlay) {
    // No modal is open but scroll is locked — clear it
    body.style.overflow = '';
    body.style.paddingRight = '';
    body.removeAttribute('data-scroll-locked');
    // Also clean up any Radix-injected style tags
    const scrollLockStyles = document.querySelectorAll('style[data-radix-scroll-lock-wrapper]');
    scrollLockStyles.forEach(el => el.remove());
    console.warn('[ScrollLockCleanup] Cleared stale scroll lock — no modal overlay found');
  }
}

export function useScrollLockCleanup() {
  useEffect(() => {
    // Check on mount (page navigation may leave stale locks)
    const initialTimer = setTimeout(clearStaleScrollLock, 500);
    
    // Periodic check every 3 seconds
    const interval = setInterval(clearStaleScrollLock, 3000);
    
    // Also clean up on unmount
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
      clearStaleScrollLock();
    };
  }, []);
}
