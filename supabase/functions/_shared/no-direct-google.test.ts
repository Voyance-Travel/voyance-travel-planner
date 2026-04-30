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
 *   - getCachedPlacesPhotoByResource (for cached photo downloads)
 *
 * "Is this URL Google-billable?" predicates must use the shared helper in
 * `_shared/is-google-billable.ts` instead of inlining a substring check.
 */

import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { walk } from "https://deno.land/std@0.224.0/fs/walk.ts";
import { fromFileUrl, relative } from "https://deno.land/std@0.224.0/path/mod.ts";

// The wrapper itself, the shared "is this Google?" predicate, the photo
// cache (which legitimately fetches the URL it was handed), and this test
// file are the ONLY files allowed to mention `googleapis.com` literally.
const ALLOWED_FILES = new Set([
  "supabase/functions/_shared/google-api.ts",
  "supabase/functions/_shared/is-google-billable.ts",
  "supabase/functions/_shared/photo-storage.ts",
  "supabase/functions/_shared/no-direct-google.test.ts",
]);

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

    if (ALLOWED_FILES.has(rel)) continue;

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
        `Migrate them to use _shared/google-api.ts wrappers (or the photo ` +
        `cache helper getCachedPlacesPhotoByResource), and use the shared ` +
        `isGoogleBillableUrl predicate from _shared/is-google-billable.ts ` +
        `instead of inlining a host substring check.\n\n${lines}\n`,
    );
  }

  assertEquals(offenders.length, 0);
});

/**
 * Secondary guard — catches the *other* historical leak class:
 *
 *   getCachedPhotoUrl(...someGoogleUrl..., /* no costTracker */ )
 *
 * The photo cache now self-heals by lazily creating a tracker, but we still
 * want call sites to pass an explicit tracker so spend gets attributed to
 * the right action_type (search vs enrichment vs review etc).
 *
 * This test scans for `getCachedPhotoUrl(` invocations and warns if a Google
 * photo URL is being passed without a tracker. We only fail loudly when a
 * file mentions a Google URL builder near the call.
 */
Deno.test("photo cache calls with raw Google URLs include a CostTracker", async () => {
  const root = fromFileUrl(new URL("../", import.meta.url));
  const offenders: Array<{ file: string; snippet: string }> = [];

  for await (
    const entry of walk(root, {
      exts: [".ts"],
      includeDirs: false,
      skip: [/node_modules/, /\.test\.ts$/, /__tests__/, /_shared\/photo-storage\.ts$/],
    })
  ) {
    const rel = `supabase/functions/${relative(root, entry.path).replaceAll("\\", "/")}`;

    let text: string;
    try {
      text = await Deno.readTextFile(entry.path);
    } catch {
      continue;
    }

    // Only inspect files that both reference a raw Google host AND call
    // getCachedPhotoUrl directly. Files that use getCachedPlacesPhotoByResource
    // or no Google host literal are fine.
    if (!/getCachedPhotoUrl\s*\(/.test(text)) continue;
    if (!FORBIDDEN_PATTERN.test(text)) continue;

    offenders.push({
      file: rel,
      snippet: "raw googleapis.com URL passed to getCachedPhotoUrl — use getCachedPlacesPhotoByResource",
    });
  }

  if (offenders.length > 0) {
    const lines = offenders.map((o) => `  - ${o.file}: ${o.snippet}`).join("\n");
    throw new Error(
      `Photo cache callers must not hand-build Google photo URLs. Use ` +
        `getCachedPlacesPhotoByResource from _shared/photo-storage.ts so ` +
        `URL construction and SKU accounting stay centralized.\n\n${lines}\n`,
    );
  }

  assertEquals(offenders.length, 0);
});
