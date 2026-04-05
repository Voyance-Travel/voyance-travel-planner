

## Trip #10 Audit Fix Plan — 5 Issues

### Root Cause Assessment

The edge function logs are **completely empty**, strongly suggesting the `generate-itinerary` function was not redeployed after the latest code changes (Prompts 28-29). Many fixes (midnight stripper, Tier 1 free venue in `generation-core.ts`, orphaned article patterns) are already in the code but were not active when trip #10 was generated.

### Issue Breakdown & Actions

**1. Garbled Text — "Arrival in the of Seven Hills" + "views of the illuminated."**

Already fixed in code:
- Line 188: `"in the of"` → `"in Lisbon, the City of"` ✅
- Line 197: `"the illuminated."` → dangling adjective catch ✅

**No code change needed** — just needs redeployment.

**2. Midnight Entry Cascade (Day 1: 12:05 AM, 1:05 AM)**

Already fixed in code at lines 413-446 of `sanitization.ts` — the sequential pre-dawn hotel entry stripper checks `startTime`, `start_time`, and `time` fields.

**No code change needed** — just needs redeployment.

**3. Phantom Pricing (Praça do Comércio ~€23, Miradouro ~€23)**

Already fixed in code:
- `generation-core.ts` line 3093-3113: Tier 1 free venue check before `cost_reference` lookup ✅
- `action-repair-costs.ts` line 118-131: Tier 1 free venue check preventing un-zeroing ✅

**No code change needed** — just needs redeployment.

**4. Empty System Note Container (Fábrica da Nata)**

Already fixed in code — `EditorialItinerary.tsx` uses `sanitizeActivityText()` guards on descriptions (lines 10235, 10379, 10731) and tips (lines 10250, 10403, 10774).

However, there may be a **remaining gap**: the `venueNameForDining` MapPin at line 10682 and the location section at line 10739 don't sanitize through `sanitizeActivityText`. If the "empty container" is actually a location/address field showing an empty pin, we need to add `.trim()` guards there too.

**Action**: Add defensive `.trim().length > 0` checks on `locName` (line 10741) and `address` (line 10656) to ensure empty strings after trimming don't render containers. Also check that `hasAddress` properly rejects whitespace-only strings (line 10657 already does `?.trim()` — looks OK).

**5. Restaurant Repetition (Fábrica da Nata on Days 2 & 3)**

This is a generation-time issue with the cross-day blocklist. The blocklist serialization and propagation through self-chaining calls should prevent this, but may have a gap. This is a separate investigation — not addressed in this prompt cycle.

### Plan

**Step 1: Redeploy `generate-itinerary` edge function**
This single action activates ALL the dormant fixes for issues 1-3.

**Step 2: Minor UI hardening for empty containers**
In `EditorialItinerary.tsx`, add a guard on the location section fallback to ensure empty `locationFallback` strings don't render the container. The current code at line 10746 (`showLocation = effectiveLocName || hasAddress || locationFallback`) could show a container if `locationFallback` is a non-empty whitespace string.

### Files to edit
- `src/components/itinerary/EditorialItinerary.tsx` — minor guard hardening (1-2 lines)

### Verification
After redeployment, generate a new Lisbon trip to confirm:
- Day titles are clean (no "in the of")
- Day 1 starts at 8-9 AM (no midnight entries)
- Praça/Miradouro show $0
- No empty pin icon containers

