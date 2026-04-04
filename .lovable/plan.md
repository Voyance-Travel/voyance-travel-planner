

## Fix: Photos Appearing Then Disappearing on Itinerary View

### Root Cause

Two issues are causing photos to flash and then vanish:

**1. `normalizeUnsplashUrl` regex is too broad (primary cause)**

In `src/utils/unsplash.ts`, line 65:
```js
if (isUnsplashUrl(value) || /photo-[a-z0-9-]+/i.test(value)) {
```

This regex matches ANY URL containing `photo-` anywhere in its path, query string, or fragment — including legitimate Supabase storage URLs, Google Places cached photos, and curated image URLs. When matched, the URL gets rewritten to a `site-images` bucket path that doesn't exist → image fails to load → fallback replaces it → photo disappears.

For example, a cached image URL like `.../trip-photos/destinations/photo-ref-abc123.jpg` would match `photo-ref` and get rewritten to `site-images/photo-ref-abc123` which doesn't exist.

**2. Global MutationObserver error handler conflicts with React (secondary cause)**

The `installGlobalUnsplashGuard` in `main.tsx` adds error handlers to ALL `<img>` elements via a MutationObserver. When a React-managed image fails (or when React updates `src` during re-render), the global handler fires BEFORE React's `onError` and replaces the src with `PLACEHOLDER_TRAVEL_SRC`. This races with React's own fallback logic in `EditorialItinerary.tsx` and can cause the image to permanently disappear (via `setThumbnailError(true)`).

### Fix

**File 1: `src/utils/unsplash.ts`** — Tighten the photo-ID regex

Change the `normalizeUnsplashUrl` function so the `photo-` regex only matches when:
- The input is a bare photo ID (no protocol, no slashes) — e.g., `photo-1234abcd`
- OR the input is an Unsplash URL (already handled by `isUnsplashUrl`)

This prevents legitimate HTTP URLs from being incorrectly rewritten. Replace the broad test with a stricter check that the entire string looks like a bare photo ID:

```js
// Before (too broad):
if (isUnsplashUrl(value) || /photo-[a-z0-9-]+/i.test(value))

// After (only bare photo IDs, not full URLs):
if (isUnsplashUrl(value) || (!value.includes('/') && /^photo-[a-z0-9-]+$/i.test(value)))
```

**File 2: `src/main.tsx`** — Skip React-managed images in the global guard

Update `patchImage` to skip images that are inside React's render tree for the itinerary. The simplest approach: skip images whose `src` is already a valid Supabase storage URL or a data URI (these are managed by React components and shouldn't be globally intercepted):

```js
// In patchImage, before normalizing:
if (originalSrc && (
  originalSrc.includes('/storage/v1/object/') ||
  originalSrc.startsWith('data:')
)) {
  return; // React components handle their own error fallbacks
}
```

### Impact
- Photos from Google Places cache, curated images, and Supabase storage will no longer be incorrectly rewritten
- React's `onError` handlers will work without interference from the global guard
- The global guard still protects legacy Unsplash URLs and bare photo IDs

