// src/config/feature-flags.ts
// Feature flags for gradual rollout of new systems.

/**
 * SCHEMA GENERATION FEATURE FLAG
 *
 * When FALSE (default): The existing generation pipeline runs exactly as-is.
 * When TRUE: The new schema-driven prompt path is used instead.
 *
 * This flag controls the branching point in the generation pipeline.
 * It should ONLY be set to true after Fix 22A-E are all deployed and tested.
 *
 * DO NOT SET THIS TO TRUE until the schema path has been manually verified.
 */
export const USE_SCHEMA_GENERATION = true;

// Additional schema generation config
export const SCHEMA_GENERATION_CONFIG = {
  /** Log compiled schemas to console for debugging (even when flag is off) */
  logSchemas: true,

  /** Run schema compiler in shadow mode: compile the schema and log it,
   *  but still use the old prompt path for actual generation.
   *  Useful for comparing schema output against existing generation. */
  shadowMode: false,

  /** Default transfer time estimate in minutes (airport ↔ hotel/activity) */
  defaultTransferMinutes: 45,

  /** Buffer before must-do activities in minutes */
  mustDoBufferMinutes: 15,
};
