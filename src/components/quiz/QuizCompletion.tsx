import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, MapPin, Plane, CheckCircle2, Gift, Zap, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/config/routes';
import { useBonusCredits, BONUS_INFO } from '@/hooks/useBonusCredits';
import { toast } from 'sonner';
import { getArchetypeNarrative, getCategoryColors, type ArchetypeNarrative } from '@/data/archetypeNarratives';
import { getRarityLabel, getRarityDisplay } from '@/config/typeRarity';
import { cn } from '@/lib/utils';

interface DNAResult {
  primary_archetype_name?: string;
  primary_archetype_display?: string;
  primary_archetype_category?: string;
  primary_archetype_tagline?: string;
  secondary_archetype_name?: string;
  secondary_archetype_display?: string;
  dna_confidence_score?: number;
  dna_rarity?: string;
  tone_tags?: string[];
  emotional_drivers?: string[];
  perfect_trip_preview?: string;
  summary?: string;
}

interface QuizCompletionProps {
  onContinue?: () => void;
  dnaResult?: DNAResult | null;
}

// Confetti particle component
function ConfettiParticle({ delay, x }: { delay: number; x: number }) {
  const colors = ['#C2956E', '#D4A574', '#B8860B', '#CD853F', '#8B7355'];
  const color = colors[Math.floor(Math.random() * colors.length)];
  
  return (
    <motion.div
      initial={{ 
        y: -20, 
        x: x, 
        opacity: 1,
        rotate: 0,
        scale: 1 
      }}
      animate={{ 
        y: 400, 
        x: x + (Math.random() - 0.5) * 200,
        opacity: 0,
        rotate: Math.random() * 360,
        scale: 0.5
      }}
      transition={{ 
        duration: 3,
        delay: delay,
        ease: 'easeOut'
      }}
      className="absolute top-0 w-3 h-3 rounded-sm"
      style={{ backgroundColor: color, left: '50%' }}
    />
  );
}

/** DNA Reveal Card shown on the completion screen */
function DNARevealCard({ dnaResult }: { dnaResult: DNAResult }) {
  const narrative = dnaResult.primary_archetype_name 
    ? getArchetypeNarrative(dnaResult.primary_archetype_name) 
    : null;

  const secondaryNarrative = dnaResult.secondary_archetype_name
    ? getArchetypeNarrative(dnaResult.secondary_archetype_name)
    : null;

  if (!narrative) return null;

  // Ensure secondary is distinct from primary
  const validSecondary = secondaryNarrative && secondaryNarrative.id !== narrative.id 
    ? secondaryNarrative 
    : null;

  const confidence = dnaResult.dna_confidence_score || 85;
  const archetypeId = dnaResult.primary_archetype_name || '';
  const rarity = getRarityLabel(archetypeId) || dnaResult.dna_rarity || 'Uncommon';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: 0.6, duration: 0.5, type: 'spring', stiffness: 200 }}
      className="w-full max-w-md mx-auto mt-6"
    >
      {/* Main archetype card */}
      <div className="relative overflow-hidden rounded-2xl bg-foreground dark:bg-foreground/95">
        {/* Subtle texture */}
        <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(circle_at_70%_30%,white_0.5px,transparent_0.5px)] bg-[size:20px_20px]" />
        <div className="absolute top-0 left-0 w-1 h-full bg-primary" />

        <div className="relative z-10 p-6 space-y-4">
          {/* Kicker */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-[11px] font-medium tracking-[0.25em] uppercase text-primary"
          >
            Your Travel DNA
          </motion.p>

          {/* Archetype name */}
          <motion.h2
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="font-serif text-3xl md:text-4xl font-bold text-background leading-[1.05] tracking-tight"
          >
            {narrative.name}
          </motion.h2>

          {/* Hook line */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.0 }}
            className="text-base text-background/50 italic max-w-sm leading-relaxed font-serif"
          >
            "{narrative.hookLine}"
          </motion.p>

          {/* Core description */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1 }}
            className="text-sm text-background/40 leading-relaxed"
          >
            {narrative.coreDescription}
          </motion.p>

          {/* Metadata row */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-3 border-t border-background/10"
          >
            <span className="text-xs font-medium tracking-wide uppercase text-background/40">
              {narrative.category.charAt(0) + narrative.category.slice(1).toLowerCase()}
            </span>
            <span className="text-background/15">·</span>
            <span className="text-xs text-background/35">{rarity}</span>
            <span className="text-background/15">·</span>
            <span className="text-xs text-background/35">{confidence}% match</span>

            {validSecondary && (
              <>
                <span className="text-background/15">·</span>
                <span className="text-xs text-background/35">
                  hints of <span className="font-medium text-background/55">{validSecondary.name}</span>
                </span>
              </>
            )}
          </motion.div>
        </div>
      </div>

      {/* Superpowers preview */}
      {narrative.superpowers.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.3 }}
          className="mt-4 space-y-2"
        >
          <p className="text-xs font-medium tracking-widest uppercase text-muted-foreground">
            Your Superpowers
          </p>
          <div className="flex flex-wrap gap-2">
            {narrative.superpowers.slice(0, 3).map((power, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.4 + i * 0.1 }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20"
              >
                <Zap className="h-3 w-3 text-primary" />
                <span className="text-xs font-medium text-foreground/80">{power}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Tone tags */}
      {dnaResult.tone_tags && dnaResult.tone_tags.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.6 }}
          className="mt-4 flex flex-wrap gap-2"
        >
          {dnaResult.tone_tags.slice(0, 5).map((tag, i) => (
            <span
              key={i}
              className="px-2.5 py-1 text-xs border border-border rounded-full text-muted-foreground capitalize"
            >
              {tag}
            </span>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}

export function QuizCompletion({ onContinue, dnaResult }: QuizCompletionProps) {
  const navigate = useNavigate();
  const [showConfetti, setShowConfetti] = useState(true);
  const [bonusGranted, setBonusGranted] = useState(false);
  const { claimBonus, hasClaimedBonus } = useBonusCredits();
  
  const hasDNA = !!dnaResult?.primary_archetype_name;

  useEffect(() => {
    const timer = setTimeout(() => setShowConfetti(false), 4000);
    return () => clearTimeout(timer);
  }, []);

  // Grant quiz completion bonus
  useEffect(() => {
    const grantQuizBonus = async () => {
      if (hasClaimedBonus('quiz_completion')) return;
      
      try {
        const result = await claimBonus('quiz_completion');
        if (result.granted) {
          setBonusGranted(true);
          toast.success(`+${BONUS_INFO.quiz_completion.credits} credits earned!`, {
            description: BONUS_INFO.quiz_completion.description,
            icon: '🧬',
          });
        }
      } catch (error) {
        console.error('[QuizCompletion] Error granting bonus:', error);
      }
    };
    
    grantQuizBonus();
  }, [claimBonus, hasClaimedBonus]);

  const handleContinue = () => {
    if (onContinue) {
      onContinue();
    } else {
      navigate(ROUTES.PROFILE.VIEW);
    }
  };

  const confettiParticles = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    delay: Math.random() * 0.5,
    x: (Math.random() - 0.5) * 400,
  }));

  return (
    <div className="min-h-[60vh] flex items-center justify-center relative overflow-hidden py-8">
      {/* Confetti */}
      <AnimatePresence>
        {showConfetti && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {confettiParticles.map((particle) => (
              <ConfettiParticle 
                key={particle.id} 
                delay={particle.delay} 
                x={particle.x}
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ 
          duration: 0.6,
          type: 'spring',
          stiffness: 200,
          damping: 20 
        }}
        className="text-center max-w-lg px-4"
      >
        {/* Success icon with glow */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
          className="relative mx-auto mb-6"
        >
          <div className="absolute inset-0 bg-accent/20 rounded-full blur-2xl scale-150" />
          <div className="relative w-20 h-20 bg-gradient-to-br from-accent to-gold rounded-full flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4, type: 'spring' }}
            >
              <CheckCircle2 className="w-10 h-10 text-white" />
            </motion.div>
          </div>
          
          {/* Floating icons */}
          <motion.div
            animate={{ y: [-5, 5, -5], rotate: [-5, 5, -5] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -top-2 -right-2"
          >
            <Sparkles className="w-7 h-7 text-gold" />
          </motion.div>
        </motion.div>

        {/* Text content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h1 className="text-2xl md:text-3xl font-serif font-bold text-foreground mb-2">
            Got it. We won't forget.
          </h1>
          <p className="text-base text-muted-foreground mb-4">
            Your Travel DNA is saved. Every trip starts here now.
          </p>
          
          {/* Bonus earned notification */}
          {bonusGranted && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="mb-4 p-4 rounded-xl bg-accent/10 border border-accent/20"
            >
              <div className="flex items-center justify-center gap-2 mb-1">
                <Gift className="w-5 h-5 text-accent" />
                <span className="text-lg font-bold text-accent">
                  +{BONUS_INFO.quiz_completion.credits} credits earned!
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Congratulations! You've unlocked {BONUS_INFO.quiz_completion.credits} bonus credits for completing your Travel DNA quiz.
              </p>
            </motion.div>
          )}
        </motion.div>

        {/* DNA Reveal Card */}
        {hasDNA && <DNARevealCard dnaResult={dnaResult!} />}

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: hasDNA ? 1.8 : 0.5 }}
          className="space-y-3 mt-8"
        >
          <Button 
            onClick={handleContinue}
            size="lg"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium gap-2"
          >
            View Full DNA Profile
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost"
            onClick={() => navigate(ROUTES.START)}
            className="w-full text-muted-foreground hover:text-foreground"
          >
            Plan a Trip Now
          </Button>
          
          {/* Retake link */}
          <p className="text-xs text-muted-foreground/70 mt-4">
            Preferences change.{' '}
            <button 
              onClick={() => window.location.href = '/quiz?retake=true'}
              className="underline hover:text-muted-foreground transition-colors"
            >
              Retake anytime →
            </button>
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
