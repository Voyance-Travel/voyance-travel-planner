/**
 * Lint guard — fails if any edge function calls Google APIs directly instead
 * of going through `_shared/google-api.ts`. This is what makes the spend
 * accounting trustworthy: every billable Google call has to flow through the
 * wrapper so a counter increments and an audit entry is written.
 *
 * If this test fails, the fix is NOT to add your file to the allowlist — it
 * is to migrate the offending fetch to one of:
 *   - googlePlacesTextSearch
 *   - googlePlacesPhoto
 *   - googleGeocode
 *   - googleRoutes
 *   - googleDistanceMatrix
 *
 * The allowlist below contains files that are known to still use direct
 * fetches. They are tracked in `.lovable/plan.md` under the centralization
 * rollout. The allowlist must only ever shrink.
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { walk } from "https://deno.land/std@0.224.0/fs/walk.ts";
import { fromFileUrl, relative } from "https://deno.land/std@0.224.0/path/mod.ts";

// Files that may still contain direct googleapis.com references. Each entry
// is an explicit debt with a tracking note. NEVER add new entries without
// reducing the count first.
const PENDING_MIGRATION_ALLOWLIST = new Set([
  // Phase 2 — pending finish:
  "supabase/functions/destination-images/index.ts",
  "supabase/functions/optimize-itinerary/index.ts",
  "supabase/functions/generate-full-preview/index.ts",
  "supabase/functions/generate-itinerary/action-generate-trip-day.ts",
  "supabase/functions/generate-itinerary/action-generate-day.ts",
  "supabase/functions/generate-itinerary/pipeline/enrich-day.ts",
  // Hotels still constructs photo URLs locally and hands them to
  // getCachedPhotoUrl, which counts the SKU on cache miss. The bare URL
  // string still trips the regex, so it is allowlisted until photos are
  // routed through googlePlacesPhoto directly.
  "supabase/functions/hotels/index.ts",
  // recommend-restaurants and fetch-reviews do the same trick for photo URLs.
  "supabase/functions/recommend-restaurants/index.ts",
  "supabase/functions/fetch-reviews/index.ts",
  // photo-storage.ts is the photo cache layer — it intentionally fetches the
  // Google URL passed in by callers. It records the places_photo SKU on every
  // cache miss, so accounting is correct even though the literal fetch lives
  // here. Do not migrate this — it would create a circular dependency with
  // google-api.ts.
  "supabase/functions/_shared/photo-storage.ts",
]);

// The wrapper itself is the only file allowed to talk to googleapis.com.
const WRAPPER_FILE = "supabase/functions/_shared/google-api.ts";
const TEST_FILE = "supabase/functions/_shared/no-direct-google.test.ts";

const FORBIDDEN_PATTERN = /googleapis\.com/;

Deno.test("no edge function calls googleapis.com directly", async () => {
  const root = fromFileUrl(new URL("../", import.meta.url));
  const offenders: string[] = [];

  for await (
    const entry of walk(root, {
      exts: [".ts"],
      includeDirs: false,
      skip: [/node_modules/, /\.test\.ts$/, /__tests__/],
    })
  ) {
    const rel = `supabase/functions/${relative(root, entry.path).replaceAll("\\", "/")}`;

    if (rel === WRAPPER_FILE || rel === TEST_FILE) continue;
    if (PENDING_MIGRATION_ALLOWLIST.has(rel)) continue;

    let text: string;
    try {
      text = await Deno.readTextFile(entry.path);
    } catch {
      continue;
    }

    if (FORBIDDEN_PATTERN.test(text)) {
      offenders.push(rel);
    }
  }

  if (offenders.length > 0) {
    const lines = offenders.map((f) => `  - ${f}`).join("\n");
    throw new Error(
      `The following files contain direct googleapis.com references.\n` +
        `Migrate them to use _shared/google-api.ts wrappers, or add a justified ` +
        `entry to PENDING_MIGRATION_ALLOWLIST.\n\n${lines}\n`,
    );
  }

  assertEquals(offenders.length, 0);
});
