

# Fix: Broken Icon in ErrorBoundary Fallback

## Problem
The ErrorBoundary fallback UI imports `AlertCircle` from `lucide-react`. When the app crashes (especially from a corrupted bundle or module loading failure), lucide-react itself may not render correctly — producing the garbled icon visible in the screenshot.

An error boundary's fallback UI must have **zero external component dependencies** to be reliable.

## Fix
**File: `src/components/common/ErrorBoundary.tsx`**

Replace the `AlertCircle` lucide-react import with a hardcoded inline SVG of a simple exclamation-circle icon. This ensures the fallback screen renders correctly regardless of what caused the crash.

The inline SVG will be a simple circle with an exclamation mark, styled to match the current design (`text-primary`, same dimensions).

Remove the `AlertCircle` import from lucide-react (keep `logClientError` and `extractFailingComponent` imports).

## Scope
- 1 file changed: `src/components/common/ErrorBoundary.tsx`
- No other files affected

