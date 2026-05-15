/**
 * Regression guard: TripDetail.tsx MUST NOT add new on-mount effects that
 * auto-invoke `generate-itinerary` against a trip that already has saved
 * activities. Silent auto-regen overwrites user-visible content (Dublin
 * 2026-05-14, Clinton Brooks Madrid 358cc606).
 *
 * Allowed `action:'generate-trip'` invocation sites in TripDetail.tsx (5):
 *   1. handleResumeGeneration  — explicit user "Regenerate" button
 *   2. triggerGeneration       — multi-city queued-leg handoff
 *   3. stuckHealAttempted      — stuck `generating` leg
 *   4. notStartedHealAttempted — chat-planner `not_started`
 *   5. extend-days user action — explicit "add days" UI flow
 *
 * Each self-heal site (2,3,4) MUST short-circuit when the trip already
 * has saved activities — checked against BOTH itinerary_data JSON and
 * the normalized itinerary_days table. See:
 *   mem://constraints/itinerary/no-auto-resume-on-load
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
  it('contains exactly 5 allow-listed action:"generate-trip" invocations', () => {
    const matches = SRC.match(/action:\s*['"]generate-trip['"]/g);
    expect(matches?.length ?? 0).toBe(5);
  });

  it('never re-introduces the useAutoResume hook or its ref', () => {
    expect(SRC).not.toMatch(/from\s+['"][^'"]*useAutoResume['"]/);
    expect(SRC).not.toMatch(/autoResumeAttemptedRef\.current/);
    expect(SRC).not.toMatch(/autoResumeAttemptedRef\s*=\s*useRef/);
  });

  it('queued-leg trigger short-circuits when saved activities already exist', () => {
    // Must check BOTH itinerary_data and itinerary_days before invoking.
    expect(SRC).toMatch(/Queued-leg trigger SKIPPED/);
    expect(SRC).toMatch(/hasJsonActivities/);
  });

  it('stuck-leg self-heal short-circuits on hasItineraryData(trip)', () => {
    expect(SRC).toMatch(/stuckHealAttempted/);
    // Existing zero-row guard.
    expect(SRC).toMatch(/from\(['"]itinerary_days['"]\)[\s\S]{0,200}count:\s*['"]exact['"]/);
    // New JSON-data guard before invoke.
    expect(SRC).toMatch(/Stuck-heal SKIPPED[\s\S]{0,200}itinerary_data has real activities/);
  });

  it('not_started self-heal short-circuits on hasItineraryData and itinerary_days rows', () => {
    expect(SRC).toMatch(/notStartedHealAttempted/);
    expect(SRC).toMatch(/if\s*\(\s*hasItineraryData\(trip\)\s*\)\s*return/);
    // New normalized-rows guard before mutating + invoking.
    expect(SRC).toMatch(/not_started self-heal SKIPPED[\s\S]{0,200}itinerary_days has/);
  });
});
