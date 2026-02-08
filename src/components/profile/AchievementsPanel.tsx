import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, 
  Lock,
  Sparkles,
  Plane,
  Dna,
  UserCheck,
  Map,
  Globe,
  Compass,
  Share2,
  Users,
  RefreshCw,
  Shuffle,
  Bookmark,
  Star,
  Award,
  ExternalLink,
  ChevronDown,
  type LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useUserAchievements, syncRetroactiveAchievements, type UserAchievement, type AchievementCategory } from '@/services/achievementsAPI';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';

// Map icon names from DB to Lucide components
const ICON_MAP: Record<string, LucideIcon> = {
  trophy: Trophy,
  dna: Dna,
  plane: Plane,
  sparkles: Sparkles,
  'user-check': UserCheck,
  map: Map,
  globe: Globe,
  'globe-2': Globe,
  compass: Compass,
  'share-2': Share2,
  users: Users,
  'refresh-cw': RefreshCw,
  shuffle: Shuffle,
  bookmark: Bookmark,
  star: Star,
  award: Award,
};

// Tier visual config
const TIER_STYLES: Record<string, { gradient: string; icon: string; label: string; ring: string }> = {
  bronze: { 
    gradient: 'from-amber-600/20 to-amber-400/5', 
    icon: 'text-amber-600 dark:text-amber-400',
    label: 'Bronze',
    ring: 'ring-amber-400/30',
  },
  silver: { 
    gradient: 'from-slate-400/20 to-slate-300/5', 
    icon: 'text-slate-500 dark:text-slate-300',
    label: 'Silver',
    ring: 'ring-slate-400/30',
  },
  gold: { 
    gradient: 'from-yellow-500/20 to-yellow-300/5', 
    icon: 'text-yellow-600 dark:text-yellow-400',
    label: 'Gold',
    ring: 'ring-yellow-400/30',
  },
  platinum: { 
    gradient: 'from-violet-500/20 to-pink-400/5', 
    icon: 'text-violet-500 dark:text-violet-400',
    label: 'Platinum',
    ring: 'ring-violet-400/30',
  },
};

const CATEGORY_CONFIG: Record<string, { label: string; icon: LucideIcon }> = {
  milestone: { label: 'Milestones', icon: Trophy },
  exploration: { label: 'Exploration', icon: Compass },
  social: { label: 'Social', icon: Users },
  mastery: { label: 'Mastery', icon: Star },
  special: { label: 'Special', icon: Sparkles },
};

function shareAchievement(achievement: UserAchievement) {
  const tierLabel = TIER_STYLES[achievement.tier]?.label || 'Bronze';
  const text = `I just earned the "${achievement.name}" ${tierLabel} badge on Voyance! ${achievement.description}`;
  const url = 'https://voyance-travel-planner.lovable.app';
  
  if (navigator.share) {
    navigator.share({
      title: `Voyance Achievement: ${achievement.name}`,
      text,
      url,
    }).catch(() => {
      navigator.clipboard.writeText(`${text}\n${url}`).then(() => toast.success('Copied to clipboard!'));
    });
  } else {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(twitterUrl, '_blank', 'width=550,height=420');
  }
}

// ============================================================================
// ACHIEVEMENT CARD - Editorial Style
// ============================================================================

function AchievementCard({ achievement, index }: { achievement: UserAchievement; index: number }) {
  const IconComponent = ICON_MAP[achievement.icon] || Trophy;
  const tierStyle = TIER_STYLES[achievement.tier] || TIER_STYLES.bronze;
  const isUnlocked = achievement.unlocked;
  
  const progressPercent = achievement.requirement_type === 'count' && achievement.requirement_value
    ? Math.min(100, ((achievement.progress || 0) / achievement.requirement_value) * 100)
    : 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, duration: 0.3 }}
      className={cn(
        "group relative",
        !isUnlocked && "opacity-50"
      )}
    >
      <div className={cn(
        "flex items-start gap-4 py-4",
        index > 0 && "border-t border-border/50"
      )}>
        {/* Icon circle */}
        <div className={cn(
          "relative w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-all",
          isUnlocked 
            ? `bg-gradient-to-br ${tierStyle.gradient} ring-1 ${tierStyle.ring}` 
            : "bg-muted/50 ring-1 ring-border/30"
        )}>
          {isUnlocked ? (
            <IconComponent className={cn("h-5 w-5", tierStyle.icon)} strokeWidth={1.5} />
          ) : (
            <Lock className="h-4 w-4 text-muted-foreground/60" strokeWidth={1.5} />
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className={cn(
              "font-medium text-sm",
              isUnlocked ? "text-foreground" : "text-muted-foreground"
            )}>
              {achievement.name}
            </h4>
            {isUnlocked && (
              <span className={cn(
                "text-[10px] font-semibold tracking-wider uppercase",
                tierStyle.icon
              )}>
                {tierStyle.label}
              </span>
            )}
          </div>
          
          <p className="text-xs text-muted-foreground leading-relaxed">
            {achievement.description}
          </p>
          
          {/* Unlock date + share for unlocked */}
          {isUnlocked && achievement.unlocked_at && (
            <div className="flex items-center gap-3 pt-1">
              <span className="text-[10px] text-muted-foreground/70">
                Earned {format(new Date(achievement.unlocked_at), 'MMM d, yyyy')}
              </span>
              <button
                onClick={() => shareAchievement(achievement)}
                className="text-[10px] text-muted-foreground/70 hover:text-foreground flex items-center gap-1 transition-colors"
              >
                <ExternalLink className="h-2.5 w-2.5" />
                Share
              </button>
            </div>
          )}
          
          {/* Progress for locked count-based */}
          {!isUnlocked && achievement.requirement_type === 'count' && achievement.requirement_value && (
            <div className="pt-1.5 space-y-1">
              <div className="flex items-center justify-between">
                <Progress value={progressPercent} className="h-1 flex-1 mr-3" />
                <span className="text-[10px] text-muted-foreground tabular-nums">
                  {achievement.progress || 0}/{achievement.requirement_value}
                </span>
              </div>
            </div>
          )}

          {/* Points badge for unlocked */}
          {isUnlocked && (
            <div className="pt-0.5">
              <span className="text-[10px] text-muted-foreground/60">
                +{achievement.points} pts
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// CATEGORY GROUP
// ============================================================================

function CategoryGroup({ 
  category, 
  achievements, 
  defaultOpen = true 
}: { 
  category: string; 
  achievements: UserAchievement[];
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const config = CATEGORY_CONFIG[category] || { label: category, icon: Trophy };
  const CategoryIcon = config.icon;
  const unlockedInCategory = achievements.filter(a => a.unlocked).length;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-2.5 text-left group">
        <div className="flex items-center gap-2.5">
          <CategoryIcon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
          <h4 className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
            {config.label}
          </h4>
          <span className="text-[10px] text-muted-foreground/50 tabular-nums">
            {unlockedInCategory}/{achievements.length}
          </span>
        </div>
        <ChevronDown className={cn(
          "h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200",
          isOpen && "rotate-180"
        )} />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="pl-0.5">
          {achievements.map((achievement, i) => (
            <AchievementCard key={achievement.id} achievement={achievement} index={i} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================================================
// MAIN PANEL
// ============================================================================

interface AchievementsPanelProps {
  className?: string;
}

export default function AchievementsPanel({ className }: AchievementsPanelProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = useUserAchievements(user?.id || '');
  const hasSynced = useRef(false);

  // Retroactively unlock achievements for users who completed actions before the system existed
  useEffect(() => {
    if (!user?.id || hasSynced.current) return;
    hasSynced.current = true;
    syncRetroactiveAchievements().then((count) => {
      if (count > 0) {
        queryClient.invalidateQueries({ queryKey: ['user-achievements'] });
        toast.success(`${count} achievement${count > 1 ? 's' : ''} retroactively unlocked!`);
      }
    });
  }, [user?.id, queryClient]);
  
  if (isLoading || !data) {
    return (
      <div className={cn("space-y-8", className)}>
        <div className="animate-pulse space-y-6">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="h-3 w-24 bg-muted rounded" />
              <div className="h-16 bg-muted/50 rounded-lg" />
              <div className="h-16 bg-muted/50 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  const { achievements, totalPoints, unlockedCount } = data;
  const totalAchievements = achievements.length;
  const progressPercent = totalAchievements > 0 ? (unlockedCount / totalAchievements) * 100 : 0;
  
  // Group by category, preserving order
  const categoryOrder: AchievementCategory[] = ['milestone', 'exploration', 'social', 'mastery', 'special'];
  const grouped = categoryOrder
    .map(cat => ({
      category: cat,
      items: achievements.filter(a => a.category === cat),
    }))
    .filter(g => g.items.length > 0);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn("space-y-8", className)}
    >
      {/* Editorial summary header */}
      <div className="space-y-4">
        <div className="flex items-baseline justify-between">
          <div>
            <span className="text-4xl font-serif font-semibold text-foreground tabular-nums">
              {totalPoints}
            </span>
            <span className="text-sm text-muted-foreground ml-2">points earned</span>
          </div>
          <div className="text-right">
            <span className="text-sm tabular-nums text-foreground font-medium">
              {unlockedCount}
            </span>
            <span className="text-sm text-muted-foreground">
              /{totalAchievements} badges
            </span>
          </div>
        </div>
        
        {/* Progress bar */}
        <div className="space-y-1.5">
          <Progress value={progressPercent} className="h-1" />
          <p className="text-[10px] text-muted-foreground/60 text-right">
            {Math.round(progressPercent)}% complete
          </p>
        </div>
      </div>

      {/* Category groups */}
      <div className="space-y-6">
        {grouped.map((group, i) => (
          <CategoryGroup 
            key={group.category} 
            category={group.category}
            achievements={group.items}
            defaultOpen={i < 2}
          />
        ))}
      </div>
      
      {/* Empty state */}
      {unlockedCount === 0 && (
        <div className="text-center py-12 space-y-3">
          <Trophy className="h-8 w-8 text-muted-foreground/30 mx-auto" strokeWidth={1} />
          <div>
            <p className="text-sm font-medium text-foreground">Start Your Collection</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto mt-1 leading-relaxed">
              Take the Travel DNA quiz, plan your first trip, or generate an itinerary to earn your first badge.
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
}
