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
      // Strip block comments so we don't false-positive on documentation.
      const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '');
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
});
