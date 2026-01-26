import { motion } from 'framer-motion';
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
  type LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { useUserAchievements, type UserAchievement } from '@/services/achievementsAPI';
import { useAuth } from '@/contexts/AuthContext';

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

// Tier colors
const TIER_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  bronze: { 
    bg: 'bg-amber-100 dark:bg-amber-900/30', 
    border: 'border-amber-300 dark:border-amber-700',
    text: 'text-amber-700 dark:text-amber-400'
  },
  silver: { 
    bg: 'bg-slate-100 dark:bg-slate-800/50', 
    border: 'border-slate-300 dark:border-slate-600',
    text: 'text-slate-600 dark:text-slate-300'
  },
  gold: { 
    bg: 'bg-yellow-100 dark:bg-yellow-900/30', 
    border: 'border-yellow-400 dark:border-yellow-600',
    text: 'text-yellow-700 dark:text-yellow-400'
  },
  platinum: { 
    bg: 'bg-violet-100 dark:bg-violet-900/30', 
    border: 'border-violet-400 dark:border-violet-600',
    text: 'text-violet-700 dark:text-violet-400'
  },
};

interface AchievementBadgeProps {
  achievement: UserAchievement;
  index: number;
}

function AchievementBadge({ achievement, index }: AchievementBadgeProps) {
  const IconComponent = ICON_MAP[achievement.icon] || Trophy;
  const tierStyle = TIER_STYLES[achievement.tier] || TIER_STYLES.bronze;
  const isUnlocked = achievement.unlocked;
  
  // Calculate progress percentage for count-based achievements
  const progressPercent = achievement.requirement_type === 'count' && achievement.requirement_value
    ? Math.min(100, ((achievement.progress || 0) / achievement.requirement_value) * 100)
    : 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        "relative p-4 rounded-xl border-2 transition-all",
        isUnlocked 
          ? `${tierStyle.bg} ${tierStyle.border}` 
          : "bg-muted/30 border-border/50 opacity-60"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
          isUnlocked ? tierStyle.bg : "bg-muted"
        )}>
          {isUnlocked ? (
            <IconComponent className={cn("h-5 w-5", tierStyle.text)} />
          ) : (
            <Lock className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className={cn(
              "font-medium text-sm truncate",
              isUnlocked ? "text-foreground" : "text-muted-foreground"
            )}>
              {achievement.name}
            </h4>
            {isUnlocked && (
              <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded", tierStyle.bg, tierStyle.text)}>
                +{achievement.points}
              </span>
            )}
          </div>
          
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
            {achievement.description}
          </p>
          
          {/* Progress bar for count-based locked achievements */}
          {!isUnlocked && achievement.requirement_type === 'count' && achievement.requirement_value && (
            <div className="mt-2 space-y-1">
              <Progress value={progressPercent} className="h-1.5" />
              <p className="text-[10px] text-muted-foreground">
                {achievement.progress || 0} / {achievement.requirement_value}
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

interface AchievementsPanelProps {
  className?: string;
}

export default function AchievementsPanel({ className }: AchievementsPanelProps) {
  const { user } = useAuth();
  const { data, isLoading } = useUserAchievements(user?.id || '');
  
  if (isLoading || !data) {
    return (
      <div className={cn("space-y-6", className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-20 bg-muted rounded-xl" />
          <div className="h-20 bg-muted rounded-xl" />
          <div className="h-20 bg-muted rounded-xl" />
        </div>
      </div>
    );
  }
  
  const { achievements, totalPoints, unlockedCount } = data;
  const totalAchievements = achievements.length;
  
  // Separate unlocked and locked achievements
  const unlockedAchievements = achievements.filter(a => a.unlocked);
  const lockedAchievements = achievements.filter(a => !a.unlocked);
  
  // Sort: unlocked by unlock date (recent first), locked by sort_order
  unlockedAchievements.sort((a, b) => {
    if (a.unlocked_at && b.unlocked_at) {
      return new Date(b.unlocked_at).getTime() - new Date(a.unlocked_at).getTime();
    }
    return 0;
  });
  
  return (
    <div className={cn("space-y-6", className)}>
      {/* Summary Header */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
            <Trophy className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-foreground">{totalPoints}</p>
            <p className="text-xs text-muted-foreground">Total Points</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold text-foreground">{unlockedCount}/{totalAchievements}</p>
          <p className="text-xs text-muted-foreground">Achievements</p>
        </div>
      </div>
      
      {/* Unlocked Achievements */}
      {unlockedAchievements.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-medium tracking-widest uppercase text-muted-foreground flex items-center gap-2">
            <Sparkles className="h-3 w-3" />
            Earned
          </h4>
          <div className="grid gap-3">
            {unlockedAchievements.map((achievement, i) => (
              <AchievementBadge key={achievement.id} achievement={achievement} index={i} />
            ))}
          </div>
        </div>
      )}
      
      {/* Locked Achievements */}
      {lockedAchievements.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs font-medium tracking-widest uppercase text-muted-foreground flex items-center gap-2">
            <Lock className="h-3 w-3" />
            In Progress
          </h4>
          <div className="grid gap-3">
            {lockedAchievements.slice(0, 4).map((achievement, i) => (
              <AchievementBadge key={achievement.id} achievement={achievement} index={i} />
            ))}
          </div>
          {lockedAchievements.length > 4 && (
            <p className="text-xs text-muted-foreground text-center pt-2">
              +{lockedAchievements.length - 4} more to unlock
            </p>
          )}
        </div>
      )}
      
      {/* Empty state */}
      {unlockedAchievements.length === 0 && (
        <div className="text-center py-8">
          <Trophy className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Complete actions to earn achievements
          </p>
        </div>
      )}
    </div>
  );
}
