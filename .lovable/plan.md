

## Cross-Flow Audit: Single City, Multi-City, Just Tell Us, Build It Myself

### Methodology

Traced all 5 trip creation paths through to `trip_cities` insertion, generation trigger, and post-generation editing. Compared field-by-field consistency.

### Flows Audited

| # | Flow | Entry Point |
|---|------|-------------|
| 1 | **Single City (Form)** | `Start.tsx` form submit → direct DB insert |
| 2 | **Multi-City (Form)** | `Start.tsx` form submit → `trip_cities` + `splitJourneyIfNeeded` |
| 3 | **Just Tell Us (Chat)** | `Start.tsx` chat confirm → DB insert + `trip_cities` |
| 4 | **Build It Myself** | `createTripFromParsed.ts` → DB insert + `trip_cities` |
| 5 | **useVoyanceAPI / useCreateTrip** | `useVoyanceAPI.ts` → DB insert + `trip_cities` |

---

### GAP 1: `days_total` Inconsistency Across Flows (MEDIUM)

The `days_total` field on `trip_cities` is calculated differently depending on the creation path:

| Flow | Formula | 3-night trip → days_total |
|------|---------|--------------------------|
| Start.tsx form (single city) | `nights + 1` | **4** ✅ |
| Start.tsx form (multi city) | `(nights \|\| 1) + 1` | **4** ✅ |
| Just Tell Us chat (single) | `nights + 1` | **4** ✅ |
| Just Tell Us chat (multi) | `(nights \|\| 1) + 1` | **4** ✅ |
| splitJourneyIfNeeded | `nights + 1` | **4** ✅ |
| **useVoyanceAPI / useCreateTrip** | **`nights`** | **3** ❌ |
| createTripFromParsed | `numDaysComputed` (from parsed days array) | Correct ✅ |

`useVoyanceAPI.ts` line 227 sets `days_total: nights` instead of `nights + 1`. This means trips created via `useCreateTrip` (used by `TripPlannerContext` and other API-driven flows) have an off-by-one `days_total`, which could cause the generation engine to produce one fewer day than expected.

**Fix**: Change `days_total: nights` to `days_total: nights + 1` in `useVoyanceAPI.ts` line 227.

---

### GAP 2: `owner_plan_tier` Missing from Both Start.tsx Paths (MEDIUM)

Both the form path (line 2411-2450) and the chat path (line 2774-2948) in `Start.tsx` do **not** set `owner_plan_tier` on the trip insert. Every other creation path (`useVoyanceAPI`, `createTripFromParsed`, `plannerAPI`, `voyanceAPI`, `TripPlannerContext`) fetches entitlements and sets this field.

This means trips created via the primary `Start.tsx` UI have `owner_plan_tier = NULL`, which could affect collaboration access rules and plan-tier checks downstream.

**Fix**: Fetch `owner_plan_tier` before the insert in `Start.tsx` (both form and chat paths), mirroring the pattern used in other flows.

---

### GAP 3: `budget_include_hotel` Not Set in Chat Path (LOW)

The form path sets `budget_include_hotel: includeHotelInBudget || false` (line 2425), but the chat path doesn't set this field at all. If the chat planner extracts hotel details with a price, the budget calculations won't include hotel costs unless this flag is set.

**Fix**: Set `budget_include_hotel` in the chat path insert when hotel details include a price.

---

### GAP 4: `allocated_budget_cents` Not Set for Chat Multi-City (LOW)

The form path splits budget across cities after `trip_cities` insertion (lines 2528-2549). The chat path inserts `trip_cities` rows but never sets `allocated_budget_cents`. When the journey split runs, it calculates proportional budgets from the parent trip's `budget_total_cents`, so split journeys are fine. But for chat multi-city trips with <8 days (no split), each city has `NULL` allocated budget.

**Fix**: Add budget allocation logic after the chat path's `trip_cities` insert, mirroring the form path.

---

### Verified Working (No Gaps)

| Area | Status |
|------|--------|
| Single city form → trip_cities row ✓, generation trigger ✓ | ✅ |
| Multi-city form → trip_cities rows ✓, journey split ✓, collabs copied ✓ | ✅ |
| Chat single city → trip_cities ✓, constraints ✓, generation trigger ✓ | ✅ |
| Chat multi-city → trip_cities ✓, journey split ✓, collabs ✓ | ✅ |
| Build It Myself → trip_cities ✓, preferences ✓ (prior fix), nights ✓ (prior fix) | ✅ |
| Journey split → leg creation ✓, collabs ✓, members ✓, metadata propagation ✓ | ✅ |
| Flight/hotel pre-gen → all paths persist selections correctly | ✅ |
| Flight/hotel post-gen → cascade events fire, optimistic saves work | ✅ |
| Generation engine → reads trip_cities correctly for all flows | ✅ |
| Budget/Payments → cost sync $0 fix intact, financial views working | ✅ |
| Chat editing (itinerary-chat) → scoped correctly, credit bypass intact | ✅ |
| Discover → hidden when aiLocked, credit bypass for manual mode | ✅ |
| Edge functions → all operational, no broken functions | ✅ |
| Prior fixes (all rounds) → no regressions detected | ✅ |

---

### Recommendations — Priority Order

1. **Fix `days_total` in `useVoyanceAPI.ts`** — Off-by-one causes generation to produce wrong day count
2. **Add `owner_plan_tier` to both Start.tsx paths** — Missing field affects downstream plan checks
3. **Set `budget_include_hotel` in chat path** — Consistency with form path
4. **Add `allocated_budget_cents` for chat multi-city (<8 days)** — Budget breakdown completeness

### Files Involved

| Fix | Files |
|-----|-------|
| GAP 1 (days_total) | `src/hooks/useVoyanceAPI.ts` (line 227) |
| GAP 2 (owner_plan_tier) | `src/pages/Start.tsx` (form path ~line 2411, chat path ~line 2774) |
| GAP 3 (budget_include_hotel) | `src/pages/Start.tsx` (chat path ~line 2786) |
| GAP 4 (allocated_budget_cents) | `src/pages/Start.tsx` (chat path ~line 2980) |

