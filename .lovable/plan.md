

# Fix Remaining "Not Valid" Shared Trip Links

## Problem
Three agent components and several other sharing features still use `window.location.origin` directly to build shareable links. When an agent generates a share link from the preview environment, the URL contains the preview domain (e.g., `id-preview--bbef7015...lovable.app`), which is inaccessible to external users -- they see "Trip Not Found" or "Not Valid."

The previous fix applied `getAppUrl()` to 5 files, but missed these.

## Files to Fix

### 1. `src/components/agent/ShareTripModal.tsx` (line 113)
Replace `window.location.origin` with `getAppUrl()` for the share URL generation.

### 2. `src/components/agent/TripCockpit.tsx` (line 109)
Replace `window.location.origin` with `getAppUrl()` for the share URL.

### 3. `src/components/agent/IntakeLinkCard.tsx` (line 22)
Replace `window.location.origin` with `getAppUrl()` for intake form links shared with clients.

### 4. `src/components/archetypes/ArchetypeDetailSheet.tsx` (lines 30, 244)
Replace `window.location.origin` with `getAppUrl()` for archetype share and quiz invite links.

### 5. `src/components/profile/TravelDNAReveal.tsx` (line 217)
Replace `window.location.origin` with `getAppUrl()` for Travel DNA share links.

### No changes needed
- Auth-related files (`AuthContext.tsx`, `ForgotPasswordForm.tsx`, `voyanceAuth.ts`, `SocialLoginButtons.tsx`) correctly use `window.location.origin` because OAuth redirects must match the current browser origin, not the published URL.

## Summary

| File | Line(s) | Link Type |
|------|---------|-----------|
| `agent/ShareTripModal.tsx` | 113 | Shared trip link |
| `agent/TripCockpit.tsx` | 109 | Shared trip link |
| `agent/IntakeLinkCard.tsx` | 22 | Client intake form |
| `archetypes/ArchetypeDetailSheet.tsx` | 30, 244 | Archetype + quiz share |
| `profile/TravelDNAReveal.tsx` | 217 | Travel DNA share |

Each file just needs an import of `getAppUrl` and replacement of `window.location.origin` with `getAppUrl()`.
