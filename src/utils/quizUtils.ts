/**
 * Storage keys for quiz data
 */
export const STORAGE_KEYS = {
  QUIZ_PROGRESS: 'voyance_quiz_progress',
  QUIZ_RESPONSES: 'voyance_quiz_responses',
  QUIZ_COMPLETED: 'voyance_quiz_completed',
  USER_PREFERENCES: 'voyance_user_preferences'
} as const;

/**
 * User preferences type
 */
export interface UserPreferences {
  // Display fields
  style: string;
  budget: string;
  pace: string;
  tags: string[];
  vibe: string;
  climate: string;
  activities: string[];
  
  // Additional fields
  travelStyle?: string;
  budgetTier?: string;
  interests?: string[];
  climatePreferences?: string[];
  homeAirport?: string;
  preferredRegions?: string[];
  tripDuration?: string;
  travelFrequency?: string;
  mobilityLevel?: string;
}

/**
 * Quiz data type
 */
export interface QuizData {
  travelStyle?: string;
  budgetTier?: string;
  travelPace?: string;
  interests?: Record<string, number | string>;
  climatePreferences?: string[];
  homeAirport?: string;
  preferredRegions?: string[];
  tripDuration?: string;
  travelFrequency?: string;
  primaryGoal?: string;
  mobilityLevel?: string;
}

/**
 * Maps quiz responses to user preferences
 */
export function mapQuizToPreferences(quizData: QuizData): UserPreferences {
  // Map travel style
  const travelStyleMap: Record<string, string> = {
    'relaxed': 'Relaxed Explorer',
    'active': 'Active Adventurer',
    'cultural': 'Cultural Enthusiast',
    'mixed': 'Balanced Traveler'
  };
  const style = travelStyleMap[quizData.travelStyle || ''] || 'Balanced Traveler';

  // Map budget
  const budgetMap: Record<string, string> = {
    'budget': '$',
    'moderate': '$$',
    'premium': '$$$',
    'luxury': '$$$$'
  };
  const budget = budgetMap[quizData.budgetTier || ''] || '$$';

  // Map pace
  const paceMap: Record<string, string> = {
    'slow': 'Leisurely',
    'moderate': 'Moderate',
    'fast': 'Packed'
  };
  const pace = paceMap[quizData.travelPace || ''] || 'Moderate';

  // Extract tags from interests
  const tags: string[] = [];
  if (quizData.travelStyle) tags.push(quizData.travelStyle);
  if (quizData.primaryGoal) tags.push(quizData.primaryGoal);
  if (quizData.interests) {
    Object.entries(quizData.interests).forEach(([key, value]) => {
      if (
        (typeof value === 'number' && value >= 3) || 
        (typeof value === 'string' && ['interested', 'veryInterested', 'mustHave'].includes(value))
      ) {
        tags.push(key);
      }
    });
  }

  // Map vibe from goals
  const vibe = quizData.primaryGoal === 'escape' ? 'Relaxing' :
               quizData.primaryGoal === 'explore' ? 'Adventurous' :
               quizData.primaryGoal === 'celebrate' ? 'Celebratory' :
               'Balanced';

  // Climate preferences
  const climate = quizData.climatePreferences?.[0] || 'Moderate';

  // Extract activities from interests
  const activities: string[] = [];
  if (quizData.interests) {
    Object.entries(quizData.interests).forEach(([key, value]) => {
      if (
        (typeof value === 'number' && value >= 3) || 
        (typeof value === 'string' && ['interested', 'veryInterested', 'mustHave'].includes(value))
      ) {
        activities.push(key);
      }
    });
  }

  return {
    style,
    budget,
    pace,
    tags,
    vibe,
    climate,
    activities,
    travelStyle: quizData.travelStyle,
    budgetTier: quizData.budgetTier,
    interests: tags,
    climatePreferences: quizData.climatePreferences,
    homeAirport: quizData.homeAirport,
    preferredRegions: quizData.preferredRegions,
    tripDuration: quizData.tripDuration,
    travelFrequency: quizData.travelFrequency,
    mobilityLevel: quizData.mobilityLevel,
  };
}

/**
 * Check if quiz is complete
 */
export function isQuizComplete(quizData: QuizData): boolean {
  const requiredFields = [
    'travelStyle',
    'budgetTier',
    'travelPace',
    'interests',
    'climatePreferences'
  ];
  
  return requiredFields.every(field => {
    const value = quizData[field as keyof QuizData];
    return value !== undefined && value !== null;
  });
}

/**
 * Calculate quiz progress percentage
 */
export function calculateQuizProgress(quizData: QuizData): number {
  const totalFields = 10;
  let completedFields = 0;
  
  const fields: (keyof QuizData)[] = [
    'travelStyle', 'budgetTier', 'travelPace', 'interests',
    'climatePreferences', 'homeAirport', 'preferredRegions',
    'tripDuration', 'travelFrequency', 'primaryGoal'
  ];
  
  fields.forEach(field => {
    if (quizData[field]) {
      completedFields++;
    }
  });
  
  return Math.round((completedFields / totalFields) * 100);
}

/**
 * Save quiz progress to localStorage
 */
export function saveQuizProgress(step: number, data: QuizData): void {
  try {
    localStorage.setItem(STORAGE_KEYS.QUIZ_PROGRESS, String(step));
    localStorage.setItem(STORAGE_KEYS.QUIZ_RESPONSES, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to save quiz progress:', error);
  }
}

/**
 * Load quiz progress from localStorage
 */
export function loadQuizProgress(): { step: number; data: QuizData } | null {
  try {
    const step = localStorage.getItem(STORAGE_KEYS.QUIZ_PROGRESS);
    const data = localStorage.getItem(STORAGE_KEYS.QUIZ_RESPONSES);
    
    if (step && data) {
      return {
        step: parseInt(step, 10),
        data: JSON.parse(data)
      };
    }
  } catch (error) {
    console.error('Failed to load quiz progress:', error);
  }
  return null;
}

/**
 * Clear quiz progress from localStorage
 */
export function clearQuizProgress(): void {
  try {
    localStorage.removeItem(STORAGE_KEYS.QUIZ_PROGRESS);
    localStorage.removeItem(STORAGE_KEYS.QUIZ_RESPONSES);
  } catch (error) {
    console.error('Failed to clear quiz progress:', error);
  }
}
