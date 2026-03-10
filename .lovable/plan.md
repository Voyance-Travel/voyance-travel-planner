

## Branded Error Experience

Three files, all cosmetic/copy changes:

### 1. `src/components/common/ErrorBoundary.tsx`
Replace the red destructive fallback UI (lines 39-65) with the branded Voyance version: teal accent circle, Playfair "Small detour." headline, friendly subtext, Refresh/Go Home buttons. Remove the `<details>` stack trace block entirely.

### 2. `src/pages/NotFound.tsx` (line 14)
Change `console.error` to `console.warn` since 404s are normal navigation events, not crashes.

### 3. `src/components/common/GlobalErrorHandler.tsx`
- Line 32: `'Something hiccupped. Try that again.'`
- Line 45: `'Something hiccupped. A quick refresh should fix it.'`

No backend or structural changes needed.

