/**
 * Voyance Quiz API Service
 * 
 * Integrates with Railway backend quiz endpoints:
 * - /api/v1/auth/quiz/start - Start a new quiz session
 * - /api/v1/auth/quiz/step/:stepNumber/save - Save step answers
 * - /api/v1/auth/quiz/update-progress - Update progress
 * - /api/v1/auth/quiz/session/:sessionId - Get session status
 * - /api/v1/auth/quiz/finalize - Complete the quiz
 */

import { supabase } from '@/integrations/supabase/client';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export interface QuizField {
  field_id: string;
  field_type: 'single_select' | 'multi_select' | 'slider' | 'text' | 'range';
  answer_value: string | string[] | number | Record<string, unknown>;
  display_label?: string;
  question_prompt?: string;
}

export interface QuizSession {
  id: string;
  userId: string;
  quizVersion: string;
  currentStep: number;
  percentage: number;
  questionsAnswered: number;
  isComplete: boolean;
  startedAt: string;
  completedAt?: string | null;
  responsesRecorded?: number; // Added from backend session endpoint
}

export interface QuizStartResponse {
  success: boolean;
  sessionId?: string;
  session?: QuizSession;
  resuming?: boolean;
  currentStep?: number;
  error?: string;
}

export interface QuizSaveStepResponse {
  success: boolean;
  message?: string;
  savedCount?: number;
  currentStep?: number;
  error?: string;
}

export interface QuizProgressResponse {
  success: boolean;
  message?: string;
  currentStep?: number;
  isComplete?: boolean;
  questionsAnswered?: number;
  error?: string;
}

export interface QuizSessionStatusResponse {
  success: boolean;
  session?: QuizSession & {
    responsesRecorded?: number;
  };
  exists?: boolean;
  error?: string;
  code?: string;
}

export interface QuizFinalizeResponse {
  success: boolean;
  message?: string;
  travelDNA?: {
    primaryArchetypeName: string;
    secondaryArchetypeName: string;
    confidence: number;
    rarity: string;
    breakdown: Record<string, number>;
  };
  profile?: Record<string, unknown>;
  error?: string;
}

// ============================================================================
// API Helpers
// ============================================================================

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    return {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    };
  }
  
  // Fall back to stored token
  const token = localStorage.getItem('voyance_access_token');
  if (token) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }
  
  return { 'Content-Type': 'application/json' };
}

async function quizApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = await getAuthHeader();
  
  const response = await fetch(`${BACKEND_URL}/api/v1/auth${endpoint}`, {
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
// Quiz API
// ============================================================================

/**
 * Start a new quiz session or resume existing one
 */
export async function startQuiz(quizVersion: string = '2.0'): Promise<QuizStartResponse> {
  try {
    const response = await quizApiRequest<QuizStartResponse>('/quiz/start', {
      method: 'POST',
      body: JSON.stringify({ quizVersion }),
    });
    return response;
  } catch (error) {
    console.error('[QuizAPI] Start quiz error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to start quiz',
    };
  }
}

/**
 * Save answers for a quiz step
 */
export async function saveQuizStep(
  sessionId: string,
  stepNumber: number,
  fields: QuizField[]
): Promise<QuizSaveStepResponse> {
  try {
    const response = await quizApiRequest<QuizSaveStepResponse>(`/quiz/step/${stepNumber}/save`, {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        step_number: stepNumber,
        fields,
      }),
    });
    return response;
  } catch (error) {
    console.error('[QuizAPI] Save step error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save step',
    };
  }
}

/**
 * Update quiz progress
 */
export async function updateQuizProgress(
  sessionId: string,
  currentStep: number,
  questionsAnswered?: number,
  isComplete?: boolean
): Promise<QuizProgressResponse> {
  try {
    const response = await quizApiRequest<QuizProgressResponse>('/quiz/update-progress', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        currentStep,
        questionsAnswered,
        isComplete,
      }),
    });
    return response;
  } catch (error) {
    console.error('[QuizAPI] Update progress error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update progress',
    };
  }
}

/**
 * Get quiz session status
 */
export async function getQuizSession(sessionId: string): Promise<QuizSessionStatusResponse> {
  try {
    const response = await quizApiRequest<QuizSessionStatusResponse>(`/quiz/session/${sessionId}`, {
      method: 'GET',
    });
    return response;
  } catch (error) {
    console.error('[QuizAPI] Get session error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get session',
    };
  }
}

/**
 * Finalize quiz and generate Travel DNA
 */
export async function finalizeQuiz(
  sessionId: string,
  step11Fields?: QuizField[]
): Promise<QuizFinalizeResponse> {
  try {
    const response = await quizApiRequest<QuizFinalizeResponse>('/quiz/finalize', {
      method: 'POST',
      body: JSON.stringify({
        sessionId,
        step_number: 11,
        fields: step11Fields || [],
      }),
    });
    return response;
  } catch (error) {
    console.error('[QuizAPI] Finalize quiz error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to finalize quiz',
    };
  }
}

/**
 * Get user's Travel DNA profile
 */
export async function getTravelDNA(): Promise<{
  success: boolean;
  travelDNA?: Record<string, unknown>;
  error?: string;
}> {
  try {
    const response = await quizApiRequest<{
      success: boolean;
      travelDNA?: Record<string, unknown>;
    }>('/quiz/travel-dna', {
      method: 'GET',
    });
    return response;
  } catch (error) {
    console.error('[QuizAPI] Get Travel DNA error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get Travel DNA',
    };
  }
}

// ============================================================================
// React Query Hooks
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useQuizSession(sessionId: string | null) {
  return useQuery({
    queryKey: ['quiz-session', sessionId],
    queryFn: () => sessionId ? getQuizSession(sessionId) : Promise.resolve({ success: false }),
    enabled: !!sessionId,
    staleTime: 30_000, // 30 seconds
  });
}

export function useStartQuiz() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (quizVersion?: string) => startQuiz(quizVersion),
    onSuccess: (data) => {
      if (data.success && data.sessionId) {
        queryClient.setQueryData(['quiz-session', data.sessionId], {
          success: true,
          session: data.session,
          exists: true,
        });
      }
    },
  });
}

export function useSaveQuizStep() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ sessionId, stepNumber, fields }: { 
      sessionId: string; 
      stepNumber: number; 
      fields: QuizField[] 
    }) => saveQuizStep(sessionId, stepNumber, fields),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quiz-session', variables.sessionId] });
    },
  });
}

export function useUpdateQuizProgress() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ sessionId, currentStep, questionsAnswered, isComplete }: {
      sessionId: string;
      currentStep: number;
      questionsAnswered?: number;
      isComplete?: boolean;
    }) => updateQuizProgress(sessionId, currentStep, questionsAnswered, isComplete),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quiz-session', variables.sessionId] });
    },
  });
}

export function useFinalizeQuiz() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ sessionId, fields }: { sessionId: string; fields?: QuizField[] }) => 
      finalizeQuiz(sessionId, fields),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['travel-dna'] });
      queryClient.invalidateQueries({ queryKey: ['user-preferences'] });
    },
  });
}

export function useTravelDNA() {
  return useQuery({
    queryKey: ['travel-dna'],
    queryFn: getTravelDNA,
    staleTime: 5 * 60_000, // 5 minutes
  });
}

// ============================================================================
// Local Storage Helpers (for offline/fallback)
// ============================================================================

const QUIZ_SESSION_KEY = 'voyance_quiz_session';
const QUIZ_ANSWERS_KEY = 'voyance_quiz_answers';

export function saveQuizSessionLocally(sessionId: string, currentStep: number): void {
  try {
    localStorage.setItem(QUIZ_SESSION_KEY, JSON.stringify({ sessionId, currentStep }));
  } catch {
    console.warn('[QuizAPI] Failed to save session locally');
  }
}

export function getLocalQuizSession(): { sessionId: string; currentStep: number } | null {
  try {
    const data = localStorage.getItem(QUIZ_SESSION_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function saveQuizAnswersLocally(answers: Record<string, unknown>): void {
  try {
    localStorage.setItem(QUIZ_ANSWERS_KEY, JSON.stringify(answers));
  } catch {
    console.warn('[QuizAPI] Failed to save answers locally');
  }
}

export function getLocalQuizAnswers(): Record<string, unknown> | null {
  try {
    const data = localStorage.getItem(QUIZ_ANSWERS_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function clearLocalQuizData(): void {
  try {
    localStorage.removeItem(QUIZ_SESSION_KEY);
    localStorage.removeItem(QUIZ_ANSWERS_KEY);
  } catch {
    console.warn('[QuizAPI] Failed to clear local quiz data');
  }
}

// ============================================================================
// Export
// ============================================================================

const quizAPI = {
  startQuiz,
  saveQuizStep,
  updateQuizProgress,
  getQuizSession,
  finalizeQuiz,
  getTravelDNA,
  
  // Local storage helpers
  saveQuizSessionLocally,
  getLocalQuizSession,
  saveQuizAnswersLocally,
  getLocalQuizAnswers,
  clearLocalQuizData,
};

export default quizAPI;
