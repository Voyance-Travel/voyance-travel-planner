/**
 * Comprehensive Preferences Redesign
 * Multi-section preferences form with step navigation
 */

import { motion, AnimatePresence } from 'framer-motion';
import {
  Plane,
  Hotel,
  Utensils,
  Heart,
  Globe,
  Calendar,
  Check,
  ChevronRight,
  ChevronLeft,
  Loader2,
  Sliders,
} from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

import type { BackendPreferencesData } from '@/types/preferences';
import type { UserFlightPreferences } from './FlightPreferencesForm';
import {
  TRAVEL_PACE_LABEL_TO_CODE,
  TRAVEL_PACE_CODE_TO_LABEL,
  BUDGET_TIER_LABEL_TO_CODE,
  BUDGET_TIER_CODE_TO_LABEL,
  TRIP_STRUCTURE_LABEL_TO_CODE,
  TRIP_STRUCTURE_CODE_TO_LABEL,
  ACCOMMODATION_STYLE_LABEL_TO_CODE,
  ACCOMMODATION_STYLE_CODE_TO_LABEL,
  ROOM_PREFERENCES_LABEL_TO_CODE,
  ROOM_PREFERENCES_CODE_TO_LABEL,
  HOTEL_VS_FLIGHT_LABEL_TO_CODE,
  type TravelPaceLabel,
  type BudgetTierLabel,
  type TripStructureLabel,
  type AccommodationStyleLabel,
  type RoomPreferencesLabel,
  type HotelVsFlightLabel,
} from '@/utils/preferencesMaps';

import { FlightPreferencesForm } from './FlightPreferencesForm';

interface PreferencesRedesignProps {
  preferences: BackendPreferencesData;
  onPreferenceChange: (
    section: keyof BackendPreferencesData,
    field: string,
    value: string | number | boolean | string[] | Record<string, unknown> | null
  ) => void;
  onSave: () => void;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
}

// Define preference sections
const PREFERENCE_SECTIONS = [
  {
    id: 'travel-style',
    title: 'Travel Style',
    subtitle: 'How you like to explore the world',
    icon: Globe,
  },
  {
    id: 'flights',
    title: 'Flight Preferences',
    subtitle: 'Your ideal flying experience',
    icon: Plane,
  },
  {
    id: 'accommodation',
    title: 'Accommodation',
    subtitle: 'Where you rest your head',
    icon: Hotel,
  },
  {
    id: 'food',
    title: 'Food & Dining',
    subtitle: 'Your culinary preferences',
    icon: Utensils,
  },
  {
    id: 'accessibility',
    title: 'Accessibility & Health',
    subtitle: 'Special needs and considerations',
    icon: Heart,
  },
  {
    id: 'planning',
    title: 'Planning Style',
    subtitle: 'How you like to plan trips',
    icon: Calendar,
  },
  {
    id: 'itinerary',
    title: 'Itinerary Customization',
    subtitle: 'Fine-tune how your itineraries are built',
    icon: Sliders,
  },
];

export default function PreferencesRedesign({
  preferences,
  onPreferenceChange,
  onSave,
  saveStatus,
}: PreferencesRedesignProps) {
  const [activeSection, setActiveSection] = useState(0);
  const [completedSections, setCompletedSections] = useState<Set<number>>(new Set());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const currentSection = PREFERENCE_SECTIONS[activeSection];

  // Auto-save after inactivity
  useEffect(() => {
    if (hasUnsavedChanges && saveStatus === 'idle') {
      const timer = setTimeout(() => {
        onSave();
        setHasUnsavedChanges(false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [hasUnsavedChanges, onSave, saveStatus]);

  const handleFieldChange = useCallback(
    (
      section: keyof BackendPreferencesData,
      field: string,
      value: string | number | boolean | string[] | Record<string, unknown> | null
    ) => {
      onPreferenceChange(section, field, value);
      setHasUnsavedChanges(true);
    },
    [onPreferenceChange]
  );

  const handleNext = () => {
    if (hasUnsavedChanges) {
      onSave();
      setHasUnsavedChanges(false);
    }

    setCompletedSections(prev => new Set([...prev, activeSection]));
    if (activeSection < PREFERENCE_SECTIONS.length - 1) {
      setActiveSection(activeSection + 1);
    } else {
      toast.success('Travel profile completed! Your preferences have been saved.');
    }
  };

  const handlePrevious = () => {
    if (hasUnsavedChanges) {
      onSave();
      setHasUnsavedChanges(false);
    }
    if (activeSection > 0) {
      setActiveSection(activeSection - 1);
    }
  };

  const handleSectionClick = (index: number) => {
    if (hasUnsavedChanges) {
      onSave();
      setHasUnsavedChanges(false);
    }
    setActiveSection(index);
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* Progress Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-light text-foreground">Complete Your Travel Profile</h2>
            <p className="text-muted-foreground mt-1">Help us personalize your travel recommendations</p>
          </div>

          {/* Save Status */}
          <div className="flex items-center gap-3">
            <AnimatePresence mode="wait">
              {saveStatus === 'saving' && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex items-center gap-2 text-muted-foreground"
                >
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Saving...</span>
                </motion.div>
              )}
              {saveStatus === 'saved' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center gap-2 text-green-600"
                >
                  <Check className="w-4 h-4" />
                  <span className="text-sm">Saved</span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Section Navigation */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {PREFERENCE_SECTIONS.map((section, index) => {
            const Icon = section.icon;
            const isActive = index === activeSection;
            const isCompleted = completedSections.has(index);

            return (
              <motion.button
                key={section.id}
                onClick={() => handleSectionClick(index)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`
                  relative p-4 rounded-xl border-2 transition-all text-center
                  ${
                    isActive
                      ? 'border-primary bg-primary/10 shadow-lg'
                      : isCompleted
                      ? 'border-green-500 bg-green-50'
                      : 'border-border bg-card hover:border-muted-foreground/30'
                  }
                `}
              >
                <Icon
                  className={`
                  w-6 h-6 mx-auto mb-2
                  ${isActive ? 'text-primary' : isCompleted ? 'text-green-600' : 'text-muted-foreground'}
                `}
                />
                <span
                  className={`
                  text-xs font-medium
                  ${isActive ? 'text-primary' : isCompleted ? 'text-green-900' : 'text-muted-foreground'}
                `}
                >
                  {section.title}
                </span>
                {isCompleted && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center"
                  >
                    <Check className="w-3 h-3 text-white" />
                  </motion.div>
                )}
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSection}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="p-8"
          >
            {/* Section Header */}
            <div className="border-l-4 border-primary pl-6 mb-8">
              <div className="flex items-center gap-3 mb-2">
                <currentSection.icon className="w-6 h-6 text-primary" />
                <h3 className="text-xl font-medium text-foreground">{currentSection.title}</h3>
              </div>
              <p className="text-muted-foreground">{currentSection.subtitle}</p>
            </div>

            {/* Section Content */}
            <div className="space-y-6">
              {renderSectionContent(currentSection.id, preferences, handleFieldChange)}
            </div>

            {/* Navigation Footer */}
            <div className="flex items-center justify-between mt-12 pt-8 border-t border-border">
              <button
                onClick={handlePrevious}
                disabled={activeSection === 0}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
                  ${
                    activeSection === 0
                      ? 'text-muted-foreground cursor-not-allowed'
                      : 'text-foreground hover:bg-muted'
                  }
                `}
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              <div className="flex items-center gap-4">
                {hasUnsavedChanges && (
                  <span className="text-sm text-amber-600 animate-pulse">Unsaved changes</span>
                )}
                <div className="flex items-center gap-2">
                  {PREFERENCE_SECTIONS.map((_, index) => (
                    <div
                      key={index}
                      className={`
                        w-2 h-2 rounded-full transition-all
                        ${
                          index === activeSection
                            ? 'w-8 bg-primary'
                            : completedSections.has(index)
                            ? 'bg-green-500'
                            : 'bg-muted'
                        }
                      `}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={handleNext}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all
                  ${
                    activeSection === PREFERENCE_SECTIONS.length - 1
                      ? 'bg-green-500 text-white hover:bg-green-600'
                      : 'bg-primary text-primary-foreground hover:bg-primary/90'
                  }
                `}
              >
                {activeSection === PREFERENCE_SECTIONS.length - 1
                  ? hasUnsavedChanges
                    ? 'Save & Complete'
                    : 'Complete'
                  : hasUnsavedChanges
                  ? 'Save & Next'
                  : 'Next'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// Section component props
interface SectionProps {
  preferences: BackendPreferencesData;
  onChange: (
    section: keyof BackendPreferencesData,
    field: string,
    value: string | number | boolean | string[] | Record<string, unknown> | null
  ) => void;
}

function renderSectionContent(
  sectionId: string,
  preferences: BackendPreferencesData,
  onChange: SectionProps['onChange']
) {
  switch (sectionId) {
    case 'travel-style':
      return <TravelStyleSection preferences={preferences} onChange={onChange} />;
    case 'flights':
      return <FlightSection preferences={preferences} onChange={onChange} />;
    case 'accommodation':
      return <AccommodationSection preferences={preferences} onChange={onChange} />;
    case 'food':
      return <FoodSection preferences={preferences} onChange={onChange} />;
    case 'accessibility':
      return <AccessibilitySection preferences={preferences} onChange={onChange} />;
    case 'planning':
      return <PlanningSection preferences={preferences} onChange={onChange} />;
    case 'itinerary':
      return <ItinerarySection preferences={preferences} onChange={onChange} />;
    default:
      return null;
  }
}

// Travel Style Section
function TravelStyleSection({ preferences, onChange }: SectionProps) {
  const currentTravelPaceLabel = preferences.core.travel_pace
    ? TRAVEL_PACE_CODE_TO_LABEL[preferences.core.travel_pace as keyof typeof TRAVEL_PACE_CODE_TO_LABEL]
    : undefined;

  return (
    <div className="space-y-8">
      <div>
        <h4 className="text-sm font-medium text-foreground mb-3">What's your travel pace?</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(Object.keys(TRAVEL_PACE_LABEL_TO_CODE) as TravelPaceLabel[]).map(label => {
            const code = TRAVEL_PACE_LABEL_TO_CODE[label];
            const isSelected = currentTravelPaceLabel === label;

            return (
              <motion.button
                key={label}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onChange('core', 'travel_pace', code)}
                className={`
                  p-4 rounded-xl border-2 transition-all text-center
                  ${isSelected ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground/30'}
                `}
              >
                <div className="text-2xl mb-2">
                  {label.includes('Relaxed') ? '🌴' : label.includes('Moderate') ? '🚶' : '🏃'}
                </div>
                <p className="font-medium text-foreground">{label.split(' (')[0]}</p>
                <p className="text-xs text-muted-foreground mt-1">{label.match(/\((.*)\)/)?.[1] || ''}</p>
              </motion.button>
            );
          })}
        </div>
      </div>

      <div>
        <label htmlFor="budget-tier" className="block text-sm font-medium text-foreground mb-3">
          Budget preference
        </label>
        <select
          id="budget-tier"
          value={
            preferences.core.budget_tier
              ? BUDGET_TIER_CODE_TO_LABEL[preferences.core.budget_tier as keyof typeof BUDGET_TIER_CODE_TO_LABEL] || ''
              : ''
          }
          onChange={e => {
            const label = e.target.value as BudgetTierLabel;
            const code = BUDGET_TIER_LABEL_TO_CODE[label];
            if (code) onChange('core', 'budget_tier', code);
          }}
          className="w-full p-3 border border-border rounded-xl bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
        >
          <option value="">Select budget preference</option>
          {(Object.keys(BUDGET_TIER_LABEL_TO_CODE) as BudgetTierLabel[]).map(label => (
            <option key={label} value={label}>{label}</option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="budget-amount" className="block text-sm font-medium text-foreground mb-3">
          Typical trip budget per person
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
          <input
            type="number"
            id="budget-amount"
            value={preferences.core.budget || ''}
            onChange={e => {
              const value = e.target.value ? Number(e.target.value) : null;
              if (value === null || value >= 0) onChange('core', 'budget', value);
            }}
            placeholder="e.g., 3000"
            className="w-full pl-8 pr-3 py-3 border border-border rounded-xl bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
          />
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          This helps us recommend accommodations and experiences within your budget
        </p>
      </div>

      <div>
        <h4 className="text-sm font-medium text-foreground mb-3">Planning preference</h4>
        <div className="space-y-3">
          {(Object.keys(TRIP_STRUCTURE_LABEL_TO_CODE) as TripStructureLabel[]).map(label => {
            const code = TRIP_STRUCTURE_LABEL_TO_CODE[label];
            const currentLabel = preferences.core.trip_structure_preference
              ? TRIP_STRUCTURE_CODE_TO_LABEL[preferences.core.trip_structure_preference as keyof typeof TRIP_STRUCTURE_CODE_TO_LABEL]
              : undefined;
            const isSelected = currentLabel === label;
            const icon = label.includes('Structured') ? '📋' : label.includes('Flexible') ? '🎯' : '🌊';

            return (
              <label
                key={label}
                className={`
                  flex items-center p-4 rounded-xl border-2 cursor-pointer transition-all
                  ${isSelected ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground/30'}
                `}
              >
                <input
                  type="radio"
                  name="planning"
                  value={label}
                  checked={isSelected}
                  onChange={() => onChange('core', 'trip_structure_preference', code)}
                  className="sr-only"
                />
                <span className="text-2xl mr-3">{icon}</span>
                <span className="font-medium text-foreground">{label}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Climate Preferences - DIFFERENTIATOR */}
      <div>
        <h4 className="text-sm font-medium text-foreground mb-3">🌤️ What climate do you prefer?</h4>
        <p className="text-xs text-muted-foreground mb-4">This helps us recommend destinations and schedule outdoor activities optimally</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { value: 'tropical', label: 'Warm & Tropical', icon: '🏝️' },
            { value: 'temperate', label: 'Mild & Temperate', icon: '🌸' },
            { value: 'cold', label: 'Cool & Crisp', icon: '❄️' },
            { value: 'variable', label: 'I Adapt', icon: '🌈' },
          ].map(option => {
            const isSelected = (preferences.core.climate_preferences || []).includes(option.value);
            return (
              <motion.button
                key={option.value}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  const current = preferences.core.climate_preferences || [];
                  if (isSelected) {
                    onChange('core', 'climate_preferences', current.filter(v => v !== option.value));
                  } else {
                    onChange('core', 'climate_preferences', [...current, option.value]);
                  }
                }}
                className={`
                  p-4 rounded-xl border-2 transition-all text-center
                  ${isSelected ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground/30'}
                `}
              >
                <div className="text-2xl mb-2">{option.icon}</div>
                <p className="text-xs font-medium text-foreground">{option.label}</p>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Interests */}
      <div>
        <h4 className="text-sm font-medium text-foreground mb-3">🎯 Your travel interests</h4>
        <div className="flex flex-wrap gap-2">
          {['Art & Museums', 'Food & Culinary', 'Architecture', 'History', 'Nature', 'Adventure', 'Nightlife', 'Shopping', 'Wellness', 'Photography', 'Local Culture', 'Beach & Water'].map(interest => {
            const value = interest.toLowerCase().replace(/ & /g, '_').replace(/ /g, '_');
            const isSelected = (preferences.core.interests || []).includes(value);
            return (
              <button
                key={interest}
                onClick={() => {
                  const current = preferences.core.interests || [];
                  if (isSelected) {
                    onChange('core', 'interests', current.filter(v => v !== value));
                  } else {
                    onChange('core', 'interests', [...current, value]);
                  }
                }}
                className={`
                  px-4 py-2 rounded-full text-sm font-medium transition-all
                  ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}
                `}
              >
                {interest}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Flight Section
function FlightSection({ preferences, onChange }: SectionProps) {
  const flightPreferences: Partial<UserFlightPreferences> = {
    homeAirport: preferences.flight.home_airport,
    airportCode: preferences.flight.airport_code,
    directFlightsOnly: preferences.flight.direct_flights_only,
    preferredCabinClass: preferences.flight.preferred_cabin_class as UserFlightPreferences['preferredCabinClass'],
    seatPreference: preferences.flight.seat_preference as UserFlightPreferences['seatPreference'],
    preferredAirlines: preferences.flight.preferred_airlines,
  };

  const handleFlightChange = (updatedPreferences: Partial<UserFlightPreferences>) => {
    if ('homeAirport' in updatedPreferences) {
      onChange('flight', 'home_airport', updatedPreferences.homeAirport || '');
    }
    if ('airportCode' in updatedPreferences) {
      onChange('flight', 'airport_code', updatedPreferences.airportCode || '');
    }
    if ('directFlightsOnly' in updatedPreferences) {
      onChange('flight', 'direct_flights_only', updatedPreferences.directFlightsOnly || false);
    }
    if ('preferredCabinClass' in updatedPreferences) {
      onChange('flight', 'preferred_cabin_class', (updatedPreferences.preferredCabinClass as string) || '');
    }
    if ('seatPreference' in updatedPreferences) {
      onChange('flight', 'seat_preference', (updatedPreferences.seatPreference as string) || '');
    }
  };

  return <FlightPreferencesForm preferences={flightPreferences} onChange={handleFlightChange} />;
}

// Accommodation Section
function AccommodationSection({ preferences, onChange }: SectionProps) {
  const currentAccommodationLabel = preferences.core.accommodation_style
    ? ACCOMMODATION_STYLE_CODE_TO_LABEL[preferences.core.accommodation_style as keyof typeof ACCOMMODATION_STYLE_CODE_TO_LABEL]
    : undefined;

  const getIcon = (label: string) => {
    if (label === 'Hotels') return '🏨';
    if (label === 'Vacation Rentals') return '🏠';
    if (label === 'Hostels') return '🏕️';
    if (label === 'Resorts') return '🏝️';
    if (label === 'Luxury Suites') return '👑';
    return '🏨';
  };

  return (
    <div className="space-y-8">
      <div>
        <h4 className="text-sm font-medium text-foreground mb-3">Accommodation style</h4>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {(Object.keys(ACCOMMODATION_STYLE_LABEL_TO_CODE) as AccommodationStyleLabel[]).map(label => {
            const code = ACCOMMODATION_STYLE_LABEL_TO_CODE[label];
            const isSelected = currentAccommodationLabel === label;

            return (
              <motion.button
                key={label}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onChange('core', 'accommodation_style', code)}
                className={`
                  p-4 rounded-xl border-2 transition-all text-center
                  ${isSelected ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground/30'}
                `}
              >
                <div className="text-2xl mb-2">{getIcon(label)}</div>
                <p className="text-sm font-medium text-foreground">{label}</p>
              </motion.button>
            );
          })}
        </div>
      </div>

      <div>
        <label htmlFor="room-preferences" className="block text-sm font-medium text-foreground mb-3">
          Room preferences
        </label>
        <select
          id="room-preferences"
          value={
            preferences.core.room_preferences
              ? ROOM_PREFERENCES_CODE_TO_LABEL[preferences.core.room_preferences as keyof typeof ROOM_PREFERENCES_CODE_TO_LABEL] || ''
              : ''
          }
          onChange={e => {
            const label = e.target.value as RoomPreferencesLabel;
            const code = ROOM_PREFERENCES_LABEL_TO_CODE[label];
            if (code) onChange('core', 'room_preferences', code);
          }}
          className="w-full p-3 border border-border rounded-xl bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
        >
          <option value="">Select room preference</option>
          {(Object.keys(ROOM_PREFERENCES_LABEL_TO_CODE) as RoomPreferencesLabel[]).map(label => (
            <option key={label} value={label}>{label}</option>
          ))}
        </select>
      </div>

      <div>
        <h4 className="text-sm font-medium text-foreground mb-3">When booking trips, I prefer to...</h4>
        <div className="space-y-3">
          {(Object.keys(HOTEL_VS_FLIGHT_LABEL_TO_CODE) as HotelVsFlightLabel[]).map(label => {
            const code = HOTEL_VS_FLIGHT_LABEL_TO_CODE[label];
            const isSelected = preferences.core.hotel_vs_flight === code;

            return (
              <label
                key={label}
                className={`
                  flex items-start p-4 rounded-xl border-2 cursor-pointer transition-all
                  ${isSelected ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground/30'}
                `}
              >
                <input
                  type="radio"
                  name="hotel_vs_flight"
                  value={code}
                  checked={isSelected}
                  onChange={() => onChange('core', 'hotel_vs_flight', code)}
                  className="sr-only"
                />
                <div className="flex items-center">
                  <span className="text-lg mr-3">
                    {label === 'Prioritize hotel quality' && '🏨'}
                    {label === 'Balance both equally' && '⚖️'}
                    {label === 'Prioritize flight options' && '✈️'}
                  </span>
                  <span className="font-medium text-foreground">{label}</span>
                </div>
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <label className="flex items-center gap-3 p-4 rounded-xl border-2 border-border cursor-pointer hover:border-muted-foreground/30 transition-all">
          <input
            type="checkbox"
            checked={preferences.core.eco_friendly || false}
            onChange={e => onChange('core', 'eco_friendly', e.target.checked)}
            className="w-5 h-5 text-primary rounded focus:ring-primary"
          />
          <div>
            <p className="font-medium text-foreground">Eco-friendly accommodations</p>
            <p className="text-sm text-muted-foreground">
              Prefer sustainable and green-certified properties
            </p>
          </div>
        </label>
      </div>
    </div>
  );
}

// Food Section
function FoodSection({ preferences, onChange }: SectionProps) {
  const dietaryOptions = [
    'Vegetarian', 'Vegan', 'Gluten-free', 'Dairy-free',
    'Kosher', 'Halal', 'Nut allergy', 'Shellfish allergy',
  ];

  return (
    <div className="space-y-8">
      <div>
        <h4 className="text-sm font-medium text-foreground mb-3">Dietary restrictions</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {dietaryOptions.map(option => (
            <label
              key={option}
              className="flex items-center gap-2 p-3 rounded-lg border border-border cursor-pointer hover:border-muted-foreground/30 transition-all"
            >
              <input
                type="checkbox"
                checked={(preferences.food.dietary_restrictions || []).includes(option)}
                onChange={e => {
                  const current = preferences.food.dietary_restrictions || [];
                  if (e.target.checked) {
                    onChange('food', 'dietary_restrictions', [...current, option]);
                  } else {
                    onChange('food', 'dietary_restrictions', current.filter(d => d !== option));
                  }
                }}
                className="w-4 h-4 text-primary rounded focus:ring-primary"
              />
              <span className="text-sm text-foreground">{option}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h4 className="text-sm font-medium text-foreground mb-3">Local cuisine adventure level</h4>
        <div className="space-y-3">
          {[
            { value: 'conservative', label: 'Stick to familiar foods', description: 'I prefer cuisine similar to home' },
            { value: 'moderate', label: 'Mix of familiar and new', description: "I'll try some local dishes" },
            { value: 'adventurous', label: 'Bring on the adventure!', description: 'I want to try everything local' },
          ].map(option => (
            <label
              key={option.value}
              className={`
                flex items-start p-4 rounded-xl border-2 cursor-pointer transition-all
                ${
                  (preferences.food.taste_graph as Record<string, unknown>)?.adventure_level === option.value
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-muted-foreground/30'
                }
              `}
            >
              <input
                type="radio"
                name="cuisine_adventure"
                value={option.value}
                checked={(preferences.food.taste_graph as Record<string, unknown>)?.adventure_level === option.value}
                onChange={e => onChange('food', 'taste_graph', {
                  ...(preferences.food.taste_graph || {}),
                  adventure_level: e.target.value,
                })}
                className="sr-only"
              />
              <div>
                <p className="font-medium text-foreground">{option.label}</p>
                <p className="text-sm text-muted-foreground">{option.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="comfort-food" className="block text-sm font-medium text-foreground mb-3">
            Favorite comfort food
          </label>
          <input
            id="comfort-food"
            type="text"
            value={preferences.food.comfort_food || ''}
            onChange={e => onChange('food', 'comfort_food', e.target.value)}
            placeholder="e.g., Pizza, Pasta, Burgers"
            className="w-full p-3 border border-border rounded-xl bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
          />
        </div>
        <div>
          <label htmlFor="celebration-food" className="block text-sm font-medium text-foreground mb-3">
            Celebration meal
          </label>
          <input
            id="celebration-food"
            type="text"
            value={preferences.food.celebration_food || ''}
            onChange={e => onChange('food', 'celebration_food', e.target.value)}
            placeholder="e.g., Steak, Sushi, Fine dining"
            className="w-full p-3 border border-border rounded-xl bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
          />
        </div>
      </div>
    </div>
  );
}

// Accessibility Section
function AccessibilitySection({ preferences, onChange }: SectionProps) {
  const accessibilityOptions = [
    'Wheelchair accessible', 'Step-free access', 'Visual aids',
    'Hearing assistance', 'Service animal friendly', 'Accessible bathroom',
  ];

  return (
    <div className="space-y-8">
      <div>
        <label htmlFor="mobility-level" className="block text-sm font-medium text-foreground mb-3">
          Mobility level
        </label>
        <select
          id="mobility-level"
          value={preferences.mobility.mobility_level || 'full'}
          onChange={e => onChange('mobility', 'mobility_level', e.target.value)}
          className="w-full p-3 border border-border rounded-xl bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
        >
          <option value="full">Full mobility</option>
          <option value="moderate">Some limitations</option>
          <option value="limited">Significant limitations</option>
          <option value="assisted">Require assistance</option>
        </select>
      </div>

      {preferences.mobility.mobility_level !== 'full' && (
        <div>
          <h4 className="text-sm font-medium text-foreground mb-3">Accessibility needs</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {accessibilityOptions.map(option => (
              <label
                key={option}
                className="flex items-center gap-2 p-3 rounded-lg border border-border cursor-pointer hover:border-muted-foreground/30 transition-all"
              >
                <input
                  type="checkbox"
                  checked={(preferences.mobility.accessibility_needs || []).includes(option)}
                  onChange={e => {
                    const current = preferences.mobility.accessibility_needs || [];
                    if (e.target.checked) {
                      onChange('mobility', 'accessibility_needs', [...current, option]);
                    } else {
                      onChange('mobility', 'accessibility_needs', current.filter(n => n !== option));
                    }
                  }}
                  className="w-4 h-4 text-primary rounded focus:ring-primary"
                />
                <span className="text-sm text-foreground">{option}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <label htmlFor="allergies" className="block text-sm font-medium text-foreground mb-3">
          Allergies (if any)
        </label>
        <input
          id="allergies"
          type="text"
          value={(preferences.mobility.allergies || []).join(', ')}
          onChange={e => onChange('mobility', 'allergies', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
          placeholder="e.g., Peanuts, Shellfish, Pollen"
          className="w-full p-3 border border-border rounded-xl bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
        />
        <p className="text-xs text-muted-foreground mt-1">Separate multiple allergies with commas</p>
      </div>

      <div>
        <label htmlFor="medical-considerations" className="block text-sm font-medium text-foreground mb-3">
          Special considerations
        </label>
        <textarea
          id="medical-considerations"
          value={preferences.mobility.medical_considerations || ''}
          onChange={e => onChange('mobility', 'medical_considerations', e.target.value)}
          placeholder="Any medical conditions or special needs we should know about..."
          rows={3}
          className="w-full p-3 border border-border rounded-xl bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none"
        />
      </div>
    </div>
  );
}

// Planning Section
function PlanningSection({ preferences, onChange }: SectionProps) {
  return (
    <div className="space-y-8">
      <div>
        <h4 className="text-sm font-medium text-foreground mb-3">AI assistance level</h4>
        <div className="space-y-3">
          {[
            { value: 'full', label: 'Full AI planning', description: 'Let AI handle everything with minimal input', icon: '🤖' },
            { value: 'balanced', label: 'Collaborative planning', description: 'AI suggestions with your input throughout', icon: '🤝' },
            { value: 'minimal', label: 'Minimal assistance', description: 'I prefer to plan myself with occasional help', icon: '👤' },
          ].map(option => (
            <label
              key={option.value}
              className={`
                flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                ${
                  (preferences.ai.ai_assistance_level || 'balanced') === option.value
                    ? 'border-primary bg-primary/10'
                    : 'border-border hover:border-muted-foreground/30'
                }
              `}
            >
              <input
                type="radio"
                name="ai_level"
                value={option.value}
                checked={(preferences.ai.ai_assistance_level || 'balanced') === option.value}
                onChange={e => onChange('ai', 'ai_assistance_level', e.target.value)}
                className="sr-only"
              />
              <span className="text-2xl">{option.icon}</span>
              <div>
                <p className="font-medium text-foreground">{option.label}</p>
                <p className="text-sm text-muted-foreground">{option.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="recommendation-style" className="block text-sm font-medium text-foreground mb-3">
          Recommendation style
        </label>
        <select
          id="recommendation-style"
          value={preferences.ai.recommendation_frequency || 'mixed'}
          onChange={e => onChange('ai', 'recommendation_frequency', e.target.value)}
          className="w-full p-3 border border-border rounded-xl bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
        >
          <option value="popular">Popular & well-reviewed</option>
          <option value="hidden_gems">Off the beaten path</option>
          <option value="mixed">Mix of both</option>
        </select>
      </div>

      <div>
        <label htmlFor="booking-advance" className="block text-sm font-medium text-foreground mb-3">
          How far in advance do you typically book?
        </label>
        <select
          id="booking-advance"
          value={preferences.core.planning_preference || 'balanced'}
          onChange={e => onChange('core', 'planning_preference', e.target.value)}
          className="w-full p-3 border border-border rounded-xl bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
        >
          <option value="minimal">Last minute (&lt; 1 week)</option>
          <option value="balanced">2-4 weeks advance</option>
          <option value="detailed">1+ months advance</option>
        </select>
      </div>
    </div>
  );
}

// Itinerary Customization Section
function ItinerarySection({ preferences, onChange }: SectionProps) {
  // Ensure itinerary preferences exist with defaults
  const itineraryPrefs = preferences.itinerary || {
    enable_gap_filling: true,
    enable_route_optimization: true,
    enable_real_transport: true,
    enable_geocoding: false,
    enable_venue_verification: false,
    enable_cost_lookup: true,
    preferred_downtime_minutes: 30,
    max_activities_per_day: 6,
  };

  return (
    <div className="space-y-8">
      {/* Free Time / Gap Filling */}
      <div>
        <h4 className="text-sm font-medium text-foreground mb-2">⏰ Free Time Between Activities</h4>
        <p className="text-xs text-muted-foreground mb-4">
          When there's a gap between activities, should we add "free time" blocks to your itinerary?
        </p>
        <div className="space-y-4">
          <label className="flex items-center justify-between p-4 rounded-xl border-2 border-border hover:border-muted-foreground/30 cursor-pointer transition-all">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🧘</span>
              <div>
                <p className="font-medium text-foreground">Add free time blocks</p>
                <p className="text-sm text-muted-foreground">Shows scheduled breaks for exploring or resting</p>
              </div>
            </div>
            <input
              type="checkbox"
              checked={itineraryPrefs.enable_gap_filling ?? true}
              onChange={e => onChange('itinerary', 'enable_gap_filling', e.target.checked)}
              className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
            />
          </label>

          {itineraryPrefs.enable_gap_filling && (
            <div className="ml-12">
              <label htmlFor="downtime-minutes" className="block text-sm font-medium text-foreground mb-2">
                Minimum gap to show as free time
              </label>
              <select
                id="downtime-minutes"
                value={itineraryPrefs.preferred_downtime_minutes ?? 30}
                onChange={e => onChange('itinerary', 'preferred_downtime_minutes', parseInt(e.target.value))}
                className="w-full p-3 border border-border rounded-xl bg-background focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none"
              >
                <option value={15}>15 minutes or more</option>
                <option value={30}>30 minutes or more</option>
                <option value={45}>45 minutes or more</option>
                <option value={60}>1 hour or more</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Max Activities Per Day */}
      <div>
        <h4 className="text-sm font-medium text-foreground mb-2">📅 Activities Per Day</h4>
        <p className="text-xs text-muted-foreground mb-4">
          How many planned activities do you prefer in a typical day?
        </p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: 4, label: 'Light', description: '3-4 activities', icon: '🌿' },
            { value: 6, label: 'Moderate', description: '5-6 activities', icon: '⚖️' },
            { value: 8, label: 'Packed', description: '7-8 activities', icon: '🔥' },
          ].map(option => {
            const isSelected = (itineraryPrefs.max_activities_per_day ?? 6) === option.value;
            return (
              <motion.button
                key={option.value}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onChange('itinerary', 'max_activities_per_day', option.value)}
                className={`
                  p-4 rounded-xl border-2 transition-all text-center
                  ${isSelected ? 'border-primary bg-primary/10' : 'border-border hover:border-muted-foreground/30'}
                `}
              >
                <div className="text-2xl mb-2">{option.icon}</div>
                <p className="font-medium text-foreground">{option.label}</p>
                <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Route Optimization */}
      <div>
        <h4 className="text-sm font-medium text-foreground mb-2">🗺️ Smart Route Planning</h4>
        <p className="text-xs text-muted-foreground mb-4">
          Optimize the order of activities to minimize travel time
        </p>
        <label className="flex items-center justify-between p-4 rounded-xl border-2 border-border hover:border-muted-foreground/30 cursor-pointer transition-all">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚀</span>
            <div>
              <p className="font-medium text-foreground">Enable route optimization</p>
              <p className="text-sm text-muted-foreground">Reorders activities for efficient travel</p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={itineraryPrefs.enable_route_optimization ?? true}
            onChange={e => onChange('itinerary', 'enable_route_optimization', e.target.checked)}
            className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
          />
        </label>
      </div>

      {/* Transport Estimates */}
      <div>
        <h4 className="text-sm font-medium text-foreground mb-2">🚗 Transportation Details</h4>
        <p className="text-xs text-muted-foreground mb-4">
          Show real transport times and options between activities
        </p>
        <label className="flex items-center justify-between p-4 rounded-xl border-2 border-border hover:border-muted-foreground/30 cursor-pointer transition-all">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🚌</span>
            <div>
              <p className="font-medium text-foreground">Calculate real transport times</p>
              <p className="text-sm text-muted-foreground">Uses maps data for accurate travel estimates</p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={itineraryPrefs.enable_real_transport ?? true}
            onChange={e => onChange('itinerary', 'enable_real_transport', e.target.checked)}
            className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
          />
        </label>
      </div>

      {/* Cost Lookup */}
      <div>
        <h4 className="text-sm font-medium text-foreground mb-2">💰 Live Cost Estimates</h4>
        <p className="text-xs text-muted-foreground mb-4">
          Look up real prices for activities and attractions
        </p>
        <label className="flex items-center justify-between p-4 rounded-xl border-2 border-border hover:border-muted-foreground/30 cursor-pointer transition-all">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📊</span>
            <div>
              <p className="font-medium text-foreground">Enable cost lookup</p>
              <p className="text-sm text-muted-foreground">Gets real pricing data when available</p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={itineraryPrefs.enable_cost_lookup ?? true}
            onChange={e => onChange('itinerary', 'enable_cost_lookup', e.target.checked)}
            className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
          />
        </label>
      </div>

      {/* Advanced Options (collapsed by default) */}
      <div className="pt-4 border-t border-border">
        <details className="group">
          <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground transition-colors list-none flex items-center gap-2">
            <ChevronRight className="w-4 h-4 group-open:rotate-90 transition-transform" />
            Advanced Options
          </summary>
          <div className="mt-4 space-y-4 pl-6">
            {/* Geocoding */}
            <label className="flex items-center justify-between p-4 rounded-xl border-2 border-border hover:border-muted-foreground/30 cursor-pointer transition-all">
              <div className="flex items-center gap-3">
                <span className="text-xl">📍</span>
                <div>
                  <p className="font-medium text-foreground">Precise location lookup</p>
                  <p className="text-sm text-muted-foreground">Uses geocoding for exact coordinates (slower)</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={itineraryPrefs.enable_geocoding ?? false}
                onChange={e => onChange('itinerary', 'enable_geocoding', e.target.checked)}
                className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
              />
            </label>

            {/* Venue Verification */}
            <label className="flex items-center justify-between p-4 rounded-xl border-2 border-border hover:border-muted-foreground/30 cursor-pointer transition-all">
              <div className="flex items-center gap-3">
                <span className="text-xl">✅</span>
                <div>
                  <p className="font-medium text-foreground">Venue verification</p>
                  <p className="text-sm text-muted-foreground">Verify places exist via Places API (slower, more accurate)</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={itineraryPrefs.enable_venue_verification ?? false}
                onChange={e => onChange('itinerary', 'enable_venue_verification', e.target.checked)}
                className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
              />
            </label>
          </div>
        </details>
      </div>
    </div>
  );
}
