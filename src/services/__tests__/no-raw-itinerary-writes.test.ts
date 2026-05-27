/**
 * Lint-style guard: any client-side write to `trips.itinerary_data` MUST go
 * through `safeUpdateItineraryData` so the server-side `save-itinerary` action
 * runs `persistTripItinerary` (prompt-artifact strip, persist-day contract,
 * cross-city sweep, terminalCleanup).
 *
 * Three previously-confirmed leak paths in src/pages/TripDetail.tsx
 * (upsert with itinerary_data, handleDateChange .update, handleUndoDateChange
 * .update) were the root cause of the intermittent (FLEX_WINDOW)/(slot)
 * prompt-artifact AND wrong-city restaurant leaks reported 30–50% of runs.
 *
 * If this test fails, you are about to reintroduce one of those leaks. Route
 * the write through `safeUpdateItineraryData` instead.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC_ROOT = join(process.cwd(), 'src');
const ALLOWED_FILES = new Set<string>([
  // The wrapper itself does not write itinerary_data — it invokes the edge
  // function. It selects from trips.itinerary_data, which is fine.
  join(SRC_ROOT, 'services', 'safeUpdateItineraryData.ts'),
  // Self-heal in TripDetail.tsx assigns to a *local* copy of tripData
  // before passing it to setTrip — never to a `.update()` call. We still
  // allow the file because all real DB writes go via safeUpdateItineraryData.
  join(SRC_ROOT, 'pages', 'TripDetail.tsx'),
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '__tests__' || entry.startsWith('.')) continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry) && !entry.endsWith('.test.ts') && !entry.endsWith('.test.tsx')) {
      out.push(full);
    }
  }
  return out;
}

// Match either `.update({ ... itinerary_data ... })` or
// `.upsert({ ... itinerary_data ... })` patterns. Crude but effective:
// look for the field name within ~600 chars after `.update(` / `.upsert(`.
const RAW_WRITE_RE = /\.(update|upsert)\([^)]{0,800}itinerary_data/m;

describe('client never writes trips.itinerary_data raw', () => {
  it('all .update / .upsert with itinerary_data go through safeUpdateItineraryData', () => {
    const offenders: string[] = [];
    for (const file of walk(SRC_ROOT)) {
      if (ALLOWED_FILES.has(file)) continue;
      const src = readFileSync(file, 'utf8');
      // Strip block + line comments so documentation referencing the
      // forbidden pattern doesn't false-positive.
      const stripped = src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
      if (RAW_WRITE_RE.test(stripped)) {
        offenders.push(file.replace(SRC_ROOT, 'src'));
      }
    }
    expect(
      offenders,
      `Raw trips.itinerary_data write detected. Route through safeUpdateItineraryData:\n  ${offenders.join('\n  ')}`,
    ).toEqual([]);
  });

  it('TripDetail.tsx itself contains no raw .update/.upsert touching itinerary_data', () => {
    const src = readFileSync(join(SRC_ROOT, 'pages', 'TripDetail.tsx'), 'utf8');
    const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(RAW_WRITE_RE.test(stripped)).toBe(false);
  });

  it('no src/ file invokes the legacy optimistic_update_itinerary RPC', () => {
    // The RPC writes trips.itinerary_data raw and was the documented
    // pre-/post-refresh divergence root cause. The only acceptable mentions
    // are comments inside itineraryOptimisticUpdate.ts that explain *why*
    // we no longer call it. An actual `.rpc('optimistic_update_itinerary'…)`
    // call would silently bypass the canonical save pipeline and must fail
    // this test.
    const offenders: string[] = [];
    const RPC_CALL_RE = /\.rpc\(\s*['"]optimistic_update_itinerary['"]/;
    for (const file of walk(SRC_ROOT)) {
      const src = readFileSync(file, 'utf8');
      const stripped = src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
      if (RPC_CALL_RE.test(stripped)) {
        offenders.push(file.replace(SRC_ROOT, 'src'));
      }
    }
    expect(
      offenders,
      `Legacy optimistic_update_itinerary RPC call detected. Route through safeUpdateItineraryData:\n  ${offenders.join('\n  ')}`,
    ).toEqual([]);
  });

  it('flight + hotel patchers and optimistic save route through safeUpdateItineraryData', () => {
    const filesThatMustRouteCanonically = [
      join(SRC_ROOT, 'services', 'itineraryOptimisticUpdate.ts'),
      join(SRC_ROOT, 'services', 'flightItineraryPatch.ts'),
      join(SRC_ROOT, 'services', 'hotelItineraryPatch.ts'),
    ];
    for (const file of filesThatMustRouteCanonically) {
      const src = readFileSync(file, 'utf8');
      expect(
        /safeUpdateItineraryData|saveItineraryOptimistic/.test(src),
        `${file.replace(SRC_ROOT, 'src')} must route through safeUpdateItineraryData (or saveItineraryOptimistic which itself routes there).`,
      ).toBe(true);
    }
  });

  it('safeUpdateItineraryData emits PERSIST_DRIFT telemetry on canonical mismatch', () => {
    const src = readFileSync(join(SRC_ROOT, 'services', 'safeUpdateItineraryData.ts'), 'utf8');
    expect(src).toMatch(/\[PERSIST_DRIFT\]/);
    expect(src).toMatch(/itineraryFingerprint/);
  });
});
