## Diagnosis

Your two-layer scrub system is correct, but I found a **concrete UI leak path** that contradicts part of your analysis:

1. **No frontend code reads `activity.reservationUrgency` as JSX.** A repo-wide search for `reservationUrgency` / `reservation_urgency` in `src/` returned **zero hits**. Path #2 (unconditional render of the JSON field) is not the cause.

2. **`src/components/itinerary/ItineraryEditor.tsx` line 1146 renders `extActivity.tips` raw — no `sanitizeActivityText()` wrapper.** This is the only activity-card render of `tips` in the codebase that bypasses the sanitizer. `EditorialItinerary.tsx` correctly wraps every `activity.tips` read in `sanitizeActivityText(...)`. So when an extracted activity (manual paste / external import / saved-before-scrubber-existed) carries `"Reservation Urgency: ."` in its `tips` field, it renders verbatim from this single component.

3. Backend `scrubActivity` runs at save (`action-save-itinerary.ts:139`) and in `repair-day` §10b — fillers from `fill-dead-gaps.ts` flow through save, so their bodies do get scrubbed. Already-persisted trips (saved before the scrubber regexes were added, or imported via the manual paste path) keep the leaked text in DB, and the UI sanitizer is the only thing standing between DB and screen.

## Fix

Wrap the one unsanitized site so the existing UI scrubber (which already covers this exact pattern at `activityNameSanitizer.ts:387–388`) actually runs:

```text
src/components/itinerary/ItineraryEditor.tsx (line 1141-1149)
─────────────────────────────────────────────────────────────
Replace direct {extActivity.tips} render with:

  {(() => {
    const t = sanitizeActivityText(extActivity.tips);
    return t ? (
      <div className="...">
        <Sparkles ... />
        <div>
          <span ...>Insider Tip</span>
          <p ...>{t}</p>
        </div>
      </div>
    ) : null;
  })()}

The outer `{extActivity.tips && (...)}` becomes redundant —
sanitized empty string already gates the render via the IIFE.
Add: import { sanitizeActivityText } from '@/utils/activityNameSanitizer';
(if not already imported in this file).
```

That's the only change. No backend edit, no regex change, no scrubActivity wiring change — the sanitizer regexes already match `Reservation Urgency: .` / `reservationUrgency: .` / camelCase / snake_case / orphan-empty-label shapes.

## Why not also add a render gate on `reservationUrgency` JSON?

Because nothing reads it. Adding a guard for a field no component renders is dead code. If the field is ever surfaced in the UI later, the existing `scrubTitleLeaks()` already deletes leaked values from the activity object at save, and a future component should call `sanitizeActivityText` (or a new typed helper) like every other text field.

## Verification

After the edit, the existing test suites cover the regex behavior:
- `supabase/functions/_shared/__tests__/prompt-leak-scrub.test.ts`
- `src/utils/__tests__/activityNameSanitizer.test.ts` (extend with one render-gate case if you want a regression lock)

No edge function redeploy needed — UI-only change.

## Files touched

- `src/components/itinerary/ItineraryEditor.tsx` — wrap `extActivity.tips` render in `sanitizeActivityText`.
