/**
 * Regression guard: TripDetail.tsx MUST NOT add new on-mount effects that
 * auto-invoke `generate-itinerary` against a trip that already has saved
 * activities. Silent auto-regen overwrites user-visible content (Dublin
 * 2026-05-14, Clinton Brooks Madrid 358cc606).
 *
 * Allowed `generate-itinerary` invocation sites in TripDetail.tsx (4):
 *   1. handleResumeGeneration  — explicit user "Regenerate" button
 *   2. triggerGeneration       — multi-city queued-leg handoff
 *   3. stuckHealAttempted      — stuck `generating` leg, gated on count===0
 *   4. notStartedHealAttempted — chat-planner `not_started`, gated on !hasItineraryData
 *   5. extend-days user action  — explicit "add days" UI flow
 *
 * Each self-heal site has a guard that prevents firing when the trip
 * already has saved activities. See:
 *   mem://constraints/itinerary/no-auto-resume-on-load
 *   mem://constraints/itinerary/mobile-uses-server-chain
 *   Core: Frozen After Ready / No-Regression Overwrite / DB Is Source of Truth
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

const SRC = readFileSync(
  resolve(__dirname, '../TripDetail.tsx'),
  'utf8',
);

describe('TripDetail — no silent regen on mount', () => {
  it('contains exactly the 5 allow-listed generate-itinerary invocations', () => {
    const matches = SRC.match(
      /supabase\.functions\.invoke\(\s*['"]generate-itinerary['"]/g,
    );
    // 4 self-heal/handoff/button sites + 1 extend-days user action = 5.
    // If this number changes, audit the new call site against the
    // memory constraint before bumping the count.
    expect(matches?.length ?? 0).toBe(5);
  });

  it('never re-introduces useAutoResume hook', () => {
    expect(SRC).not.toMatch(/useAutoResume/);
    expect(SRC).not.toMatch(/autoResumeAttemptedRef/);
  });

  it('stuck-leg self-heal is gated on zero saved itinerary_days rows', () => {
    // The stuck-heal branch only invokes generate-itinerary when the
    // count of itinerary_days rows is 0 — see TripDetail.tsx ~L920.
    expect(SRC).toMatch(/stuckHealAttempted/);
    expect(SRC).toMatch(/from\(['"]itinerary_days['"]\)[\s\S]{0,200}count:\s*['"]exact['"]/);
  });

  it('not_started self-heal is gated on !hasItineraryData', () => {
    // The not-started branch must short-circuit when itinerary data
    // already exists — see TripDetail.tsx ~L1036.
    expect(SRC).toMatch(/notStartedHealAttempted/);
    expect(SRC).toMatch(/if\s*\(\s*hasItineraryData\(trip\)\s*\)\s*return/);
  });
});
