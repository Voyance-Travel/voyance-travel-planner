/**
 * Archetype Matcher v3.1
 * Matches user trait scores to the 29 travel archetypes
 * 
 * This module implements the scoring algorithm from the Travel DNA Quiz specification:
 * 1. Calculate trait scores from quiz answers (0-1 scale)
 * 2. Check required traits for each archetype
 * 3. Apply boosters for matching traits
 * 4. Apply penalties for incompatible traits
 * 5. Apply life stage bonuses
 * 6. Rank archetypes by total score
 */

import quizConfig from '@/config/quiz-questions-v3.json';

// Type definitions
export interface TraitScores {
  pace: number;
  morning_energy: number;
  restoration_need: number;
  planning: number;
  flexibility: number;
  social_energy: number;
  group_size_pref: number;
  romance_focus: number;
  family_focus: number;
  budget_tier: number;
  quality_intrinsic: number;
  status_seeking: number;
  food_focus: number;
  art_focus: number;
  photo_focus: number;
  niche_interest: number;
  nature_orientation: number;
  adventure: number;
  cultural_depth: number;
  novelty_seeking: number;
  bucket_list: number;
  spirituality: number;
  healing_focus: number;
  learning_focus: number;
  ethics_focus: number;
  life_stage: 'early' | 'building' | 'established' | 'free' | 'na';
  [key: string]: number | string;
}

export interface ArchetypeMatch {
  id: string;
  name: string;
  category: string;
  score: number;
  confidence: 'high' | 'medium' | 'low';
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

interface TraitRequirement {
  min?: number;
  max?: number;
}

interface PenaltyRule {
  above?: number;
  below?: number;
  weight: number;
}

interface ArchetypeProfile {
  name: string;
  category: string;
  required: Record<string, TraitRequirement>;
  boosters: Record<string, number>;
  penalties: Record<string, PenaltyRule>;
  lifeStageBonus?: Record<string, number>;
  isDefault?: boolean;
  maxTraitSpread?: number;
}

// Type assertion for the config
const archetypeProfiles = quizConfig.archetypeProfiles as unknown as Record<string, ArchetypeProfile>;
const traitDefinitions = quizConfig.traitDefinitions as Record<string, { default: number }>;

/**
 * Initialize default trait scores from config
 */
function initializeTraits(): TraitScores {
  const traits: TraitScores = {
    pace: 0.5,
    morning_energy: 0.5,
    restoration_need: 0.5,
    planning: 0.5,
    flexibility: 0.5,
    social_energy: 0.5,
    group_size_pref: 0.5,
    romance_focus: 0,
    family_focus: 0,
    budget_tier: 0.5,
    quality_intrinsic: 0.5,
    status_seeking: 0.3,
    food_focus: 0.3,
    art_focus: 0.2,
    photo_focus: 0.2,
    niche_interest: 0.2,
    nature_orientation: 0.5,
    adventure: 0.5,
    cultural_depth: 0.5,
    novelty_seeking: 0.5,
    bucket_list: 0.3,
    spirituality: 0.2,
    healing_focus: 0,
    learning_focus: 0.3,
    ethics_focus: 0.3,
    life_stage: 'na',
  };

  // Override with config defaults if available
  for (const [key, def] of Object.entries(traitDefinitions)) {
    if (key in traits && 'default' in def) {
      (traits as Record<string, number | string>)[key] = def.default;
    }
  }

  return traits;
}

/**
 * Calculate trait scores from quiz answers
 * Each answer directly sets trait values (0-1 scale)
 */
export function calculateTraitScores(
  answers: Record<string, string>
): { scores: TraitScores; lifeStage: string | null } {
  const traits = initializeTraits();
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
        traits.life_stage = value as TraitScores['life_stage'];
        continue;
      }

      // Accumulate trait values for averaging
      if (!traitAccumulator[trait]) {
        traitAccumulator[trait] = [];
      }
      traitAccumulator[trait].push(value as number);
    }
  }

  // Fix D: Use weighted-max instead of simple average to preserve strong signals
  for (const [trait, values] of Object.entries(traitAccumulator)) {
    if (trait in traits && typeof traits[trait] === 'number') {
      const sum = values.reduce((a, b) => a + b, 0);
      const avg = sum / values.length;
      const max = Math.max(...values);
      // 70% strongest signal, 30% average — prevents dilution
      const weightedScore = (max * 0.7) + (avg * 0.3);
      // Clamp to 0-1 range
      (traits as Record<string, number | string>)[trait] = Math.max(0, Math.min(1, weightedScore));
    }
  }

  return { scores: traits, lifeStage };
}

/**
 * Check if a trait score meets a requirement
 */
function meetsRequirement(
  score: number | undefined,
  requirement: TraitRequirement
): boolean {
  if (score === undefined) return false;

  if (requirement.min !== undefined && score < requirement.min) return false;
  if (requirement.max !== undefined && score > requirement.max) return false;

  return true;
}

/**
 * Calculate how close a trait score is to meeting a requirement (0.0-1.0)
 * Returns 1.0 if fully met, proportional credit if close
 */
function calculateProximity(score: number | undefined, requirement: TraitRequirement): number {
  if (score === undefined || score === null) return 0;
  if (typeof score !== 'number' || !isFinite(score)) return 0;
  let proximity = 1.0;
  if (requirement.min !== undefined && score < requirement.min) {
    const gap = requirement.min - score;
    proximity = Math.min(proximity, Math.max(0, 1 - (gap / Math.max(0.01, 0.3))));
  }
  if (requirement.max !== undefined && score > requirement.max) {
    const gap = score - requirement.max;
    proximity = Math.min(proximity, Math.max(0, 1 - (gap / Math.max(0.01, 0.3))));
  }
  return isNaN(proximity) || !isFinite(proximity) ? 0 : proximity;
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
  const traitProximities: number[] = [];

  // Skip default archetype in normal scoring — handled separately
  if (profile.isDefault) {
    return {
      id: archetypeId,
      name: profile.name,
      category: profile.category,
      score: -Infinity, // Will never win in normal sorting
      confidence: 'low',
      matchedRequirements: [],
      penalties: [],
    };
  }

  // Check required traits as HARD GATES — if any required trait fails, disqualify
  const required = profile.required || {};
  let requiredMet = true;
  
  // Normalize required-gate budget: every archetype gets the same 30-point max from gates
  const requiredTraitCount = Object.keys(required).length;
  const pointsPerRequiredTrait = requiredTraitCount > 0 ? 30 / requiredTraitCount : 30;
  
  for (const [trait, requirement] of Object.entries(required)) {
    const traitValue = scores[trait];
    if (traitValue === undefined || traitValue === null || typeof traitValue !== 'number' || !isFinite(traitValue)) {
      // Missing trait = requirement not met
      requiredMet = false;
      continue;
    }
    
    if (meetsRequirement(traitValue, requirement)) {
      matchedRequirements.push(trait);
      // Bonus for meeting the requirement
      score += pointsPerRequiredTrait;
      traitProximities.push(1.0);
    } else {
      // Required trait FAILED — this is a hard gate
      requiredMet = false;
      traitProximities.push(0);
    }
  }

  // If any required trait is not met, disqualify this archetype
  if (!requiredMet && Object.keys(required).length > 0) {
    return {
      id: archetypeId,
      name: profile.name,
      category: profile.category,
      score: -Infinity,
      confidence: 'low',
      matchedRequirements,
      penalties: ['failed required gate'],
    };
  }

  // Apply booster scores
  const boosters = profile.boosters || {};
  for (const [trait, weight] of Object.entries(boosters)) {
    const traitValue = scores[trait];
    if (typeof traitValue === 'number') {
      score += traitValue * weight * 10;
    }
  }

  // Apply penalties
  const penaltyRules = profile.penalties || {};
  for (const [trait, penalty] of Object.entries(penaltyRules)) {
    const traitValue = scores[trait];
    if (typeof traitValue !== 'number') continue;

    if (penalty.above !== undefined && traitValue > penalty.above) {
      score += penalty.weight * 10;
      penalties.push(`${trait} too high`);
    }
    if (penalty.below !== undefined && traitValue < penalty.below) {
      score += penalty.weight * 10;
      penalties.push(`${trait} too low`);
    }
  }

  // Apply life stage bonus (capped at 8 to prevent dominating trait-based scoring)
  if (lifeStage && profile.lifeStageBonus?.[lifeStage]) {
    score += profile.lifeStageBonus[lifeStage] * 8;
    matchedRequirements.push(`life stage: ${lifeStage}`);
  }

  // Bonus for having at least one excellent trait match
  if (traitProximities.length > 0) {
    const bestProximity = Math.max(...traitProximities);
    if (bestProximity >= 0.8) {
      score += bestProximity * 20;
    }
  }

  // Calculate confidence
  let confidence: 'high' | 'medium' | 'low' = 'medium';
  if (score > 50 && matchedRequirements.length >= 2) {
    confidence = 'high';
  } else if (score < 20 || penalties.length > matchedRequirements.length) {
    confidence = 'low';
  }

  return {
    id: archetypeId,
    name: profile.name,
    category: profile.category,
    score: (typeof score === 'number' && isFinite(score)) ? score : 0,
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
    // Only include non-default archetypes in the competition
    if (!profile.isDefault) {
      matches.push(match);
    }
  }

  // Sort by score descending
  matches.sort((a, b) => b.score - a.score);

  // Diagnostic logging
  console.log('[ArchetypeMatcher] Top 5 matches:',
    matches.slice(0, 5).map(m => `${m.id}: ${m.score.toFixed(1)}`).join(', '));

  const topMatch = matches[0];

  // BSC only wins if there are literally NO scored archetypes — the top-scoring
  // archetype always wins, even with a low score. BSC is too generic for personalization.
  if (!topMatch || matches.length === 0) {
    console.log('[ArchetypeMatcher] No archetypes found — defaulting to BSC');
    const bscProfile = archetypeProfiles['balanced_story_collector'];
    const bscMatch: ArchetypeMatch = {
      id: 'balanced_story_collector',
      name: bscProfile?.name || 'The Balanced Story Collector',
      category: bscProfile?.category || 'BALANCED',
      score: 10,
      confidence: 'low',
      matchedRequirements: ['fallback'],
      penalties: [],
    };
    return {
      primary: bscMatch,
      secondary: null,
      allMatches: [bscMatch],
      traitScores: scores,
      lifeStage,
    };
  }

  // If the top match has a very low score, mark it low-confidence
  // but still use it — it's better than BSC for personalization
  if (topMatch.score < 15) {
    console.log(`[ArchetypeMatcher] Low-confidence match: ${topMatch.id} (${topMatch.score.toFixed(1)})`);
    topMatch.confidence = 'low';
  }

  // Update confidence based on score gaps
  if (matches.length >= 2) {
    const gap = matches[0].score - matches[1].score;
    if (gap > 20) {
      matches[0].confidence = 'high';
    } else if (gap > 10) {
      matches[0].confidence = 'medium';
    } else {
      matches[0].confidence = 'low';
    }
  }

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
 * Get primary archetype ID from answers
 */
export function getPrimaryArchetype(answers: Record<string, string>): string {
  const result = determineArchetype(answers);
  return result.primary?.id ?? result.allMatches[0]?.id ?? 'cultural_anthropologist';
}

/**
 * Get top N archetypes from answers
 */
export function getTopArchetypes(answers: Record<string, string>, count: number = 3): ArchetypeMatch[] {
  const result = determineArchetype(answers);
  return result.allMatches.slice(0, count);
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
    `Score: ${match.score.toFixed(1)} | Confidence: ${match.confidence}`,
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
      return `  ✗ ${trait}: ${typeof actual === 'number' ? actual.toFixed(2) : 'missing'} (need: ${JSON.stringify(req)})`;
    });

  if (missed.length > 0) {
    lines.push('', 'Missed requirements:');
    lines.push(...missed);
  }

  return lines.join('\n');
}
