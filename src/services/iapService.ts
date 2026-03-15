/**
 * In-App Purchase Service
 *
 * Phase 1: Detects iOS native → links out to website for purchase
 * Phase 2 (future): Native StoreKit 2 purchases
 */

import { Capacitor } from '@capacitor/core';

/**
 * Returns true if running inside the native iOS app shell (Capacitor WKWebView).
 */
export function isNativeIOS(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
  } catch {
    return false;
  }
}

/**
 * Returns true if running inside ANY native app shell (iOS or Android).
 */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return navigator.userAgent.includes('VoyanceApp');
  }
}

/**
 * Open the pricing page on the website in the device's external browser.
 * Used as the Phase 1 iOS purchase flow — link out to Stripe on the web.
 */
export async function openWebsitePurchase(packId?: string): Promise<void> {
  const baseUrl = 'https://travelwithvoyance.com/pricing';
  const url = packId ? `${baseUrl}?pack=${packId}` : baseUrl;

  try {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url, presentationStyle: 'popover' });
  } catch {
    window.location.href = url;
  }
}

// Legacy exports for backward compatibility (no-ops)
export function isIAPAvailable(): boolean {
  return false;
}

export async function purchaseByPackId(
  _packId: string
): Promise<{ success: boolean; error?: string; credits?: number }> {
  return { success: false, error: 'IAP not available' };
}
