
Goal: make itinerary generation fully backend-resilient (user can leave), stop false “all days locked” after partial failures/timeouts, fix non-responsive single-day unlock UX, and clean up crowded mobile layout.

What I found (root causes)
1) Locking bug after timeout/partial failure:
- Day visibility is gated primarily by entitlements.unlocked_day_count.
- Server-side generate-trip writes partial days to itinerary_data but does not progressively update unlocked_day_count.
- If generation fails/stalls after N days, entitlements may still report 0 unlocked days, so EditorialItinerary renders LockedDayCard for every day (even generated ones).

2) Timeout architecture risk:
- generate-trip runs a long background loop in one invocation (waitUntil) and can still die mid-run on long prompts/trips.
- This matches your “timed out after six days” symptom.

3) “Unlock day button does nothing” perception:
- It appears dead when days that should already be unlocked are wrongly locked.
- Also lacks strong inline loading/error state at card-level in some locked-card paths.

4) Mobile crowding:
- Day header action row uses horizontal overflow + left padding on mobile.
- Server generation screen spacing is too large on small screens.
- Activity metadata density is too high for small devices.

Implementation plan

Phase 1 — Fix data correctness first (no more false locked days)
A) Progressive unlock persistence in backend generation
- File: supabase/functions/generate-itinerary/index.ts
- In action=generate-trip:
  - After each successful day save:
    - update metadata.generation_completed_days
    - update metadata.generation_heartbeat
    - update unlocked_day_count = max(current unlocked_day_count, completed day number)
  - On failure with partial days:
    - preserve generated partial itinerary_data
    - persist unlocked_day_count to generatedDays.length (max with existing)
- Result: entitlements reflect paid/generated progress immediately, so generated days remain visible.

B) UI fallback guard against stale entitlements
- Files: src/pages/TripDetail.tsx, src/components/itinerary/EditorialItinerary.tsx
- Compute effective unlocked count as:
  max(
    entitlements.unlocked_day_count,
    trip.metadata.generation_completed_days,
    count(days with actual generated activities and non-preview metadata)
  )
- Use this effective value for day access gating while status is generating/failed/partial.
- Result: even if entitlement refresh lags, already-generated days never relock.

Phase 2 — Make generation durable when user leaves (backend-first orchestration)
A) Replace monolithic long loop with chunked continuation
- File: supabase/functions/generate-itinerary/index.ts
- Keep action=generate-trip entrypoint, but process in short bounded chunks per invocation (time/day budget).
- If days remain:
  - persist checkpoint (next day, heartbeat, progress)
  - self-invoke generate-trip with resumeFromDay=nextDay (server-to-server handoff)
- Final chunk marks itinerary_status='ready' and metadata.generation_completed_at.
- On error: mark failed with checkpoint preserved.
- Result: no dependency on user being on-page; long trips continue across invocations.

B) Strengthen resume safety
- Keep existing resumeFromDay flow, but make it idempotent:
  - never duplicate days already generated
  - always append/overwrite by dayNumber deterministically

Phase 3 — Fix unlock CTA responsiveness and reliability
A) Day unlock correctness
- File: src/hooks/useUnlockDay.ts
- When unlock succeeds:
  - set unlocked_day_count = max(current unlocked_day_count, unlocked day number) (not blind +1)
  - invalidate entitlements + trip queries immediately
- Ensure failures always surface visible toast/callout.

B) Locked day CTA UX
- Files: src/components/itinerary/LockedDayCard.tsx, src/components/itinerary/EditorialItinerary.tsx
- Add explicit loading state on button for current unlocking day.
- Disable repeated taps while unlocking.
- Show inline error state below CTA if unlock fails.
- Result: no “button does nothing” ambiguity.

Phase 4 — “Itinerary is ready” comeback experience
A) Completion signal in metadata
- File: supabase/functions/generate-itinerary/index.ts
- Persist metadata.generation_completed_at and generation_run_id when ready.

B) In-app ready popup/toast
- Files: src/pages/TripDashboard.tsx, src/pages/Profile.tsx (and/or TripDetail.tsx)
- Detect transition from generating/queued to ready and show:
  “Your itinerary is ready” with quick “Open trip” CTA.
- Store per-trip seen marker (local storage by tripId + generation_completed_at) to avoid repeat spam.
- Result: users return to “My Trips” and immediately get the completion cue you requested.

Phase 5 — Mobile UI cleanup in build flow
A) Generation screen spacing
- File: src/components/itinerary/ItineraryGenerator.tsx
- Tighten mobile spacing:
  - py-8 → py-4 sm:py-8
  - space-y-6 → space-y-4 sm:space-y-6
  - banner/card paddings reduced on mobile
  - remove mobile max-width constraints for progressive day preview.

B) Day header/action wrapping
- File: src/components/itinerary/EditorialItinerary.tsx
- Day number: text-3xl → text-2xl sm:text-5xl
- Action row: remove overflow-x behavior on mobile; use flex-wrap with tighter gaps.
- Remove mobile left padding that forces crowding.

C) Activity density reduction on mobile
- File: src/components/itinerary/EditorialItinerary.tsx
- Hide non-critical secondary metadata on mobile (e.g., extended address/insight blocks), keep essential title/time/category.
- Keep touch targets accessible.

D) TripDetail generation header spacing
- File: src/pages/TripDetail.tsx
- Reduce mobile top/bottom spacing and tighten callout spacing.

Validation plan
1) Start long itinerary generation, close page immediately, reopen from My Trips:
- Expect status to continue and eventually complete without manual resume.
2) Force mid-run failure/time-limit:
- Expect days already generated to remain visible and unlocked.
3) Click single-day unlock on a locked day:
- Expect immediate loading feedback and day unlock or clear error.
4) Mobile viewport checks on build flow:
- Verify no stacked overlap, wrapped actions, readable spacing.
5) Verify completion popup appears once when generation becomes ready.

Assumptions I will use
- Generated days should always remain accessible once produced (no re-locking due to stale entitlement state).
- “Itinerary ready” should surface as an in-app popup/toast in My Trips/Profile context (not email-only).
