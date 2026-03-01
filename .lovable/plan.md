

# Soft Guardrails: Warn, Don't Block

## The Problem

The current implementation has **hard caps** at two layers:

1. **Database trigger** (`validate_activity_cost`): Silently rewrites any cost above the cap to the cap value (e.g., $600 dining becomes $500). The user never even knows their data was changed.
2. **Frontend validation** (`validateCostUpdate` in `EditActivityModal.tsx`): Returns `valid: false` and blocks the save button entirely.

Both of these prevent legitimate use cases like a $500/person omakase, a $1,000 fine dining experience, or a $400 private car transfer.

## The Fix

Change both layers from "block/rewrite" to "warn but allow."

### 1. Database Trigger: Remove hard caps, keep anomaly detection

Replace the current trigger that silently rewrites costs with one that only:
- Prevents negative costs (hard rule -- always valid)
- Auto-corrects when linked to a reference AND the cost exceeds 3x the reference high-end AND the source is NOT `user_override` (keeps the reference-based guard for AI-generated costs only)
- Logs a warning note when costs are unusually high, but **does not change the value** for user overrides

The key distinction: **AI-generated costs** still get capped against reference data. **User-entered costs** are always respected.

```text
Logic:
  IF source = 'user_override' THEN
    -- User explicitly set this. Allow it. Just add a note if it's high.
    IF cost > category_warning_threshold THEN
      append note: "[User override: above typical range for category]"
    END IF
  ELSE
    -- AI/system generated. Apply reference-based correction.
    IF cost_reference_id IS NOT NULL AND cost > ref.cost_high_usd * 3 THEN
      auto-correct to ref.cost_high_usd
    END IF
  END IF

  -- No category caps applied. No RAISE EXCEPTION. No silent rewrites for users.
```

### 2. Frontend Validation: Warn, don't block

Change `validateCostUpdate()` to return a **warning** level instead of `valid: false`:

```text
Return type changes from:
  { valid: boolean; message?: string }
To:
  { valid: true; warning?: string }  -- always valid, optionally warns

Example:
  $600 dining -> { valid: true, warning: "This is above the typical range for dining ($500/pp). Are you sure?" }
  $40 dining  -> { valid: true }
  -$5 dining  -> { valid: false, message: "Cost cannot be negative" }  -- only case that blocks
```

### 3. EditActivityModal: Show warning, allow save

- Replace the hard block (disabled save button + error state) with a yellow warning banner
- The save button stays enabled
- Warning text: "This is above the typical range for [category]. You can still save it."
- Only truly invalid values (negative costs) disable save

### 4. `upsertActivityCost`: Remove the blocking validation

- The service function currently calls `validateCostUpdate` and returns `null` if invalid
- Change it to proceed with the upsert regardless (the DB trigger handles anomaly logging)
- When source is `user_override`, the trigger respects the value

## Files to Change

1. **New migration SQL** -- Replace the `validate_activity_cost` trigger function with the soft version that only hard-corrects AI-sourced costs
2. **`src/services/activityCostService.ts`** -- Change `validateCostUpdate` return type to always return `valid: true` with an optional `warning` field (except for negatives). Remove the blocking check in `upsertActivityCost`
3. **`src/components/itinerary/EditActivityModal.tsx`** -- Show warning text instead of blocking save. Keep save button enabled when warning is present

## What This Preserves

- AI-generated costs (from `generate-itinerary` or `budget-coach`) are still corrected against `cost_reference` data -- no $1,000 ramen from AI hallucination
- Anomaly detection still fires and logs notes for auditing
- Users can enter any positive cost they want -- their $1,000 dinner, their $400 private transfer, their $6,000 Tokyo food budget

