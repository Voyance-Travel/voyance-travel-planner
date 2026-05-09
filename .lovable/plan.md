## Goal
Wrap six remaining unsanitized JSX renders of `description` / `tips` with `sanitizeActivityText` so AI prompt-leak artifacts can never reach the UI. Same one-line pattern already applied at `ItineraryEditor.tsx:1141`.

## Changes

All edits add (or reuse) `import { sanitizeActivityText } from '@/utils/activityNameSanitizer'` and wrap the field render. Use the IIFE pattern for single descriptions, and a pre-`map` transform for tip arrays so we can drop empties cleanly.

### 1. `src/pages/ActiveTrip.tsx` (line 1273 — tips array)
```tsx
{activity.tips
  .slice(0, 2)
  .map(t => sanitizeActivityText(t))
  .filter((t): t is string => !!t)
  .map((tip, i) => (
    <p key={i} className="text-xs font-serif italic text-muted-foreground leading-relaxed">
      {tip}
    </p>
  ))}
```

### 2. `src/pages/DestinationDetail.tsx` (line 732 — description)
```tsx
{(() => {
  const desc = sanitizeActivityText(activity.description);
  return desc ? (
    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">{desc}</p>
  ) : null;
})()}
```

### 3. `src/pages/CommunityGuidePublic.tsx` (line 267-269 — description)
Same IIFE pattern guarding the existing `activity.description &&` block.

### 4. `src/pages/CommunityGuideDetail.tsx` (line 607-614 — description "Voyance Tip")
IIFE returning the `<div className="pl-3 …">` only when sanitized text is non-empty.

### 5. `src/pages/TravelGuideBuilder.tsx` (line 273-277 — description)
IIFE wrapper around the `<p className="text-xs … line-clamp-1">`.

### 6. `src/components/itinerary/ItineraryEditor.tsx` (line 968-970 — second description block)
Import already present. IIFE wrapper around the `<p className="text-sm opacity-80 line-clamp-2">`.

## Verification
- `npm run typecheck` clean.
- `rg -n "\\{(activity|tip)\\.(description|tips)\\}" src/` — only sanitized call sites remain (or known non-itinerary surfaces outside the audit scope).
- UI smoke: open each surface (Active Trip, Destination Detail, public + private community guide, guide builder, itinerary editor card) on a generated trip and confirm no `Reservation Urgency:` / `Booking Window:` / dot-only artifact text leaks.

## Out of scope
Backend pipeline scrubbers and the validation gate already cover the data source; this PR is the last UI safety net only. No edge-function or schema changes.
