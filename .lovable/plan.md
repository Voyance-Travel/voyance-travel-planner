
Goal: stop Smart Finish from repeatedly failing, stop user-visible 500/504 loops, and guarantee no credit loss (or accidental over-refunds) during failures.

What is actually happening (confirmed from logs/data):
1) The Smart Finish run is failing inside backend generation validation, not payment checkout.
   - Error in logs: TRIP-WIDE DUPLICATE for “Blanton Museum of Art” and “Freshen up and Relax”.
2) Those validation errors become hard-fail in Smart Finish mode after retries, which returns 500.
3) The failure reason is being collapsed to “Generation failed: 500” in metadata, hiding the real cause.
4) pending_credit_charges has a schema mismatch:
   - code writes status = "failed"
   - DB check constraint only allows ('pending','completed','refunded')
   - result: failure resolution writes silently fail, rows stay pending.
5) Client stale-refund flow attempts to mark pending charges as refunded from client-side, but table has no UPDATE policy; those updates can fail silently.
   - This allows repeated stale refunds and inconsistent accounting states.

Implementation sequence

Phase 1 — Stop Smart Finish hard-failing on over-strict duplicate rules
Files:
- supabase/functions/generate-itinerary/index.ts

Changes:
1. Reclassify trip-wide concept duplicates from hard errors to warnings for general “other/museum/downtime” activities.
2. Keep hard rules only for truly strict cases (e.g., repeated culinary_class / wine_tasting caps if desired), but do not hard-fail generic concept repeats.
3. Exclude additional logistical/downtime patterns from trip-wide duplicate checks:
   - free time, relax, reset, check-in/out, transfer, transit, breaks.
4. Tighten similarity criteria so generic tokens (“museum”, “relax”, “visit”) don’t trigger cross-day duplicates by themselves.
5. Preserve back-to-back same-concept checks as quality guidance, but avoid entire-trip abort unless structure is invalid.

Result:
- Smart Finish can complete even when model output has mild repetition.
- Quality remains guided by warnings rather than catastrophic failures.

Phase 2 — Preserve true backend error in Smart Finish metadata
Files:
- supabase/functions/enrich-manual-trip/index.ts

Changes:
1. When generate-itinerary returns non-2xx, parse JSON/text body and propagate the underlying message (not only HTTP status).
2. Set metadata.smartFinishStatus = "failed" when background generation fails.
3. Save a short user-safe error + full diagnostic error field (truncated) for internal debugging.
4. Add explicit logging on metadata update failures.

Result:
- Console/UI reflect the actual cause (“validation duplicate rule too strict”) instead of opaque “Generation failed: 500”.

Phase 3 — Fix pending charge state model so failures can resolve correctly
Files:
- new SQL migration in supabase/migrations
- supabase/functions/enrich-manual-trip/index.ts

Database changes:
1. Update pending_credit_charges status check to include 'failed'.
   - current: pending/completed/refunded
   - target: pending/completed/refunded/failed
2. Backfill currently stuck rows:
   - old pending rows already refunded in ledger should be marked refunded
   - old pending rows with clear failure metadata should be marked failed

Function changes:
1. Check and log errors for pending charge status writes (completed/failed) instead of fire-and-forget.
2. Ensure every run ends with a resolved pending_charge state.

Result:
- No more zombie pending rows.
- State machine aligns with code behavior.

Phase 4 — Make refund flow idempotent and server-authoritative
Files:
- supabase/functions/spend-credits/index.ts
- src/hooks/useStalePendingChargeRefund.ts
- (optional new backend function) supabase/functions/reconcile-smart-finish-charges/index.ts

Changes:
1. Add idempotency in REFUND path using pendingChargeId (or deterministic key) in metadata:
   - if refund already issued for that pending charge, return idempotent success without creating a second refund.
2. Move stale pending reconciliation to backend-only mutation path (service role), not direct client table update.
3. Update frontend hook to call backend reconciliation function and only display summary result.
4. Ensure stale recovery updates pending_credit_charges status atomically with refund.

Result:
- No accidental double refunds.
- No silent client-side update failures due RLS.

Phase 5 — Improve Smart Finish retry UX to reduce frustration loops
Files:
- src/components/itinerary/SmartFinishBanner.tsx

Changes:
1. Show clear failure reason from metadata.smartFinishError (humanized).
2. Distinguish:
   - transient timeout/retryable
   - validation/quality issue
   - upstream AI/rate-limit issue
3. Disable repeated immediate retries while backend run is active.
4. On retry, include idempotency key metadata so charge/refund pair is traceable per attempt.

Result:
- User sees meaningful error + safe retry behavior, not generic repeated failures.

Validation plan after implementation
1. Re-run Smart Finish on the failing trip ID and confirm:
   - no 500 from duplicate-concept-only violations
   - metadata.smartFinishCompleted=true on success
2. Simulate forced validation failure and confirm:
   - metadata.smartFinishStatus="failed"
   - smartFinishError contains detailed cause
   - pending charge resolves to failed (not stuck pending)
3. Trigger stale reconciliation twice and confirm:
   - only one refund ledger entry per pending charge
   - second call returns idempotent result
4. Verify credit integrity:
   - one spend per attempt
   - max one refund per failed attempt
   - no net drift across retries.

Technical summary of concrete edits
- Backend generation logic:
  - soften trip-wide duplicate enforcement
  - improve similarity gating and logistical exclusions
- Enrichment orchestration:
  - preserve real downstream error payload
  - correct smartFinishStatus transitions
  - enforce pending-charge resolution logging
- Database migration:
  - allow failed status in pending_credit_charges
  - repair existing stuck rows
- Refund safety:
  - idempotent REFUND with pendingChargeId linkage
  - backend-only stale reconciliation path
- Frontend:
  - improved failure messaging + controlled retry state

Expected outcome
- Smart Finish stops failing on non-critical repetition.
- No more opaque “Generation failed: 500” dead-end errors.
- Pending charge lifecycle becomes reliable.
- Credit behavior becomes deterministic and auditable under repeated retries.
