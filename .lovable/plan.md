

## Fix: "Refresh Day" Misses Buffer Warnings for Activities Without Coordinates

### Root Cause

The edge function `refresh-day` only checks buffer gaps **inside** the `if (transit)` block (line 363). `estimateTransit()` returns `null` when either activity lacks `lat`/`lng` coordinates (line 155). This means **zero-gap pairs without coordinates are never flagged** — the function reports "no issues" while the client-side banner (which uses time-only `computeGapMinutes`) correctly counts 11 zero-buffer activities.

### Fix — 1 file: `supabase/functions/refresh-day/index.ts`

**Add a coordinate-independent buffer check** as a fallback when `estimateTransit` returns null. After line 410 (end of the `if (transit)` block), add an `else` branch:

```typescript
} else {
  // No coordinates — still check time-based buffer
  const effectiveEnd = patchedTimes.get(act.id)?.end ?? endMin;
  const effectiveNextStart = patchedTimes.get(next.id)?.start ?? parseTime(next.startTime);
  if (effectiveEnd !== null && effectiveNextStart !== null) {
    const gap = effectiveNextStart - effectiveEnd;
    const minBuffer = getMinBufferMinutes(act.category, next.category);
    if (gap < minBuffer && gap >= 0 && minBuffer > 0) {
      issues.push({
        type: 'insufficient_buffer',
        activityId: next.id,
        activityTitle: next.title,
        severity: 'warning',
        message: `Only ${gap} min between "${act.title}" and "${next.title}" (${minBuffer} min buffer recommended).`,
        suggestion: `Delay "${next.title}" to ${minutesToTime(effectiveEnd + minBuffer)}.`,
      });
      if (!changedIds.has(next.id)) {
        // Propose shifting next activity
        const origNextStart = parseTime(next.startTime);
        const nextDuration = next.durationMinutes || ...;
        const bufferedStart = effectiveEnd + minBuffer;
        const bufferedEnd = bufferedStart + nextDuration;
        proposedChanges.push({ type: 'buffer_added', patch: { startTime, endTime }, ... });
        changedIds.add(next.id);
        patchedTimes.set(next.id, { start: bufferedStart, end: bufferedEnd });
      }
    }
  }
}
```

This mirrors the existing buffer logic (lines 368-410) but without requiring transit distance data. The `getMinBufferMinutes` function already handles category-based exemptions (transport, accommodation).

### Result

After this fix, "Refresh Day" will correctly report insufficient buffer issues for all activity pairs regardless of whether they have coordinates, and will propose time shifts to fix them — matching what the client-side banner detects.

