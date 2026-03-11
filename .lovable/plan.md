

## Flip the Schema Generation Flag

Set `USE_SCHEMA_GENERATION = true` in both copies of the feature flags file. This activates the schema-driven prompt path for itinerary generation.

### Changes (2 files)

1. **`src/config/feature-flags.ts`** — line 15: `false` → `true`
2. **`supabase/functions/generate-itinerary/schema/feature-flags.ts`** — line 8: `false` → `true`

Also enable `logSchemas: true` in both files so you can monitor the compiled schemas in edge function logs during the initial rollout. This can be turned off once you're confident in the output.

