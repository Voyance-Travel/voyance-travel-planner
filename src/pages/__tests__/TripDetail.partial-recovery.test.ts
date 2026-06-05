/**
 * Regression guard for the Bangkok/Dubai class of failures:
 *
 *   - `generate-itinerary` 504s after writing itinerary_days + itinerary_activities
 *     rows but before populating `itinerary_data.days` or flipping
 *     `itinerary_status` to 'ready'.
 *   - Trip is left at `partial` / `failed` / stale `generating` with empty JSON
 *     but complete normalized tables.
 *   - Without this recovery path, the user sits forever on
 *     "Your itinerary is ready! / Loading your itinerary…" and a hard refresh
 *     falls back toward "plan from scratch".
 *
 * The fix in `TripDetail.tsx`:
 *   1. Widens the rebuild self-heal gate beyond `ready/generated` to also
 *      include `partial`, `failed`, and stale `generating`/`queued` when the
 *      itinerary_days table is non-empty.
 *   2. Adds a "JSON empty but tables exist" drift signal so the per-day
 *      rebuild branch fires when `jsonDayCount === 0`.
 *   3. Promotes status to `ready` and clears `failed_day_numbers` once every
 *      expected day has real activities, stamps `fully_persisted = true`.
 *
 * See plan in `.lovable/plan.md`.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';

const SRC = readFileSync(
  resolve(__dirname, '../TripDetail.tsx'),
  'utf8',
);

describe('TripDetail — recovers partial/failed trips from normalized tables', () => {
  it('rebuild self-heal gate accepts partial, failed, and stale generating', () => {
    expect(SRC).toMatch(/isRecoverableSemiTerminal[\s\S]{0,200}partial[\s\S]{0,200}failed/);
    expect(SRC).toMatch(/isStaleGenerating[\s\S]{0,200}generating[\s\S]{0,200}queued/);
    expect(SRC).toMatch(/isReadyStatus\s*\|\|\s*isRecoverableSemiTerminal\s*\|\|\s*isStaleGenerating/);
  });

  it('JSON-empty-but-tables-exist forces the per-day rebuild branch', () => {
    expect(SRC).toMatch(/jsonEmptyButTablesExist[\s\S]{0,200}jsonDayCount\s*===\s*0[\s\S]{0,200}itineraryDaysDbCount\s*>\s*0/);
    expect(SRC).toMatch(/perDayDriftSuspected\s*=\s*jsonEmptyButTablesExist/);
  });

  it('settles status to partial and clears failed_day_numbers after successful rebuild', () => {
    // Status settled + failure metadata cleared. The frontend deliberately
    // does NOT flip to 'ready'/'fully_persisted' itself — the server-side
    // commit gate is the sole authority for that promotion. After a rebuild
    // from tables it settles the trip to 'partial' and clears stale failure
    // metadata so the poller exits and the UI stops spinning.
    expect(SRC).toMatch(/itinerary_status:\s*'partial'/);
    expect(SRC).toMatch(/failed_day_numbers:\s*\[\]/);
    expect(SRC).toMatch(/final_gate_bypassed:\s*true/);
    expect(SRC).toMatch(/recovered_from_tables_at/);
    // Honesty: only settle when ALL expected days have real activities.
    expect(SRC).toMatch(/realDayCount\s*>=\s*expectedTotal/);
  });

  it('passes allowFrozenWrite so the rebuilt JSON survives the Frozen-After-Ready gate', () => {
    expect(SRC).toMatch(/safeUpdateItineraryData[\s\S]{0,400}allowFrozenWrite:\s*true/);
  });
});
