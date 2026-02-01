/**
 * Trait Score Calculation Engine
 * 
 * This module calculates normalized trait scores (-10 to +10) from quiz responses.
 * Each quiz answer contributes weights (0.0-1.0) to multiple personality traits.
 * The final scores represent the user's position on each trait dimension.
 */

import quizConfigRaw from '@/config/quiz-questions-v2.json';

// Type assertion for the config
const quizConfig = quizConfigRaw as typeof quizConfigRaw & {
  traitDefinitions: Record<string, { description: string; dimension: string }>;
  dimensionWeights: Record<string, { weight: number; description: string }>;
};

// Type definitions
export interface TraitMapping {
  trait: string;
  weight: number;
}

export interface QuizAnswer {
  id: string;
  label: string;
  mappings: TraitMapping[];
  toneTags: string[];
  emotionalDrivers: string[];
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  type: 'single' | 'multi';
  maxSelections?: number;
  answers: QuizAnswer[];
}

export interface QuizResponse {
  questionId: string;
  answerId: string | string[];
}

export interface TraitScores {
  [trait: string]: number;
}

export interface TraitCalculationResult {
  scores: TraitScores;
  rawWeights: { [trait: string]: number };
  traitCounts: { [trait: string]: number };
  toneTags: string[];
  emotionalDrivers: string[];
  confidence: number;
}

/**
 * Find an answer by ID across all questions
 */
function findAnswer(answerId: string): QuizAnswer | null {
  for (const question of (quizConfig.questions as QuizQuestion[])) {
    const answer = question.answers.find(a => a.id === answerId);
    if (answer) return answer;
  }
  return null;
}

/**
 * Calculate trait scores from quiz responses
 * 
 * Algorithm:
 * 1. Accumulate weights from all selected answers
 * 2. Track count of contributions per trait
 * 3. Calculate average weight per trait
 * 4. Normalize to -10 to +10 scale (0.5 = neutral/0)
 * 
 * Formula: trait_score = (average_weight - 0.5) × 20
 *   - average_weight = 1.0 → +10 (maximum positive)
 *   - average_weight = 0.5 → 0 (neutral)
 *   - average_weight = 0.0 → -10 (maximum negative)
 */
export function calculateTraitScores(responses: QuizResponse[]): TraitCalculationResult {
  const traitAccumulator = new Map<string, number>();
  const traitCounts = new Map<string, number>();
  const allToneTags = new Set<string>();
  const allEmotionalDrivers = new Set<string>();

  // Step 1: Accumulate weights from all answers
  for (const response of responses) {
    const answerIds = Array.isArray(response.answerId) 
      ? response.answerId 
      : [response.answerId];
    
    for (const answerId of answerIds) {
      const answer = findAnswer(answerId);
      if (!answer) continue;

      // Accumulate trait mappings
      for (const mapping of answer.mappings) {
        const currentWeight = traitAccumulator.get(mapping.trait) || 0;
        const currentCount = traitCounts.get(mapping.trait) || 0;

        traitAccumulator.set(mapping.trait, currentWeight + mapping.weight);
        traitCounts.set(mapping.trait, currentCount + 1);
      }

      // Collect tone tags and emotional drivers
      answer.toneTags.forEach(tag => allToneTags.add(tag));
      answer.emotionalDrivers.forEach(driver => allEmotionalDrivers.add(driver));
    }
  }

  // Step 2: Calculate normalized scores (-10 to +10)
  const normalizedScores: TraitScores = {};
  const rawWeights: { [trait: string]: number } = {};

  for (const [trait, totalWeight] of traitAccumulator.entries()) {
    const count = traitCounts.get(trait) || 1;
    const averageWeight = totalWeight / count;

    // Store raw average weight for debugging
    rawWeights[trait] = averageWeight;

    // Convert 0-1 weight to -10 to +10 scale
    // 0.5 = neutral (0), 1.0 = +10, 0.0 = -10
    normalizedScores[trait] = Math.round((averageWeight - 0.5) * 20);
    
    // Clamp to valid range
    normalizedScores[trait] = Math.max(-10, Math.min(10, normalizedScores[trait]));
  }

  // Step 3: Calculate confidence based on coverage
  const totalTraits = Object.keys(quizConfig.traitDefinitions).length;
  const coveredTraits = traitAccumulator.size;
  const answeredQuestions = responses.length;
  const totalQuestions = quizConfig.questions.length;

  // Confidence formula: weighted combination of trait coverage and question completion
  const traitCoverage = coveredTraits / totalTraits;
  const questionCoverage = answeredQuestions / totalQuestions;
  const confidence = Math.round((traitCoverage * 0.4 + questionCoverage * 0.6) * 100);

  return {
    scores: normalizedScores,
    rawWeights,
    traitCounts: Object.fromEntries(traitCounts),
    toneTags: Array.from(allToneTags),
    emotionalDrivers: Array.from(allEmotionalDrivers),
    confidence: Math.min(100, confidence),
  };
}

/**
 * Get dimension aggregate scores
 * Aggregates individual trait scores into the 8 primary dimensions
 */
export function getDimensionScores(traitScores: TraitScores): TraitScores {
  const dimensionScores: TraitScores = {
    planning: 0,
    social: 0,
    comfort: 0,
    pace: 0,
    authenticity: 0,
    adventure: 0,
    budget: 0,
    transformation: 0,
  };

  const dimensionCounts: { [key: string]: number } = {
    planning: 0,
    social: 0,
    comfort: 0,
    pace: 0,
    authenticity: 0,
    adventure: 0,
    budget: 0,
    transformation: 0,
  };

  // Map traits to their dimensions
  const traitDefinitions = quizConfig.traitDefinitions as Record<string, { dimension: string }>;

  for (const [trait, score] of Object.entries(traitScores)) {
    const definition = traitDefinitions[trait];
    if (definition && definition.dimension in dimensionScores) {
      dimensionScores[definition.dimension] += score;
      dimensionCounts[definition.dimension]++;
    }
  }

  // Average the dimension scores
  for (const dimension of Object.keys(dimensionScores)) {
    if (dimensionCounts[dimension] > 0) {
      dimensionScores[dimension] = Math.round(
        dimensionScores[dimension] / dimensionCounts[dimension]
      );
      // Clamp to valid range
      dimensionScores[dimension] = Math.max(-10, Math.min(10, dimensionScores[dimension]));
    }
  }

  return dimensionScores;
}

/**
 * Get top traits (highest absolute values)
 */
export function getTopTraits(traitScores: TraitScores, count: number = 5): Array<{ trait: string; score: number }> {
  return Object.entries(traitScores)
    .map(([trait, score]) => ({ trait, score, absScore: Math.abs(score) }))
    .sort((a, b) => b.absScore - a.absScore)
    .slice(0, count)
    .map(({ trait, score }) => ({ trait, score }));
}

/**
 * Convert legacy quiz answers format to responses
 */
export function convertLegacyAnswers(
  answers: Record<string, string | string[]>
): QuizResponse[] {
  const responses: QuizResponse[] = [];
  
  // Map from legacy field names to question IDs
  const fieldToQuestionMap: Record<string, string> = {
    traveler_type: 'q1',
    travel_vibes: 'q2',
    budget: 'q3',
    pace: 'q4',
    planning_style: 'q5',
    travel_companions: 'q6',
    interests: 'q7',
    accommodation: 'q8',
    weather_preference: 'q9',
    emotional_drivers: 'q10',
  };

  for (const [field, value] of Object.entries(answers)) {
    const questionId = fieldToQuestionMap[field];
    if (questionId && value) {
      responses.push({
        questionId,
        answerId: value,
      });
    }
  }

  return responses;
}
