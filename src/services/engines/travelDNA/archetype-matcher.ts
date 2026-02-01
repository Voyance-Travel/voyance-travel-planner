/**
 * Archetype Matcher v3
 * Matches user trait scores to the 27 travel archetypes
 */

import quizConfig from '@/config/quiz-questions-v3.json';

export interface TraitScores {
  [trait: string]: number;
}

export interface ArchetypeMatch {
  id: string;
  name: string;
  category: string;
  score: number;
  confidence: number;
  matchedRequirements: string[];
  penalties: string[];
}

export interface MatchResult {
  primary: ArchetypeMatch;
  secondary: ArchetypeMatch | null;
  allMatches: ArchetypeMatch[];
  traitScores: TraitScores;
  lifeStage: string | null;
}

interface ArchetypeProfile {
  name: string;
  category: string;
  required?: Record<string, { min?: number; max?: number; range?: [number, number] }>;
  preferred?: Record<string, { min?: number; max?: number; range?: [number, number] }>;
  penalties?: Record<string, { above?: number; below?: number; weight: number }>;
  lifeStageBonus?: Record<string, number>;
  isDefault?: boolean;
  maxTraitSpread?: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const archetypeProfiles: Record<string, ArchetypeProfile> = quizConfig.archetypeProfiles as any;

/**
 * Calculate trait scores from quiz answers
 */
export function calculateTraitScores(
  answers: Record<string, string>
): { scores: TraitScores; lifeStage: string | null } {
  const traitAccumulator: Record<string, number[]> = {};
  let lifeStage: string | null = null;

  for (const [questionId, answerId] of Object.entries(answers)) {
    const question = quizConfig.questions.find(q => q.id === questionId);
    if (!question) continue;

    const answer = question.answers.find(a => a.id === answerId);
    if (!answer) continue;

    // Extract traits from answer
    for (const [trait, value] of Object.entries(answer.traits)) {
      // Handle life_stage specially
      if (trait === 'life_stage') {
        lifeStage = value as string;
        continue;
      }

      if (!traitAccumulator[trait]) {
        traitAccumulator[trait] = [];
      }
      traitAccumulator[trait].push(value as number);
    }
  }

  // Average the trait scores
  const scores: TraitScores = {};
  for (const [trait, values] of Object.entries(traitAccumulator)) {
    const sum = values.reduce((a, b) => a + b, 0);
    scores[trait] = sum / values.length;
  }

  return { scores, lifeStage };
}

/**
 * Check if a trait score meets a requirement
 */
function meetsRequirement(
  score: number | undefined,
  requirement: { min?: number; max?: number; range?: [number, number] }
): boolean {
  if (score === undefined) return false;

  if (requirement.min !== undefined && score < requirement.min) return false;
  if (requirement.max !== undefined && score > requirement.max) return false;
  if (requirement.range) {
    if (score < requirement.range[0] || score > requirement.range[1]) return false;
  }

  return true;
}

/**
 * Calculate match score for a single archetype
 */
function calculateArchetypeScore(
  archetypeId: string,
  profile: ArchetypeProfile,
  scores: TraitScores,
  lifeStage: string | null
): ArchetypeMatch {
  let score = 0;
  const matchedRequirements: string[] = [];
  const penalties: string[] = [];

  // Check required traits (must all be met for a base score)
  let meetsAllRequired = true;
  const required = profile.required || {};
  
  for (const [trait, requirement] of Object.entries(required)) {
    if (meetsRequirement(scores[trait], requirement)) {
      matchedRequirements.push(trait);
      score += 30; // Base points for meeting required traits
    } else {
      meetsAllRequired = false;
    }
  }

  // If doesn't meet all required, heavily penalize
  if (!meetsAllRequired && Object.keys(required).length > 0) {
    score -= 50;
  }

  // Check preferred traits (bonus points)
  const preferred = profile.preferred || {};
  for (const [trait, requirement] of Object.entries(preferred)) {
    if (meetsRequirement(scores[trait], requirement)) {
      score += 15; // Bonus for preferred traits
      matchedRequirements.push(`${trait} (preferred)`);
    }
  }

  // Apply penalties
  const penaltyRules = profile.penalties || {};
  for (const [trait, penalty] of Object.entries(penaltyRules)) {
    const traitScore = scores[trait];
    if (traitScore === undefined) continue;

    if (penalty.above !== undefined && traitScore > penalty.above) {
      score += penalty.weight * 100; // Penalties are negative weights
      penalties.push(`${trait} too high`);
    }
    if (penalty.below !== undefined && traitScore < penalty.below) {
      score += penalty.weight * 100;
      penalties.push(`${trait} too low`);
    }
  }

  // Apply life stage bonus
  if (lifeStage && profile.lifeStageBonus?.[lifeStage]) {
    score += profile.lifeStageBonus[lifeStage] * 100;
    matchedRequirements.push(`life stage: ${lifeStage}`);
  }

  // Handle default archetype (Balanced Story Collector)
  if (profile.isDefault) {
    // Check if traits are well-distributed (no extreme values)
    const traitValues = Object.values(scores);
    if (traitValues.length > 0) {
      const max = Math.max(...traitValues);
      const min = Math.min(...traitValues);
      const spread = max - min;
      
      // If spread is low (balanced), boost this archetype
      if (profile.maxTraitSpread && spread <= profile.maxTraitSpread) {
        score += 20;
        matchedRequirements.push('balanced traits');
      }
    }
    // Default gets a small base score so it's always available
    score += 10;
  }

  // Calculate confidence based on how many traits contributed
  const totalTraits = Object.keys(scores).length;
  const contributingTraits = matchedRequirements.length;
  const confidence = totalTraits > 0 
    ? Math.min(100, Math.round((contributingTraits / Math.max(totalTraits, 5)) * 100))
    : 50;

  return {
    id: archetypeId,
    name: profile.name,
    category: profile.category,
    score,
    confidence,
    matchedRequirements,
    penalties,
  };
}

/**
 * Match trait scores to archetypes and return ranked results
 */
export function matchArchetypes(
  scores: TraitScores,
  lifeStage: string | null
): MatchResult {
  const matches: ArchetypeMatch[] = [];

  for (const [archetypeId, profile] of Object.entries(archetypeProfiles)) {
    const match = calculateArchetypeScore(archetypeId, profile, scores, lifeStage);
    matches.push(match);
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);

  // Get primary and secondary
  const primary = matches[0];
  const secondary = matches.length > 1 && matches[1].score > 0 ? matches[1] : null;

  return {
    primary,
    secondary,
    allMatches: matches.filter(m => m.score > 0),
    traitScores: scores,
    lifeStage,
  };
}

/**
 * Full pipeline: answers → traits → archetype match
 */
export function determineArchetype(answers: Record<string, string>): MatchResult {
  const { scores, lifeStage } = calculateTraitScores(answers);
  return matchArchetypes(scores, lifeStage);
}

/**
 * Get archetype details by ID
 */
export function getArchetypeProfile(archetypeId: string): ArchetypeProfile | null {
  return archetypeProfiles[archetypeId] || null;
}

/**
 * Get all archetype IDs
 */
export function getAllArchetypeIds(): string[] {
  return Object.keys(archetypeProfiles);
}

/**
 * Debug helper: explain why an archetype matched or didn't
 */
export function explainMatch(
  archetypeId: string,
  scores: TraitScores,
  lifeStage: string | null
): string {
  const profile = archetypeProfiles[archetypeId];
  if (!profile) return `Unknown archetype: ${archetypeId}`;

  const match = calculateArchetypeScore(archetypeId, profile, scores, lifeStage);
  
  const lines = [
    `${profile.name} (${profile.category})`,
    `Score: ${match.score} | Confidence: ${match.confidence}%`,
    '',
    'Matched:',
    ...match.matchedRequirements.map(r => `  ✓ ${r}`),
  ];

  if (match.penalties.length > 0) {
    lines.push('', 'Penalties:');
    lines.push(...match.penalties.map(p => `  ✗ ${p}`));
  }

  const required = profile.required || {};
  const missed = Object.entries(required)
    .filter(([trait]) => !match.matchedRequirements.includes(trait))
    .map(([trait, req]) => {
      const actual = scores[trait];
      return `  ✗ ${trait}: ${actual?.toFixed(2) ?? 'missing'} (need: ${JSON.stringify(req)})`;
    });

  if (missed.length > 0) {
    lines.push('', 'Missed requirements:');
    lines.push(...missed);
  }

  return lines.join('\n');
}
