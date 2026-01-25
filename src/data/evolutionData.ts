/**
 * Travel DNA Evolution & Maturity System
 * 
 * Defines the progression stages for travelers and the indicators
 * that signal readiness to advance to the next level.
 */

export type TravelerStage = 'Novice' | 'Experienced' | 'Expert' | 'Master Traveler';

export interface StageDefinition {
  id: TravelerStage;
  name: string;
  tagline: string;
  description: string;
  keyMilestones: string[];
  indicatorCount: number; // How many "trips" or experiences to unlock
}

export interface MaturityIndicator {
  label: string;
  description: string;
  icon: 'check' | 'star' | 'globe' | 'compass' | 'map' | 'heart' | 'lightbulb' | 'trophy';
}

export interface EvolutionPath {
  currentStage: TravelerStage;
  nextStage: TravelerStage;
  progressPercent: number;
  maturityIndicators: MaturityIndicator[];
  growthAreas: string[];
  unlockHint: string;
}

/**
 * The 4 stages of travel evolution
 */
export const TRAVELER_STAGES: Record<TravelerStage, StageDefinition> = {
  Novice: {
    id: 'Novice',
    name: 'The Novice',
    tagline: 'Every journey begins with a single step',
    description: 'You\'re at the beginning of your travel journey, discovering what kind of traveler you are. Each trip teaches you something new about yourself and the world.',
    keyMilestones: [
      'Taken your first solo or independent trip',
      'Navigated a foreign transit system',
      'Tried food you couldn\'t pronounce',
      'Made a friend on the road'
    ],
    indicatorCount: 0
  },
  Experienced: {
    id: 'Experienced',
    name: 'The Experienced',
    tagline: 'You\'ve found your travel rhythm',
    description: 'Travel has become second nature. You\'ve developed personal preferences, trusted routines, and the confidence to handle the unexpected.',
    keyMilestones: [
      'Comfortable navigating language barriers',
      'Able to adapt plans on the fly',
      'Developed a personal travel style',
      'Built a network of places you\'d return to'
    ],
    indicatorCount: 5
  },
  Expert: {
    id: 'Expert',
    name: 'The Expert',
    tagline: 'Travel is an art you\'ve mastered',
    description: 'You don\'t just travel, you curate experiences. Others seek your advice, and you\'ve learned that the best trips often come from the unexpected.',
    keyMilestones: [
      'Seeks transformative over transactional experiences',
      'Mentors other travelers naturally',
      'Creates unique itineraries off typical routes',
      'Has "home" destinations across the globe'
    ],
    indicatorCount: 15
  },
  'Master Traveler': {
    id: 'Master Traveler',
    name: 'The Master Traveler',
    tagline: 'The world is home',
    description: 'Travel isn\'t something you do—it\'s who you are. You\'ve transcended tourism to become a true citizen of the world, giving back as much as you receive.',
    keyMilestones: [
      'Travel has become a way of life, not escape',
      'Deep understanding of global interconnectedness',
      'Gives back to destinations visited',
      'Inspires others through your journeys'
    ],
    indicatorCount: 30
  }
};

/**
 * Category-specific evolution traits and growth areas
 */
export const CATEGORY_EVOLUTION: Record<string, {
  growthAreas: string[];
  maturityIndicators: MaturityIndicator[];
  evolutionTip: string;
}> = {
  EXPLORER: {
    growthAreas: [
      'Deepen cultural immersion beyond surface experiences',
      'Learn conversational phrases in more languages',
      'Build lasting relationships in destinations you love',
      'Document and share your discoveries meaningfully'
    ],
    maturityIndicators: [
      { label: 'Speaks multiple travel phrases', description: 'Can navigate basics in 3+ languages', icon: 'globe' },
      { label: 'Off-map discoveries', description: 'Finds gems not in any guidebook', icon: 'compass' },
      { label: 'Return visitor status', description: 'Has deep knowledge of favorite destinations', icon: 'heart' },
      { label: 'Local network builder', description: 'Maintains friendships across borders', icon: 'star' }
    ],
    evolutionTip: 'Your curiosity is your compass—follow it deeper, not just wider.'
  },
  CONNECTOR: {
    growthAreas: [
      'Create traditions around your shared travels',
      'Balance group energy with personal reflection',
      'Document the stories behind the connections',
      'Organize reunion trips with travel friends'
    ],
    maturityIndicators: [
      { label: 'Community creator', description: 'Has organized group trips successfully', icon: 'heart' },
      { label: 'Story keeper', description: 'Documents shared memories meaningfully', icon: 'lightbulb' },
      { label: 'Bridge builder', description: 'Connects travelers from different trips', icon: 'globe' },
      { label: 'Tradition maker', description: 'Has recurring travel rituals with loved ones', icon: 'star' }
    ],
    evolutionTip: 'The connections you make are the real destinations.'
  },
  ACHIEVER: {
    growthAreas: [
      'Balance bucket list with spontaneous discoveries',
      'Find meaning in the journey, not just the destination',
      'Revisit favorites with fresh eyes',
      'Mentor others on their travel goals'
    ],
    maturityIndicators: [
      { label: 'Goal crusher', description: 'Has achieved significant travel milestones', icon: 'trophy' },
      { label: 'Strategic planner', description: 'Maximizes every trip efficiently', icon: 'map' },
      { label: 'Experience collector', description: 'Has a diverse portfolio of adventures', icon: 'star' },
      { label: 'Travel mentor', description: 'Helps others plan their dream trips', icon: 'lightbulb' }
    ],
    evolutionTip: 'The best achievements are the ones that change you.'
  },
  RESTORER: {
    growthAreas: [
      'Discover restoration in unexpected places',
      'Build a global network of sanctuary spots',
      'Share wellness practices learned abroad',
      'Find peace in adventure, not just stillness'
    ],
    maturityIndicators: [
      { label: 'Sanctuary finder', description: 'Knows where to recharge in any region', icon: 'heart' },
      { label: 'Wellness warrior', description: 'Has integrated global practices at home', icon: 'star' },
      { label: 'Balanced being', description: 'Finds rest in both stillness and motion', icon: 'compass' },
      { label: 'Peaceful presence', description: 'Brings calm energy to any travel situation', icon: 'lightbulb' }
    ],
    evolutionTip: 'True restoration comes from knowing yourself, anywhere.'
  },
  CURATOR: {
    growthAreas: [
      'Find excellence in unexpected places',
      'Balance curation with spontaneous discovery',
      'Share your refined taste through recommendations',
      'Recognize quality in simplicity'
    ],
    maturityIndicators: [
      { label: 'Quality connoisseur', description: 'Spots excellence instinctively', icon: 'star' },
      { label: 'Taste maker', description: 'Friends seek your recommendations', icon: 'trophy' },
      { label: 'Detail master', description: 'Notices what others miss', icon: 'lightbulb' },
      { label: 'Experience architect', description: 'Creates flawless journeys', icon: 'map' }
    ],
    evolutionTip: 'The highest curation includes the art of happy accidents.'
  },
  TRANSFORMER: {
    growthAreas: [
      'Integrate travel insights into daily life',
      'Share your transformation to inspire others',
      'Find growth in comfort, not just challenge',
      'Build on each journey\'s lessons'
    ],
    maturityIndicators: [
      { label: 'Life changer', description: 'Travel has fundamentally shifted your path', icon: 'compass' },
      { label: 'Wisdom gatherer', description: 'Carries lessons from every journey', icon: 'lightbulb' },
      { label: 'Inspirer', description: 'Your stories encourage others to grow', icon: 'heart' },
      { label: 'Continuous learner', description: 'Every trip adds to your evolution', icon: 'star' }
    ],
    evolutionTip: 'The greatest transformation is becoming comfortable in your own skin, anywhere.'
  }
};

/**
 * Calculate evolution path based on user data
 */
export function calculateEvolutionPath(
  tripCount: number,
  category: string,
  preferences?: {
    travelFrequency?: string;
    hasOverrides?: boolean;
    quizCompleted?: boolean;
  }
): EvolutionPath {
  // Determine current stage based on trip count + other factors
  let experienceScore = tripCount;
  
  if (preferences?.travelFrequency === 'monthly') experienceScore += 5;
  else if (preferences?.travelFrequency === 'quarterly') experienceScore += 3;
  else if (preferences?.travelFrequency === 'yearly') experienceScore += 1;
  
  if (preferences?.hasOverrides) experienceScore += 2; // Shows engagement
  if (preferences?.quizCompleted) experienceScore += 1;
  
  // Determine stage
  let currentStage: TravelerStage;
  let nextStage: TravelerStage;
  let progressPercent: number;
  
  if (experienceScore >= 30) {
    currentStage = 'Master Traveler';
    nextStage = 'Master Traveler';
    progressPercent = 100;
  } else if (experienceScore >= 15) {
    currentStage = 'Expert';
    nextStage = 'Master Traveler';
    progressPercent = Math.min(100, ((experienceScore - 15) / 15) * 100);
  } else if (experienceScore >= 5) {
    currentStage = 'Experienced';
    nextStage = 'Expert';
    progressPercent = Math.min(100, ((experienceScore - 5) / 10) * 100);
  } else {
    currentStage = 'Novice';
    nextStage = 'Experienced';
    progressPercent = Math.min(100, (experienceScore / 5) * 100);
  }
  
  // Get category-specific evolution data
  const categoryEvolution = CATEGORY_EVOLUTION[category] || CATEGORY_EVOLUTION.EXPLORER;
  
  // Determine unlock hint based on next stage
  let unlockHint = '';
  switch (nextStage) {
    case 'Experienced':
      unlockHint = 'Complete more trips and explore different travel styles to unlock.';
      break;
    case 'Expert':
      unlockHint = 'Deepen your expertise by returning to favorites and mentoring others.';
      break;
    case 'Master Traveler':
      unlockHint = 'Give back to destinations and inspire others with your journey.';
      break;
    default:
      unlockHint = 'You\'ve reached the pinnacle—now inspire the next generation.';
  }
  
  return {
    currentStage,
    nextStage,
    progressPercent,
    maturityIndicators: categoryEvolution.maturityIndicators,
    growthAreas: categoryEvolution.growthAreas,
    unlockHint
  };
}

/**
 * Get stage-appropriate milestones that are unlocked
 */
export function getUnlockedMilestones(stage: TravelerStage): string[] {
  const stages: TravelerStage[] = ['Novice', 'Experienced', 'Expert', 'Master Traveler'];
  const stageIndex = stages.indexOf(stage);
  
  const unlocked: string[] = [];
  for (let i = 0; i <= stageIndex; i++) {
    unlocked.push(...TRAVELER_STAGES[stages[i]].keyMilestones);
  }
  
  return unlocked;
}

/**
 * Get the next milestones to work toward
 */
export function getNextMilestones(stage: TravelerStage): string[] {
  const stages: TravelerStage[] = ['Novice', 'Experienced', 'Expert', 'Master Traveler'];
  const stageIndex = stages.indexOf(stage);
  
  if (stageIndex >= stages.length - 1) {
    return ['Continue inspiring others with your journey'];
  }
  
  return TRAVELER_STAGES[stages[stageIndex + 1]].keyMilestones;
}
