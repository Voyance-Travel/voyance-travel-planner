/**
 * Types for parsed trip input from ChatGPT/Claude paste
 * Used by both "Just Tell Us" and "I'll Build Myself" paths
 */

export interface ParsedPreferences {
  budget?: string;
  budgetLevel?: 'budget' | 'mid-range' | 'luxury';
  focus?: string[];
  avoid?: string[];
  dietary?: string[];
  walkability?: string;
  pace?: string;
  accessibility?: string[];
  rawPreferenceText?: string;
}

export interface ParsedTripInput {
  preferences?: ParsedPreferences | null;
  destination?: string;
  dates?: { start: string; end: string };
  duration?: number;
  travelers?: number;
  tripType?: string;
  days: ParsedDay[];
  accommodationNotes?: string[];
  practicalTips?: string[];
  unparsed?: string[];
}

export interface ParsedDay {
  dayNumber: number;
  date?: string;
  theme?: string;
  dailyBudget?: number;
  activities: ParsedActivity[];
}

export interface ParsedActivity {
  name: string;
  time?: string;
  location?: string;
  cost?: number;
  currency?: string;
  notes?: string;
  description?: string;
  category?: string;
  isOption?: boolean;
  optionGroup?: string;
  bookingRequired?: boolean;
  source: 'parsed';
}
