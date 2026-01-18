/**
 * Editorial Preferences View
 * 
 * A magazine-style, read-optimized view of user travel preferences
 * with inline editing capabilities.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
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
  Compass,
  Coffee,
  Mountain,
  Camera,
  Music,
  Book,
  ShoppingBag,
  Waves,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface UserPreferences {
  // Travel Style
  travel_style?: string | null;
  travel_pace?: string | null;
  budget_tier?: string | null;
  activity_level?: string | null;
  travel_vibes?: string[] | null;
  interests?: string[] | null;
  primary_goal?: string | null;
  
  // Flight Preferences
  home_airport?: string | null;
  seat_preference?: string | null;
  direct_flights_only?: boolean | null;
  flight_time_preference?: string | null;
  preferred_airlines?: string[] | null;
  
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
  planning_preference?: string | null;
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
}

// Display value mappings
const PACE_DISPLAY: Record<string, string> = {
  'relaxed': 'Relaxed & Easy',
  'moderate': 'Balanced',
  'fast': 'Fast-Paced',
  'slow': 'Slow & Mindful',
};

const BUDGET_DISPLAY: Record<string, string> = {
  'budget': 'Budget-Conscious',
  'moderate': 'Moderate',
  'luxury': 'Luxury',
  'premium': 'Ultra-Premium',
  'flexible': 'Flexible',
};

const ACCOMMODATION_DISPLAY: Record<string, string> = {
  'hostel': 'Hostels & Social',
  'budget_hotel': 'Budget Hotels',
  'standard_hotel': 'Standard Hotels',
  'boutique': 'Boutique & Unique',
  'luxury': 'Luxury Properties',
  'vacation_rental': 'Vacation Rentals',
};

const SEAT_DISPLAY: Record<string, string> = {
  'window': 'Window',
  'aisle': 'Aisle',
  'middle': 'No Preference',
  'no_preference': 'No Preference',
};

const INTEREST_ICONS: Record<string, React.ReactNode> = {
  'adventure': <Mountain className="h-3.5 w-3.5" />,
  'culture': <Book className="h-3.5 w-3.5" />,
  'food': <Coffee className="h-3.5 w-3.5" />,
  'nature': <Waves className="h-3.5 w-3.5" />,
  'photography': <Camera className="h-3.5 w-3.5" />,
  'nightlife': <Music className="h-3.5 w-3.5" />,
  'shopping': <ShoppingBag className="h-3.5 w-3.5" />,
  'relaxation': <Sun className="h-3.5 w-3.5" />,
};

export default function EditorialPreferencesView() {
  const { user } = useAuth();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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
        setPreferences(data);
      } catch (error) {
        console.error('Failed to load preferences:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    loadPreferences();
  }, [user?.id]);

  // Toggle preference
  const handleToggle = async (field: keyof UserPreferences, value: boolean) => {
    if (!user?.id) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('user_preferences')
        .update({ [field]: value })
        .eq('user_id', user.id);
      
      if (error) throw error;
      
      setPreferences(prev => prev ? { ...prev, [field]: value } : null);
      toast.success('Preference updated');
    } catch (error) {
      console.error('Failed to update preference:', error);
      toast.error('Failed to save');
    } finally {
      setIsSaving(false);
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
      className="space-y-12"
    >
      {/* Header */}
      <div className="relative">
        <div className="absolute -left-4 top-0 bottom-0 w-px bg-gradient-to-b from-primary via-primary/50 to-transparent" />
        <div className="pl-8">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium">
              Travel Profile
            </span>
          </div>
          <h2 className="text-2xl font-serif text-foreground mb-2">Your Preferences</h2>
          <p className="text-sm text-muted-foreground max-w-lg">
            These preferences shape every recommendation, from flights to activities.
          </p>
        </div>
      </div>

      {/* Preferences Display */}
      <div className="space-y-10">
        /* Preferences Display */
        <div className="space-y-10">
          {/* Travel Style Section */}
          <PreferenceSection
            icon={Globe}
            title="Travel Style"
            subtitle="How you explore"
          >
            <div className="grid md:grid-cols-2 gap-6">
              <PreferenceCard
                label="Pace"
                value={PACE_DISPLAY[preferences?.travel_pace || ''] || preferences?.travel_pace}
                sublabel="Your ideal rhythm"
              />
              <PreferenceCard
                label="Budget"
                value={BUDGET_DISPLAY[preferences?.budget_tier || ''] || preferences?.budget_tier}
                sublabel="Spending comfort zone"
              />
              <PreferenceCard
                label="Activity Level"
                value={preferences?.activity_level}
                sublabel="Energy on trips"
              />
              <PreferenceCard
                label="Primary Goal"
                value={preferences?.primary_goal}
                sublabel="What travel means to you"
              />
            </div>
            
            {/* Interests Tags */}
            {preferences?.interests && preferences.interests.length > 0 && (
              <div className="mt-6 pt-6 border-t border-border">
                <span className="text-xs uppercase tracking-wider text-muted-foreground mb-3 block">
                  Interests
                </span>
                <div className="flex flex-wrap gap-2">
                  {preferences.interests.map((interest) => (
                    <span
                      key={interest}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 rounded-full text-sm text-foreground capitalize"
                    >
                      {INTEREST_ICONS[interest.toLowerCase()] || <Compass className="h-3.5 w-3.5" />}
                      {interest}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {/* Travel Vibes */}
            {preferences?.travel_vibes && preferences.travel_vibes.length > 0 && (
              <div className="mt-4">
                <span className="text-xs uppercase tracking-wider text-muted-foreground mb-3 block">
                  Vibes
                </span>
                <div className="flex flex-wrap gap-2">
                  {preferences.travel_vibes.map((vibe) => (
                    <span
                      key={vibe}
                      className="px-3 py-1 border border-border rounded-full text-sm text-muted-foreground capitalize"
                    >
                      {vibe}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </PreferenceSection>

          {/* Flight Preferences */}
          <PreferenceSection
            icon={Plane}
            title="Flight Preferences"
            subtitle="Your flying comfort"
          >
            <div className="grid md:grid-cols-2 gap-6">
              <PreferenceCard
                label="Home Airport"
                value={preferences?.home_airport?.toUpperCase()}
                sublabel="Your departure base"
                icon={<MapPin className="h-4 w-4" />}
              />
              <PreferenceCard
                label="Seat Preference"
                value={SEAT_DISPLAY[preferences?.seat_preference || ''] || preferences?.seat_preference}
                sublabel="Where you sit"
              />
              <PreferenceCard
                label="Flight Timing"
                value={preferences?.flight_time_preference}
                sublabel="Preferred departure times"
                icon={<Clock className="h-4 w-4" />}
              />
              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-foreground">Direct Flights Only</span>
                    <p className="text-xs text-muted-foreground mt-0.5">Avoid layovers when possible</p>
                  </div>
                  <Switch
                    checked={preferences?.direct_flights_only || false}
                    onCheckedChange={(checked) => handleToggle('direct_flights_only', checked)}
                    disabled={isSaving}
                  />
                </div>
              </div>
            </div>
            
            {/* Preferred Airlines */}
            {preferences?.preferred_airlines && preferences.preferred_airlines.length > 0 && (
              <div className="mt-6 pt-6 border-t border-border">
                <span className="text-xs uppercase tracking-wider text-muted-foreground mb-3 block">
                  Preferred Airlines
                </span>
                <div className="flex flex-wrap gap-2">
                  {preferences.preferred_airlines.map((airline) => (
                    <span
                      key={airline}
                      className="px-3 py-1.5 bg-muted/50 rounded-full text-sm text-foreground"
                    >
                      {airline}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </PreferenceSection>

          {/* Accommodation */}
          <PreferenceSection
            icon={Hotel}
            title="Accommodation"
            subtitle="Where you rest"
          >
            <div className="grid md:grid-cols-2 gap-6">
              <PreferenceCard
                label="Style"
                value={ACCOMMODATION_DISPLAY[preferences?.accommodation_style || ''] || preferences?.accommodation_style}
                sublabel="Your preferred type"
              />
              <PreferenceCard
                label="Hotel Priority"
                value={preferences?.hotel_vs_flight}
                sublabel="What matters more"
              />
            </div>
          </PreferenceSection>

          {/* Food & Dining */}
          <PreferenceSection
            icon={Utensils}
            title="Food & Dining"
            subtitle="Culinary preferences"
          >
            <div className="grid md:grid-cols-2 gap-6">
              <PreferenceCard
                label="Dining Style"
                value={preferences?.dining_style}
                sublabel="How you like to eat"
              />
            </div>
            
            {/* Dietary Restrictions */}
            {preferences?.dietary_restrictions && preferences.dietary_restrictions.length > 0 && (
              <div className="mt-6 pt-6 border-t border-border">
                <span className="text-xs uppercase tracking-wider text-muted-foreground mb-3 block">
                  Dietary Restrictions
                </span>
                <div className="flex flex-wrap gap-2">
                  {preferences.dietary_restrictions.map((item) => (
                    <span
                      key={item}
                      className="px-3 py-1.5 bg-destructive/10 text-destructive rounded-full text-sm"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {/* Food Preferences */}
            <div className="mt-4 grid md:grid-cols-2 gap-4">
              {preferences?.food_likes && preferences.food_likes.length > 0 && (
                <div>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
                    Favorites
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {preferences.food_likes.map((item) => (
                      <span
                        key={item}
                        className="px-2.5 py-1 bg-green-500/10 text-green-700 rounded-full text-xs"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {preferences?.food_dislikes && preferences.food_dislikes.length > 0 && (
                <div>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">
                    Avoid
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {preferences.food_dislikes.map((item) => (
                      <span
                        key={item}
                        className="px-2.5 py-1 bg-muted rounded-full text-xs text-muted-foreground"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </PreferenceSection>

          {/* Accessibility & Health */}
          <PreferenceSection
            icon={Heart}
            title="Accessibility & Health"
            subtitle="Special considerations"
          >
            <div className="grid md:grid-cols-2 gap-6">
              <PreferenceCard
                label="Mobility Level"
                value={preferences?.mobility_level}
                sublabel="Activity capability"
              />
              <PreferenceCard
                label="Mobility Needs"
                value={preferences?.mobility_needs}
                sublabel="Specific requirements"
              />
            </div>
            
            {preferences?.accessibility_needs && preferences.accessibility_needs.length > 0 && (
              <div className="mt-6 pt-6 border-t border-border">
                <span className="text-xs uppercase tracking-wider text-muted-foreground mb-3 block">
                  Accessibility Needs
                </span>
                <div className="flex flex-wrap gap-2">
                  {preferences.accessibility_needs.map((need) => (
                    <span
                      key={need}
                      className="px-3 py-1.5 bg-primary/10 text-primary rounded-full text-sm"
                    >
                      {need}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </PreferenceSection>

          {/* Planning Style */}
          <PreferenceSection
            icon={Calendar}
            title="Planning Style"
            subtitle="How you organize trips"
          >
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <PreferenceCard
                label="Structure"
                value={preferences?.trip_structure_preference}
                sublabel="Level of planning"
              />
              <PreferenceCard
                label="Flexibility"
                value={preferences?.schedule_flexibility}
                sublabel="Openness to change"
              />
              <PreferenceCard
                label="Time of Day"
                value={preferences?.daytime_bias}
                sublabel="When you're most active"
                icon={preferences?.daytime_bias?.toLowerCase().includes('morning') ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              />
              <PreferenceCard
                label="Downtime"
                value={preferences?.downtime_ratio}
                sublabel="Rest vs. activities"
              />
              <PreferenceCard
                label="Trip Duration"
                value={preferences?.trip_duration}
                sublabel="Ideal trip length"
              />
              <PreferenceCard
                label="Travel Frequency"
                value={preferences?.travel_frequency}
                sublabel="How often you travel"
              />
            </div>
          </PreferenceSection>

          {/* Trip Context */}
          <PreferenceSection
            icon={Users}
            title="Trip Context"
            subtitle="Who you travel with"
          >
            <div className="grid md:grid-cols-2 gap-6">
              <PreferenceCard
                label="Group Size"
                value={preferences?.preferred_group_size}
                sublabel="Typical party size"
              />
            </div>
            
            {preferences?.travel_companions && preferences.travel_companions.length > 0 && (
              <div className="mt-6 pt-6 border-t border-border">
                <span className="text-xs uppercase tracking-wider text-muted-foreground mb-3 block">
                  Travel Companions
                </span>
                <div className="flex flex-wrap gap-2">
                  {preferences.travel_companions.map((companion) => (
                    <span
                      key={companion}
                      className="px-3 py-1.5 bg-muted/50 rounded-full text-sm text-foreground capitalize"
                    >
                      {companion}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {/* Preferred Regions */}
            {preferences?.preferred_regions && preferences.preferred_regions.length > 0 && (
              <div className="mt-4">
                <span className="text-xs uppercase tracking-wider text-muted-foreground mb-3 block">
                  Preferred Regions
                </span>
                <div className="flex flex-wrap gap-2">
                  {preferences.preferred_regions.map((region) => (
                    <span
                      key={region}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 rounded-full text-sm text-foreground"
                    >
                      <Globe className="h-3.5 w-3.5" />
                      {region}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </PreferenceSection>

          {/* Values & Sustainability */}
          <PreferenceSection
            icon={Leaf}
            title="Values"
            subtitle="What matters to you"
          >
            <div className="p-4 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-green-500/10">
                    <Leaf className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-foreground">Eco-Friendly Travel</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Prefer sustainable options and reduce environmental impact
                    </p>
                  </div>
                </div>
                <Switch
                  checked={preferences?.eco_friendly || false}
                  onCheckedChange={(checked) => handleToggle('eco_friendly', checked)}
                  disabled={isSaving}
                />
              </div>
            </div>
          </PreferenceSection>

          {/* Notifications */}
          <PreferenceSection
            icon={Bell}
            title="Notifications"
            subtitle="Stay informed"
          >
            <div className="space-y-3">
              <NotificationToggle
                label="Email Notifications"
                description="Trip updates and confirmations"
                checked={preferences?.email_notifications || false}
                onChange={(checked) => handleToggle('email_notifications', checked)}
                disabled={isSaving}
              />
              <NotificationToggle
                label="Push Notifications"
                description="Real-time alerts on your device"
                checked={preferences?.push_notifications || false}
                onChange={(checked) => handleToggle('push_notifications', checked)}
                disabled={isSaving}
              />
              <NotificationToggle
                label="Trip Reminders"
                description="Upcoming trip notifications"
                checked={preferences?.trip_reminders || false}
                onChange={(checked) => handleToggle('trip_reminders', checked)}
                disabled={isSaving}
              />
              <NotificationToggle
                label="Price Alerts"
                description="Price drops and deals"
                checked={preferences?.price_alerts || false}
                onChange={(checked) => handleToggle('price_alerts', checked)}
                disabled={isSaving}
              />
              <NotificationToggle
                label="Marketing Emails"
                description="Travel inspiration and offers"
                checked={preferences?.marketing_emails || false}
                onChange={(checked) => handleToggle('marketing_emails', checked)}
                disabled={isSaving}
              />
            </div>
          </PreferenceSection>

          {/* Personal Notes */}
          {preferences?.personal_notes && (
            <PreferenceSection
              icon={Edit3}
              title="Personal Notes"
              subtitle="Additional details"
            >
              <div className="p-4 rounded-lg bg-muted/30 border border-border">
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {preferences.personal_notes}
                </p>
              </div>
            </PreferenceSection>
          )}

          {/* Update Button */}
          <div className="pt-6 border-t border-border">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-sm text-foreground font-medium">Want to update your preferences?</p>
                <p className="text-sm text-muted-foreground">Retake the travel quiz or edit individual sections.</p>
              </div>
              <Button variant="outline" asChild>
                <Link to={ROUTES.QUIZ}>
                  <Edit3 className="h-4 w-4 mr-2" />
                  Retake Quiz
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Helper Components

interface PreferenceSectionProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

function PreferenceSection({ icon: Icon, title, subtitle, children }: PreferenceSectionProps) {
  return (
    <div className="relative">
      <div className="absolute -left-4 top-0 w-px h-8 bg-border" />
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <Icon className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-serif font-medium text-foreground">{title}</h3>
        </div>
        <p className="text-sm text-muted-foreground pl-8">{subtitle}</p>
      </div>
      <div className="pl-8">
        {children}
      </div>
    </div>
  );
}

interface PreferenceCardProps {
  label: string;
  value?: string | null;
  sublabel?: string;
  icon?: React.ReactNode;
}

function PreferenceCard({ label, value, sublabel, icon }: PreferenceCardProps) {
  return (
    <div className="p-4 rounded-lg bg-muted/30 border border-border">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="p-1.5 rounded bg-muted text-muted-foreground">
            {icon}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <span className="text-xs uppercase tracking-wider text-muted-foreground block mb-1">
            {label}
          </span>
          <p className={cn(
            "text-sm font-medium capitalize",
            value ? "text-foreground" : "text-muted-foreground italic"
          )}>
            {value || 'Not set'}
          </p>
          {sublabel && (
            <p className="text-xs text-muted-foreground mt-0.5">{sublabel}</p>
          )}
        </div>
      </div>
    </div>
  );
}

interface NotificationToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

function NotificationToggle({ label, description, checked, onChange, disabled }: NotificationToggleProps) {
  return (
    <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
      <div>
        <span className="text-sm font-medium text-foreground">{label}</span>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onChange}
        disabled={disabled}
      />
    </div>
  );
}
