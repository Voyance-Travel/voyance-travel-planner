
# Fix 25A — iOS In-App Purchases: Remove Broken Plugin, Add Website Link-Out

## Problem
The iOS app crashes with "NativePurchases plugin is not implemented on ios" when tapping Buy on any credit pack. The `@capgo/native-purchases` plugin referenced in `iapService.ts` doesn't exist as a native Capacitor plugin, so every IAP call fails.

## Solution
Replace the broken native IAP flow with a website link-out on iOS native. When `isNativeIOS()` is true, purchase buttons open Safari to `travelwithvoyance.com/pricing` instead of trying Stripe Embedded Checkout (broken in WKWebView) or the non-existent IAP plugin. This complies with Apple's US storefront rules.

## Files to Change

### 1. `src/services/iapService.ts` — Full replacement
Replace entire file. Remove all `NativePurchases`/`@capgo/native-purchases` references. New exports:
- `isNativeIOS()` — detects iOS Capacitor shell
- `isNativeApp()` — detects any native shell
- `openWebsitePurchase(packId?)` — opens Safari to pricing page via `@capacitor/browser`

### 2. Six consumer files — Replace IAP calls with link-out
Each file currently does `isIAPAvailable() → purchaseByPackId()`. Replace with `isNativeIOS() → openWebsitePurchase()`:

| File | Handler |
|------|---------|
| `src/components/profile/CreditPacksGrid.tsx` | `openCheckout()` |
| `src/components/checkout/OutOfCreditsModal.tsx` | `handleBuyPack()` |
| `src/components/checkout/UpgradePrompt.tsx` | `handleBuyPack()` |
| `src/components/checkout/CreditQuickBuy.tsx` | `handleBuy()` |
| `src/components/itinerary/CreditNudge.tsx` | `handleBuyPack()` |
| `src/pages/Pricing.tsx` | `openCheckout()` |
| `src/pages/CreditsAndBilling.tsx` | `handleBuyPack()` |

### 3. `src/components/checkout/EmbeddedCheckoutModal.tsx` — Safety net
Add `useEffect` that calls `openWebsitePurchase() + onClose()` if somehow opened on iOS native, preventing a broken Stripe iframe.

### 4. `src/App.tsx` — Remove IAP initializer
The `IAPInitializer` component that calls `initializeIAP()` is no longer needed since there's no native plugin to initialize.

### Already Fixed (no changes needed)
- `supabase/functions/create-checkout/index.ts` — already uses correct origin fallback
- `supabase/functions/create-embedded-checkout/index.ts` — already uses correct origin fallback  
- `src/pages/Profile.tsx` — already uses `window.location.href` instead of `window.open`
