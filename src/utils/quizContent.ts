/**
 * Quiz Content Labels and Display Data
 * Centralized content for travel preference quiz
 */

// Traveler type labels
export const travelerTypeLabels = {
  explorer: {
    title: 'Explorer',
    icon: '🎒',
    description: 'You seek authentic experiences and off-the-beaten-path adventures',
  },
  escapeArtist: {
    title: 'Escape Artist',
    icon: '🧘‍♀️',
    description: 'You travel to disconnect, recharge, and find peace',
  },
  curatedLuxe: {
    title: 'Curated Luxe',
    icon: '🍷',
    description: 'You appreciate refined experiences and premium accommodations',
  },
  storySeeker: {
    title: 'Story Seeker',
    icon: '📸',
    description: 'You collect memorable moments and cultural experiences',
  },
};

// Travel vibe labels
export const travelVibeLabels = {
  coastal: {
    title: 'Coastal',
    icon: '🏝️',
    description: 'Beach, ocean, and seaside experiences',
  },
  urban: {
    title: 'Urban',
    icon: '🏙️',
    description: 'City exploration, architecture, and metropolitan energy',
  },
  mountain: {
    title: 'Mountain',
    icon: '⛰️',
    description: 'Alpine views, hiking, and natural grandeur',
  },
  quiet: {
    title: 'Quiet',
    icon: '🧘',
    description: 'Peaceful settings and relaxing atmospheres',
  },
  bold: {
    title: 'Bold',
    icon: '🚀',
    description: 'Adventurous, unique, and extraordinary experiences',
  },
  spiritual: {
    title: 'Spiritual',
    icon: '✨',
    description: 'Mindful travel with cultural or spiritual significance',
  },
};

// Trip frequency labels
export const tripFrequencyLabels = {
  monthly: { title: 'Monthly', description: 'Multiple trips per year' },
  quarterly: { title: 'Quarterly', description: '3-4 times per year' },
  biAnnually: { title: 'Bi-Annually', description: 'Twice per year' },
  annually: { title: 'Annually', description: 'Once per year' },
  lessOften: { title: 'Less Often', description: 'Every few years' },
};

// Trip length labels
export const tripLengthLabels = {
  weekend: { title: 'Weekend Getaway', description: '2-3 days' },
  shortWeek: { title: 'Short Week', description: '4-5 days' },
  week: { title: 'A Week', description: '6-8 days' },
  twoWeeks: { title: 'Two Weeks', description: '10-14 days' },
  month: { title: 'A Month', description: '3-4 weeks' },
  longer: { title: 'Extended Journey', description: 'A month or longer' },
};

// Budget labels
export const budgetLabels = {
  budget: {
    title: 'Budget-Friendly',
    icon: '$',
    description: 'Economical options without sacrificing experience',
  },
  moderate: {
    title: 'Moderate',
    icon: '$$',
    description: 'Quality experiences at reasonable prices',
  },
  premium: {
    title: 'Premium',
    icon: '$$$',
    description: 'Higher-end with some luxury elements',
  },
  luxury: {
    title: 'Luxury',
    icon: '$$$$',
    description: 'Top-tier accommodations and premium experiences',
  },
};

// Travel pace labels
export const travelPaceLabels = {
  relaxed: {
    title: 'Relaxed',
    icon: '🧘',
    description: '1-2 activities per day with plenty of downtime',
  },
  balanced: {
    title: 'Balanced',
    icon: '⚖️',
    description: '3-4 activities per day with breaks',
  },
  active: {
    title: 'Active',
    icon: '🏃',
    description: '5+ activities per day, maximizing experiences',
  },
};

// Travel companion labels
export const travelCompanionLabels = {
  solo: { title: 'Solo', icon: '🧳', description: 'Traveling on your own' },
  partner: { title: 'Partner', icon: '👫', description: 'Traveling with a significant other' },
  family: { title: 'Family', icon: '👨‍👩‍👧‍👦', description: 'Traveling with family members' },
  friends: { title: 'Friends', icon: '👯', description: 'Traveling with friends' },
  group: { title: 'Group', icon: '👥', description: 'Traveling with a larger group' },
};

// Activity level labels
export const activityLevelLabels = {
  minimal: { title: 'Minimal', description: 'Very little physical activity' },
  light: { title: 'Light', description: 'Short walks and casual activities' },
  moderate: { title: 'Moderate', description: 'Some walking tours and outdoor activities' },
  active: { title: 'Active', description: 'Hiking, biking, and regular physical activity' },
  intense: { title: 'Intense', description: 'Challenging activities and adventure sports' },
};

// Seat preference labels
export const seatPreferenceLabels = {
  window: { title: 'Window', icon: '🪟', description: 'Enjoy the view and a place to rest' },
  aisle: { title: 'Aisle', icon: '🚶', description: 'Easy access to move around' },
  noPreference: { title: 'No Preference', icon: '✈️', description: 'Either works fine' },
};

// Flight time preference labels
export const flightTimePreferenceLabels = {
  morning: { title: 'Morning', icon: '🌅', description: 'Early departures (5am-10am)' },
  afternoon: { title: 'Afternoon', icon: '☀️', description: 'Midday flights (11am-3pm)' },
  evening: { title: 'Evening', icon: '🌆', description: 'Evening departures (4pm-8pm)' },
  overnight: { title: 'Overnight', icon: '🌙', description: 'Red-eye flights (9pm-4am)' },
  noPreference: { title: 'No Preference', icon: '🕓', description: 'Any time works' },
};

// Interest category labels
export const interestLabels = {
  culture: { title: 'Culture & History', icon: '🏛️', description: 'Museums, monuments, and heritage sites' },
  food: { title: 'Food & Dining', icon: '🍽️', description: 'Local cuisine and culinary experiences' },
  nature: { title: 'Nature & Outdoors', icon: '🌿', description: 'Parks, wildlife, and natural beauty' },
  adventure: { title: 'Adventure', icon: '🧗', description: 'Active excursions and thrilling activities' },
  wellness: { title: 'Wellness & Relaxation', icon: '🧘', description: 'Spas, retreats, and mindfulness' },
  nightlife: { title: 'Nightlife', icon: '🌙', description: 'Bars, clubs, and evening entertainment' },
  shopping: { title: 'Shopping', icon: '🛍️', description: 'Markets, boutiques, and local crafts' },
  art: { title: 'Art & Architecture', icon: '🎨', description: 'Galleries, design, and creative spaces' },
};

/**
 * Get label data for a specific preference type
 */
export function getPreferenceLabel<T extends Record<string, { title: string; description: string }>>(
  labels: T,
  key: keyof T
): { title: string; description: string } | null {
  return labels[key] || null;
}

/**
 * Get all options for a preference category as an array
 */
export function getOptionsArray<T extends Record<string, { title: string; description: string }>>(
  labels: T
): Array<{ key: string; title: string; description: string; icon?: string }> {
  return Object.entries(labels).map(([key, value]) => ({
    key,
    ...value,
    icon: 'icon' in value ? (value as { icon: string }).icon : undefined,
  }));
}
