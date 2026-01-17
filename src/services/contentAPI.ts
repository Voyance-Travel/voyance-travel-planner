/**
 * Voyance Content API
 * 
 * Static content endpoints:
 * - GET /api/v1/image/home-hero - Get home hero image URL
 * - GET /api/v1/featureCards - Get feature cards data
 */

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export interface HomeHeroResponse {
  url: string;
}

export interface FeatureCard {
  title: string;
  description: string;
  icon?: string;
  image?: string;
}

export interface FeatureCardsResponse {
  cards: FeatureCard[];
}

// ============================================================================
// Content API
// ============================================================================

/**
 * Get home hero image URL
 */
export async function getHomeHeroImage(): Promise<HomeHeroResponse> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/image/home-hero`, {
      method: 'GET',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('[ContentAPI] Get home hero error:', error);
    // Return default fallback
    return { url: '/images/hero-travel-scene.jpg' };
  }
}

/**
 * Get feature cards data
 */
export async function getFeatureCards(): Promise<FeatureCardsResponse> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/featureCards`, {
      method: 'GET',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('[ContentAPI] Get feature cards error:', error);
    // Return default fallback
    return {
      cards: [
        { title: 'Card 1', description: 'Description for card 1' },
        { title: 'Card 2', description: 'Description for card 2' },
        { title: 'Card 3', description: 'Description for card 3' },
      ],
    };
  }
}

// ============================================================================
// How It Works API
// ============================================================================

export interface HowItWorksStep {
  headline: string;
  subtext: string;
  image: string;
}

export interface HowItWorksResponse {
  steps: HowItWorksStep[];
}

/**
 * Get how it works steps data
 */
export async function getHowItWorks(): Promise<HowItWorksResponse> {
  try {
    const response = await fetch(`${BACKEND_URL}/api/v1/howItWorks`, {
      method: 'GET',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('[ContentAPI] Get how it works error:', error);
    // Return default fallback
    return {
      steps: [
        { headline: 'Step 1', subtext: 'Description for step 1', image: '/images/step1.jpg' },
        { headline: 'Step 2', subtext: 'Description for step 2', image: '/images/step2.jpg' },
        { headline: 'Step 3', subtext: 'Description for step 3', image: '/images/step3.jpg' },
      ],
    };
  }
}

// ============================================================================
// React Query Hooks
// ============================================================================

import { useQuery } from '@tanstack/react-query';

export function useHomeHeroImage() {
  return useQuery({
    queryKey: ['home-hero-image'],
    queryFn: getHomeHeroImage,
    staleTime: Infinity, // Static content doesn't change
  });
}

export function useFeatureCards() {
  return useQuery({
    queryKey: ['feature-cards'],
    queryFn: getFeatureCards,
    staleTime: Infinity, // Static content doesn't change
  });
}

export function useHowItWorks() {
  return useQuery({
    queryKey: ['how-it-works'],
    queryFn: getHowItWorks,
    staleTime: Infinity, // Static content doesn't change
  });
}

// ============================================================================
// Export
// ============================================================================

const contentAPI = {
  getHomeHeroImage,
  getFeatureCards,
  getHowItWorks,
};

export default contentAPI;
