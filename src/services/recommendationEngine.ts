/**
 * Recommendation Engine
 * Generates personalized recommendations based on user preferences
 */

import type { Destination } from '@/lib/destinations';
import { destinations } from '@/lib/destinations';

export interface RecommendationParams {
  interests?: string[];
  budget?: 'budget' | 'moderate' | 'premium' | 'luxury';
  travelStyle?: string;
  climate?: string;
  region?: string;
  excludeIds?: string[];
}

export interface RecommendedDestination extends Destination {
  matchScore: number;
  matchReasons: string[];
}

/**
 * Calculate match score between preferences and destination
 */
function calculateMatchScore(
  destination: Destination,
  params: RecommendationParams
): { score: number; reasons: string[] } {
  let score = 50; // Base score
  const reasons: string[] = [];

  // Region match
  if (params.region && destination.region.toLowerCase().includes(params.region.toLowerCase())) {
    score += 20;
    reasons.push(`Perfect for ${params.region} exploration`);
  }

  // Add variety bonus for different regions
  if (!params.region) {
    score += 10;
    reasons.push(`Diverse ${destination.region} experience`);
  }

  // Tagline interest matching (simple keyword matching)
  if (params.interests?.length) {
    const taglineLower = destination.tagline.toLowerCase();
    const descLower = destination.description.toLowerCase();
    
    params.interests.forEach(interest => {
      const interestLower = interest.toLowerCase();
      if (taglineLower.includes(interestLower) || descLower.includes(interestLower)) {
        score += 15;
        reasons.push(`Great for ${interest}`);
      }
    });
  }

  // Add some randomization for variety
  score += Math.random() * 10;

  return { score: Math.min(100, Math.round(score)), reasons };
}

/**
 * Get recommended destinations based on preferences
 */
export function getRecommendedDestinations(
  params: RecommendationParams,
  limit = 6
): RecommendedDestination[] {
  const excludeSet = new Set(params.excludeIds || []);
  
  const scored = destinations
    .filter(d => !excludeSet.has(d.id))
    .map(destination => {
      const { score, reasons } = calculateMatchScore(destination, params);
      return {
        ...destination,
        matchScore: score,
        matchReasons: reasons.slice(0, 3), // Max 3 reasons
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);

  return scored.slice(0, limit);
}

/**
 * Get similar destinations
 */
export function getSimilarDestinations(
  destinationId: string,
  limit = 4
): RecommendedDestination[] {
  const current = destinations.find(d => d.id === destinationId);
  if (!current) return [];

  return getRecommendedDestinations({
    region: current.region,
    excludeIds: [destinationId],
  }, limit);
}

/**
 * Get trending destinations (mock implementation)
 */
export function getTrendingDestinations(limit = 6): RecommendedDestination[] {
  // In real app, this would use analytics data
  const shuffled = [...destinations].sort(() => Math.random() - 0.5);
  
  return shuffled.slice(0, limit).map(d => ({
    ...d,
    matchScore: 80 + Math.floor(Math.random() * 20),
    matchReasons: ['Trending this season', 'Highly rated'],
  }));
}

/**
 * Get destinations by region
 */
export function getDestinationsByRegion(region: string): Destination[] {
  return destinations.filter(d => 
    d.region.toLowerCase() === region.toLowerCase()
  );
}

/**
 * Recommendation engine class for advanced usage
 */
export class RecommendationEngine {
  static async generateRecommendations(
    preferences: RecommendationParams
  ): Promise<RecommendedDestination[]> {
    // Simulate async processing
    await new Promise(resolve => setTimeout(resolve, 300));
    return getRecommendedDestinations(preferences);
  }

  static async getSimilar(destinationId: string): Promise<RecommendedDestination[]> {
    await new Promise(resolve => setTimeout(resolve, 200));
    return getSimilarDestinations(destinationId);
  }

  static async getTrending(): Promise<RecommendedDestination[]> {
    await new Promise(resolve => setTimeout(resolve, 200));
    return getTrendingDestinations();
  }
}
