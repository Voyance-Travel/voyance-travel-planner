

# Fix 25B — Apple Sign In Visibility + Cookie Banner in Native App

## Current State

1. **SocialLoginButtons.tsx**: Apple button is already first and always visible (no conditional hiding). However, it uses the same outline styling as Google — Apple HIG requires the Apple button to use their official black background style for prominence.

2. **Cookie Banner**: There is NO dedicated cookie consent banner component. The `voyance_cookie_consent` key in localStorage is referenced by `analyticsGate.ts` but no UI component sets it. No banner to hide.

3. **Analytics in Native App**: Already handled — `useAnalyticsTracker.ts` calls `isNativeApp()` and skips tracking. `analyticsGate.ts` returns `false` for `canUseAnalytics()` and `canUseMarketing()` when native. This is solid.

## Changes Required

### 1. `src/components/auth/SocialLoginButtons.tsx` — Apple button styling

The Apple button currently uses `bg-background hover:bg-muted border-border text-foreground` (same as Google). Change it to Apple's official black button style: `bg-black hover:bg-gray-900 text-white border-black dark:bg-white dark:hover:bg-gray-100 dark:text-black dark:border-white`. This gives Apple the required visual prominence per HIG guideline 4.8.

Button order is already correct (Apple first, Google second). No conditional hiding found.

### 2. No cookie banner exists — nothing to hide

There is no cookie consent banner component in the codebase. The `voyance_cookie_consent` localStorage key exists in the analytics gate utility but no UI renders a banner. No changes needed here.

### 3. Analytics — already handled

`useAnalyticsTracker` and `analyticsGate` already skip all tracking when `isNativeApp()` returns true. No changes needed.

## Summary

Only one file needs editing: style the Apple Sign In button with Apple's official black/white treatment to satisfy the App Store review requirement for prominence.

