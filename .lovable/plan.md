

## Flip USE_STRICT_GENERATOR to false

### Change
One file, one line:

**`src/config/environment.ts` line 48:**
```
USE_STRICT_GENERATOR: false,  // Disabled — using legacy generation path
```

This returns the generation pipeline to the old (working) path. No other files need changes since no corresponding backend flag exists in the edge function.

