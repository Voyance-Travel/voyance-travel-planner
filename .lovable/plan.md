

## Phase 4: Clean Up `index.ts` — Remove Dead Imports & Duplicates

### Problem
After extracting all action handlers, `index.ts` still has ~340 lines of imports (lines 23–460) for types and functions it no longer uses directly. These are only needed by the extracted action files, which import them independently. There are also duplicate definitions (`corsHeaders`, `verifyTripAccess`) that already live in `action-types.ts`.

### Changes

**1. Remove unused imports from `index.ts` (lines 23–460)**
- Delete all `import type { ... } from './generation-types.ts'` (lines 23–40) — unused in router
- Delete all `import { ... } from './generation-utils.ts'` (lines 45–56) — unused
- Delete all `import { ... } from './venue-enrichment.ts'` (lines 61–73) — unused
- Delete all `import { ... } from './sanitization.ts'` (lines 78–86) — unused
- Delete all `import { ... } from './currency-utils.ts'` (lines 88–94) — unused
- Delete all `import { ... } from './budget-constraints.ts'` (lines 96–107) — unused
- Delete all `import { ... } from './personalization-enforcer.ts'` (lines 112–126) — unused
- Delete all `import { ... } from './truth-anchors.ts'` (lines 128–139) — unused
- Delete all `import { ... } from './explainability.ts'` (lines 141–147) — unused
- Delete all `import { ... } from './geographic-coherence.ts'` (lines 153–170) — unused
- Delete all `import { ... } from './prompt-library.ts'` (lines 175–188) — unused
- Delete all `import { ... } from './meal-policy.ts'` (lines 193–199) — unused
- Delete all `import { ... } from './dietary-rules.ts'` (lines 204–210) — unused
- Delete all `import { ... } from './trip-duration-rules.ts'` (lines 216–221) — unused
- Delete all `import { ... } from './reservation-urgency.ts'` (lines 223–225) — unused
- Delete all `import { ... } from './jet-lag-calculator.ts'` (lines 230–234) — unused
- Delete all `import { ... } from './weather-backup.ts'` (lines 236–239) — unused
- Delete all `import { ... } from './daily-estimates.ts'` (lines 241–243) — unused
- Delete all `import { ... } from './group-archetype-blending.ts'` (lines 249–252) — unused
- Delete all `import { ... } from './pre-booked-commitments.ts'` (lines 254–257) — unused
- Delete all `import { ... } from './must-do-priorities.ts'` (lines 259–268) — unused
- Delete all `import { ... } from './packing-suggestions.ts'` (lines 270–272) — unused
- Delete all `import { ... } from './archetype-data.ts'` (lines 278–309) — unused
- Delete all `import { ... } from './trip-type-modifiers.ts'` (lines 314–318) — unused
- Delete all `import { ... } from './profile-loader.ts'` (lines 323–328) — unused
- Delete all `import { ... } from './destination-essentials.ts'` (lines 334–339) — unused
- Delete all `import { ... } from './user-context-normalization.ts'` (lines 371–380) — unused
- Delete all `import { ... } from './flight-hotel-context.ts'` (lines 421–432) — unused
- Delete all `import { ... } from './preference-context.ts'` (lines 434–447) — unused

**2. Remove duplicate `corsHeaders` definition (lines 341–346)**
- Import from `action-types.ts` instead (already defined there)

**3. Remove duplicate `verifyTripAccess` (lines 508–565)**
- Already in `action-types.ts` — import from there

**4. Remove stale placeholder comments** (lines 348–470)
- Comments like "// moved to X" no longer serve a purpose

### Result

| Metric | Before | After |
|---|---|---|
| `index.ts` lines | 743 | ~280 |
| Unused imports removed | ~340 lines | 0 |
| Duplicate functions removed | 2 (`corsHeaders`, `verifyTripAccess`) | 0 |

`index.ts` becomes a clean, minimal router: imports for action handlers, auth, rate limiting, and dispatch.

### Risk
- Zero logic changes — only removing dead code and deduplicating
- Smoke tests verify nothing breaks

