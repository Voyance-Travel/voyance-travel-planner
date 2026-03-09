

## Fix: Enable Preference Enforcement — Stop Ignoring User Requests

### Problem
The system detects preference violations (dietary, activity requests, budget) but never triggers retries — all checks use `console.warn()` instead of pushing to `validation.errors`. Stage 2.6 rejection is commented out.

### Changes (1 file: `supabase/functions/generate-itinerary/index.ts`)

#### Fix 1: Move validation blocks & upgrade to retry triggers (lines 6059-6120)

Move the MINIMUM REAL ACTIVITY COUNT block (lines 6059-6076) and USER PREFERENCE VALIDATION block (lines 6078-6118) to **after** `const validation = validateGeneratedDay(...)` on line 6120. This lets them push errors into `validation.errors` to trigger the existing retry loop.

Upgrade each check:
- **Minimum activities**: `console.warn` → `validation.errors.push(...)` + `validation.isValid = false`
- **Activity keywords** (skiing, surfing, etc.): Same upgrade, skip departure day (`!isLastDay`)
- **Light dining** ($50+ check): Same upgrade, expand keywords to include `'simple dinner'`, `'quick bite'`
- **New: Budget check**: If user notes contain `'budget'`/`'cheap'`/`'affordable'`, flag activities over $75

#### Fix 2: Enable Stage 2.6 personalization rejection (lines 9222-9227)

Replace the commented-out TODO block with active enforcement:
- Filter for `critical` severity violations and `major` dietary violations
- Log each violation with details
- For dietary violations: patch the offending activity's description with a `⚠️` dietary warning note rather than full regeneration
- Log warning when `personalizationScore < 40`

#### Fix 3: Update plan.md

Document the preference enforcement activation.

### How the retry works (existing infrastructure)
The retry loop (lines ~4980-4999) already sends `validation.errors` back to the AI with a "fix this" prompt. These changes simply feed it the preference violations it was previously missing.

### Risk Mitigation
- Activity keyword checks skip departure days to avoid false positives
- Budget threshold is $75+ (generous) to avoid over-triggering
- Stage 2.6 patches activities with warnings instead of rejecting entire itineraries
- Max 3 retry attempts already enforced by existing loop

