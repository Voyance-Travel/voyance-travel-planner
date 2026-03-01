
# Table-Driven Budget Architecture & Cost Integrity

## Problem Summary
Three views show three different totals for the same trip because each uses a different JS calculation path. The Budget Coach can corrupt activity prices (e.g., $5 bus becomes $800, $15 ramen becomes $1,000). All costs originate from AI hallucination with no validation.

## Current State (What Exists)
- `destination_cost_index` table already exists with per-city base costs (breakfast, lunch, dinner, etc.)
- `trip_budget_ledger` table exists with category, entry_type (committed/planned), amount_cents
- `trip_budget_summary` and `trip_cost_summary` SQL views already exist
- `cost-estimation.ts` engine already does destination-aware pricing using `destination_cost_index`
- Three separate cost calculation paths: `getDayTotalCost()` in EditorialItinerary, `getBudgetSummary()` in tripBudgetService, and `payableItems` in PaymentsTab

## Implementation Plan

### Phase 1: Create `cost_reference` and `activity_costs` Tables

**New table: `cost_reference`** — granular per-category, per-subcategory pricing by destination (extends the existing `destination_cost_index` which only has broad category bases).

```text
cost_reference
  id UUID PK
  destination_city TEXT
  destination_country TEXT
  category TEXT (dining, transport, activity, nightlife, shopping)
  subcategory TEXT (street_food, mid_range, fine_dining, bus, taxi, metro...)
  item_name TEXT (optional: specific venue)
  cost_low_usd NUMERIC(10,2)
  cost_mid_usd NUMERIC(10,2)
  cost_high_usd NUMERIC(10,2)
  source TEXT (manual, api, ai_seeded)
  confidence TEXT (high, medium, low)
  UNIQUE(destination_city, category, subcategory, item_name)
```

**New table: `activity_costs`** — one row per activity per trip, the single source of truth for all cost displays.

```text
activity_costs
  id UUID PK
  trip_id UUID FK trips
  activity_id UUID
  day_number INT
  cost_reference_id UUID FK cost_reference (nullable)
  cost_per_person_usd NUMERIC(10,2)
  num_travelers INT DEFAULT 1
  total_cost_usd GENERATED (cost_per_person_usd * num_travelers)
  category TEXT
  source TEXT (reference, user_override, booking_actual, fallback)
  confidence TEXT
  is_paid BOOLEAN DEFAULT FALSE
  paid_amount_usd NUMERIC(10,2)
  created_at, updated_at TIMESTAMPTZ
```

**New table: `exchange_rates`** — stored rates for consistent currency conversion.

```text
exchange_rates
  currency_code TEXT PK
  rate_to_usd NUMERIC(12,6)
  last_updated TIMESTAMPTZ
```

**Validation trigger on `activity_costs`:** Enforces category caps (dining <= $500/pp, transport <= $300/pp, activity <= $1000/pp, global <= $2000/pp) and auto-corrects costs exceeding 3x the reference high-end.

**RLS policies:** All three new tables get RLS. `cost_reference` and `exchange_rates` are read-only for authenticated users. `activity_costs` allows CRUD for trip owners/collaborators.

### Phase 2: Seed Cost Reference Data

- Seed `cost_reference` with baseline pricing for destinations already in use (Hong Kong, Tokyo, Austin, Barcelona, Shanghai, Beijing, etc.)
- Use AI to generate initial seed data once, stored with `source: 'ai_seeded'`, `confidence: 'medium'`
- Create a `seed-cost-reference` edge function that can be called to populate data for new destinations on-demand

### Phase 3: SQL Views for Consistent Totals

Create four new views that all read from `activity_costs`:

- **`v_trip_total`** — total per-person and all-travelers cost per trip
- **`v_day_totals`** — per-day breakdown
- **`v_budget_by_category`** — category-level aggregation
- **`v_payments_summary`** — paid vs unpaid totals

These replace the existing divergent JS calculations.

### Phase 4: Cost Assignment During Generation

**Modify `generate-itinerary` edge function:**
1. Remove cost fields from the AI prompt schema — AI generates activity metadata only (name, description, category, subcategory, time, location)
2. After AI returns activities, call a new `assignCosts()` function that:
   - Looks up `cost_reference` for (destination_city, category, subcategory)
   - Selects cost_low/mid/high based on budget tier (saver/moderate/premium)
   - Falls back to `destination_cost_index` if no specific reference exists
   - Inserts rows into `activity_costs`
3. The activity JSON still gets a `cost` field for display, but it's sourced from the table lookup, not AI

### Phase 5: Update Frontend to Use Single Source of Truth

**EditorialItinerary.tsx:**
- Replace `getDayTotalCost()` JS calculation with a query to `v_day_totals` / `v_trip_total`
- Keep `getActivityCostInfo()` for individual card display but source from `activity_costs` table
- When a user edits a cost, write to `activity_costs` with `source: 'user_override'`

**BudgetTab.tsx:**
- Continue using `useTripBudget` hook but update `getBudgetSummary()` to read from `v_budget_by_category` and `v_trip_total`
- Remove independent ledger-based calculation

**PaymentsTab.tsx:**
- Replace `payableItems` cost derivation (currently re-computing from itinerary JSON + `estimateCostSync`) with a query to `activity_costs` joined with payment status
- `estimatedTotal` comes from `v_payments_summary`

### Phase 6: Budget Coach Guardrails

**Edge function changes (`budget-coach/index.ts`):**
- AI only returns qualitative swap suggestions (activity_id, replacement name, reasoning)
- AI does NOT return cost numbers at all
- Backend looks up `cost_reference` for the suggested replacement to get the new cost
- Savings = current cost (from `activity_costs`) - reference cost for replacement
- Strict guard: if new_cost >= current_cost, discard suggestion

**Apply swap flow (`EditorialItinerary.tsx`):**
- When user approves a swap, update `activity_costs` row with the new reference-backed cost
- Never use AI-provided cost numbers
- Frontend validates: new cost must be strictly less than current cost before applying

### Phase 7: Backfill Existing Trips

- Create a one-time migration/edge function to:
  - Read existing itinerary JSON for each trip
  - For each activity, look up `cost_reference` or use `destination_cost_index`
  - If existing cost is within reference range, keep it; if outside (e.g., $800 bus), replace with reference mid
  - Insert validated costs into `activity_costs`
  - Flag auto-corrected entries

### Phase 8: Frontend Validation Guards

- Add `validateCostUpdate()` on the frontend before any cost write
- Category caps: dining $500, transport $300, activity $1000, nightlife $200, global $2000
- Show user-friendly error: "This price seems too high for [category]. Maximum is $X/person."

## Files to Create
- Migration SQL for `cost_reference`, `activity_costs`, `exchange_rates` tables + trigger + views + RLS
- `supabase/functions/seed-cost-reference/index.ts` — seeds reference data per destination
- `src/services/activityCostService.ts` — CRUD for `activity_costs`, query views

## Files to Modify
- `supabase/functions/generate-itinerary/index.ts` — remove cost from AI schema, add `assignCosts()` post-generation
- `supabase/functions/budget-coach/index.ts` — AI returns qualitative swaps only, backend computes costs from reference
- `src/components/itinerary/EditorialItinerary.tsx` — source totals from `v_trip_total`/`v_day_totals`, add cost validation
- `src/components/itinerary/PaymentsTab.tsx` — source from `activity_costs` + `v_payments_summary`
- `src/components/planner/budget/BudgetTab.tsx` — align with canonical views
- `src/components/planner/budget/BudgetCoach.tsx` — update swap application to use reference costs
- `src/services/tripBudgetService.ts` — `getBudgetSummary()` reads from SQL views
- `src/hooks/useTripBudget.ts` — update queries to use new views
- `src/services/budgetLedgerSync.ts` — sync to `activity_costs` instead of/in addition to ledger

## Priority Order
1. Tables + trigger + views (foundation)
2. Seed reference data for existing destinations
3. Frontend reads from views (fixes the 3-number divergence immediately)
4. Generation pipeline uses reference lookups (prevents future hallucination)
5. Budget Coach guardrails (prevents corruption)
6. Backfill existing trips
7. Exchange rates + currency handling
