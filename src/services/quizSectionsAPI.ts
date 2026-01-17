/**
 * Voyance Quiz Sections API
 * 
 * Alternative quiz flow using sections:
 * - GET /api/quiz/sections - Get user's quiz sections and progress
 * - POST /api/quiz/sections/save - Save or update a quiz section
 * - GET /api/quiz/progress - Get quiz progress summary
 * - POST /api/quiz/reset - Reset quiz for retake
 * - POST /api/quiz/complete-final - Mark quiz as fully completed
 */

import { supabase } from '@/integrations/supabase/client';

// Backend base URL
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://voyance-backend.railway.app';

// ============================================================================
// Types
// ============================================================================

export interface QuizSection {
  id?: string;
  userId: string;
  sectionName: string;
  sectionOrder: number;
  completed: boolean;
  questionsAnswered: number;
  totalQuestions: number;
  answers: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface QuizProgress {
  totalSections: number;
  completedSections: number;
  percentage: number;
  isComplete: boolean;
  sectionsStatus: Array<{
    name: string;
    completed: boolean;
    questionsAnswered: number;
  }>;
}

export interface QuizSectionsResponse {
  success: boolean;
  sections?: QuizSection[];
  progress?: QuizProgress;
  error?: string;
}

export interface SaveSectionResponse {
  success: boolean;
  section?: QuizSection;
  message?: string;
  error?: string;
}

export interface QuizProgressResponse {
  success: boolean;
  progress?: QuizProgress;
  error?: string;
}

export interface ResetQuizResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export interface CompleteQuizResponse {
  success: boolean;
  message?: string;
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
  
  const token = localStorage.getItem('voyance_access_token');
  if (token) {
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }
  
  return { 'Content-Type': 'application/json' };
}

async function apiRequest<T>(
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
// Quiz Sections API
// ============================================================================

/**
 * Get user's quiz sections and progress
 */
export async function getQuizSections(): Promise<QuizSectionsResponse> {
  try {
    const response = await apiRequest<QuizSectionsResponse>('/api/quiz/sections', {
      method: 'GET',
    });
    return response;
  } catch (error) {
    console.error('[QuizSectionsAPI] Get sections error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get sections',
    };
  }
}

/**
 * Save or update a quiz section
 */
export async function saveQuizSection(
  sectionData: Partial<QuizSection>
): Promise<SaveSectionResponse> {
  try {
    const response = await apiRequest<SaveSectionResponse>('/api/quiz/sections/save', {
      method: 'POST',
      body: JSON.stringify(sectionData),
    });
    return response;
  } catch (error) {
    console.error('[QuizSectionsAPI] Save section error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save section',
    };
  }
}

/**
 * Get quiz progress summary
 */
export async function getQuizProgress(): Promise<QuizProgressResponse> {
  try {
    const response = await apiRequest<QuizProgressResponse>('/api/quiz/progress', {
      method: 'GET',
    });
    return response;
  } catch (error) {
    console.error('[QuizSectionsAPI] Get progress error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get progress',
    };
  }
}

/**
 * Reset quiz for retake
 */
export async function resetQuiz(): Promise<ResetQuizResponse> {
  try {
    const response = await apiRequest<ResetQuizResponse>('/api/quiz/reset', {
      method: 'POST',
    });
    return response;
  } catch (error) {
    console.error('[QuizSectionsAPI] Reset quiz error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to reset quiz',
    };
  }
}

/**
 * Mark quiz as fully completed
 */
export async function completeQuizFinal(): Promise<CompleteQuizResponse> {
  try {
    const response = await apiRequest<CompleteQuizResponse>('/api/quiz/complete-final', {
      method: 'POST',
    });
    return response;
  } catch (error) {
    console.error('[QuizSectionsAPI] Complete quiz error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to complete quiz',
    };
  }
}

// ============================================================================
// React Query Hooks
// ============================================================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export function useQuizSections() {
  return useQuery({
    queryKey: ['quiz-sections'],
    queryFn: getQuizSections,
    staleTime: 30_000,
  });
}

export function useQuizProgress() {
  return useQuery({
    queryKey: ['quiz-progress'],
    queryFn: getQuizProgress,
    staleTime: 30_000,
  });
}

export function useSaveQuizSection() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (sectionData: Partial<QuizSection>) => saveQuizSection(sectionData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-sections'] });
      queryClient.invalidateQueries({ queryKey: ['quiz-progress'] });
    },
  });
}

export function useResetQuiz() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: resetQuiz,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-sections'] });
      queryClient.invalidateQueries({ queryKey: ['quiz-progress'] });
      queryClient.invalidateQueries({ queryKey: ['quiz-session'] });
    },
  });
}

export function useCompleteQuizFinal() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: completeQuizFinal,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quiz-sections'] });
      queryClient.invalidateQueries({ queryKey: ['quiz-progress'] });
      queryClient.invalidateQueries({ queryKey: ['travel-dna'] });
    },
  });
}

// ============================================================================
// Export
// ============================================================================

const quizSectionsAPI = {
  getQuizSections,
  saveQuizSection,
  getQuizProgress,
  resetQuiz,
  completeQuizFinal,
};

export default quizSectionsAPI;
