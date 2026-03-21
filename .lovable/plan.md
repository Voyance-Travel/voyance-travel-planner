

## Fix: "11:00 AM" Parsed as "1:00 AM" in Import Modal

### Analysis

Extensive code review shows the regex (`TIME_PATTERN`) and `normalizeTimeTo24h` logic are correct in isolation for clean input. The persistent bug is almost certainly caused by **invisible characters in pasted text** (zero-width spaces, non-breaking spaces, soft hyphens, etc. from Google Docs, Notes apps, or other rich-text sources). These invisible chars split `"11"` into `"1[invisible]1"`, so the regex only matches the second `"1:00 AM"`.

The backend `parse-trip-input` already has a raw-text cross-check for exactly this problem. The client-side import modal lacks it.

### Fix

**File: `src/components/itinerary/ImportActivitiesModal.tsx`**

#### 1. Sanitize invisible characters from pasted text before parsing

Add a sanitization step in `cleanMarkdown` (or before the time extraction) that strips common invisible Unicode characters:

```typescript
function sanitizeInvisibleChars(text: string): string {
  // Strip zero-width spaces, soft hyphens, zero-width joiners/non-joiners,
  // word joiners, BOM, and other invisible formatting chars
  return text.replace(/[\u200B\u200C\u200D\u00AD\u2060\uFEFF\u200E\u200F\u2028\u2029\u202A-\u202E]/g, '');
}
```

Apply this in `cleanMarkdown` as the first step, before any other replacements.

#### 2. Add raw-text cross-check after time extraction (defensive)

After extracting `startTime` via the regex + `normalizeTime`, cross-check against the original raw line. If the raw line contains a two-digit hour like `"11:00"` but the extracted time only has `"01:00"`, correct it:

```typescript
// After line 261: startTime = normalizeTime(times[0]);
if (startTime) {
  const twoDigitMatch = raw.match(/\b(1[0-2]):(\d{2})\s*(am|pm)/i);
  if (twoDigitMatch) {
    const crossCheck = normalizeTime(twoDigitMatch[0]);
    if (crossCheck && crossCheck !== startTime) {
      startTime = crossCheck;
    }
  }
}
```

### Scope
Single file: `src/components/itinerary/ImportActivitiesModal.tsx` — ~15 lines added (sanitizer function + cross-check). No backend changes.

