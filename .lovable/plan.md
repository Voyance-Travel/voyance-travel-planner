## Fix: Journey Leg Handoff + Pricing Consistency ✅ COMPLETE

### Root causes fixed:
1. **Backend handoff** (`triggerNextJourneyLeg`): Was sending `{ tripId }` only — rejected by service-role allowlist (missing `generate-trip`). Now fetches full trip fields and sends `action: 'generate-trip'` with complete payload. Allowlist expanded.
2. **Frontend fallback** (`TripDetail.tsx`): Same `{ tripId }` problem. Now sends full `generate-trip` payload. No longer pre-sets `itinerary_status='generating'` before invoke succeeds.
3. **Stuck-leg self-heal**: On TripDetail load, detects journey legs stuck in `generating` with no heartbeat/progress and auto-retriggers with full payload.
4. **Pricing mismatch** (`useGenerationGate`): Was summing per-leg single-city estimates (missing multi-city fee). Now uses canonical `calculateTripCredits({ days: totalJourneyDays, cities: allCities })`.
5. **Cost dialog timing** (`ItineraryGenerator`): Journey legs now pre-fetched in `handleGenerateClick` before showing confirmation, not after confirm.

---

## Journey Sequential Generation — Implementation Status

### Part 1: Unified Cost Confirmation + Queue All Legs ✅ COMPLETE

**Implemented:**

1. **`src/hooks/useGenerationGate.ts`**:
   - Added `journeyId` and `journeyTotalLegs` to `GenerationGateParams` interface
   - Added journey detection: fetches all sibling legs when `journeyId` is present
   - Sums credit costs across all journey legs for unified billing
   - Uses `totalJourneyCost` instead of single-leg cost when in journey mode
   - After successful credit spend, queues sibling legs with `itinerary_status: 'queued'`

2. **`src/components/itinerary/ItineraryGenerator.tsx`**:
   - Added `journeyLegs` state for cost breakdown display
   - In `handleGenerate()`: fetches journey info if this is leg 1, populates `journeyLegs` array
   - Passes `journeyId` and `journeyTotalLegs` to the generation gate
   - Updated cost confirmation dialog:
     - Shows "Journey Cost Breakdown" header for journeys
     - Lists each leg with city, days, and cost
     - Shows "Journey Total" instead of "Total"
     - Uses `effectiveTotalCost` (journey sum or single-trip cost) for affordability checks
     - Disabled partial generation for journeys (must pay full upfront)
     - "Confirm & Generate Journey" button text for journeys

### Part 2: Auto-Chain Generation (TODO)

When leg 1 completes generation, the backend should:
1. Check for next queued leg in the journey
2. Automatically trigger `generate-trip` for the next leg
3. Continue until all legs are generated

Files to modify:
- `supabase/functions/generate-trip/index.ts` or similar edge function
- Add post-generation hook to detect and chain to next journey leg

### Part 3: Queued State UI for Waiting Legs ✅ COMPLETE

**Implemented:**

1. **`src/pages/TripDetail.tsx`**:
   - Added `isQueuedJourneyLeg` flag to distinguish queued journey legs from active generation
   - Updated `isServerGenerating` to exclude queued journey legs (they're not actively generating)
   - Added polling effect: checks every 5s if queued leg's status changes, auto-transitions to generator when backend starts
   - Added distinct "queued" state UI:
     - Clock icon with hourglass badge
     - "{destination} is up next" heading
     - Explanation text about waiting for previous leg
     - "View previous city" button to navigate back to the generating leg
   - Added `Clock` to lucide-react imports

---

## Preference Enforcement Activation ✅ COMPLETE

### Fix 1: Per-day preference checks now trigger retries ✅
Moved MINIMUM REAL ACTIVITY COUNT and USER PREFERENCE VALIDATION blocks to after `validateGeneratedDay()` so they can push errors into `validation.errors`. Upgraded all `console.warn` calls to `validation.errors.push` + `validation.isValid = false`. Added budget preference validation ($75+ threshold). Activity keyword checks skip departure days.

### Fix 2: Stage 2.6 personalization rejection enabled ✅
Uncommented and enhanced the rejection block. Critical and major dietary violations are now actively enforced — dietary violations get patched with ⚠️ warnings in activity descriptions. Low personalization scores (<40) are logged.

---

## Itinerary Generation Quality Fixes ✅ COMPLETE

### Bug 1: Arrival Sequence Inverted ✅
Post-generation validator in `index.ts` detects when hotel check-in is ordered before airport arrival on Day 1. Extracts arrival/transfer/checkin activities, recalculates times based on flight arrival, and re-inserts in correct order.

### Bug 2: User Preferences Ignored ✅
- Strengthened preference injection in system prompt with explicit enforcement language (🚨 MUST BE HONORED)
- Added post-generation validation logging that checks activities against keyword map for requested activities (skiing, surfing, etc.)
- Warns when "light dinner" preference is violated by expensive dining ($50+)

### Bug 3: Empty Days ✅
Added minimum real activity count validation after generation. Filters out logistics (transport, accommodation, downtime) and warns when a day has fewer than 2 real activities (1 for departure day).

### Bug 4: Nonsensical Inter-City Flights ✅
Added `SAME_METRO_PAIRS` lookup in `buildTransitionDayPrompt` (prompt-library.ts). When origin and destination are in the same metro area (e.g., East Rutherford ↔ NYC), flights are suppressed from transport options and the prompt explicitly forbids them. Default mode switches to `rideshare`.

---

## Fix: Case-Sensitive Token Lookup ✅ COMPLETE

**Root cause:** `generate_share_token()` used base64 encoding producing mixed-case tokens. Mobile apps (iMessage, WhatsApp) can lowercase URLs, breaking the case-sensitive PostgreSQL lookup.

### Changes (single migration):
1. **`generate_share_token(integer)`** — switched from base64 to hex encoding (lowercase-only: a-f, 0-9)
2. **Case-insensitive index** — `idx_trip_invites_token_lower` on `LOWER(token)`
3. **Backfill** — all existing tokens lowercased
4. **`get_trip_invite_info()`** — `WHERE LOWER(token) = LOWER(p_token)` + failure logging + `replaced_at` check
5. **`accept_trip_invite()`** — `WHERE LOWER(token) = LOWER(p_token) FOR UPDATE`
6. **`replaced_at` column** — added to `trip_invites` for soft-delete support

---

## Fix: User Requirements Ignored in Just Tell Us Pipeline ✅ COMPLETE

### Layer 1: `findBestDay` respects `preferredDay` on Day 1/last day ✅
- Modified skip guard in `must-do-priorities.ts` L472 to allow long activities on Day 1/last day when user explicitly requested that day via `preferredDay`.

### Layer 2: `parseMustDoInput` resolves day-of-week and multi-day references ✅
- Added `tripStartDate` and `totalDays` parameters to function signature
- Day-of-week resolution: maps "Friday", "Saturday" etc. to trip day numbers using start date
- Multi-day expansion: "both days" / "every day" / "all N days" duplicated into per-day entries
- Updated all 5 callers in `index.ts` to pass `startDate` and `totalDays`

### Layer 3: Chat AI prompt strengthened for temporal mapping ✅
- Added CRITICAL TEMPORAL MAPPING RULES to system prompt in `chat-trip-planner/index.ts`
- Updated `mustDoActivities` field description to instruct AI to expand multi-day refs into per-day entries with explicit day numbers

### Layer 4: Day 1 arrival uses actual airport name ✅
- Added `arrivalAirport` to `FlightHotelContextResult` interface and return value
- Stage 2.55 split block uses `flightHotelResult.arrivalAirport` instead of hardcoded `'Airport'`
- All 3 Day 1 constraint templates (morning/afternoon/evening) use `arrivalAirportDisplay`

---

## Fix 12: Blocked Time Window Truncation ✅ COMPLETE

**Root cause:** Chat planner outputs `time_block` constraints with start time but no `endTime`. `Start.tsx` defaults missing durations to 120 minutes, producing `09:00→11:00` instead of `09:00→17:00` for "US Open 9am to 5pm". The generator sees the short window and skips the event card.

### Layer 1: Self-correction in generation engine ✅
- `budget-constraints.ts` `formatGenerationRules`: parses `reason` text for explicit time ranges (e.g. "9am to 5pm") using regex
- If parsed end time is later than stored `to` value, overrides it
- Fixes ALL existing trips with truncated blocked windows

### Layer 2: Chat planner schema extended ✅
- Added `endTime` and `duration` fields to `userConstraints` schema in `chat-trip-planner/index.ts`
- AI can now output structured time ranges (time="9:00 AM", endTime="5:00 PM")

### Layer 3: Start.tsx time_block handler fixed ✅
- Priority 1: Use explicit `endTime` from chat planner
- Priority 2: Parse time range from constraint `description` text via regex
- Priority 3: Fall back to duration math (existing behavior)
- Eliminates the 120-minute default for events with known end times

---

## Fix 16: Replace Lovable Favicon with Voyance Favicon ✅ COMPLETE

- Deleted `public/favicon.ico` (Lovable heart logo)
- Updated `index.html` favicon links with `?v=3` cache-buster, explicit sizes, and `image/x-icon` override pointing to PNG
- Post-deploy: request Google re-crawl via Search Console

---

## Fix 17: Community Guides Redesign — Phase 1 ✅ COMPLETE

### Database Changes
- Added `user_experience`, `user_rating`, `recommended`, `photos` columns to `guide_sections`
- Added `moderation_status` column to `community_guides`
- Created `guide_activity_reviews` table with indexes and RLS
- Created `guide-photos` storage bucket with public read + authenticated upload/delete RLS

### New Components
- **`StarRating.tsx`** — 1-5 star rating with hover/click states
- **`PhotoUploadGrid.tsx`** — Upload up to 4 photos per activity to Supabase Storage, with thumbnail grid and remove
- **`EditableActivityCard.tsx`** — Rich editable card with experience textarea (2000 chars), star rating, photo uploads, recommend toggle (Yes/No/It's okay)
- **`SmartTagSelector.tsx`** — Auto-suggested tags from destination, activity categories, Travel DNA, and trip type + custom input

### Edge Function
- **`moderate-guide-content`** — Keyword-based content moderation returning `{ approved, warnings, blocked_reasons }`. Blocks violence/explicit/hate/drugs; warns on PII (phone, email, SSN).

### GuideBuilder.tsx Rewrite
- Merged "Guide Content" section into editable activity cards
- Sections are the single source of truth (persisted to `guide_sections` table)
- Removed separate `guide_favorites` / `guide_manual_entries` dependency for the editor flow
- Smart tags replace free-text input
- Save mutation persists sections with new fields + runs moderation before publish
- Activity reviews aggregated to `guide_activity_reviews` on publish
- "Add Custom Tip" button replaces separate recommendation modal

### Published View Redesign (CommunityGuideDetail.tsx)
- Blog-style layout with hero image (first user photo or destination cover)
- Only shows activities with user content (experience, rating, photos, or recommendation)
- Star ratings and recommendation badges inline
- Photo grids per activity
- "Custom Tips" section at bottom for non-itinerary recommendations
- "Voyance Tip" callout for activities without user experience text

---

## Fix: City-Boundary Checkout/Check-in in generate-day Handler ✅ COMPLETE

### Problem
`generate-day` action extracted `paramIsFirstDayInCity` and `paramIsLastDayInCity` but never used them. Mid-journey city boundaries got no checkout/check-in constraints.

### Change
- **`supabase/functions/generate-itinerary/index.ts`** — Inserted multi-city boundary block after the Day 1/Last Day decision tree:
  - `paramIsFirstDayInCity && !isFirstDay && !paramIsTransitionDay` → appends CITY ARRIVAL check-in constraints
  - `paramIsLastDayInCity && !isLastDay` → appends CITY DEPARTURE checkout constraints
  - Reinforces correct hotel name on all multi-city days
