
Problem confirmed. I checked the live trip records and this is reproducible in production data: chat-created trips are still being saved with 2025 dates even when created in 2026.

What’s actually causing it
1) Just Tell Us date extraction (`supabase/functions/chat-trip-planner/index.ts`) does not provide the model an explicit “today/current year = 2026” anchor, so the model frequently defaults to 2025.
2) There is no hard post-extraction date guard in the Just Tell Us path before saving.
3) In `TripChatPlanner.tsx`, `normalizeMultiCity` uses `new Date("YYYY-MM-DD")` (UTC parsing), which can create date drift edge cases.

Plan to fix (targeted + durable)

1) Harden Just Tell Us prompt year rules (server side)
- File: `supabase/functions/chat-trip-planner/index.ts`
- Add explicit runtime date context and a minimum planning year floor:
  - `MIN_TRIP_YEAR = 2026`
  - `effectiveYear = max(currentYear, MIN_TRIP_YEAR)`
- Update SYSTEM_PROMPT rules to explicitly forbid 2025 and earlier for inferred/default dates.
- Add concrete examples in prompt:
  - “US Open” without explicit year must resolve to 2026+.
  - If ambiguous month/day, choose `effectiveYear` or next year.

2) Add a hard date-normalization safety net before confirmation (client side)
- File: `src/components/planner/TripChatPlanner.tsx`
- Add `normalizeExtractedDates(details)` and run it immediately after tool-call JSON parse, before `setExtractedDetails`.
- Rules:
  - Parse local dates with local components (not `new Date("YYYY-MM-DD")`).
  - Force minimum year to 2026.
  - If normalized start date is still in the past, roll both dates forward by 1 year.
  - Preserve trip length when shifting years.
  - Ensure `endDate >= startDate` after normalization.

3) Add final guard right before DB insert (defense in depth)
- File: `src/pages/Start.tsx` (inside `onChatDetailsExtracted`)
- Re-run the same normalization right before writing `trips.start_date/end_date`.
- This prevents stale/legacy UI states or future regressions from saving 2025 again.

4) Remove UTC parsing in chat multi-city normalization
- File: `src/components/planner/TripChatPlanner.tsx`
- Replace:
  - `new Date(details.startDate)` / `new Date(details.endDate)`
- With local-date parsing helper (`parseLocalDate`) to avoid timezone drift.

Technical implementation details
- Introduce a shared helper (recommended): `src/utils/justTellUsDateGuard.ts`
  - `parseIsoLocal(yyyyMmDd)`
  - `formatIsoLocal(date)`
  - `normalizeChatTripDates({ startDate, endDate }, { minYear: 2026 })`
- Reuse this helper in both TripChatPlanner and Start page.
- Keep all date math in local date components (`getFullYear/getMonth/getDate`) and avoid `toISOString()` for calendar-only logic.

Validation plan
1) Just Tell Us: “New York for the US Open, 4 days” (no year mentioned) → confirm card must show 2026+.
2) Just Tell Us: explicit 2025 input → normalized to 2026+ (per your requirement).
3) Multi-city Just Tell Us route with dates crossing months → nights and date range remain consistent.
4) DB verification query after test: no new `creation_source in ('chat','multi_city')` rows saved with year 2025.
5) Regression check: standard Start flow (non-chat) unchanged.

Expected outcome
- 2025 will no longer be persisted from Just Tell Us.
- Users will stop getting “past trip” defaults for event-driven plans like US Open.
- Date handling will be consistent and timezone-safe in the chat flow.
