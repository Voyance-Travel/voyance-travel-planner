/**
 * Voyance Quiz Extended API Service
 * 
 * Additional quiz endpoints not in main quizAPI:
 * - POST /quiz/complete-frontend - Frontend-compatible quiz completion
 * - POST /quiz/finalize - Finalize quiz and generate Travel DNA
 * - POST /quiz-finalize/finalize-profile-simple - Simple finalize endpoint
 * - GET /quiz-diagnostic/status - Quiz data status check
 * - POST /quiz-diagnostic/echo - Echo quiz data for debugging
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export interface TravelDNAAnswers {
  // Primary goals and motivations
  primary_goal?: string;
  travel_motivation?: string;
  experience_priority?: string;

  // Trip structure and planning
  trip_structure_preference?: string;
  planning_style?: string;
  flexibility_preference?: string;

  // Budget and spending
  budget_range?: string;
  spending_priority?: string;
  value_focus?: string;

  // Activities and interests
  activity_level?: string;
  adventure_comfort?: string;
  cultural_interest?: string;
  nature_preference?: string;

  // Accommodation and travel style
  accommodation_style?: string;
  travel_pace?: string;
  group_vs_solo?: string;

  // Climate and environment
  climate_preference?: string[];
  weather_flexibility?: string;

  // Dietary and lifestyle
  dietary_requirements?: string[];
  mobility_considerations?: string;

  // Additional preferences
  language_comfort?: string;
  technology_reliance?: string;
  sustainability_importance?: string;

  // Legacy field support
  tripLength?: string;
  tripDuration?: string;

  // Allow additional fields
  [key: string]: unknown;
}

export interface QuizCompleteFrontendResponse {
  success: boolean;
  message?: string;
  travelDNA?: {
    type: string;
    description: string;
    score: number;
    traits: Record<string, number>;
    generatedAt: string;
    userId: string;
  };
  simpleDNA?: Record<string, unknown>;
  preferences?: Record<string, unknown>;
  user?: {
    id: string;
    quizCompleted: boolean;
  };
  error?: string;
  code?: string;
}

export interface QuizFinalizeRequest {
  sessionId?: string;
}

export interface QuizFinalizeResponse {
  success: boolean;
  dnaArchetype?: string;
  sessionCompleted?: boolean;
  quizCompletedAt?: string;
  data?: {
    archetype: {
      primary: string;
      secondary?: string;
      tagline: string;
      traits: string[];
    };
    traitScores: Record<string, number>;
    confidence: number;
    rarity: string;
    emotionalDrivers: string[];
    profileCompletion: {
      overall: number;
      missingFields: string[];
    };
  };
  userUpdate?: {
    quizCompleted: boolean;
    travelDNAProfileType: string;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface QuizDiagnosticStatus {
  user: {
    id: string;
    email?: string;
  };
  preferences: {
    exists: boolean;
    id?: string;
    travelStyle?: string;
    budget?: string;
    isCustomized: boolean;
    lastUpdated?: string;
  };
  status: {
    hasProfile: boolean;
    hasQuizData: boolean;
    dataAge: string;
  };
}

export interface SimpleQuizFinalizeResponse {
  success: boolean;
  message?: string;
  data?: {
    profileUnlocked: boolean;
    quizCompleted: boolean;
  };
}

// ============================================================================
// API Helpers
// ============================================================================

async function getAuthHeader(): Promise<Record<string, string>> {
  const token = localStorage.getItem('voyance_access_token');
  if (token) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }
  return { 'Content-Type': 'application/json' };
}

async function quizExtendedApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    ...options,
    headers: {
      ...headers,
      ...options.headers,
    },
    credentials: 'include',
  });
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || errorData.message || `HTTP ${response.status}`);
  }
  
  return response.json();
}

// ============================================================================
// Quiz Extended API
// ============================================================================

/**
 * Complete quiz using frontend-compatible format
 */
export async function completeQuizFrontend(
  answers: TravelDNAAnswers
): Promise<QuizCompleteFrontendResponse> {
  try {
    const response = await quizExtendedApiRequest<QuizCompleteFrontendResponse>(
      '/api/v1/auth/quiz/complete-frontend',
      {
        method: 'POST',
        body: JSON.stringify(answers),
      }
    );
    return response;
  } catch (error) {
    console.error('[QuizExtendedAPI] Complete quiz frontend error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to complete quiz',
      code: 'COMPLETION_ERROR',
    };
  }
}

/**
 * Finalize quiz and generate full Travel DNA profile
 */
export async function finalizeQuizProfile(
  request?: QuizFinalizeRequest
): Promise<QuizFinalizeResponse> {
  try {
    const response = await quizExtendedApiRequest<QuizFinalizeResponse>(
      '/api/v1/auth/quiz-finalize/finalize',
      {
        method: 'POST',
        body: JSON.stringify(request || {}),
      }
    );
    return response;
  } catch (error) {
    console.error('[QuizExtendedAPI] Finalize quiz error:', error);
    return {
      success: false,
      error: {
        code: 'FINALIZE_ERROR',
        message: error instanceof Error ? error.message : 'Failed to finalize quiz',
      },
    };
  }
}

/**
 * Simple quiz finalize (for loading/revealing page)
 */
export async function finalizeQuizSimple(): Promise<SimpleQuizFinalizeResponse> {
  try {
    const response = await quizExtendedApiRequest<SimpleQuizFinalizeResponse>(
      '/api/v1/auth/quiz-finalize/finalize-profile-simple',
      {
        method: 'POST',
        body: JSON.stringify({}),
      }
    );
    return response;
  } catch (error) {
    console.error('[QuizExtendedAPI] Simple finalize error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to finalize',
    };
  }
}

/**
 * Get quiz diagnostic status
 */
export async function getQuizDiagnosticStatus(): Promise<QuizDiagnosticStatus | null> {
  try {
    const response = await quizExtendedApiRequest<QuizDiagnosticStatus>(
      '/api/v1/auth/quiz-diagnostic/status'
    );
    return response;
  } catch (error) {
    console.error('[QuizExtendedAPI] Get diagnostic status error:', error);
    return null;
  }
}

/**
 * Echo quiz data for debugging
 */
export async function echoQuizData(data: Record<string, unknown>): Promise<Record<string, unknown>> {
  try {
    const response = await quizExtendedApiRequest<Record<string, unknown>>(
      '/api/v1/auth/quiz-diagnostic/echo',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
    return response;
  } catch (error) {
    console.error('[QuizExtendedAPI] Echo quiz data error:', error);
    throw error;
  }
}

// ============================================================================
// React Query Hooks
// ============================================================================

const quizExtendedKeys = {
  all: ['quiz-extended'] as const,
  diagnostic: () => [...quizExtendedKeys.all, 'diagnostic'] as const,
};

export function useQuizDiagnosticStatus() {
  return useQuery({
    queryKey: quizExtendedKeys.diagnostic(),
    queryFn: getQuizDiagnosticStatus,
    staleTime: 30_000, // 30 seconds
  });
}

export function useCompleteQuizFrontend() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: completeQuizFrontend,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['travel-dna'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

export function useFinalizeQuizProfile() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: finalizeQuizProfile,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['travel-dna'] });
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
    },
  });
}

export function useFinalizeQuizSimple() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: finalizeQuizSimple,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
}

// Default export
export default {
  completeQuizFrontend,
  finalizeQuizProfile,
  finalizeQuizSimple,
  getQuizDiagnosticStatus,
  echoQuizData,
};
