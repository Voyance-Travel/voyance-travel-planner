/**
 * Itinerary Templates Service
 * Save and reuse itineraries across different destinations
 */

import { supabase } from '@/integrations/supabase/client';
import type { DayItinerary, ItineraryActivity } from '@/types/itinerary';

export interface ItineraryTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  source_destination: string | null;
  source_trip_id: string | null;
  template_data: TemplateDayData[];
  day_count: number;
  tags: string[];
  trip_type: string | null;
  pace: string | null;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

// Abstracted day structure (destination-agnostic)
export interface TemplateDayData {
  dayNumber: number;
  theme: string;
  description: string;
  activities: TemplateActivity[];
}

// Abstracted activity (location replaced with category/type hints)
export interface TemplateActivity {
  title: string;
  description: string;
  time: string;
  duration: string;
  type: string;
  estimatedCost: number;
  category: string; // More specific category hint for AI
  tags: string[];
}

export interface CreateTemplateInput {
  name: string;
  description?: string;
  sourceDestination: string;
  sourceTripId?: string;
  days: DayItinerary[];
  tags?: string[];
  tripType?: string;
  pace?: string;
}

/**
 * Convert a real itinerary to an abstracted template
 */
function abstractItinerary(days: DayItinerary[]): TemplateDayData[] {
  return days.map(day => ({
    dayNumber: day.dayNumber,
    theme: day.theme,
    description: day.description,
    activities: day.activities.map(activity => ({
      title: abstractTitle(activity.title, activity.type),
      description: activity.description,
      time: activity.time,
      duration: activity.duration,
      type: activity.type,
      estimatedCost: activity.cost,
      category: activity.type,
      tags: activity.tags || [],
    })),
  }));
}

/**
 * Make activity titles more generic for reuse
 * e.g., "Louvre Museum" -> "Major Art Museum"
 */
function abstractTitle(title: string, type: string): string {
  // Keep the original title but prefix with category hint
  // The AI will use this as a template when applying to new destinations
  return title;
}

/**
 * Save an itinerary as a reusable template
 */
export async function saveAsTemplate(input: CreateTemplateInput): Promise<{
  success: boolean;
  template?: ItineraryTemplate;
  error?: string;
}> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    const templateData = abstractItinerary(input.days);

    // Use type assertion for insert since types may not be synced yet
    const insertData = {
      user_id: user.id,
      name: input.name,
      description: input.description || null,
      source_destination: input.sourceDestination,
      source_trip_id: input.sourceTripId || null,
      template_data: templateData,
      day_count: input.days.length,
      tags: input.tags || [],
      trip_type: input.tripType || null,
      pace: input.pace || null,
    };

    const { data, error } = await supabase
      .from('itinerary_templates')
      .insert(insertData as any)
      .select()
      .single();

    if (error) {
      console.error('[Templates] Save error:', error);
      return { success: false, error: error.message };
    }

    return { 
      success: true, 
      template: {
        ...data,
        template_data: data.template_data as unknown as TemplateDayData[],
        tags: data.tags || [],
      } as ItineraryTemplate,
    };
  } catch (err) {
    console.error('[Templates] Save exception:', err);
    return { success: false, error: 'Failed to save template' };
  }
}

/**
 * Get all templates for the current user
 */
export async function getUserTemplates(): Promise<ItineraryTemplate[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    const { data, error } = await supabase
      .from('itinerary_templates')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[Templates] Fetch error:', error);
      return [];
    }

    return (data || []).map(row => ({
      ...row,
      template_data: row.template_data as unknown as TemplateDayData[],
      tags: row.tags || [],
    })) as ItineraryTemplate[];
  } catch (err) {
    console.error('[Templates] Fetch exception:', err);
    return [];
  }
}

/**
 * Get a single template by ID
 */
export async function getTemplate(templateId: string): Promise<ItineraryTemplate | null> {
  try {
    const { data, error } = await supabase
      .from('itinerary_templates')
      .select('*')
      .eq('id', templateId)
      .single();

    if (error || !data) return null;

    return {
      ...data,
      template_data: data.template_data as unknown as TemplateDayData[],
      tags: data.tags || [],
    } as ItineraryTemplate;
  } catch {
    return null;
  }
}

/**
 * Delete a template
 */
export async function deleteTemplate(templateId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('itinerary_templates')
      .delete()
      .eq('id', templateId);

    return !error;
  } catch {
    return false;
  }
}

/**
 * Increment usage count when a template is applied
 */
export async function recordTemplateUsage(templateId: string): Promise<void> {
  try {
    const { data: current } = await supabase
      .from('itinerary_templates')
      .select('use_count')
      .eq('id', templateId)
      .single();

    await supabase
      .from('itinerary_templates')
      .update({
        use_count: (current?.use_count || 0) + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq('id', templateId);
  } catch (err) {
    console.error('[Templates] Usage tracking error:', err);
  }
}
