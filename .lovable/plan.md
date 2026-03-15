

# Fix: Self-heal incorrectly regenerating already-planned days

## The Problem

The self-heal logic at TripDetail.tsx line 1134-1184 detects "unplanned" days by filtering out logistical activities (`check-in`, `check-out`, `hotel`, `accommodation`) and checking if anything remains. If a day has **only** logistical activities (like a late arrival day with just hotel check-in, or an early departure day with just checkout), the self-heal treats it as broken and **regenerates it — destroying existing, intentional data**.

This is happening on "almost all trips" because arrival and departure days commonly have only logistical activities, and the filter is too aggressive.

## The Fix

The self-heal should **only** trigger for days that are genuinely empty (zero activities of any kind), not for days that have logistical-only content. A day with a hotel check-in or checkout was intentionally generated that way — it's not broken.

### Changes to `src/pages/TripDetail.tsx` (~line 1140-1149)

Replace the "filter out logistics, check if empty" logic with a simpler check: only flag days where `activities` is truly empty (length === 0) or undefined. Days that have ANY activities — even just check-in/check-out — are considered planned.

```typescript
for (const day of daysList) {
  const acts = Array.isArray(day.activities) ? day.activities : [];
  // Only flag days with truly ZERO activities — not days with logistical-only content.
  // Arrival/departure days with just check-in/check-out are intentionally planned that way.
  if (acts.length === 0 && day.dayNumber) {
    emptyDayNumbers.push(day.dayNumber);
  }
}
```

This is a one-file, targeted fix that stops the self-heal from destroying legitimate data while still catching genuinely failed generation (where a day exists in the structure but has no activities at all).

### File Changed

| File | Change |
|------|--------|
| `src/pages/TripDetail.tsx` | Remove overly-aggressive logistics filter from self-heal detection — only regenerate truly empty days |

