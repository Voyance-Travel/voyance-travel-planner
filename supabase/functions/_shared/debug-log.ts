// Gate verbose / PII-bearing console logs behind an explicit env flag.
// In production, DEBUG_LOGS is unset → these calls are no-ops.
// To re-enable locally, set the DEBUG_LOGS edge-function secret to "true".
const DEBUG = Deno.env.get('DEBUG_LOGS') === 'true';

export const debugLog = (...args: unknown[]): void => {
  if (DEBUG) console.log(...args);
};

export const debugWarn = (...args: unknown[]): void => {
  if (DEBUG) console.warn(...args);
};
