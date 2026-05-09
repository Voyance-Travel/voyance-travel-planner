# Plan: Remove dead feature flags

## Change

In `src/config/environment.ts`, delete lines 47–48:

```ts
USE_AMADEUS_API: false, // Removed Feb 2026 — hotels now credit-gated AI feature
USE_STRICT_GENERATOR: false,  // Disabled — using legacy generation path
```

## Verification

- `rg "USE_AMADEUS_API|USE_STRICT_GENERATOR" src/ supabase/` returned only those two definition lines — zero readers. Safe to delete.
- TypeScript build will catch any missed reference (none expected).

## Out of scope

- Other feature flags in the same block (all still actively read).
- Any environment-variable cleanup (these are constants, not env-driven).
