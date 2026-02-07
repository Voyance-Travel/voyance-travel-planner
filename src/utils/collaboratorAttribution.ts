/**
 * Collaborator Activity Attribution
 * 
 * Assigns a color-coded collaborator indicator to activities in shared trips.
 * Uses the activity's tags/category to match against each collaborator's archetype affinities.
 */

// Consistent color palette for up to 6 collaborators (owner + 5 guests)
export const COLLABORATOR_COLORS = [
  { bg: 'bg-blue-500/15', border: 'border-blue-500/30', text: 'text-blue-600 dark:text-blue-400', dot: 'bg-blue-500' },
  { bg: 'bg-emerald-500/15', border: 'border-emerald-500/30', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  { bg: 'bg-amber-500/15', border: 'border-amber-500/30', text: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  { bg: 'bg-purple-500/15', border: 'border-purple-500/30', text: 'text-purple-600 dark:text-purple-400', dot: 'bg-purple-500' },
  { bg: 'bg-rose-500/15', border: 'border-rose-500/30', text: 'text-rose-600 dark:text-rose-400', dot: 'bg-rose-500' },
  { bg: 'bg-cyan-500/15', border: 'border-cyan-500/30', text: 'text-cyan-600 dark:text-cyan-400', dot: 'bg-cyan-500' },
] as const;

export interface CollaboratorAttribution {
  userId: string;
  name: string;
  colorIndex: number;
}

/**
 * Build a stable color map for all trip participants (owner first, then collaborators)
 */
export function buildCollaboratorColorMap(
  ownerId: string,
  ownerName: string,
  collaborators: Array<{ user_id: string; profile?: { display_name?: string | null; handle?: string | null } | null }>
): Map<string, CollaboratorAttribution> {
  const map = new Map<string, CollaboratorAttribution>();

  // Owner always gets index 0
  map.set(ownerId, {
    userId: ownerId,
    name: ownerName || 'Owner',
    colorIndex: 0,
  });

  // Collaborators get sequential indices
  collaborators.forEach((collab, i) => {
    const name = collab.profile?.display_name || collab.profile?.handle || 'Guest';
    map.set(collab.user_id, {
      userId: collab.user_id,
      name,
      colorIndex: (i + 1) % COLLABORATOR_COLORS.length,
    });
  });

  return map;
}

export function getCollaboratorColor(colorIndex: number) {
  return COLLABORATOR_COLORS[colorIndex % COLLABORATOR_COLORS.length];
}
