-- Create achievements definition table (static achievement definitions)
CREATE TABLE public.achievements (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL, -- 'milestone', 'exploration', 'social', 'mastery', 'special'
  icon TEXT NOT NULL DEFAULT 'trophy',
  points INTEGER NOT NULL DEFAULT 10,
  tier TEXT NOT NULL DEFAULT 'bronze', -- 'bronze', 'silver', 'gold', 'platinum'
  requirement_type TEXT NOT NULL, -- 'count', 'first', 'streak', 'special'
  requirement_value INTEGER DEFAULT 1,
  requirement_meta JSONB DEFAULT '{}',
  is_hidden BOOLEAN DEFAULT false, -- Hidden until unlocked
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user achievement unlocks table
CREATE TABLE public.achievement_unlocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  achievement_id TEXT NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  progress INTEGER DEFAULT 0, -- For progressive achievements
  metadata JSONB DEFAULT '{}', -- Context about how it was unlocked
  notified BOOLEAN DEFAULT false, -- Whether user has been shown the unlock
  UNIQUE(user_id, achievement_id)
);

-- Enable RLS
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievement_unlocks ENABLE ROW LEVEL SECURITY;

-- Achievements are publicly readable (static definitions)
CREATE POLICY "Achievements are publicly readable"
ON public.achievements
FOR SELECT
USING (is_active = true);

-- Users can view their own unlocks
CREATE POLICY "Users can view own achievement unlocks"
ON public.achievement_unlocks
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own unlocks (triggered by app logic)
CREATE POLICY "Users can unlock achievements"
ON public.achievement_unlocks
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own unlocks (mark as notified)
CREATE POLICY "Users can update own unlocks"
ON public.achievement_unlocks
FOR UPDATE
USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_achievement_unlocks_user_id ON public.achievement_unlocks(user_id);
CREATE INDEX idx_achievement_unlocks_achievement_id ON public.achievement_unlocks(achievement_id);
CREATE INDEX idx_achievements_category ON public.achievements(category);

-- Seed initial achievements
INSERT INTO public.achievements (id, name, description, category, icon, points, tier, requirement_type, requirement_value, sort_order) VALUES
-- Milestone achievements
('first_quiz', 'DNA Discovered', 'Completed your Travel DNA quiz', 'milestone', 'dna', 50, 'bronze', 'first', 1, 1),
('first_trip', 'First Steps', 'Created your first trip', 'milestone', 'plane', 50, 'bronze', 'first', 1, 2),
('first_itinerary', 'Itinerary Architect', 'Generated your first AI itinerary', 'milestone', 'sparkles', 75, 'bronze', 'first', 1, 3),
('profile_complete', 'Identity Complete', 'Filled out your complete travel profile', 'milestone', 'user-check', 100, 'silver', 'first', 1, 4),

-- Exploration achievements
('trips_5', 'Seasoned Planner', 'Planned 5 trips', 'exploration', 'map', 100, 'bronze', 'count', 5, 10),
('trips_10', 'Globetrotter', 'Planned 10 trips', 'exploration', 'globe', 200, 'silver', 'count', 10, 11),
('trips_25', 'World Explorer', 'Planned 25 trips', 'exploration', 'compass', 500, 'gold', 'count', 25, 12),
('continents_3', 'Continental', 'Planned trips across 3 continents', 'exploration', 'globe-2', 150, 'silver', 'count', 3, 15),
('continents_5', 'Five Continents Club', 'Planned trips across 5 continents', 'exploration', 'award', 300, 'gold', 'count', 5, 16),

-- Social achievements
('first_share', 'Storyteller', 'Shared your first trip', 'social', 'share-2', 50, 'bronze', 'first', 1, 20),
('group_trip', 'Pack Leader', 'Planned a group trip with 4+ travelers', 'social', 'users', 75, 'bronze', 'first', 1, 21),

-- Mastery achievements  
('days_regenerated_10', 'Perfectionist', 'Refined 10 days with AI regeneration', 'mastery', 'refresh-cw', 100, 'bronze', 'count', 10, 30),
('activities_swapped_25', 'Curator', 'Swapped 25 activities to personalize trips', 'mastery', 'shuffle', 150, 'silver', 'count', 25, 31),
('templates_saved', 'Template Master', 'Saved an itinerary as a reusable template', 'mastery', 'bookmark', 75, 'bronze', 'first', 1, 32),

-- Special achievements
('early_adopter', 'Early Adopter', 'Joined Voyance in its first year', 'special', 'star', 200, 'gold', 'special', 1, 50),
('mystery_trip', 'Mystery Seeker', 'Completed a Mystery Getaway', 'special', 'sparkles', 100, 'silver', 'first', 1, 51);