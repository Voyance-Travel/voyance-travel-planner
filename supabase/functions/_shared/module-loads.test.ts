/**
 * Smoke test — every file in `_shared/` must parse and evaluate at module
 * load. A single broken shared module silently breaks every consumer's
 * deploy, and we keep falling into that trap. This test catches it locally.
 *
 * It does NOT exercise behavior — it just imports each module. If a top-level
 * statement throws (e.g. a `Deno.env.get(...)!` assertion when a secret is
 * absent in CI), it surfaces here instead of at deploy time.
 */

import { assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { walk } from "https://deno.land/std@0.224.0/fs/walk.ts";

Deno.test("every _shared module loads without throwing", async () => {
  const here = new URL("./", import.meta.url);
  const failures: Array<{ file: string; error: string }> = [];

  for await (
    const entry of walk(here, {
      exts: [".ts"],
      includeDirs: false,
      maxDepth: 1,
      // Skip test files and the email-templates subfolder (data, not code).
      skip: [/\.test\.ts$/, /email-templates/],
    })
  ) {
    const rel = entry.name;
    try {
      await import(entry.path);
    } catch (err) {
      failures.push({
        file: rel,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (failures.length > 0) {
    const lines = failures.map((f) => `  - ${f.file}: ${f.error}`).join("\n");
    throw new Error(
      `One or more _shared modules failed to load. Fix these before they ` +
        `break every consumer's deploy:\n\n${lines}\n`,
    );
  }

  assert(failures.length === 0);
});
