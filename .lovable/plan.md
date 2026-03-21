

## Fix: Apostrophe-Truncated Brewery Name ("Brouwerij 't IJ")

### Root Cause

Line 84 in `activityNameSanitizer.ts` uses **substring** matching to detect trailing duplicate words:

```typescript
if (withoutLast.toLowerCase().includes(lastWord.toLowerCase())) {
  sanitized = withoutLast;
}
```

For `"Brouwerij 't IJ"`:
- `lastWord` = `"IJ"`
- `withoutLast` = `"Brouwerij 't"`
- `"brouwerij 't".includes("ij")` → **true** (substring match inside "Brouwer**ij**")
- Result: `"IJ"` is incorrectly stripped → `"Brouwerij 't"`

### Fix

**File: `src/utils/activityNameSanitizer.ts` (line 84)**

Change from substring matching to **whole-word** matching. Replace:
```typescript
if (withoutLast.toLowerCase().includes(lastWord.toLowerCase())) {
```
With:
```typescript
const precedingWords = withoutLast.toLowerCase().split(/\s+/);
if (precedingWords.includes(lastWord.toLowerCase())) {
```

This ensures "IJ" is only stripped if "ij" appears as a standalone word in the preceding text, not as a substring within "Brouwerij".

### Scope
1 file, 2 lines changed.

