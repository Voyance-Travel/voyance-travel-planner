import { motion } from 'framer-motion';
import { 
  Check, 
  Star, 
  Globe, 
  Compass, 
  Map, 
  Heart, 
  Lightbulb, 
  Trophy,
  ChevronRight,
  Lock,
  Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { 
  TRAVELER_STAGES,
  CATEGORY_EVOLUTION,
  calculateEvolutionPath,
  getNextMilestones,
  type TravelerStage,
  type MaturityIndicator
} from '@/data/evolutionData';

const ICON_MAP = {
  check: Check,
  star: Star,
  globe: Globe,
  compass: Compass,
  map: Map,
  heart: Heart,
  lightbulb: Lightbulb,
  trophy: Trophy,
} as const;

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
  const categoryEvolution = CATEGORY_EVOLUTION[category] || CATEGORY_EVOLUTION.EXPLORER;
  const nextMilestones = getNextMilestones(evolution.currentStage);

  const stages: TravelerStage[] = ['Novice', 'Experienced', 'Expert', 'Master Traveler'];
  const currentStageIndex = stages.indexOf(evolution.currentStage);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("space-y-8", className)}
    >
      {/* Current Stage Hero */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
              Your Stage
            </p>
            <h3 className="font-serif text-2xl font-semibold text-foreground">
              {currentStageData.name}
            </h3>
          </div>
        </div>
        
        <p className="text-lg italic text-muted-foreground">
          "{currentStageData.tagline}"
        </p>
        
        <p className="text-foreground/80 leading-relaxed">
          {currentStageData.description}
        </p>
      </div>

      {/* Stage Progression Visual */}
      <div className="space-y-4">
        <h4 className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
          Your Journey
        </h4>
        
        <div className="relative">
          {/* Progress Track */}
          <div className="flex items-center gap-1">
            {stages.map((stage, index) => {
              const isComplete = index < currentStageIndex;
              const isCurrent = index === currentStageIndex;
              const isLocked = index > currentStageIndex;
              
              return (
                <div key={stage} className="flex-1 flex items-center">
                  {/* Stage Node */}
                  <div 
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all",
                      isComplete && "bg-primary text-primary-foreground",
                      isCurrent && "bg-primary/20 border-2 border-primary text-primary",
                      isLocked && "bg-muted border border-border text-muted-foreground"
                    )}
                  >
                    {isComplete ? (
                      <Check className="h-4 w-4" />
                    ) : isLocked ? (
                      <Lock className="h-3 w-3" />
                    ) : (
                      <span className="text-xs font-bold">{index + 1}</span>
                    )}
                  </div>
                  
                  {/* Connector Line */}
                  {index < stages.length - 1 && (
                    <div 
                      className={cn(
                        "flex-1 h-1 mx-1 rounded-full transition-all",
                        isComplete ? "bg-primary" : "bg-border"
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Stage Labels */}
          <div className="flex mt-2">
            {stages.map((stage, index) => (
              <div key={stage} className="flex-1 text-center first:text-left last:text-right">
                <span className={cn(
                  "text-xs",
                  index === currentStageIndex ? "text-foreground font-medium" : "text-muted-foreground"
                )}>
                  {TRAVELER_STAGES[stage].name.replace('The ', '')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Progress to Next Stage */}
      {nextStageData && (
        <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Progress to {nextStageData.name}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {Math.round(evolution.progressPercent)}%
            </span>
          </div>
          
          <Progress value={evolution.progressPercent} className="h-2" />
          
          <p className="text-xs text-muted-foreground">
            {evolution.unlockHint}
          </p>
        </div>
      )}

      {/* Key Milestones Achieved */}
      <div className="space-y-4">
        <h4 className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
          Milestones Achieved
        </h4>
        <div className="grid gap-2">
          {currentStageData.keyMilestones.map((milestone, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-3 text-foreground/80"
            >
              <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Check className="h-3 w-3 text-primary" />
              </div>
              <span className="text-sm">{milestone}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Next Milestones to Unlock */}
      {nextMilestones.length > 0 && evolution.currentStage !== 'Master Traveler' && (
        <div className="space-y-4">
          <h4 className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
            Next Milestones
          </h4>
          <div className="grid gap-2">
            {nextMilestones.slice(0, 3).map((milestone, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.1 }}
                className="flex items-center gap-3 text-muted-foreground"
              >
                <div className="w-5 h-5 rounded-full bg-muted border border-border flex items-center justify-center flex-shrink-0">
                  <Lock className="h-2.5 w-2.5" />
                </div>
                <span className="text-sm">{milestone}</span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Maturity Indicators */}
      <div className="space-y-4">
        <h4 className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
          {category} Mastery Indicators
        </h4>
        <div className="grid sm:grid-cols-2 gap-3">
          {categoryEvolution.maturityIndicators.map((indicator, i) => {
            const Icon = ICON_MAP[indicator.icon];
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + i * 0.1 }}
                className="p-3 rounded-lg bg-muted/20 border border-border/50 space-y-1"
              >
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-primary/70" />
                  <span className="text-sm font-medium text-foreground">{indicator.label}</span>
                </div>
                <p className="text-xs text-muted-foreground pl-6">
                  {indicator.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Growth Areas */}
      <div className="space-y-4">
        <h4 className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
          Areas for Growth
        </h4>
        <div className="grid gap-3">
          {evolution.growthAreas.slice(0, 3).map((area, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 + i * 0.1 }}
              className="flex items-start gap-3 py-2"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-foreground/30 mt-2 flex-shrink-0" />
              <span className="text-foreground/80">{area}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Evolution Tip */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="pt-4 border-t border-border"
      >
        <p className="text-sm italic text-muted-foreground">
          💡 {categoryEvolution.evolutionTip}
        </p>
      </motion.div>
    </motion.div>
  );
}
