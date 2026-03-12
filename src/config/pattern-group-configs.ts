// Schema-Driven Generation — DNA Pattern Group Configurations
// Part of the isolated schema generation system (Fix 22A-E)
// This file has ZERO dependencies on existing generation code.

import type { PatternGroupConfig } from '@/types/schema-generation';

export const PACKED_CONFIG: PatternGroupConfig = {
  groupName: 'packed',
  displayName: 'Every hour counts',
  activitySlots: { min: 5, max: 7 },
  eveningSlots: { min: 1, max: 2 },
  dayStartTime: '07:30',
  dayEndTime: '22:30',
  mealWeight: 'fuel',
  mealInstruction: 'Find a quick, well-rated spot nearby. Nothing fancy — fuel for the day. The traveler wants to eat fast and get back to exploring.',
  bufferMinutes: 15,
  unscheduledBlocks: 0,
  hotelPriority: 'deferred',
  breakfastRequired: false,
  mealDuration: { min: 30, max: 60 },
  specialInstructions: [
    'This traveler wants to maximize every hour. Pack the schedule tight.',
    'On arrival day: skip hotel check-in if possible — drop bags and go to the first activity. Hotel comes later.',
    'Short transitions — activities should be geographically clustered to minimize travel time.',
    'Quick meals only — no sit-down restaurants unless the traveler specifically requested one.',
  ],
};

export const SOCIAL_CONFIG: PatternGroupConfig = {
  groupName: 'social',
  displayName: 'Light day, big night',
  activitySlots: { min: 3, max: 5 },
  eveningSlots: { min: 2, max: 3 },
  dayStartTime: '10:00',
  dayEndTime: '02:00',
  mealWeight: 'standard',
  mealInstruction: 'Find a social, buzzy spot — communal tables, groups welcome, local vibe. This traveler eats to socialize, not just to fuel.',
  bufferMinutes: 30,
  unscheduledBlocks: 0,
  hotelPriority: 'first',
  breakfastRequired: false,
  mealDuration: { min: 45, max: 75 },
  specialInstructions: [
    'Late start to the day — nothing before 10 AM. These travelers stay out late.',
    'Evening is the main event. At least 2 evening activities (bars, live music, rooftop lounges, nightlife).',
    'Dinner should transition naturally into the evening — pick a restaurant in the nightlife district.',
    'For Gap Year Graduate: budget-friendly venues preferred. Hostels with bars, street food markets.',
    'For Digital Explorer: Instagram-worthy spots, trendy cafes, co-working spaces count as activities.',
  ],
};

export const BALANCED_CONFIG: PatternGroupConfig = {
  groupName: 'balanced',
  displayName: 'A good mix of everything',
  activitySlots: { min: 4, max: 5 },
  eveningSlots: { min: 0, max: 1 },
  dayStartTime: '09:00',
  dayEndTime: '22:00',
  mealWeight: 'standard',
  mealInstruction: 'Find a well-reviewed local restaurant. Good food, not rushed, not over-the-top. The traveler wants to enjoy meals but they are not the centerpiece of the day.',
  bufferMinutes: 30,
  unscheduledBlocks: 0,
  hotelPriority: 'first',
  breakfastRequired: true,
  mealDuration: { min: 45, max: 75 },
  specialInstructions: [
    'A well-paced day with variety — mix cultural, dining, and leisure activities.',
    'Breakfast is included every day. It sets the rhythm.',
    'For History Hunter: prioritize historical sites, museums, guided tours.',
    'For Art Aficionado: gallery or art district visit should appear at least once.',
    'For Eco Ethicist: sustainable, eco-friendly venues preferred. No chain restaurants.',
    'For Cultural Anthropologist: include at least one immersive cultural experience (local market, cooking class, neighborhood walk).',
    'For Status Seeker: include one recognizable, premium experience per day (famous restaurant, exclusive venue).',
  ],
};

export const INDULGENT_CONFIG: PatternGroupConfig = {
  groupName: 'indulgent',
  displayName: 'Meals and atmosphere ARE the activity',
  activitySlots: { min: 3, max: 5 },
  eveningSlots: { min: 1, max: 2 },
  dayStartTime: '09:30',
  dayEndTime: '23:30',
  mealWeight: 'experience',
  mealInstruction: 'Find an exceptional dining experience. Reservations, ambiance, culinary reputation matter. This IS the activity — treat meal selection with the same care as sightseeing.',
  bufferMinutes: 30,
  unscheduledBlocks: 0,
  hotelPriority: 'first',
  breakfastRequired: true,
  mealDuration: { min: 75, max: 120 },
  specialInstructions: [
    'Dinner is the centerpiece of the evening — schedule it as the main evening event, not a pit stop before nightlife.',
    'Consider a sunset/golden hour activity before dinner.',
    'Meals are 75-120 minutes. These travelers linger.',
    'For Luxury Luminary: a spa slot is acceptable in lieu of one activity slot. Premium venues only.',
    'For Culinary Cartographer: food markets and cooking classes count as activity slots. At least one food-focused activity per day beyond meals.',
    'For Romantic Curator: one sunset viewing slot is required. Intimate venues preferred. No loud/crowded spots.',
  ],
};

export const GENTLE_CONFIG: PatternGroupConfig = {
  groupName: 'gentle',
  displayName: 'Less is more',
  activitySlots: { min: 2, max: 3 },
  eveningSlots: { min: 0, max: 1 },
  dayStartTime: '09:30',
  dayEndTime: '21:00',
  mealWeight: 'standard',
  mealInstruction: 'Find a comfortable, unhurried spot. No loud or crowded venues. Quality over scene. The traveler wants to relax over their meal.',
  bufferMinutes: 60,
  unscheduledBlocks: 1,
  hotelPriority: 'first',
  breakfastRequired: true,
  mealDuration: { min: 60, max: 90 },
  specialInstructions: [
    'Include at least one 90+ minute unscheduled block labeled "Free time to explore at your own pace."',
    'Fewer activities, longer durations. Quality over quantity.',
    'No rushing between activities. 60-minute buffers minimum.',
    'For Beach Therapist: one 3-hour beach block required. It replaces 1-2 activity slots.',
    'For Wilderness Pioneer: activities are long (2-4 hours each). Fewer but bigger. Hiking, nature, outdoors.',
    'For Family Architect: all venues must be family/kid-friendly. Early dinner (5:30-7pm). No nightlife.',
    'For Retreat Regular: one wellness/spa slot per day replaces one activity slot.',
    'For Flexible Wanderer: use neighborhood suggestions instead of specific venues for 50% of activity slots.',
    'For Zen Seeker: one meditation/temple/spiritual site slot required.',
  ],
};

export const PATTERN_GROUP_CONFIGS: Record<string, PatternGroupConfig> = {
  packed: PACKED_CONFIG,
  social: SOCIAL_CONFIG,
  balanced: BALANCED_CONFIG,
  indulgent: INDULGENT_CONFIG,
  gentle: GENTLE_CONFIG,
};

export function getPatternGroupConfig(group: string): PatternGroupConfig {
  return PATTERN_GROUP_CONFIGS[group] || BALANCED_CONFIG;
}
