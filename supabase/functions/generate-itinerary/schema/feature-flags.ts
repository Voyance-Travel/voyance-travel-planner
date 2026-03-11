// ============================================================
// EDGE FUNCTION COPY — Source of truth is in src/
// This file is a copy of src/config/feature-flags.ts with import paths
// adjusted for the Deno edge function environment.
// If you modify this file, also update the src/ version.
// ============================================================

export const USE_SCHEMA_GENERATION = false;

export const SCHEMA_GENERATION_CONFIG = {
  logSchemas: false,
  shadowMode: false,
  defaultTransferMinutes: 45,
  mustDoBufferMinutes: 15,
};
