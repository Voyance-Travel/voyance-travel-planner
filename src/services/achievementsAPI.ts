/**
 * Achievements API Service
 * Handles fetching, unlocking, and tracking user achievements
 */

import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ============================================================================
// TYPES
// ============================================================================

export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum';
export type AchievementCategory = 'milestone' | 'exploration' | 'social' | 'mastery' | 'special';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  category: AchievementCategory;
  icon: string;
  points: number;
  tier: AchievementTier;
  requirement_type: 'count' | 'first' | 'streak' | 'special';
  requirement_value: number;
  requirement_meta: Record<string, unknown>;
  is_hidden: boolean;
  sort_order: number;
}

export interface AchievementUnlock {
  id: string;
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
  progress: number;
  metadata: Record<string, unknown>;
  notified: boolean;
}

export interface UserAchievement extends Achievement {
  unlocked: boolean;
  unlocked_at: string | null;
  progress: number;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Fetch all available achievements
 */
export async function getAllAchievements(): Promise<Achievement[]> {
  const { data, error } = await supabase
    .from('achievements')
    .select('*')
    .order('sort_order', { ascending: true });

  if (error) {
    console.error('[Achievements] Fetch error:', error);
    return [];
  }

  return (data || []) as Achievement[];
}

/**
 * Fetch user's unlocked achievements
 */
export async function getUserUnlocks(userId: string): Promise<AchievementUnlock[]> {
  const { data, error } = await supabase
    .from('achievement_unlocks')
    .select('*')
    .eq('user_id', userId);

  if (error) {
    console.error('[Achievements] Fetch unlocks error:', error);
    return [];
  }

  return (data || []) as AchievementUnlock[];
}

/**
 * Get combined achievement data for a user
 */
export async function getUserAchievements(userId: string): Promise<{
  achievements: UserAchievement[];
  totalPoints: number;
  unlockedCount: number;
}> {
  const [allAchievements, userUnlocks] = await Promise.all([
    getAllAchievements(),
    getUserUnlocks(userId),
  ]);

  const unlockMap = new Map(
    userUnlocks.map(u => [u.achievement_id, u])
  );

  const achievements: UserAchievement[] = allAchievements
    .filter(a => !a.is_hidden || unlockMap.has(a.id))
    .map(a => {
      const unlock = unlockMap.get(a.id);
      return {
        ...a,
        unlocked: !!unlock,
        unlocked_at: unlock?.unlocked_at || null,
        progress: unlock?.progress || 0,
      };
    });

  const unlockedAchievements = achievements.filter(a => a.unlocked);
  const totalPoints = unlockedAchievements.reduce((sum, a) => sum + a.points, 0);

  return {
    achievements,
    totalPoints,
    unlockedCount: unlockedAchievements.length,
  };
}

/**
 * Unlock an achievement for the current user
 */
export async function unlockAchievement(
  achievementId: string,
  metadata?: Record<string, unknown>
): Promise<{ success: boolean; alreadyUnlocked?: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    // Check if already unlocked
    const { data: existing } = await supabase
      .from('achievement_unlocks')
      .select('id')
      .eq('user_id', user.id)
      .eq('achievement_id', achievementId)
      .maybeSingle();

    if (existing) {
      return { success: true, alreadyUnlocked: true };
    }

    // Insert unlock
    const { error } = await supabase
      .from('achievement_unlocks')
      .insert({
        user_id: user.id,
        achievement_id: achievementId,
        metadata: metadata || {},
      } as any);

    if (error) {
      console.error('[Achievements] Unlock error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.error('[Achievements] Unlock exception:', err);
    return { success: false, error: 'Failed to unlock achievement' };
  }
}

/**
 * Update progress for a count-based achievement
 */
export async function updateAchievementProgress(
  achievementId: string,
  progress: number
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get the achievement to check threshold
    const { data: achievement } = await supabase
      .from('achievements')
      .select('requirement_value')
      .eq('id', achievementId)
      .single();

    if (!achievement) return;

    // Check if already unlocked
    const { data: existing } = await supabase
      .from('achievement_unlocks')
      .select('id, progress')
      .eq('user_id', user.id)
      .eq('achievement_id', achievementId)
      .maybeSingle();

    if (existing) {
      // Already unlocked, just update progress if higher
      if (progress > (existing.progress || 0)) {
        await supabase
          .from('achievement_unlocks')
          .update({ progress })
          .eq('id', existing.id);
      }
      return;
    }

    // Check if we've reached the threshold
    if (progress >= achievement.requirement_value) {
      await unlockAchievement(achievementId, { final_progress: progress });
    }
  } catch (err) {
    console.error('[Achievements] Progress update error:', err);
  }
}

/**
 * Mark achievements as notified (user has seen them)
 */
export async function markAchievementsNotified(unlockIds: string[]): Promise<void> {
  try {
    await supabase
      .from('achievement_unlocks')
      .update({ notified: true })
      .in('id', unlockIds);
  } catch (err) {
    console.error('[Achievements] Mark notified error:', err);
  }
}

/**
 * Get unnotified achievement unlocks
 */
export async function getUnnotifiedAchievements(userId: string): Promise<AchievementUnlock[]> {
  const { data, error } = await supabase
    .from('achievement_unlocks')
    .select('*')
    .eq('user_id', userId)
    .eq('notified', false);

  if (error) return [];
  return (data || []) as AchievementUnlock[];
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

export function useAchievements() {
  return useQuery({
    queryKey: ['achievements'],
    queryFn: getAllAchievements,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour (static data)
  });
}

export function useUserAchievements(userId: string | undefined) {
  return useQuery({
    queryKey: ['user-achievements', userId],
    queryFn: () => getUserAchievements(userId!),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

export function useUnlockAchievement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ achievementId, metadata }: { achievementId: string; metadata?: Record<string, unknown> }) =>
      unlockAchievement(achievementId, metadata),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-achievements'] });
    },
  });
}

// ============================================================================
// ACHIEVEMENT TRIGGER HELPERS
// ============================================================================

/**
 * Check and unlock milestone achievements based on user actions
 */
export async function checkMilestoneAchievements(action: string, context?: Record<string, unknown>): Promise<void> {
  const achievementMap: Record<string, string> = {
    'quiz_completed': 'first_quiz',
    'trip_created': 'first_trip',
    'itinerary_generated': 'first_itinerary',
    'profile_completed': 'profile_complete',
    'trip_shared': 'first_share',
    'template_saved': 'templates_saved',
    'mystery_trip_completed': 'mystery_trip',
  };

  const achievementId = achievementMap[action];
  if (achievementId) {
    await unlockAchievement(achievementId, context);
  }
}

/**
 * Sync trip count achievements based on actual trip count
 * Call after creating a new trip to update progress on trips_5, trips_10, trips_25
 */
export async function syncTripCountAchievements(): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Count user's trips
    const { count, error } = await supabase
      .from('trips')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (error || count === null) return;

    // Update progress for count-based trip achievements
    const tripAchievements = [
      { id: 'trips_5', threshold: 5 },
      { id: 'trips_10', threshold: 10 },
      { id: 'trips_25', threshold: 25 },
    ];

    for (const { id, threshold } of tripAchievements) {
      if (count >= threshold) {
        await unlockAchievement(id, { tripCount: count });
      } else {
        await updateAchievementProgress(id, count);
      }
    }
  } catch (err) {
    console.error('[Achievements] Sync trip count error:', err);
  }
}

/**
 * Retroactive achievement sync — checks existing user state and unlocks
 * any achievements that were earned before the achievement system existed.
 * Safe to call multiple times (idempotent via unlockAchievement's duplicate check).
 */
export async function syncRetroactiveAchievements(): Promise<number> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 0;

    let unlocked = 0;

    // 1. Check if user has Travel DNA → first_quiz
    const { data: profile } = await supabase
      .from('profiles')
      .select('travel_dna, display_name, avatar_url')
      .eq('id', user.id)
      .single();

    if (profile?.travel_dna) {
      const result = await unlockAchievement('first_quiz', { retroactive: true });
      if (result.success && !result.alreadyUnlocked) unlocked++;
    }

    // 2. Check if profile is "complete" (has display_name + avatar + DNA)
    if (profile?.travel_dna && profile?.display_name && profile?.avatar_url) {
      const result = await unlockAchievement('profile_complete', { retroactive: true });
      if (result.success && !result.alreadyUnlocked) unlocked++;
    }

    // 3. Check trip counts
    const { count: tripCount } = await supabase
      .from('trips')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (tripCount && tripCount > 0) {
      const r = await unlockAchievement('first_trip', { retroactive: true });
      if (r.success && !r.alreadyUnlocked) unlocked++;

      // Count-based trip achievements
      for (const { id, threshold } of [
        { id: 'trips_5', threshold: 5 },
        { id: 'trips_10', threshold: 10 },
        { id: 'trips_25', threshold: 25 },
      ]) {
        if (tripCount >= threshold) {
          const r2 = await unlockAchievement(id, { retroactive: true, tripCount });
          if (r2.success && !r2.alreadyUnlocked) unlocked++;
        } else {
          await updateAchievementProgress(id, tripCount);
        }
      }
    }

    // 4. Check if user has generated any itinerary
    const { count: itinCount } = await supabase
      .from('trips')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .not('itinerary_data', 'is', null);

    if (itinCount && itinCount > 0) {
      const r = await unlockAchievement('first_itinerary', { retroactive: true });
      if (r.success && !r.alreadyUnlocked) unlocked++;
    }

    // 5. Check if user has collaborators (group trip)
    const { count: collabCount } = await supabase
      .from('trip_collaborators')
      .select('*', { count: 'exact', head: true })
      .eq('invited_by', user.id);

    if (collabCount && collabCount > 0) {
      const r = await unlockAchievement('group_trip', { retroactive: true });
      if (r.success && !r.alreadyUnlocked) unlocked++;
    }

    if (unlocked > 0) {
      console.log(`[Achievements] Retroactively unlocked ${unlocked} achievement(s)`);
    }

    return unlocked;
  } catch (err) {
    console.error('[Achievements] Retroactive sync error:', err);
    return 0;
  }
}

export const TIER_COLORS: Record<AchievementTier, string> = {
  bronze: 'from-amber-600 to-amber-400',
  silver: 'from-slate-400 to-slate-200',
  gold: 'from-yellow-500 to-yellow-300',
  platinum: 'from-purple-500 to-pink-400',
};

export const TIER_BG_COLORS: Record<AchievementTier, string> = {
  bronze: 'bg-amber-500/10 border-amber-500/30',
  silver: 'bg-slate-400/10 border-slate-400/30',
  gold: 'bg-yellow-500/10 border-yellow-500/30',
  platinum: 'bg-purple-500/10 border-purple-500/30',
};

export const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  milestone: 'Milestones',
  exploration: 'Exploration',
  social: 'Social',
  mastery: 'Mastery',
  special: 'Special',
};
