/**
 * iOS In-App Purchase Service (StoreKit 2 via Capacitor)
 * 
 * Handles native IAP on iOS. On web or Android, falls back to Stripe.
 * Uses @capawesome/capacitor-in-app-purchases for StoreKit 2 integration.
 */

import { Capacitor } from '@capacitor/core';

// Lazy-loaded native module
let InAppPurchasesModule: any = null;
let initialized = false;

// Apple IAP Product IDs — must match App Store Connect products
export const IAP_PRODUCTS = {
  // Flexible Credits
  flex_100: 'com.voyancetravel.credits.flex100',
  flex_300: 'com.voyancetravel.credits.flex300',
  flex_500: 'com.voyancetravel.credits.flex500',
  // Voyance Club Packs
  voyager:    'com.voyancetravel.club.voyager',
  explorer:   'com.voyancetravel.club.explorer',
  adventurer: 'com.voyancetravel.club.adventurer',
  // Group Unlocks
  group_small:  'com.voyancetravel.group.small',
  group_medium: 'com.voyancetravel.group.medium',
  group_large:  'com.voyancetravel.group.large',
} as const;

// Map internal pack IDs to Apple product IDs
export const PACK_TO_IAP: Record<string, string> = {
  flex_100:   IAP_PRODUCTS.flex_100,
  flex_300:   IAP_PRODUCTS.flex_300,
  flex_500:   IAP_PRODUCTS.flex_500,
  voyager:    IAP_PRODUCTS.voyager,
  explorer:   IAP_PRODUCTS.explorer,
  adventurer: IAP_PRODUCTS.adventurer,
};

// Map Apple product IDs to credit amounts
export const PRODUCT_CREDITS: Record<string, number> = {
  [IAP_PRODUCTS.flex_100]: 100,
  [IAP_PRODUCTS.flex_300]: 300,
  [IAP_PRODUCTS.flex_500]: 500,
  [IAP_PRODUCTS.voyager]: 600,
  [IAP_PRODUCTS.explorer]: 1600,
  [IAP_PRODUCTS.adventurer]: 3200,
};

/**
 * Check if native iOS IAP is available
 */
export function isIAPAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';
}

/**
 * Initialize IAP - call once on app start when on iOS
 */
export async function initializeIAP(): Promise<void> {
  if (!isIAPAvailable() || initialized) return;

  try {
    const mod = await import('@capawesome/capacitor-in-app-purchases');
    InAppPurchasesModule = mod.InAppPurchases;

    await InAppPurchasesModule.initialize();

    // Listen for purchase updates
    InAppPurchasesModule.addListener('purchaseUpdated', async (purchase: any) => {
      console.log('[IAP] Purchase updated:', purchase.transactionState, purchase.productId);

      if (purchase.transactionState === 'purchased' || purchase.transactionState === 1) {
        await validateAndFulfill(purchase);
      }
    });

    initialized = true;
    console.log('[IAP] StoreKit 2 initialized');
  } catch (err) {
    console.error('[IAP] Failed to initialize:', err);
  }
}

/**
 * Get available products from the App Store
 */
export async function getProducts(): Promise<any[]> {
  if (!isIAPAvailable() || !InAppPurchasesModule) return [];

  try {
    const { products } = await InAppPurchasesModule.getProducts({
      productIds: Object.values(IAP_PRODUCTS),
      productType: 'consumable',
    });
    return products || [];
  } catch (err) {
    console.error('[IAP] Failed to get products:', err);
    return [];
  }
}

/**
 * Purchase a product by Apple product ID
 * Returns { success, error?, credits? }
 */
export async function purchaseProduct(
  productId: string
): Promise<{ success: boolean; error?: string; credits?: number }> {
  if (!isIAPAvailable() || !InAppPurchasesModule) {
    return { success: false, error: 'In-App Purchases not available' };
  }

  try {
    await InAppPurchasesModule.purchaseProduct({
      productId,
      productType: 'consumable',
    });

    // Purchase result comes through the listener, but we return optimistically
    const credits = PRODUCT_CREDITS[productId] || 0;
    return { success: true, credits };
  } catch (err: any) {
    // User cancelled
    if (err?.code === 'USER_CANCELLED' || err?.message?.includes('cancel')) {
      return { success: false, error: 'cancelled' };
    }
    console.error('[IAP] Purchase error:', err);
    return { success: false, error: err?.message || 'Purchase failed' };
  }
}

/**
 * Purchase using internal pack ID (flex_100, voyager, etc.)
 */
export async function purchaseByPackId(
  packId: string
): Promise<{ success: boolean; error?: string; credits?: number }> {
  const productId = PACK_TO_IAP[packId];
  if (!productId) {
    return { success: false, error: `Unknown pack: ${packId}` };
  }
  return purchaseProduct(productId);
}

/**
 * Validate receipt server-side and fulfill credits
 */
async function validateAndFulfill(purchase: any): Promise<void> {
  try {
    const { supabase } = await import('@/integrations/supabase/client');

    const { data, error } = await supabase.functions.invoke('validate-iap-receipt', {
      body: {
        receiptData: purchase.receipt || purchase.receiptData,
        productId: purchase.productId,
        transactionId: purchase.transactionId || purchase.transactionIdentifier,
      },
    });

    if (error) {
      console.error('[IAP] Server validation failed:', error);
      return;
    }

    if (data?.success) {
      console.log('[IAP] Credits fulfilled:', data.credits);

      // Finish the transaction
      await InAppPurchasesModule.finishTransaction({
        transactionId: purchase.transactionId || purchase.transactionIdentifier,
      });
    }
  } catch (err) {
    console.error('[IAP] Validate & fulfill error:', err);
  }
}
