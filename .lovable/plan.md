## Fix: Fallback city parser treating descriptive phrases as city names

### Problem

The `resolveCities` fallback parser in `src/utils/cityNormalization.ts` splits `details.destination` on weak separators (commas, "and", etc.) and treats each part as a city name. When the destination field contains descriptive text like "Girls' trip focused on partying, letting loose", it produces two fake "cities": "Girls' trip focused on partying" and "letting loose", complete with a flight selector between them.

### Root cause

The weak separator fallback (lines 165-183) has no validation that the resulting candidates actually resemble place names. Long descriptive phrases and common English words pass through `cleanCandidate` and `isRegionNotCity` unchecked. 

### Fix — add a `looksLikeCityName` guard

In `src/utils/cityNormalization.ts`, add a validation function that rejects candidates that are clearly not city names:..... We have a table with all the cities populated...... we should use that

&nbsp;

1. **Too many words** — real city names rarely exceed 4-5 words. Reject candidates with 6+ words.
2. **Contains common non-place verbs/descriptors** — words like "focused", "letting", "partying", "trip", "vacation", "exploring", "relaxed", "adventure" strongly indicate descriptive text, not a place name.
3. **All lowercase with no proper noun signals** — city names are typically capitalized. A fully lowercase multi-word string with no recognizable place pattern is suspect.

Apply this guard to all fallback-parsed candidates (weak separator path, lines 165-183 and notes path, lines 187-198). The authoritative AI `cities[]` path (step 1) is left unchanged since the AI explicitly structured those.

### Implementation

`**src/utils/cityNormalization.ts**`

- Add a `looksLikeCityName(candidate: string): boolean` function that returns `false` if:
  - Candidate has 6+ words
  - Candidate contains descriptive keywords: `trip`, `focused`, `partying`, `letting`, `vacation`, `adventure`, `exploring`, `relaxing`, `style`, `vibe`, `itinerary`, `plan`, `budget`, `experience`, `holiday`, `getaway`, `weekend`, `loose`, `energy`, `downtime`, `recovery`
- Apply this filter alongside the existing `isRegionNotCity` check in the fallback candidate filtering (lines 160, 169-170, 193)

This is a single-file, ~15-line change.