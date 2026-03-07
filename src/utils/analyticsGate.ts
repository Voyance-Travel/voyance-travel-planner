/**
 * Analytics Gate — prevents analytics/tracking in native app context.
 * Checks both native app detection and cookie consent preferences.
 * 
 * Apple Guideline 5.1.2(i): No tracking in native app without ATT.
 */

const CONSENT_STORAGE_KEY = 'voyance_cookie_consent';

export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(
    (window as any).isNativeApp ||
    navigator.userAgent.includes('VoyanceApp') ||
    (window as any).Capacitor?.isNativePlatform?.() ||
    (window as any).webkit?.messageHandlers?.nativeApp ||
    (window as any).Capacitor?.getPlatform?.() === 'ios' ||
    (window as any).Capacitor?.getPlatform?.() === 'android' ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.location.protocol === 'capacitor:' ||
    window.location.protocol === 'ionic:'
  );
}

export function canUseAnalytics(): boolean {
  if (isNativeApp()) return false;
  try {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!stored) return false;
    const prefs = JSON.parse(stored);
    return prefs.analytics === true;
  } catch {
    return false;
  }
}

export function canUseMarketing(): boolean {
  if (isNativeApp()) return false;
  try {
    const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!stored) return false;
    const prefs = JSON.parse(stored);
    return prefs.marketing === true;
  } catch {
    return false;
  }
}
