import { motion } from 'framer-motion';
import { 
  Check, 
  Lock,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { 
  TRAVELER_STAGES,
  calculateEvolutionPath,
  type TravelerStage,
} from '@/data/evolutionData';

interface TravelDNAEvolutionProps {
  category: string;
  tripCount?: number;
  travelFrequency?: string;
  hasOverrides?: boolean;
  quizCompleted?: boolean;
  className?: string;
}

export default function TravelDNAEvolution({
  category,
  tripCount = 0,
  travelFrequency,
  hasOverrides = false,
  quizCompleted = true,
  className
}: TravelDNAEvolutionProps) {

  const evolution = calculateEvolutionPath(tripCount, category, {
    travelFrequency,
    hasOverrides,
    quizCompleted
  });
  
  const currentStageData = TRAVELER_STAGES[evolution.currentStage];
  const nextStageData = evolution.currentStage !== evolution.nextStage 
    ? TRAVELER_STAGES[evolution.nextStage] 
    : null;

  const stages: TravelerStage[] = ['Novice', 'Experienced', 'Expert', 'Master Traveler'];
  const currentStageIndex = stages.indexOf(evolution.currentStage);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("space-y-8", className)}
    >
      {/* Current Stage - Editorial Hero */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <Sparkles className="h-7 w-7 text-primary" />
          </div>
          <div>
            <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground mb-1">
              Current Stage
            </p>
            <h3 className="font-serif text-2xl font-semibold text-foreground">
              {currentStageData.name}
            </h3>
          </div>
        </div>
        
        <p className="text-lg italic text-muted-foreground border-l-2 border-primary/30 pl-4">
          "{currentStageData.tagline}"
        </p>
      </div>

      {/* Stage Journey - Simplified Visual */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          {stages.map((stage, index) => {
            const isComplete = index < currentStageIndex;
            const isCurrent = index === currentStageIndex;
            
            return (
              <div key={stage} className="flex-1 flex items-center">
                <div 
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium transition-all",
                    isComplete && "bg-primary text-primary-foreground",
                    isCurrent && "bg-primary/20 border-2 border-primary text-primary",
                    !isComplete && !isCurrent && "bg-muted border border-border text-muted-foreground"
                  )}
                >
                  {isComplete ? <Check className="h-4 w-4" /> : index + 1}
                </div>
                {index < stages.length - 1 && (
                  <div className={cn(
                    "flex-1 h-0.5 mx-1.5 rounded-full",
                    isComplete ? "bg-primary" : "bg-border"
                  )} />
                )}
              </div>
            );
          })}
        </div>
        
        {/* Stage Labels - Mobile friendly */}
        <div className="flex text-[10px] text-muted-foreground">
          {stages.map((stage, index) => (
            <div 
              key={stage} 
              className={cn(
                "flex-1 text-center",
                index === currentStageIndex && "text-foreground font-medium"
              )}
            >
              {TRAVELER_STAGES[stage].name.replace('The ', '').split(' ')[0]}
            </div>
          ))}
        </div>
      </div>

      {/* Progress to Next - Clean Card */}
      {nextStageData && (
        <div className="p-5 rounded-xl bg-muted/30 border border-border space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">
                Next: {nextStageData.name}
              </span>
            </div>
            <span className="text-sm font-medium text-primary">
              {Math.round(evolution.progressPercent)}%
            </span>
          </div>
          <Progress value={evolution.progressPercent} className="h-2" />
          <p className="text-sm text-muted-foreground">
            {evolution.unlockHint}
          </p>
        </div>
      )}

      {/* Milestones - Simple List */}
      <div className="space-y-3">
        <h4 className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
          Milestones Unlocked
        </h4>
        <div className="space-y-2">
          {currentStageData.keyMilestones.slice(0, 3).map((milestone, i) => (
            <div key={i} className="flex items-center gap-3 text-sm text-foreground/80">
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Check className="h-3 w-3 text-primary" />
              </div>
              {milestone}
            </div>
          ))}
        </div>
      </div>

      {/* What's Next - Teaser */}
      {evolution.currentStage !== 'Master Traveler' && (
        <div className="space-y-3">
          <h4 className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
            Coming Soon
          </h4>
          <div className="space-y-2">
            {evolution.growthAreas.slice(0, 2).map((area, i) => (
              <div key={i} className="flex items-center gap-3 text-sm text-muted-foreground">
                <div className="w-5 h-5 rounded-full bg-muted border border-border flex items-center justify-center flex-shrink-0">
                  <Lock className="h-2.5 w-2.5" />
                </div>
                {area}
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
