

# Honest Assessment: What's Still Uncovered

## What We've Done So Far

1. **Extracted 6 small action handlers** from the monolith (get-trip, save-itinerary, get-itinerary, toggle-lock, sync-tables, repair-costs) — ~950 lines out of 11,418
2. **Added 16 smoke tests** for `generate-itinerary` actions
3. **Added stall detection** in `useGenerationPoller`
4. **Created generation canary** edge function
5. **Created `critical-paths.spec.ts`** for public routes + edge function availability

## What's Still Exposed

### The Monolith Is Still 11,418 Lines
The four core action blocks are **still inline** — these are the ones that actually break:

| Action | Lines | Risk |
|--------|-------|------|
| `generate-full` | ~2,300 (4407-6735) | Stage pipeline, context prep, multi-city mapping |
| `generate-day` / `regenerate-day` | ~3,600 (6738-10317) | The exact code path where `context is not defined` crashed |
| `generate-trip` | ~470 (10358-10830) | Chain orchestrator, self-invocation |
| `generate-trip-day` | ~580 (10837-11392) | Per-day chain handler, multi-city resolution |

Plus ~4,200 lines of shared helper functions (prepareContext, validateAuth, verifyTripAccess, etc.) that live between the action blocks. **This is where the scoping bugs hide.**

### Critical Edge Functions With Zero Tests
These functions are on the critical user path and have no smoke tests:

| Function | Lines | What It Does | Risk If It Breaks |
|----------|-------|----|----|
| `spend-credits` | 708 | FIFO credit deduction | Users can't generate trips |
| `get-entitlements` | ~200 | Credit balance + tier check | App shows wrong credits, blocks paid users |
| `stripe-webhook` | 799 | Payment processing + credit fulfillment | Users pay but don't get credits |
| `destination-images` | 1,579 | Image pipeline (Google/TripAdvisor/AI) | Blank images across all trips |
| `chat-trip-planner` | 470 | Onboarding chat for trip creation | Can't create trips via chat |
| `flights` | 502 | Flight search | Flight search broken |
| `parse-travel-story` | ~200 | Travel DNA quiz analysis | Quiz results don't save |
| `calculate-travel-dna` | ~300 | DNA profile computation | Personalization breaks |

### E2E Tests Are Shallow
The existing E2E tests (`auth.spec.ts`, `quiz.spec.ts`, `trip-planning.spec.ts`, etc.) only check page loads and form visibility. None of them:
- Complete a real trip creation flow
- Verify generation actually starts
- Test credit spending works
- Test the collaboration invite acceptance flow
- Test multi-city trip creation

### No Monitoring for 100+ Other Edge Functions
You have **~120 edge functions**. Only `generate-itinerary` has smoke tests. Functions like `refresh-day`, `optimize-itinerary`, `itinerary-chat`, `get-activity-alternatives`, `suggest-hotel-swaps` could crash silently.

## The Plan: Close the Gaps

### Phase 1: Extract the 4 remaining monolith actions (highest priority)
Split the core action blocks out of `index.ts` into:
- `action-generate-full.ts` — the 7-stage pipeline
- `action-generate-day.ts` — single day generation (the one that broke)
- `action-generate-trip.ts` — chain orchestrator
- `action-generate-trip-day.ts` — per-day chain handler

Also extract the ~4,200 lines of shared helpers into:
- `helpers/prepare-context.ts`
- `helpers/validate-auth.ts`
- `helpers/generate-single-day.ts` (the retry wrapper)
- `helpers/prompt-builder.ts` (the massive prompt construction)

The `index.ts` shrinks to a ~200-line router that imports everything.

### Phase 2: Smoke tests for critical non-generation edge functions
Add `index.test.ts` for:
- `spend-credits` — POST with fake auth, verify not 500
- `get-entitlements` — POST with fake auth, verify not 500
- `destination-images` — POST with minimal body, verify not 500
- `chat-trip-planner` — POST with minimal conversation, verify not 500
- `parse-travel-story` — POST with minimal story, verify not 500
- `calculate-travel-dna` — POST with minimal data, verify not 500

### Phase 3: Deepen E2E tests for real user flows
Add authenticated E2E scenarios to `critical-paths.spec.ts`:
- Complete chat-based trip creation (send messages, extract tripId)
- Verify credit check before generation
- Verify collaboration invite accept flow end-to-end

### Implementation Priority
1. **Phase 1** — extract monolith actions (prevents future scoping bugs)
2. **Phase 2** — smoke tests for critical functions (catches crashes)
3. **Phase 3** — deeper E2E tests (catches flow breaks)

### Files to Create/Modify
| File | Action |
|------|--------|
| `supabase/functions/generate-itinerary/action-generate-full.ts` | Create — extract generate-full |
| `supabase/functions/generate-itinerary/action-generate-day.ts` | Create — extract generate-day/regenerate-day |
| `supabase/functions/generate-itinerary/action-generate-trip.ts` | Create — extract generate-trip |
| `supabase/functions/generate-itinerary/action-generate-trip-day.ts` | Create — extract generate-trip-day |
| `supabase/functions/generate-itinerary/helpers/prepare-context.ts` | Create — extract shared helpers |
| `supabase/functions/generate-itinerary/index.ts` | Rewrite — thin router only |
| `supabase/functions/spend-credits/index.test.ts` | Create — smoke tests |
| `supabase/functions/get-entitlements/index.test.ts` | Create — smoke tests |
| `supabase/functions/destination-images/index.test.ts` | Create — smoke tests |
| `supabase/functions/chat-trip-planner/index.test.ts` | Create — smoke tests |
| `e2e/critical-paths.spec.ts` | Update — add authenticated flow tests |

