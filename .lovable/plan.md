

## Fix: Refresh Day says "All Good" despite zero-buffer activities

### Root cause

There is a **brace scoping bug** in `supabase/functions/refresh-day/index.ts`. The no-coordinates buffer check (the `else` branch of `if (transit)`) is placed outside the `if (i < sorted.length - 1)` block due to a mismatched closing brace:

```
line 323: if (i < sorted.length - 1) {
line 329:   if (effectiveEnd > nextStart) { ... }      // overlap check
line 364:   const transit = estimateTransit(act, next);
line 365:   if (transit) {                               // HAS coordinates
line 410:   }                                            // closes if(transit)
line 411: }                                              // closes if(i < sorted.length-1)
line 412:   } else {                                     // ← ORPHANED — no-coords path
line 413:     // buffer check without coordinates
line 451:   }
```

The `} else {` on line 412 is outside the consecutive-pair guard, so `next` is undefined. Activities without lat/lng coordinates (which is most activities) **never get their buffers checked**. The page's heuristic uses a simple zero-gap check that works regardless of coordinates, which is why it correctly detects the issue while Refresh misses it entirely.

### Fix

**File: `supabase/functions/refresh-day/index.ts`** — restructure the brace nesting so the no-coordinates buffer check is inside the `if (i < sorted.length - 1)` block as the proper `else` of `if (transit)`:

1. Remove the premature `}` on line 411 that closes the consecutive-pair block too early.
2. Keep the `} else {` on line 412 as the else branch of `if (transit)`.
3. Close the `if (i < sorted.length - 1)` block after the else branch ends (after line 451).

The corrected structure:

```
if (i < sorted.length - 1) {
  // overlap check
  const transit = estimateTransit(act, next);
  if (transit) {
    // buffer check WITH transit estimates
  } else {
    // buffer check WITHOUT coordinates (time-based only)
  }
}  // closes if (i < sorted.length - 1)
```

This ensures all consecutive activity pairs get buffer-checked, whether or not they have coordinates. After the fix, activities with 0-minute gaps will correctly produce `insufficient_buffer` issues instead of "All Good."

