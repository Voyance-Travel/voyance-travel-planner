/**
 * Editorial Preferences View
 * 
 * A comprehensive preferences view with nested tabs for organizing
 * the many preference questions into manageable sections.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import {
  Plane,
  Hotel,
  Utensils,
  Heart,
  Globe,
  Calendar,
  MapPin,
  Clock,
  DollarSign,
  Leaf,
  Bell,
  Edit3,
  Check,
  ChevronRight,
  Loader2,
  Sparkles,
  Sun,
  Moon,
  Users,
  Mountain,
  Flame,
  Music,
  Landmark,
  UtensilsCrossed,
  Compass,
  Coffee,
  Camera,
  Book,
  ShoppingBag,
  Waves,
  Zap,
  Battery,
  TreePine,
  Eye,
  Gift,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { recalculateDNAFromPreferences } from '@/utils/quizMapping';
import { AirportAutocomplete } from './AirportAutocomplete';
import { useBonusCredits } from '@/hooks/useBonusCredits';

// Preference categories for nested tabs
const PREFERENCE_TABS = [
  { id: 'travel-style', label: 'Travel Style', icon: Globe },
  { id: 'flights', label: 'Flights', icon: Plane },
  { id: 'accommodation', label: 'Accommodation', icon: Hotel },
  { id: 'food', label: 'Food & Dining', icon: Utensils },
  { id: 'accessibility', label: 'Accessibility', icon: Heart },
  { id: 'planning', label: 'Planning', icon: Calendar },
  { id: 'budget', label: 'Budget', icon: DollarSign },
  { id: 'pacing', label: 'Pacing', icon: Battery },
  { id: 'values', label: 'Values', icon: Leaf },
  { id: 'memories', label: 'Memories', icon: Gift },
] as const;

type PreferenceTabId = typeof PREFERENCE_TABS[number]['id'];

// DNA-affecting fields that should trigger automatic recalculation
const DNA_AFFECTING_FIELDS = new Set([
  'travel_pace',
  'interests',
  'budget_tier',
  'accommodation_style',
  'planning_preference',
  'activity_level',
  'travel_vibes',
  'traveler_type',
  'travel_companions',
  'hotel_style',
  'eco_friendly',
  'dining_style',
  'climate_preferences',
  'primary_goal',
  'trip_structure_preference',
  'preferred_regions',
]);

interface UserPreferences {
  // Travel Style
  travel_style?: string | null;
  travel_pace?: string | null;
  budget_tier?: string | null;
  activity_level?: string | null;
  travel_vibes?: string[] | null;
  interests?: string[] | null;
  primary_goal?: string | null;
  planning_preference?: string | null;
  
  // Flight Preferences
  home_airport?: string | null;
  seat_preference?: string | null;
  direct_flights_only?: boolean | null;
  flight_time_preference?: string | null;
  preferred_airlines?: string[] | null;
  flight_preferences?: Record<string, unknown> | null;
  
  // Accommodation
  accommodation_style?: string | null;
  hotel_style?: string | null;
  hotel_vs_flight?: string | null;
  
  // Food & Dining
  dining_style?: string | null;
  dietary_restrictions?: string[] | null;
  food_likes?: string[] | null;
  food_dislikes?: string[] | null;
  
  // Accessibility & Health
  mobility_level?: string | null;
  mobility_needs?: string | null;
  accessibility_needs?: string[] | null;
  
  // Planning Style
  trip_structure_preference?: string | null;
  schedule_flexibility?: string | null;
  daytime_bias?: string | null;
  downtime_ratio?: string | null;
  
  // Trip Preferences
  travel_companions?: string[] | null;
  preferred_group_size?: string | null;
  trip_duration?: string | null;
  travel_frequency?: string | null;
  preferred_regions?: string[] | null;
  climate_preferences?: string[] | null;
  weather_preferences?: string[] | null;
  
  // Budget
  budget_range?: { min?: number; max?: number } | null;
  
  // Values
  eco_friendly?: boolean | null;
  
  // Notifications
  email_notifications?: boolean | null;
  push_notifications?: boolean | null;
  marketing_emails?: boolean | null;
  trip_reminders?: boolean | null;
  price_alerts?: boolean | null;
  
  // Meta
  quiz_completed?: boolean | null;
  personal_notes?: string | null;
  sleep_schedule?: string | null;
}

export default function EditorialPreferencesView() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [activeTab, setActiveTab] = useState<PreferenceTabId>('travel-style');
  const { hasClaimedBonus, claimBonus } = useBonusCredits();
  const prefsCompletionGranted = useRef(false);
  // No longer auto-recalculating DNA on every preference save
  // Users can manually trigger recalculation via the "Recalculate DNA" button

  // Load preferences from Supabase
  useEffect(() => {
    async function loadPreferences() {
      if (!user?.id) return;
      
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('user_preferences')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (error) throw error;
        setPreferences(data as UserPreferences);
      } catch (error) {
        console.error('Failed to load preferences:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadPreferences();
  }, [user?.id]);

  // Update a single preference
  const updatePreference = async (field: string, value: unknown) => {
    if (!user?.id) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('user_preferences')
        .update({ [field]: value })
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      setPreferences(prev => prev ? { ...prev, [field]: value } : null);
      
      // Check if this field affects DNA - just inform user
      if (DNA_AFFECTING_FIELDS.has(field)) {
        toast.success('Preference saved', {
          description: 'Recalculate your Travel DNA to see changes reflected.',
        });
      } else {
        toast.success('Preference saved');
      }
      
      // Grant preferences_completion bonus (once)
      if (!prefsCompletionGranted.current && !hasClaimedBonus('preferences_completion')) {
        prefsCompletionGranted.current = true;
        try {
          const result = await claimBonus('preferences_completion');
          if (result.granted) {
            toast.success(`+${result.credits} credits earned!`, {
              description: 'Thanks for setting your preferences!',
            });
          }
        } catch (e) {
          console.warn('[Preferences] Could not grant completion bonus:', e);
        }
      }
    } catch (error) {
      console.error('Failed to update preference:', error);
      toast.error('Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  // Recalculate Travel DNA from current preferences
  const handleRecalculateDNA = async () => {
    if (!user?.id) return;
    
    setIsRecalculating(true);
    try {
      const result = await recalculateDNAFromPreferences(user.id);
      if (result.success && result.dna) {
        // Invalidate DNA-related queries so UI refreshes with preserved overrides
        queryClient.invalidateQueries({ queryKey: ['travel-dna'] });
        queryClient.invalidateQueries({ queryKey: ['profile'] });
        queryClient.invalidateQueries({ queryKey: ['preference-completion'] });
        
        toast.success('Travel DNA updated based on your preferences!', {
          description: result.dna.primary_archetype_display 
            ? `You're now: ${result.dna.primary_archetype_display}`
            : undefined,
        });

        // Grant preferences_completion bonus if not yet claimed
        if (!prefsCompletionGranted.current && !hasClaimedBonus('preferences_completion')) {
          prefsCompletionGranted.current = true;
          try {
            const bonusResult = await claimBonus('preferences_completion');
            if (bonusResult.granted) {
              toast.success(`+${bonusResult.credits} credits earned!`, {
                description: 'Thanks for setting your preferences!',
              });
            }
          } catch (e) {
            console.warn('[Preferences] Could not grant completion bonus:', e);
          }
        }
      } else {
        toast.error('Failed to recalculate Travel DNA');
      }
    } catch (error) {
      console.error('Failed to recalculate DNA:', error);
      toast.error('Failed to update Travel DNA');
    } finally {
      setIsRecalculating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="relative pl-4 sm:pl-8">
        <div className="absolute left-0 top-0 bottom-0 w-px bg-gradient-to-b from-primary via-primary/50 to-transparent" />
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
                Travel Profile
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRecalculateDNA}
              disabled={isRecalculating}
              className="gap-2"
            >
              {isRecalculating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Zap className="h-3 w-3" />
              )}
              Update Travel DNA
            </Button>
          </div>
          <h2 className="text-2xl font-serif text-foreground mb-2">Your Preferences</h2>
          <p className="text-sm text-muted-foreground max-w-lg">
            The more you share, the more personalized your recommendations become.
            <span className="text-primary/70 ml-1">Changes will update your Travel DNA.</span>
          </p>
        </div>
      </div>

      {/* Nested Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-1 overflow-x-auto pb-px scrollbar-hide">
          {PREFERENCE_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all",
                  "border-b-2 -mb-px",
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="min-h-[400px]"
        >
          {activeTab === 'travel-style' && (
            <TravelStyleSection 
              preferences={preferences} 
              onUpdate={updatePreference}
              isSaving={isSaving}
            />
          )}
          {activeTab === 'flights' && (
            <FlightsSection 
              preferences={preferences} 
              onUpdate={updatePreference}
              isSaving={isSaving}
            />
          )}
          {activeTab === 'accommodation' && (
            <AccommodationSection 
              preferences={preferences} 
              onUpdate={updatePreference}
              isSaving={isSaving}
            />
          )}
          {activeTab === 'food' && (
            <FoodSection 
              preferences={preferences} 
              onUpdate={updatePreference}
              isSaving={isSaving}
            />
          )}
          {activeTab === 'accessibility' && (
            <AccessibilitySection 
              preferences={preferences} 
              onUpdate={updatePreference}
              isSaving={isSaving}
            />
          )}
          {activeTab === 'planning' && (
            <PlanningSection 
              preferences={preferences} 
              onUpdate={updatePreference}
              isSaving={isSaving}
            />
          )}
          {activeTab === 'budget' && (
            <BudgetSection 
              preferences={preferences} 
              onUpdate={updatePreference}
              isSaving={isSaving}
            />
          )}
          {activeTab === 'pacing' && (
            <PacingSection 
              preferences={preferences} 
              onUpdate={updatePreference}
              isSaving={isSaving}
            />
          )}
          {activeTab === 'values' && (
            <ValuesSection 
              preferences={preferences} 
              onUpdate={updatePreference}
              isSaving={isSaving}
            />
          )}
          {activeTab === 'memories' && (
            <MemoriesSection 
              preferences={preferences} 
              onUpdate={updatePreference}
              isSaving={isSaving}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================================
// Section Components
// ============================================================================

interface SectionProps {
  preferences: UserPreferences | null;
  onUpdate: (field: string, value: unknown) => void;
  isSaving: boolean;
}

function TravelStyleSection({ preferences, onUpdate, isSaving }: SectionProps) {
  // Interest options that match quiz options
  const interestOptions = [
    { value: 'culture', label: 'Culture & History', Icon: Landmark },
    { value: 'food', label: 'Food & Cuisine', Icon: UtensilsCrossed },
    { value: 'nature', label: 'Nature & Outdoors', Icon: Mountain },
    { value: 'adventure', label: 'Adventure & Thrills', Icon: Flame },
    { value: 'relaxation', label: 'Relaxation & Wellness', Icon: Heart },
    { value: 'nightlife', label: 'Nightlife & Entertainment', Icon: Music },
  ];

  const toggleInterest = (value: string) => {
    const current = preferences?.interests || [];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onUpdate('interests', updated);
  };

  return (
    <div className="space-y-8">
      <SectionHeader 
        title="Travel Style Preferences"
        description="Help us understand how you like to explore"
      />
      
      {/* Travel Pace */}
      <PreferenceGroup label="What's your travel pace?">
        <RadioGroup
          value={preferences?.travel_pace || ''}
          onValueChange={(value) => onUpdate('travel_pace', value)}
          className="grid gap-3"
        >
          <RadioOption value="relaxed" label="Relaxed" description="1-2 activities per day" />
          <RadioOption value="balanced" label="Balanced" description="3-4 activities per day" />
          <RadioOption value="active" label="Active" description="5+ activities per day" />
        </RadioGroup>
      </PreferenceGroup>

      {/* Interests - from quiz */}
      <PreferenceGroup label="What draws you to a destination?">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {interestOptions.map((option) => {
            const isSelected = preferences?.interests?.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleInterest(option.value)}
                className={cn(
                  "relative p-4 rounded-xl border-2 text-left transition-all",
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                )}
              >
                {isSelected && (
                  <div className="absolute top-2 right-2">
                    <Check className="h-4 w-4 text-primary" />
                  </div>
                )}
                <option.Icon className="w-6 h-6 mb-2 text-muted-foreground" />
                <span className="text-sm font-medium">{option.label}</span>
              </button>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-2">Select all that apply</p>
      </PreferenceGroup>

      {/* Budget Preference */}
      <PreferenceGroup label="Budget preference">
        <RadioGroup
          value={preferences?.budget_tier || ''}
          onValueChange={(value) => onUpdate('budget_tier', value)}
          className="grid gap-3"
        >
          <RadioOption value="budget" label="Budget-friendly" description="Focus on value and savings" />
          <RadioOption value="moderate" label="Comfort" description="Balance of quality and price" />
          <RadioOption value="luxury" label="Luxury experiences" description="Premium everything" />
        </RadioGroup>
      </PreferenceGroup>

      {/* Accommodation Style */}
      <PreferenceGroup label="Where do you prefer to stay?">
        <RadioGroup
          value={preferences?.accommodation_style || ''}
          onValueChange={(value) => onUpdate('accommodation_style', value)}
          className="grid gap-3"
        >
          <RadioOption value="hostel" label="Hostels & Shared 🛏️" description="Social and affordable" />
          <RadioOption value="hotel" label="Hotels & Resorts 🏨" description="Comfort and amenities" />
          <RadioOption value="unique" label="Unique Stays 🏡" description="Airbnbs, treehouses, boats" />
        </RadioGroup>
      </PreferenceGroup>

      {/* Planning Preference */}
      <PreferenceGroup label="How do you like to plan?">
        <RadioGroup
          value={preferences?.planning_preference || ''}
          onValueChange={(value) => onUpdate('planning_preference', value)}
          className="grid gap-3"
        >
          <RadioOption value="detailed" label="Detailed Planner 📅" description="Every hour accounted for" />
          <RadioOption value="flexible" label="Flexible Framework 📋" description="Key plans, room to wander" />
          <RadioOption value="spontaneous" label="Spontaneous 🎲" description="Go with the flow" />
        </RadioGroup>
      </PreferenceGroup>
    </div>
  );
}

function FlightsSection({ preferences, onUpdate, isSaving }: SectionProps) {
  return (
    <div className="space-y-8">
      <SectionHeader 
        title="Flight Preferences"
        description="These preferences are used when searching for flights"
      />
      
      {/* Home Airport */}
      <PreferenceGroup label="Home Airport" required>
        <AirportAutocomplete
          value={preferences?.home_airport}
          onSelect={(code) => onUpdate('home_airport', code)}
          placeholder="Search your home airport..."
        />
        <p className="text-xs text-muted-foreground mt-2">
          Start typing to search by city or airport code
        </p>
      </PreferenceGroup>

      {/* Note about what we can't enforce */}
      <div className="bg-muted/20 border border-border rounded-lg p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">💡 Good to know</p>
        <p>
          Seat selection and departure times depend on airline availability during booking.
        </p>
      </div>
    </div>
  );
}

function AccommodationSection({ preferences, onUpdate, isSaving }: SectionProps) {
  return (
    <div className="space-y-8">
      <SectionHeader 
        title="Accommodation Preferences"
        description="Where you rest matters"
      />
      
      {/* Accommodation Style */}
      <PreferenceGroup label="Accommodation style">
        <RadioGroup
          value={preferences?.accommodation_style || ''}
          onValueChange={(value) => onUpdate('accommodation_style', value)}
          className="grid sm:grid-cols-2 gap-3"
        >
          <RadioOption value="hotel" label="Hotels 🏨" />
          <RadioOption value="vacation_rental" label="Vacation Rentals 🏠" />
          <RadioOption value="boutique" label="Boutique ✨" />
          <RadioOption value="hostel" label="Hostels 🏕️" />
          <RadioOption value="resort" label="Resorts 🏝️" />
          <RadioOption value="luxury" label="Luxury Suites 👑" />
        </RadioGroup>
      </PreferenceGroup>

      {/* Hotel vs Flight Priority */}
      <PreferenceGroup label="When booking trips, I prefer to...">
        <RadioGroup
          value={preferences?.hotel_vs_flight || ''}
          onValueChange={(value) => onUpdate('hotel_vs_flight', value)}
          className="grid gap-3"
        >
          <RadioOption value="hotel" label="Prioritize hotel quality 🏨" description="I spend more time at the hotel" />
          <RadioOption value="balanced" label="Balance both equally ⚖️" description="Both matter to me" />
          <RadioOption value="flight" label="Prioritize flight options ✈️" description="The journey matters most" />
        </RadioGroup>
      </PreferenceGroup>

      {/* Hotel Style */}
      <PreferenceGroup label="Hotel Style">
        <RadioGroup
          value={preferences?.hotel_style || ''}
          onValueChange={(value) => onUpdate('hotel_style', value)}
          className="grid sm:grid-cols-2 gap-3"
        >
          <RadioOption value="modern" label="Modern & Sleek" />
          <RadioOption value="classic" label="Classic & Traditional" />
          <RadioOption value="unique" label="Unique & Boutique" />
          <RadioOption value="no_preference" label="No Preference" />
        </RadioGroup>
      </PreferenceGroup>
    </div>
  );
}

function FoodSection({ preferences, onUpdate, isSaving }: SectionProps) {
  const dietaryOptions = [
    'Vegetarian', 'Vegan', 'Gluten-free', 'Dairy-free', 
    'Kosher', 'Halal', 'Nut allergy', 'Shellfish allergy'
  ];

  const toggleDietary = (item: string) => {
    const current = preferences?.dietary_restrictions || [];
    const updated = current.includes(item)
      ? current.filter(d => d !== item)
      : [...current, item];
    onUpdate('dietary_restrictions', updated);
  };

  return (
    <div className="space-y-8">
      <SectionHeader 
        title="Food & Dining Preferences"
        description="Culinary adventures await"
      />
      
      {/* Dietary Restrictions */}
      <PreferenceGroup label="Dietary restrictions">
        <div className="grid sm:grid-cols-2 gap-3">
          {dietaryOptions.map((option) => (
            <label
              key={option}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                preferences?.dietary_restrictions?.includes(option)
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              <Checkbox
                checked={preferences?.dietary_restrictions?.includes(option)}
                onCheckedChange={() => toggleDietary(option)}
              />
              <span className="text-sm">{option}</span>
            </label>
          ))}
        </div>
      </PreferenceGroup>

      {/* Dining Style */}
      <PreferenceGroup label="Local cuisine adventure level">
        <RadioGroup
          value={preferences?.dining_style || ''}
          onValueChange={(value) => onUpdate('dining_style', value)}
          className="grid gap-3"
        >
          <RadioOption value="conservative" label="Conservative" description="I prefer cuisine similar to home" />
          <RadioOption value="moderate" label="Moderate" description="I'll try some local dishes" />
          <RadioOption value="adventurous" label="Adventurous" description="I want to try everything local" />
        </RadioGroup>
      </PreferenceGroup>

      {/* Food Preferences */}
      <div className="grid sm:grid-cols-2 gap-6">
        <PreferenceGroup label="Favorite comfort food">
          <Input
            placeholder="Pizza, sushi, tacos..."
            value={preferences?.food_likes?.join(', ') || ''}
            onChange={(e) => onUpdate('food_likes', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
          />
        </PreferenceGroup>

        <PreferenceGroup label="Foods to avoid">
          <Input
            placeholder="Spicy food, seafood..."
            value={preferences?.food_dislikes?.join(', ') || ''}
            onChange={(e) => onUpdate('food_dislikes', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
          />
        </PreferenceGroup>
      </div>
    </div>
  );
}

function AccessibilitySection({ preferences, onUpdate, isSaving }: SectionProps) {
  const accessibilityOptions = [
    'Wheelchair accessible', 'Step-free access', 'Visual aids', 
    'Hearing assistance', 'Service animal friendly'
  ];

  const toggleAccessibility = (item: string) => {
    const current = preferences?.accessibility_needs || [];
    const updated = current.includes(item)
      ? current.filter(a => a !== item)
      : [...current, item];
    onUpdate('accessibility_needs', updated);
  };

  return (
    <div className="space-y-8">
      <SectionHeader 
        title="Accessibility & Health"
        description="We'll make sure your trip is comfortable"
      />
      
      {/* Mobility Level */}
      <PreferenceGroup label="Mobility level">
        <RadioGroup
          value={preferences?.mobility_level || ''}
          onValueChange={(value) => onUpdate('mobility_level', value)}
          className="grid gap-3"
        >
          <RadioOption value="full" label="Full mobility" description="No limitations" />
          <RadioOption value="some" label="Some limitations" description="Can walk moderate distances" />
          <RadioOption value="significant" label="Significant limitations" description="Limited walking ability" />
          <RadioOption value="assistance" label="Require assistance" description="Need mobility aids" />
        </RadioGroup>
      </PreferenceGroup>

      {/* Accessibility Needs */}
      {preferences?.mobility_level && preferences.mobility_level !== 'full' && (
        <PreferenceGroup label="Accessibility needs">
          <div className="grid sm:grid-cols-2 gap-3">
            {accessibilityOptions.map((option) => (
              <label
                key={option}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                  preferences?.accessibility_needs?.includes(option)
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                <Checkbox
                  checked={preferences?.accessibility_needs?.includes(option)}
                  onCheckedChange={() => toggleAccessibility(option)}
                />
                <span className="text-sm">{option}</span>
              </label>
            ))}
          </div>
        </PreferenceGroup>
      )}

      {/* Special Considerations */}
      <PreferenceGroup label="Special considerations or allergies">
        <Textarea
          placeholder="Any additional health considerations we should know about..."
          value={preferences?.mobility_needs || ''}
          onChange={(e) => onUpdate('mobility_needs', e.target.value)}
          className="resize-none"
          rows={3}
        />
      </PreferenceGroup>
    </div>
  );
}

function PlanningSection({ preferences, onUpdate, isSaving }: SectionProps) {
  return (
    <div className="space-y-8">
      <SectionHeader 
        title="Planning Style"
        description="How do you like to organize your adventures?"
      />
      
      {/* AI Assistance Level */}
      <PreferenceGroup label="AI assistance level">
        <RadioGroup
          value={preferences?.trip_structure_preference || ''}
          onValueChange={(value) => onUpdate('trip_structure_preference', value)}
          className="grid gap-3"
        >
          <RadioOption value="full_ai" label="Full AI planning 🤖" description="Let AI handle everything" />
          <RadioOption value="collaborative" label="Collaborative planning 🤝" description="AI suggestions with your input" />
          <RadioOption value="minimal" label="Minimal assistance 👤" description="I prefer to plan myself" />
        </RadioGroup>
      </PreferenceGroup>

      {/* Recommendation Style */}
      <PreferenceGroup label="Recommendation style">
        <RadioGroup
          value={preferences?.schedule_flexibility || ''}
          onValueChange={(value) => onUpdate('schedule_flexibility', value)}
          className="grid gap-3"
        >
          <RadioOption value="popular" label="Popular & well-reviewed" description="Tried and tested favorites" />
          <RadioOption value="hidden" label="Off the beaten path" description="Hidden gems and local secrets" />
          <RadioOption value="mix" label="Mix of both" description="Balance of popular and unique" />
        </RadioGroup>
      </PreferenceGroup>

      {/* Booking Advance */}
      <PreferenceGroup label="How far in advance do you book?">
        <RadioGroup
          value={preferences?.travel_frequency || ''}
          onValueChange={(value) => onUpdate('travel_frequency', value)}
          className="grid gap-3"
        >
          <RadioOption value="last_minute" label="Last minute" description="Less than 1 week" />
          <RadioOption value="short" label="2-4 weeks advance" />
          <RadioOption value="planned" label="1+ months advance" />
        </RadioGroup>
      </PreferenceGroup>
    </div>
  );
}

function BudgetSection({ preferences, onUpdate, isSaving }: SectionProps) {
  const budgetRange = preferences?.budget_range as { min?: number; max?: number } | null;
  
  // Helper to determine which preset matches current range
  const getDailyBudgetPreset = (range: { min?: number; max?: number } | null): string => {
    if (!range?.max) return 'moderate';
    if (range.max <= 150) return 'budget';
    if (range.max <= 300) return 'moderate';
    if (range.max <= 500) return 'comfort';
    if (range.max <= 800) return 'premium';
    return 'luxury';
  };
  
  return (
    <div className="space-y-8">
      <SectionHeader 
        title="Budget & Spending"
        description="Help us find options that fit your style"
      />
      
      {/* Daily Budget Range */}
      <PreferenceGroup label="Daily Budget (per person)">
        <RadioGroup
          value={getDailyBudgetPreset(budgetRange)}
          onValueChange={(value) => {
            const ranges: Record<string, { min: number; max: number }> = {
              'budget': { min: 50, max: 150 },
              'moderate': { min: 150, max: 300 },
              'comfort': { min: 300, max: 500 },
              'premium': { min: 500, max: 800 },
              'luxury': { min: 800, max: 2000 },
            };
            onUpdate('budget_range', ranges[value] || { min: 150, max: 300 });
          }}
          className="grid gap-3"
        >
          <RadioOption value="budget" label="Budget" description="$50–150/day" />
          <RadioOption value="moderate" label="Moderate" description="$150–300/day" />
          <RadioOption value="comfort" label="Comfort" description="$300–500/day" />
          <RadioOption value="premium" label="Premium" description="$500–800/day" />
          <RadioOption value="luxury" label="Luxury" description="$800+/day" />
        </RadioGroup>
        <p className="text-xs text-muted-foreground mt-3">
          Includes meals, activities, and local transport (not flights/hotels)
        </p>
      </PreferenceGroup>

      {/* When Do You Splurge */}
      <PreferenceGroup label="When do you splurge?">
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            'Arrival day',
            'One special meal per trip',
            'Spa/wellness day',
            'Last night celebration',
            'Never splurge',
            'Every day is special'
          ].map((option) => (
            <label
              key={option}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                preferences?.interests?.includes(option)
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              <Checkbox
                checked={preferences?.interests?.includes(option)}
                onCheckedChange={(checked) => {
                  const current = preferences?.interests || [];
                  const updated = checked
                    ? [...current, option]
                    : current.filter(i => i !== option);
                  onUpdate('interests', updated);
                }}
              />
              <span className="text-sm">{option}</span>
            </label>
          ))}
        </div>
      </PreferenceGroup>
    </div>
  );
}

function PacingSection({ preferences, onUpdate, isSaving }: SectionProps) {
  return (
    <div className="space-y-8">
      <SectionHeader 
        title="Pacing & Recovery"
        description="Everyone recharges differently"
      />
      
      {/* Active Hours */}
      <PreferenceGroup label="Active hours per day">
        <RadioGroup
          value={preferences?.activity_level || ''}
          onValueChange={(value) => onUpdate('activity_level', value)}
          className="grid gap-3"
        >
          <RadioOption value="light" label="3-5 hours" description="Light touring" />
          <RadioOption value="moderate" label="6-8 hours" description="Moderate pace" />
          <RadioOption value="full" label="9+ hours" description="All day adventure" />
        </RadioGroup>
      </PreferenceGroup>

      {/* Recovery Style */}
      <PreferenceGroup label="How do you recover?">
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            'Spa treatments',
            'Alone time in room',
            'Drinks & socializing',
            'Early sleep',
            'Light walking'
          ].map((option) => (
            <label
              key={option}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                preferences?.travel_vibes?.includes(option)
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              <Checkbox
                checked={preferences?.travel_vibes?.includes(option)}
                onCheckedChange={(checked) => {
                  const current = preferences?.travel_vibes || [];
                  const updated = checked
                    ? [...current, option]
                    : current.filter(v => v !== option);
                  onUpdate('travel_vibes', updated);
                }}
              />
              <span className="text-sm">{option}</span>
            </label>
          ))}
        </div>
      </PreferenceGroup>

      {/* Jet Lag Profile */}
      <PreferenceGroup label="Jet lag profile">
        <RadioGroup
          value={preferences?.sleep_schedule || ''}
          onValueChange={(value) => onUpdate('sleep_schedule', value)}
          className="grid gap-3"
        >
          <RadioOption value="adjusts_quickly" label="Adjusts quickly" description="I adapt within a day" />
          <RadioOption value="needs_day" label="Needs full day to adjust" description="I need recovery time" />
          <RadioOption value="avoids_changes" label="Avoids big time zone changes" description="I stick to similar zones" />
          <RadioOption value="plans_recovery" label="Plans for jet lag recovery" description="I build in adjustment time" />
        </RadioGroup>
      </PreferenceGroup>

      {/* Daytime Preference */}
      <PreferenceGroup label="When are you most active?">
        <RadioGroup
          value={preferences?.daytime_bias || ''}
          onValueChange={(value) => onUpdate('daytime_bias', value)}
          className="grid sm:grid-cols-2 gap-3"
        >
          <RadioOption value="morning" label="Morning person 🌅" description="Early starts" />
          <RadioOption value="evening" label="Night owl 🌙" description="Late nights" />
          <RadioOption value="balanced" label="Balanced ⚖️" description="Flexible timing" />
        </RadioGroup>
      </PreferenceGroup>
    </div>
  );
}

function ValuesSection({ preferences, onUpdate, isSaving }: SectionProps) {
  return (
    <div className="space-y-8">
      <SectionHeader 
        title="Values & Style"
        description="What matters to you when you travel"
      />
      
      {/* Environmental Concerns */}
      <PreferenceGroup label="Environmental concerns">
        <RadioGroup
          value={preferences?.eco_friendly ? 'yes' : 'no'}
          onValueChange={(value) => onUpdate('eco_friendly', value === 'yes')}
          className="grid gap-3"
        >
          <RadioOption value="no" label="No specific concerns" />
          <RadioOption value="yes" label="Prefer eco-friendly options" description="Lower environmental impact" />
        </RadioGroup>
      </PreferenceGroup>

      {/* Cultural Immersion */}
      <PreferenceGroup label="Cultural immersion level">
        <RadioGroup
          value={preferences?.primary_goal || ''}
          onValueChange={(value) => onUpdate('primary_goal', value)}
          className="grid gap-3"
        >
          <RadioOption value="deep" label="Deep cultural experiences" description="Living like a local" />
          <RadioOption value="surface" label="Surface-level is fine" description="Quick cultural highlights" />
          <RadioOption value="tourist" label="Tourist attractions preferred" description="Famous landmarks and sites" />
          <RadioOption value="mix" label="Mix of both" description="Balance of local and touristy" />
        </RadioGroup>
      </PreferenceGroup>

      {/* Privacy Threshold */}
      <PreferenceGroup label="Privacy threshold">
        <RadioGroup
          value={preferences?.preferred_group_size || ''}
          onValueChange={(value) => onUpdate('preferred_group_size', value)}
          className="grid gap-3"
        >
          <RadioOption value="social" label="Love meeting new people" description="Group tours and social activities" />
          <RadioOption value="small" label="Small groups preferred" description="Intimate experiences" />
          <RadioOption value="avoid_crowds" label="Avoid crowds when possible" description="Off-peak timing" />
          <RadioOption value="private" label="Private experiences only" description="Just me and my group" />
        </RadioGroup>
      </PreferenceGroup>
    </div>
  );
}

function MemoriesSection({ preferences, onUpdate, isSaving }: SectionProps) {
  return (
    <div className="space-y-8">
      <SectionHeader 
        title="Trip Memories"
        description="What makes travel special for you"
      />
      
      {/* Trip Rituals */}
      <PreferenceGroup label="Trip rituals & traditions">
        <Textarea
          placeholder="Always visit a local market on the first day, have a fancy dinner on the last night..."
          value={preferences?.personal_notes || ''}
          onChange={(e) => onUpdate('personal_notes', e.target.value)}
          className="resize-none"
          rows={3}
        />
      </PreferenceGroup>

      {/* What Do You Collect */}
      <PreferenceGroup label="What do you collect from travels?">
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            'Photos & memories',
            'Physical souvenirs',
            'Recipes & local food',
            'Stories & experiences'
          ].map((option) => (
            <label
              key={option}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                preferences?.climate_preferences?.includes(option)
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
            >
              <Checkbox
                checked={preferences?.climate_preferences?.includes(option)}
                onCheckedChange={(checked) => {
                  const current = preferences?.climate_preferences || [];
                  const updated = checked
                    ? [...current, option]
                    : current.filter(c => c !== option);
                  onUpdate('climate_preferences', updated);
                }}
              />
              <span className="text-sm">{option}</span>
            </label>
          ))}
        </div>
      </PreferenceGroup>
    </div>
  );
}

// ============================================================================
// Helper Components
// ============================================================================

function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="pb-4 border-b border-border">
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function PreferenceGroup({ 
  label, 
  required, 
  children 
}: { 
  label: string; 
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      {label && (
        <Label className="text-sm font-medium">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}
      {children}
    </div>
  );
}

function RadioOption({ 
  value, 
  label, 
  description 
}: { 
  value: string; 
  label: string; 
  description?: string;
}) {
  return (
    <div className="flex items-start space-x-3">
      <RadioGroupItem value={value} id={value} className="mt-1" />
      <label htmlFor={value} className="flex-1 cursor-pointer">
        <span className="text-sm font-medium">{label}</span>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </label>
    </div>
  );
}
