/**
 * Sanitizes activity names by stripping internal system prefixes
 * that should never be shown to users.
 */

// Internal prefixes used by the generation system that shouldn't appear in UI
const SYSTEM_PREFIXES = [
  'EDGE_ACTIVITY:',
  'SIGNATURE_MEAL:',
  'LINGER_BLOCK:',
  'WELLNESS_MOMENT:',
  'AUTHENTIC_ENCOUNTER:',
  'SOCIAL_EXPERIENCE:',
  'SOLO_RETREAT:',
  'DEEP_CONTEXT:',
  'SPLURGE_EXPERIENCE:',
  'VIP_EXPERIENCE:',
  'COUPLES_MOMENT:',
  'CONNECTIVITY_SPOT:',
  'FAMILY_ACTIVITY:',
  // Also handle lowercase variants
  'edge_activity:',
  'signature_meal:',
  'linger_block:',
  'wellness_moment:',
  'authentic_encounter:',
  'social_experience:',
  'solo_retreat:',
  'deep_context:',
  'splurge_experience:',
  'vip_experience:',
  'couples_moment:',
  'connectivity_spot:',
  'family_activity:',
];

/**
 * Remove internal system prefixes from activity names
 * @param name - The raw activity name that may contain system prefixes
 * @returns Clean activity name suitable for display
 */
export function sanitizeActivityName(name: string | undefined | null): string {
  if (!name) return 'Activity';
  
  let sanitized = name.trim();
  
  // Strip any system prefixes
  for (const prefix of SYSTEM_PREFIXES) {
    if (sanitized.startsWith(prefix)) {
      sanitized = sanitized.slice(prefix.length).trim();
      break; // Only remove first matching prefix
    }
  }
  
  // Also handle case-insensitive matching for robustness
  const lowerName = sanitized.toLowerCase();
  for (const prefix of SYSTEM_PREFIXES) {
    if (lowerName.startsWith(prefix.toLowerCase())) {
      sanitized = sanitized.slice(prefix.length).trim();
      break;
    }
  }
  
  return sanitized || 'Activity';
}
