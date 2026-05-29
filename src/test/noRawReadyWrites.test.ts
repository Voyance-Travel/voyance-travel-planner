/**
 * Lint-style guard: no new raw `itinerary_status: 'ready'` / `'generated'`
 * writes from frontend code, no `metadata.fully_persisted: true` and no
 * `metadata.itinerary_frozen_at` writes either.
 *
 * The commit gate runs SERVER-SIDE only (`_shared/commit-itinerary.ts`),
 * is the single authority that may promote a trip to ready/frozen, and
 * is invoked by:
 *   - generate-itinerary/action-save-itinerary.ts
 *   - generate-itinerary/action-generate-trip-day.ts (Phase 6)
 *   - generate-itinerary/generation-core.ts (Stage 6 → Phase 6)
 *
 * Any new `src/` call that hard-codes ready/freeze fields bypasses the
 * gate and re-introduces the Lisbon / Amsterdam class of bug (flight
 * mismatch / post-checkin loop / missing canal boat must-do still
 * showing as a saved, ready trip).
 *
 * Allowed exceptions are explicitly listed below. The list MUST stay
 * tiny and every entry must have a stated reason.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// Allow-listed file:line patterns. Format: `<path>::<regex>` where the
// regex is a discriminator that matches the offending line. Keep the
// discriminator narrow so a real bypass cannot hide behind it.
const ALLOW = [
  // Local React state only — no DB write. setTrip is in-memory; the
  // backend remains the source of truth on the next reload.
  { file: 'src/pages/TripDetail.tsx', match: /setTrip\(/, label: 'local-react-state-setTrip' },
  // safeUpdateItineraryData routes through backend `save-itinerary`
  // edge function, which itself runs `resolveCommitGate`. Approved.
  { file: 'src/pages/TripDetail.tsx', match: /safeUpdateItineraryData\(/, label: 'goes-through-backend-gate' },
];

const FORBIDDEN_PATTERNS = [
  /itinerary_status\s*:\s*['"]ready['"]/i,
  /itinerary_status\s*:\s*['"]generated['"]/i,
  /fully_persisted\s*:\s*true/i,
  /itinerary_frozen_at\s*:/i,
];

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '__tests__' || entry === '.git') continue;
      walk(p, acc);
    } else if (/\.(t|j)sx?$/.test(entry) && !/\.test\.(t|j)sx?$/.test(entry)) {
      acc.push(p);
    }
  }
  return acc;
}

describe('frontend cannot promote to ready/frozen', () => {
  it('no raw itinerary_status:ready / fully_persisted:true / itinerary_frozen_at writes in src/', () => {
    const files = walk('src');
    const offenders: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      const lines = text.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!FORBIDDEN_PATTERNS.some((re) => re.test(line))) continue;
        // Check allow-list: any rule whose file matches AND whose
        // context regex matches this OR the preceding 3 lines passes.
        const ctx = lines.slice(Math.max(0, i - 3), i + 2).join('\n');
        const allowed = ALLOW.some(
          (a) => file.endsWith(a.file) && a.match.test(ctx),
        );
        if (!allowed) {
          offenders.push(`${file}:${i + 1}  ${line.trim()}`);
        }
      }
    }
    if (offenders.length > 0) {
      const msg =
        'Frontend code is trying to promote a trip to ready/frozen.\n' +
        'Only the backend commit gate (`_shared/commit-itinerary.ts`) may do this.\n' +
        'Either route through `safeUpdateItineraryData` (which calls the\n' +
        '`save-itinerary` edge function), or remove the write.\n\n' +
        'Offenders:\n  ' + offenders.join('\n  ');
      throw new Error(msg);
    }
    expect(offenders).toEqual([]);
  });
});
