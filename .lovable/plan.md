

## Fix: Leading "1" Stripped from Two-Digit Hours (10, 11, 12)

### Root cause

**Line 165** in `cleanMarkdown()`:
```
.replace(/^[\p{Emoji}\s]{1,4}(?=\w)/u, '')
```

In JavaScript's Unicode spec, **ASCII digits (0-9) match `\p{Emoji}`** because they're emoji components (keycap sequences). This regex is meant to strip leading emoji like "🍣 Sushi dinner" but it also matches digits.

For input `"10:00 AM - Tsukiji Fish Market"`:
1. `\p{Emoji}` matches `"1"` at position 0
2. It tries to greedily match more — `"0"` also matches, but then `":"` doesn't, so it backtracks to just `"1"`
3. Lookahead `(?=\w)` checks next char `"0"` — passes (`\w` includes digits)
4. Strips `"1"` → `"0:00 AM - Tsukiji Fish Market"`
5. `normalizeTimeTo24h("0:00 AM")` → `"00:00"` → displayed as **12:00 AM**

This explains every broken case:
- `10:00 AM` → strips "1" → `0:00 AM` → **12:00 AM** ❌
- `11:00 AM` → strips "1" → `1:00 AM` → **1:00 AM** ❌
- `12:00 PM` → strips "1" → `2:00 PM` → **2:00 PM** ❌
- `9:00 AM` → "9" matches emoji but lookahead on ":" fails → no strip → **9:00 AM** ✅
- `1:00 PM` → "1" matches but lookahead on ":" fails → no strip → **1:00 PM** ✅

### Fix

**File: `src/components/itinerary/ImportActivitiesModal.tsx` (line 165)**

Replace `\p{Emoji}` with a pattern that excludes ASCII digits:

```typescript
.replace(/^[\p{Emoji_Presentation}\p{Extended_Pictographic}\s]{1,4}(?=\w)/u, '')
```

`\p{Emoji_Presentation}` and `\p{Extended_Pictographic}` match actual visual emoji (🍣, 🏯, ✈️) but **not** ASCII digits. This preserves the intended emoji-stripping behavior while leaving time strings intact.

### Scope
One regex change on one line. No other files affected.

