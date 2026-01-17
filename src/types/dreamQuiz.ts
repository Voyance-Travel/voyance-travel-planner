import { z } from 'zod';

// Traveler types
export const travelerTypes = ['explorer', 'escapeArtist', 'curatedLuxe', 'storySeeker'] as const;
export type TravelerType = typeof travelerTypes[number];

// Travel vibes
export const travelVibes = ['coastal', 'urban', 'mountain', 'quiet', 'bold', 'spiritual'] as const;
export type TravelVibe = typeof travelVibes[number];

// Trip frequencies
export const tripFrequencies = ['monthly', 'quarterly', 'biAnnually', 'annually', 'lessOften'] as const;
export type TripFrequency = typeof tripFrequencies[number];

// Trip lengths
export const tripLengths = ['weekend', 'shortWeek', 'week', 'twoWeeks', 'month', 'longer'] as const;
export type TripLength = typeof tripLengths[number];

// Budget ranges
export const budgetRanges = ['budget', 'moderate', 'premium', 'luxury'] as const;
export type BudgetRange = typeof budgetRanges[number];

// Day structures
export const dayStructures = ['planned', 'flexible', 'mixed'] as const;
export type DayStructure = typeof dayStructures[number];

// Travel paces
export const travelPaces = ['relaxed', 'balanced', 'active'] as const;
export type TravelPace = typeof travelPaces[number];

// Travel companions
export const travelCompanions = ['solo', 'partner', 'family', 'friends', 'group'] as const;
export type TravelCompanion = typeof travelCompanions[number];

// Planning preferences
export const planningPreferences = ['detailed', 'flexible', 'collaborative', 'spontaneous'] as const;
export type PlanningPreference = typeof planningPreferences[number];

// Activity levels
export const activityLevels = ['minimal', 'light', 'moderate', 'active', 'intense'] as const;
export type ActivityLevel = typeof activityLevels[number];

// Seat preferences
export const seatPreferences = ['window', 'aisle', 'noPreference'] as const;
export type SeatPreference = typeof seatPreferences[number];

// Flight time preferences
export const flightTimePreferences = ['morning', 'afternoon', 'evening', 'overnight', 'noPreference'] as const;
export type FlightTimePreference = typeof flightTimePreferences[number];

// Boolean preference
export const booleanPreference = ['yes', 'no', 'noPreference'] as const;
export type BooleanPreference = typeof booleanPreference[number];

// Hotel styles
export const hotelStyles = ['boutique', 'chain', 'resort', 'hostel', 'vacation-rental', 'luxury'] as const;
export type HotelStyle = typeof hotelStyles[number];

// Location preferences
export const locationPreferences = ['central', 'quiet', 'scenic', 'convenient', 'local'] as const;
export type LocationPreference = typeof locationPreferences[number];

// Weather preferences
export const weatherPreferences = ['tropical', 'temperate', 'cold', 'dry', 'humid', 'variable'] as const;
export type WeatherPreference = typeof weatherPreferences[number];

// Interest levels
export const interestLevels = ['notInterested', 'slightlyInterested', 'interested', 'veryInterested', 'mustHave'] as const;
export type InterestLevel = typeof interestLevels[number];

// Travel priorities
export const travelPriorities = ['flight', 'hotel', 'balanced', 'budget'] as const;
export type TravelPriority = typeof travelPriorities[number];

// Interests schema
export const InterestsSchema = z.object({
  food: z.number().min(1).max(5).default(3),
  culture: z.number().min(1).max(5).default(3),
  shopping: z.number().min(1).max(5).default(3),
  nature: z.number().min(1).max(5).default(3),
  nightlife: z.number().min(1).max(5).default(3),
  wellness: z.number().min(1).max(5).default(3),
  adventure: z.number().min(1).max(5).default(3),
});

// Main Dream Quiz Schema
export const DreamQuizSchema = z.object({
  // Step 1: Travel Identity
  travelerType: z.enum(travelerTypes).optional(),
  travelVibes: z.array(z.enum(travelVibes)).min(1).max(5).default([]),
  
  // Step 2: Trip Cadence
  tripFrequency: z.enum(tripFrequencies).optional(),
  tripLength: z.enum(tripLengths).optional(),
  budgetRange: z.enum(budgetRanges).optional(),
  
  // Step 3: Pace & Structure
  dayStructure: z.enum(dayStructures).optional(),
  travelPace: z.enum(travelPaces).optional(),
  
  // Step 4: Companions
  travelCompanions: z.enum(travelCompanions).optional(),
  planningPreference: z.enum(planningPreferences).optional(),
  
  // Step 5: Mobility
  activityLevel: z.enum(activityLevels).optional(),
  accessibilityNeeds: z.string().optional(),
  
  // Step 6: Flight Preferences
  seatPreference: z.enum(seatPreferences).optional(),
  flightTimePreference: z.enum(flightTimePreferences).optional(),
  directFlightsOnly: z.enum(booleanPreference).optional(),
  
  // Step 7: Hotel Preferences
  hotelStyle: z.array(z.enum(hotelStyles)).max(3).default([]),
  locationPreference: z.array(z.enum(locationPreferences)).max(3).default([]),
  
  // Step 8: Climate
  weatherPreference: z.array(z.enum(weatherPreferences)).max(3).default([]),
  weatherAvoid: z.array(z.enum(weatherPreferences)).max(3).default([]),
  
  // Step 9: Activity Interests
  interests: InterestsSchema.default({
    food: 3,
    culture: 3,
    shopping: 3,
    nature: 3,
    nightlife: 3,
    wellness: 3,
    adventure: 3,
  }),
  
  // Step 10: Special Requests
  specialRequests: z.string().optional(),
  dietaryRestrictions: z.string().optional(),
  
  // Step 11: Travel Priorities
  travelPriority: z.enum(travelPriorities).optional(),
});

export type DreamQuizType = z.infer<typeof DreamQuizSchema>;

// Empty quiz default values
export const emptyDreamQuiz: DreamQuizType = {
  travelerType: undefined,
  travelVibes: [],
  tripFrequency: undefined,
  tripLength: undefined,
  budgetRange: undefined,
  dayStructure: undefined,
  travelPace: undefined,
  travelCompanions: undefined,
  planningPreference: undefined,
  activityLevel: undefined,
  accessibilityNeeds: '',
  seatPreference: undefined,
  flightTimePreference: undefined,
  directFlightsOnly: undefined,
  hotelStyle: [],
  locationPreference: [],
  weatherPreference: [],
  weatherAvoid: [],
  interests: {
    food: 3,
    culture: 3,
    shopping: 3,
    nature: 3,
    nightlife: 3,
    wellness: 3,
    adventure: 3,
  },
  specialRequests: '',
  dietaryRestrictions: '',
  travelPriority: undefined,
};

// Interest level labels for sliders
export const interestLevelLabels: Record<InterestLevel, { value: number; title: string }> = {
  notInterested: { value: 1, title: 'Not Important' },
  slightlyInterested: { value: 2, title: 'Nice to Have' },
  interested: { value: 3, title: 'Interested' },
  veryInterested: { value: 4, title: 'Very Important' },
  mustHave: { value: 5, title: 'Must Have' },
};
