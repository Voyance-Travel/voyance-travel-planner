

# Fix: 20 Edge Functions Missing from Config

## Problem

There are **20 edge functions** that exist as code directories and are actively called from the frontend, but are **missing from `config.toml`**. Without a config entry, they default to `verify_jwt = true` at the Supabase gateway level. Since your project uses in-code JWT validation (not gateway-level), these functions will fail with 401/CORS errors when called from the browser.

## Affected Functions

All 20 are called from the frontend and have proper CORS headers and in-code auth, but will be blocked at the gateway:

| Function | Called From |
|---|---|
| `refresh-day` | `useRefreshDay.ts` |
| `trip-chat` | `TripChat.tsx` |
| `trip-suggestions` | `TripSuggestions.tsx` |
| `discover-proactive` | `DiscoverDrawer.tsx` |
| `dna-feedback-chat` | `DNAFeedbackChat.tsx` |
| `mid-trip-dna` | `MidTripDNA.tsx` |
| `suggest-hotel-swaps` | `TripConfirmationBanner.tsx` |
| `transit-estimate` | `useTransitEstimate.ts` |
| `compare-transport` | `useTransportComparison.ts` |
| `generate-skip-list` | `useSkipList.ts` |
| `purchase-group-unlock` | `GroupUnlockModal.tsx` |
| `topup-group-budget` | `GroupTopupModal.tsx` |
| `spend-group-credits` | (group billing) |
| `discover-hidden-gems` | (discovery feature) |
| `chat-trip-planner` | (chat planner) |
| `mystery-trip-logistics` | (mystery trips) |
| `backfill-activity-costs` | (admin/migration) |
| `backfill-destination-images` | (admin/migration) |
| `cache-destination-image` | (image caching) |
| `migrate-site-images` | (admin/migration) |

## Fix

**Single change to `supabase/config.toml`**: Add all 20 missing function entries with `verify_jwt = false`, matching the existing pattern used by the other 85+ functions.

## Technical Details

- **File changed**: `supabase/config.toml` only
- **No code changes needed** — all 20 functions already have proper CORS headers and in-code auth
- **Risk**: None — this aligns them with the architecture every other function already uses
- **Impact**: Fixes silent 401 failures for features like Refresh Day, Trip Chat, Trip Suggestions, Discover, DNA Feedback, Hotel Swaps, Transit Estimates, Group Unlocks, and more

