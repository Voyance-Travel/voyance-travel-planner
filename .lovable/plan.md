

## Fix: Transport Card Inconsistencies

Two problems: (1) inconsistent transport titles ("Travel to X" when mode is known), and (2) duration format varies wildly ("15 min", "15m", "0:25", "~15 min").

---

### Problem 1: Generic "Travel to" Titles + Wrong Destinations

**Root causes:**
- The bookend validator creates stub transport cards with `method: 'unknown'` and title `Travel to X` (line 11468)
- The transport title fixer (line 7682) only rewrites titles if a mode prefix is already present; it doesn't check `transportation.method`
- Destination mismatch: transport titles sometimes reference a location that doesn't match the next activity

**Fix — Enhance transport title normalizer in `index.ts` (~line 7690)**

When the title is generic "Travel to X", check `act.transportation?.method` and use it:
```typescript
} else if ((act.title || '').toLowerCase().startsWith('travel to')) {
  const method = (act.transportation?.method || '').toLowerCase();
  const knownModes = ['taxi','metro','walk','walking','train','bus','ferry','uber','subway','tram','rideshare','drive','driving'];
  const modeLabel = knownModes.includes(method) 
    ? method.charAt(0).toUpperCase() + method.slice(1)
    : null;
  act.title = modeLabel 
    ? `${modeLabel} to ${nextLocationName}` 
    : `Travel to ${nextLocationName}`;
  // Also fix method='unknown' when we can infer from title
}
```

Also update the bookend validator's `bTransCard` (line 11468) to avoid `method: 'unknown'` — default to `'walking'` for short gaps.

---

### Problem 2: Duration Format Inconsistency

**Root cause:** Duration strings come from three sources with no normalization:
- AI output: `"25 min"`, `"0:25"`, `"1h 30m"`
- Bookend validator: `"~15 min"`
- Transit estimates: `"15m"`

**Fix — Add `normalizeDurationString()` utility and apply in post-gen pipeline**

Add a function in `sanitization.ts`:
```typescript
export function normalizeDurationString(raw: string | undefined): string {
  if (!raw) return '';
  const cleaned = raw.replace(/^~/, '').trim();
  
  // Parse "H:MM" format (e.g., "0:25", "1:30")
  const hmMatch = cleaned.match(/^(\d+):(\d{2})$/);
  if (hmMatch) {
    const h = parseInt(hmMatch[1], 10);
    const m = parseInt(hmMatch[2], 10);
    const total = h * 60 + m;
    if (total < 60) return `${total} min`;
    if (total % 60 === 0) return `${total / 60}h`;
    return `${h}h ${m} min`;
  }
  
  // Parse existing "Xh Ym" / "X min" / "Xm" formats → re-render consistently
  let totalMins = 0;
  const hMatch = cleaned.match(/(\d+)\s*h/i);
  const mMatch = cleaned.match(/(\d+)\s*m(?:in)?/i);
  if (hMatch) totalMins += parseInt(hMatch[1], 10) * 60;
  if (mMatch) totalMins += parseInt(mMatch[1], 10);
  
  if (totalMins > 0) {
    if (totalMins < 60) return `${totalMins} min`;
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    return m === 0 ? `${h}h` : `${h}h ${m} min`;
  }
  
  return raw; // Unparseable — pass through
}
```

Apply this in the Stage 2 normalization loop (where transport cards are already being processed) to every `transportation.duration` and the activity's own `duration` field for transport cards.

Also update the bookend validator to use `'15 min'` instead of `'~15 min'`.

---

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/generate-itinerary/sanitization.ts` | Add `normalizeDurationString()` |
| `supabase/functions/generate-itinerary/index.ts` | (1) Enhance transport title normalizer to use `transportation.method` for generic "Travel to" titles. (2) Apply `normalizeDurationString()` to all transport durations in Stage 2. (3) Fix bookend validator defaults (`walking` instead of `unknown`, `15 min` instead of `~15 min`). |

