# Need to Know tab — audit and lock down

## What I found

`NeedToKnowSection` (lines 8182–8810 of `EditorialItinerary.tsx`) hydrates from two sources:

1. **`lookup-destination-insights` edge function** (Perplexity `sonar`) — fills language, timezone, water, voltage, emergency.
2. **Hardcoded static fallbacks** in `getDefaultInfo()` and `getEntryRequirements()` for UK / France / Italy / Spain / Germany, with a generic default.

Three concrete risks the user is right to worry about:

### Risk 1 — Outdated future-tense copy
The fallback text is now stale in 2026:
- `"ETIAS authorization required from 2025 for US citizens"` (lines 8502, 8529, 8556, 8583)
- `"Electronic Travel Authorisation (ETA) required from 2024 for some nationalities"` (line 8477)
- `"COVID restrictions may apply - check before travel"` (line 8488) — generation-era artifact

These render verbatim in the tab. ETIAS hasn't actually launched (it's been pushed to late 2026 / 2027); ETA is now live for most. Either way, "from 2025" reads as a bug.

### Risk 2 — Placeholder leak from partial AI responses
When `aiInsights` loads but the model returns an incomplete object, the merge in `getDefaultInfo()` (lines 8239–8255) silently substitutes generic placeholders that look like UI bugs:
- `aiInsights.language?.primary || 'Local language'`
- `aiInsights.timezone?.zone || 'Local time'`
- `aiInsights.emergency?.number || 'Contact local authorities'`
- `aiInsights.water?.description || 'Check local advisories'`

If even one field is missing, the user sees "Local language" / "Local time" — which is exactly the placeholder-copy regression flagged. The tab does NOT fall back to the country-specific static block when `aiInsights` is partially populated; it short-circuits at `if (aiInsights)` and uses placeholders for the missing fields.

### Risk 3 — No test coverage
There is no test for `NeedToKnowSection`, no test for the merge logic, no test for the entry-requirements switch. If a future regen mangles `aiInsights.language.phrases`, the `.map(...)` (line 8242) throws.

## Plan

### 1. Refresh stale future-tense copy

Edit the static fallbacks in `getEntryRequirements()`:
- Replace `"ETIAS authorization required from 2025 for US citizens"` with `"ETIAS pre-travel authorisation will be required once it launches — check the official EU travel site before booking"`.
- Replace `"Electronic Travel Authorisation (ETA) required from 2024 for some nationalities"` with `"UK ETA is now required for most non-EU/non-Irish visitors — apply online before travel"`.
- Drop the `"COVID restrictions may apply - check before travel"` bullet (line 8488). It's a generation-era artifact; if anything, replace with `"Check current health advisories with your country's foreign-travel office"`.

### 2. Make AI/static merge safer

Extract a pure helper:

```ts
// src/components/itinerary/needToKnow.ts
export function mergeNeedToKnowInfo(
  aiInsights: AiInsights | null,
  fallback: StaticInfo,           // country-specific block from getDefaultInfo
): StaticInfo
```

Rule: for **each field** (`language`, `timezone`, `water`, `voltage`, `emergency`), use the AI value only when it's a non-empty string AND the matching `tips` array has at least one non-empty entry. Otherwise fall back to the country-specific static block — never the bare `'Local language'` / `'Local time'` literal. This kills Risk 2.

Wire `getDefaultInfo()` to call `mergeNeedToKnowInfo(aiInsights, countryFallback)` instead of the current `if (aiInsights) return ai-only` branch.

### 3. Defensive parsing for AI tips arrays

`languageTips` builds a string from `aiInsights.language.phrases.map(p => "${p.phrase}" = "${p.translation}" (${p.pronunciation}))`. If `phrases` is `null`, `undefined`, or contains an entry missing one of the three subkeys, the result is either a thrown error or `undefined = undefined (undefined)` rendered to the user.

Harden it: filter out entries lacking `phrase`/`translation`, default `pronunciation` to empty (and drop the parens when missing), and fall through to the static block if zero valid entries remain.

### 4. Tests

`src/components/itinerary/__tests__/needToKnow.test.ts`:
- AI insights null → returns fallback unchanged.
- AI insights complete → AI fields win.
- AI insights with empty `language.primary` → falls back to country-specific language (NOT `'Local language'`).
- AI insights with empty `language.phrases` array → uses fallback `languageTips` instead of `[]`.
- Malformed phrase entry (`{phrase: 'Hi'}` no translation) → filtered out; if all filtered, fallback wins.
- AI insights with present `voltage.voltage` but missing `plugType` → renders `"230V"` (no trailing comma+undefined).

### 5. Document in memory

Add a small memory entry: *Need to Know merge contract* — partial AI responses must fall back per-field, never substitute generic "Local language"/"Local time" placeholders.

## Out of scope

- Rewriting the country list / adding new countries.
- Validating the Perplexity edge function output server-side (could be a future hardening pass).
- Changing the visual UI of the cards.

## Files

- `src/components/itinerary/needToKnow.ts` (new)
- `src/components/itinerary/__tests__/needToKnow.test.ts` (new)
- `src/components/itinerary/EditorialItinerary.tsx` (use helper, refresh ETIAS/ETA/COVID copy)
- `mem://technical/itinerary/need-to-know-merge` (new)
